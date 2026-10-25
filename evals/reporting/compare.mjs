import { buildReport, formatDuration } from './report.mjs';
import { isRecord } from './evidence.mjs';
import { sourceRequirements } from '../suites/registry.mjs';

const canonical = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])]));
  return value;
}
function sourceHashes(evidence, fixtures = false) {
  const requirements = sourceRequirements(evidence.summary.suite);
  if (!requirements) return null;
  const records = fixtures ? evidence.sourceManifest?.promptFiles : evidence.sourceManifest?.runnerFiles;
  if (!Array.isArray(records)) return null;
  const seen = new Set();
  for (const entry of records) {
    if (!isRecord(entry) || typeof entry.path!=='string' || typeof entry.sha256!=='string' || !/^[a-f0-9]{64}$/i.test(entry.sha256) || seen.has(entry.path)) return null;
    seen.add(entry.path);
  }
  const required = fixtures ? requirements.promptFiles : requirements.runnerFiles;
  const entries = records.filter(item=>fixtures ? required.length>0 && item.path.endsWith('.workflow.yaml')
    : item.path==='run.mjs' || item.path==='suites/registry.mjs' || item.path.startsWith('core/') || item.path.startsWith(`suites/${evidence.summary.suite}/`));
  if (required.some(file=>!seen.has(file))) return null;
  return Object.fromEntries(entries.sort((a,b)=>a.path.localeCompare(b.path)).map(item=>[item.path,item.sha256.toLowerCase()]));
}
function caseChange(before, after) {
  if (!before || !after || [before.firstPassed,after.firstPassed,before.eventualPassed,after.eventualPassed].some(value=>value===null)) return 'unevaluated';
  const shifts=[Number(after.firstPassed)-Number(before.firstPassed),Number(after.eventualPassed)-Number(before.eventualPassed)];
  return shifts.some(value=>value>0) ? shifts.some(value=>value<0) ? 'mixed' : 'improved' : shifts.some(value=>value<0) ? 'regressed' : 'unchanged';
}
export function compareEvidence(baselineEvidence, candidateEvidence) {
  const baseline = buildReport(baselineEvidence), candidate = buildReport(candidateEvidence);
  const mismatches = [];
  const match = (field,before,after,valid=value=>value!==undefined && value!==null) => {
    if (!valid(before) || !valid(after)) mismatches.push({ field,reason:'Required provenance is missing or invalid.' });
    else if (canonical(before)!==canonical(after)) mismatches.push({ field,reason:'Baseline and candidate differ.' });
  };
  for (const [label,evidence] of [['baseline',baselineEvidence],['candidate',candidateEvidence]]) {
    if (evidence.charter?.mode!=='run') mismatches.push({field:`${label}.mode`,reason:'Only agent evaluation runs establish comparable performance.'});
    if (evidence.charter?.suite!==evidence.summary.suite || evidence.charter?.suiteVersion!==evidence.summary.suiteVersion) mismatches.push({field:`${label}.suite`,reason:'Summary and charter suite identity/version must agree.'});
    if (evidence.scenarios && canonical(evidence.scenarios.map(item=>item.id).sort())!==canonical((evidence.summary.results??[]).map(item=>item.scenarioId).sort())) {
      // Missing cases are incomplete runs; extra results indicate inconsistent selection evidence.
      if ((evidence.summary.results??[]).some(item=>!evidence.scenarios.some(scenario=>scenario.id===item.scenarioId))) mismatches.push({field:`${label}.selection`,reason:'Recorded results include a case outside the frozen selection.'});
    }
  }
  match('suite',baseline.suite,candidate.suite,value=>typeof value==='string' && Boolean(value));
  match('suiteVersion',baseline.suiteVersion,candidate.suiteVersion);
  match('scenario definitions',baselineEvidence.scenarios?.slice().sort((a,b)=>a.id.localeCompare(b.id)),candidateEvidence.scenarios?.slice().sort((a,b)=>a.id.localeCompare(b.id)),value=>Array.isArray(value)&&value.length>0);
  for (const key of ['providerType','model','reasoningEffort','sandboxMode','approvalPolicy']) match(`profile.${key}`,baselineEvidence.charter?.profile?.[key],candidateEvidence.charter?.profile?.[key],value=>typeof value==='string' && Boolean(value.trim()));
  match('tier',baselineEvidence.charter?.tier,candidateEvidence.charter?.tier,value=>['raider','vanguard','sovereign'].includes(value));
  match('maxRepairs',baselineEvidence.charter?.maxRepairs,candidateEvidence.charter?.maxRepairs,value=>Number.isSafeInteger(value)&&value>=0&&value<=2);
  match('timeoutMs',baselineEvidence.charter?.timeoutMs,candidateEvidence.charter?.timeoutMs,value=>Number.isSafeInteger(value)&&value>=1000&&value<=1200000);
  match('binary.sha256',baselineEvidence.charter?.binary?.sha256,candidateEvidence.charter?.binary?.sha256,value=>typeof value==='string' && /^[a-f0-9]{64}$/i.test(value));
  for (const key of ['platform','arch']) match(`binary.${key}`,baselineEvidence.charter?.binary?.[key],candidateEvidence.charter?.binary?.[key],value=>typeof value==='string' && Boolean(value));
  match('authorBinary.sha256',baselineEvidence.charter?.authorBinary?.sha256,candidateEvidence.charter?.authorBinary?.sha256,value=>typeof value==='string' && /^[a-f0-9]{64}$/i.test(value));
  for (const key of ['version','platform','arch']) match(`authorBinary.${key}`,baselineEvidence.charter?.authorBinary?.[key],candidateEvidence.charter?.authorBinary?.[key],value=>typeof value==='string' && Boolean(value.trim()));
  match('runtime and suite source hashes',sourceHashes(baselineEvidence),sourceHashes(candidateEvidence));
  match('workflow fixture hashes',sourceHashes(baselineEvidence,true),sourceHashes(candidateEvidence,true));
  const comparable=mismatches.length===0;
  const complete=comparable && baseline.complete && candidate.complete;
  const changes=comparable ? baseline.cases.map(before=>{
    const after=candidate.cases.find(item=>item.id===before.id);
    return {id:before.id,title:before.title,change:caseChange(before,after),baseline:{firstPassed:before.firstPassed,eventualPassed:before.eventualPassed,outcome:before.outcome},
      candidate:{firstPassed:after?.firstPassed??null,eventualPassed:after?.eventualPassed??null,outcome:after?.outcome??'not_started'}};
  }) : [];
  const deltas=complete ? {firstCandidatePassed:candidate.metrics.firstCandidatePassed-baseline.metrics.firstCandidatePassed,eventuallyPassed:candidate.metrics.eventuallyPassed-baseline.metrics.eventuallyPassed,
    repairsUsed:candidate.metrics.repairsUsed-baseline.metrics.repairsUsed,durationMs:baseline.durationMs!==null && candidate.durationMs!==null ? candidate.durationMs-baseline.durationMs : null} : null;
  const improved=changes.some(item=>['improved','mixed'].includes(item.change)), regressed=changes.some(item=>['regressed','mixed'].includes(item.change));
  const assessment=!comparable ? 'incompatible' : !complete ? 'incomplete' : improved ? regressed ? 'mixed' : 'improved' : regressed ? 'regressed' : 'unchanged';
  return {schemaVersion:1,ok:complete,comparable,complete,assessment,mismatches,baseline,candidate,changes,deltas,
    note:'One run per candidate is diagnostic evidence, not a statistical reliability estimate.'};
}
export function renderTextComparison(comparison) {
  const lines=[`Comparison: ${comparison.assessment}`,`Baseline: ${comparison.baseline.directory}`,`Candidate: ${comparison.candidate.directory}`];
  for (const mismatch of comparison.mismatches) lines.push(`  Cannot compare ${mismatch.field}: ${mismatch.reason}`);
  if (comparison.comparable) {
    if (!comparison.complete) lines.push('Incomplete evidence: no improvement or regression claim can be made.');
    for (const [label,report] of [['Baseline',comparison.baseline],['Candidate',comparison.candidate]]) if(report.metrics) lines.push(`${label}: first ${report.metrics.firstCandidatePassed}/${report.metrics.firstEvaluated}; eventual ${report.metrics.eventuallyPassed}/${report.metrics.eventualEvaluated}; repairs ${report.metrics.repairsUsed}; author duration ${formatDuration(report.durationMs)}`);
    for (const item of comparison.changes) lines.push(`  ${item.id}: ${item.change}`);
  }
  lines.push(comparison.note);
  return lines.join('\n');
}
