import { evaluationOutcome, summarizeAttempts } from '../core/results.mjs';
import { redactEvidence } from '../core/evidence.mjs';
import { isRecord } from './evidence.mjs';

const incomplete = new Set(['cancelled','infrastructure_incomplete','submission_incomplete','not_started']);
function boundEvidence(value, depth = 0) {
  if (typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
    let parsed;
    try { parsed = JSON.parse(value); } catch { return value; }
    return JSON.stringify(boundEvidence(parsed,depth));
  }
  if (value && typeof value === 'object') {
    if (depth >= 32) return '[Nested evidence omitted: depth limit reached]';
    if (Array.isArray(value)) return value.map(item=>boundEvidence(item,depth+1));
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,boundEvidence(item,depth+1)]));
  }
  return value;
}
const reportEvidence = value => redactEvidence(boundEvidence(value));
const excerpt = value => {
  const safe = reportEvidence(value);
  const text = typeof safe === 'string' ? safe : JSON.stringify(safe);
  return (text ?? 'Not recorded').slice(0,2000);
};
function diagnostics(evaluation, infrastructureError, submissionIncomplete) {
  const items = [];
  const add = (message, actual, expected) => {
    if (items.length < 20) items.push({ message: excerpt(message), ...(actual !== undefined ? { actual: excerpt(actual) } : {}), ...(expected !== undefined ? { expected: excerpt(expected) } : {}) });
  };
  if (infrastructureError) add(infrastructureError);
  if (submissionIncomplete) add(`Submission incomplete: ${submissionIncomplete.reason ?? 'required write unavailable'}`);
  if (evaluation?.error) add(evaluation.error);
  for (const error of evaluation?.errors ?? []) {
    if (typeof error === 'string') add(error);
    else if (isRecord(error)) add(error.message ?? 'Evaluation failed',error.actual,error.expected);
  }
  for (const error of evaluation?.safety?.errors ?? []) add(error);
  for (const validation of evaluation?.validation ?? []) if (validation.valid === false) {
    for (const error of validation.errors ?? []) add(typeof error === 'string' ? error : error.message ?? 'Validation failed');
  }
  for (const variant of evaluation?.variants ?? []) if (!variant.ok) {
    if (variant.error) add(`${variant.id}: ${variant.error}`);
    for (const assertion of variant.assertions ?? []) if (assertion.pass === false) {
      add(`${variant.id}: ${assertion.message}`,assertion.actual,assertion.expected);
    }
  }
  return items;
}
const duration = author => Number.isFinite(author?.durationMs) && author.durationMs >= 0 ? author.durationMs : null;
function buildCase(result, scenario, providerEvents) {
  const definition = reportEvidence(scenario);
  if (!result) return { id: scenario.id, title: scenario.title ?? scenario.id, outcome: 'not_started', firstPassed: null, eventualPassed: null, durationMs: null, cleanup: null, definition, cleanupReceipt: null, evidence: null, attempts: [] };
  const ordered = [...result.attempts].sort((a,b) => a.attempt-b.attempt);
  const measured = ordered.length > 0 && ordered.every((attempt,index) => attempt.attempt === index+1 && typeof attempt.evaluation?.ok === 'boolean');
  let outcome = !result.cleanup ? 'infrastructure_incomplete' : evaluationOutcome([result]);
  if (!measured && !incomplete.has(outcome)) outcome = 'infrastructure_incomplete';
  const attempts = [...result.attempts].sort((a,b) => a.attempt-b.attempt).map(attempt => ({
    number: attempt.attempt,
    outcome: attempt.infrastructureError ? 'infrastructure_incomplete' : attempt.submissionIncomplete ? 'submission_incomplete'
      : attempt.evaluation?.ok ? 'passed' : attempt.evaluation?.safety?.safe === false ? 'policy_rejected'
        : attempt.evaluation ? 'candidate_failed' : result.cancelled ? 'cancelled' : 'infrastructure_incomplete',
    durationMs: duration(attempt.author),
    diagnostics: diagnostics(attempt.evaluation,attempt.infrastructureError,attempt.submissionIncomplete),
    activity: reportEvidence(providerEvents?.[attempt.attempt] ?? null),
    evidence: reportEvidence(attempt),
  }));
  const first = result.attempts.find(attempt => attempt.attempt === 1);
  const firstPassed = first?.infrastructureError || first?.submissionIncomplete ? null : first?.evaluation?.ok ?? null;
  return { id: result.scenarioId, title: excerpt(result.title ?? scenario?.title ?? result.scenarioId), outcome,
    firstPassed, eventualPassed: incomplete.has(outcome) ? null : outcome === 'passed',
    durationMs: attempts.length && attempts.every(attempt => attempt.durationMs !== null) ? attempts.reduce((sum,attempt)=>sum+attempt.durationMs,0) : null,
    cleanup: result.cleanup?.ok ?? null, definition, cleanupReceipt: reportEvidence(result.cleanup ?? null),
    evidence: reportEvidence(Object.fromEntries(Object.entries(result).filter(([key])=>key !== 'attempts' && key !== 'cleanup'))), attempts };
}
export function buildReport(evidence) {
  const { summary, charter, scenarios } = evidence;
  const { results, ...summaryContext } = summary;
  const records = results ?? [];
  const definitions = new Map((scenarios ?? []).map(scenario=>[scenario.id,scenario]));
  for (const record of records) if (!definitions.has(record.scenarioId)) definitions.set(record.scenarioId,{ id:record.scenarioId,title:record.title });
  const kind = ['run','check','replay'].includes(charter?.mode) ? charter.mode : 'unknown';
  const cases = kind === 'check' || kind === 'replay' ? [] : [...definitions.values()].map(scenario=>buildCase(records.find(record=>record.scenarioId===scenario.id),scenario,evidence.providerEvents?.[scenario.id]));
  const warnings = [];
  if (summary.error) warnings.push(`Recorded error: ${excerpt(summary.error)}`);
  if (!charter) warnings.push('Missing charter.json; execution mode and profile are not recorded.');
  if (!scenarios && kind === 'run') warnings.push('Missing scenario snapshot; intended case selection cannot be verified.');
  if (!summary.completedAt && kind === 'run') warnings.push('No completed-run receipt; the saved run may be partial.');
  let complete = kind === 'run' && Boolean(summary.completedAt) && Boolean(scenarios?.length) && cases.length > 0
    && cases.every(item=>!incomplete.has(item.outcome)) && !incomplete.has(summary.outcome);
  if(kind==='run' && cases.some(item=>item.firstPassed===null || item.eventualPassed===null)) {
    complete=false;warnings.push('Some cases have no verified first-attempt or final measurement.');
  }
  if(kind==='run' && scenarios && records.some(record=>!scenarios.some(scenario=>scenario.id===record.scenarioId))) {
    complete=false;warnings.push('Recorded cases differ from the frozen scenario selection.');
  }
  let outcome = kind === 'run' ? evaluationOutcome(records) : summary.outcome;
  if(kind==='run' && ((summary.ok===false && outcome==='passed') || (summary.ok===true && outcome!=='passed')
      || (!incomplete.has(summary.outcome) && summary.outcome!==outcome))) {
    complete=false;warnings.push('Saved summary and case results disagree.');
  }
  if (incomplete.has(summary.outcome)) outcome=summary.outcome;
  if (kind === 'run' && !complete && !incomplete.has(outcome)) outcome='infrastructure_incomplete';

  const metrics = kind === 'run' ? { ...summarizeAttempts(records), scenarios:cases.length,
    firstCandidatePassed:cases.filter(item=>item.firstPassed===true).length, firstEvaluated:cases.filter(item=>item.firstPassed!==null).length,
    eventuallyPassed:cases.filter(item=>item.eventualPassed===true).length, eventualEvaluated:cases.filter(item=>item.eventualPassed!==null).length,
    notStarted:cases.filter(item=>item.outcome==='not_started').length } : null;
  return { schemaVersion:1, kind, directory:evidence.directory, suite:summary.suite, suiteVersion:summary.suiteVersion ?? charter?.suiteVersion ?? null,
    outcome, recordedOutcome:summary.outcome, complete: complete && outcome !== 'infrastructure_incomplete',
    agentPath:charter?.agentPath ?? null, profile:charter?.profile ? Object.fromEntries(['providerType','model','reasoningEffort','sandboxMode','approvalPolicy'].map(key=>[key,charter.profile[key] ?? null])) : null,
    round:charter?.round ?? null, startedAt:charter?.startedAt ?? null, completedAt:summary.completedAt ?? null,
    durationMs:cases.length && cases.every(item=>item.durationMs!==null) ? cases.reduce((sum,item)=>sum+item.durationMs,0) : null,
    metrics, cases, warnings, artifacts:evidence.artifacts??[],
    context: reportEvidence({ charter: charter ?? null, sourceManifest: evidence.sourceManifest ?? null, summary: summaryContext }) };
}
export const formatDuration = value => value === null ? 'Not recorded' : `${(value/1000).toFixed(2)}s`;
export function renderTextReport(report) {
  const lines = [`${report.suite}: ${report.outcome}`,`Evidence type: ${report.kind}${report.kind!=='run' ? ' (not an agent performance score)' : ''}`,
    `Agent: ${report.agentPath ?? 'Not recorded'}`,`Model: ${report.profile?.model ?? 'Not recorded'} (${report.profile?.reasoningEffort ?? 'Not recorded'})`];
  if (report.recordedOutcome && report.recordedOutcome !== report.outcome) lines.push(`Recorded outcome: ${report.recordedOutcome}`);
  if (report.metrics) lines.push(`First attempt: ${report.metrics.firstCandidatePassed}/${report.metrics.firstEvaluated} evaluated; ${report.metrics.scenarios} selected`,
    `Eventual pass: ${report.metrics.eventuallyPassed}/${report.metrics.eventualEvaluated} evaluated; repairs: ${report.metrics.repairsUsed}`,
    `Recorded author duration: ${formatDuration(report.durationMs)}`);
  for (const warning of report.warnings) lines.push(`Note: ${warning}`);
  for (const item of report.cases) {
    lines.push(`\n${item.id} — ${item.title}: ${item.outcome} (${formatDuration(item.durationMs)})`);
    for (const attempt of item.attempts) {
      lines.push(`  Attempt ${attempt.number}: ${attempt.outcome} (${formatDuration(attempt.durationMs)})`);
      for (const diagnostic of attempt.diagnostics) lines.push(`    ${diagnostic.message}${diagnostic.actual !== undefined ? `; actual: ${diagnostic.actual}` : ''}${diagnostic.expected !== undefined ? `; expected: ${diagnostic.expected}` : ''}`);
    }
  }
  lines.push(`\nEvidence: ${report.directory}`);
  return lines.join('\n');
}
