import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceFixture } from './fixtures.mjs';
import * as comparison from '../../reporting/compare.mjs';

test('compatible runs expose case improvements without treating prompt changes as evaluator changes',t=>{
  const baseline=evidenceFixture(t);
  const candidate=evidenceFixture(t,e=>{
    e.charter.agentPath='different/agent.agent.yaml';e.charter.profile.key='equivalent-alias';e.charter.round='candidate';
    e.sourceManifest.promptFiles[0].sha256='2'.repeat(64);
    e.sourceManifest.runnerFiles.at(-1).sha256='3'.repeat(64);
    e.scenarios.reverse();e.summary.results.reverse();
    e.summary.results[0].attempts=[{attempt:1,author:{durationMs:50},evaluation:{ok:true}}];
  });
  const result=comparison.compareEvidence(baseline,candidate);
  assert.equal(result.ok,true);
  assert.equal(result.comparable,true);
  assert.equal(result.assessment,'improved');
  assert.equal(result.deltas.firstCandidatePassed,1);
  assert.equal(result.deltas.repairsUsed,-1);
  assert.equal(result.changes.find(item=>item.id==='beta').change,'improved');
  assert.match(comparison.renderTextComparison(result),/diagnostic/i);
});

test('task repair comparisons ignore unrelated workflow source changes',t=>{
  const baseline=evidenceFixture(t);
  for(const mutate of [
    e=>{e.sourceManifest.promptFiles[1].sha256='7'.repeat(64);},
    e=>{e.sourceManifest.promptFiles=e.sourceManifest.promptFiles.filter(item=>!item.path.endsWith('.workflow.yaml'));},
    e=>{e.sourceManifest.promptFiles.push({path:'example/another.workflow.yaml',sha256:'8'.repeat(64)});},
  ]){
    const result=comparison.compareEvidence(baseline,evidenceFixture(t,mutate));
    assert.equal(result.ok,true);
    assert.equal(result.assessment,'unchanged');
    assert.deepEqual(result.mismatches,[]);
  }
});

const mutations=[
  ['suite',e=>{e.summary.suite=e.charter.suite='workflow-authoring';}],
  ['suiteVersion',e=>{e.summary.suiteVersion=e.charter.suiteVersion=4;}],
  ['scenario definitions',e=>{e.scenarios[0].brief='different fixture';}],
  ['model',e=>{e.charter.profile.model='different-model';}],
  ['reasoningEffort',e=>{e.charter.profile.reasoningEffort='low';}],
  ['providerType',e=>{e.charter.profile.providerType='another-provider';}],
  ['sandboxMode',e=>{e.charter.profile.sandboxMode='different';}],
  ['approvalPolicy',e=>{e.charter.profile.approvalPolicy='different';}],
  ['tier',e=>{e.charter.tier='vanguard';}],
  ['maxRepairs',e=>{e.charter.maxRepairs=0;}],
  ['timeoutMs',e=>{e.charter.timeoutMs=1000;}],
  ['binary',e=>{e.charter.binary.sha256='4'.repeat(64);}],
  ['platform',e=>{e.charter.binary.platform='linux';}],
  ['architecture',e=>{e.charter.binary.arch='x64';}],
  ['core runtime',e=>{e.sourceManifest.runnerFiles[0].sha256='5'.repeat(64);}],
  ['tool argument policy',e=>{e.sourceManifest.runnerFiles.find(item=>item.path==='core/arguments.mjs').sha256='7'.repeat(64);}],
  ['suite code',e=>{e.sourceManifest.runnerFiles.find(item=>item.path.startsWith('suites/')).sha256='6'.repeat(64);}],
];
for(const [name,mutate] of mutations)test(`comparison refuses changed ${name}`,t=>{
  const result=comparison.compareEvidence(evidenceFixture(t),evidenceFixture(t,mutate));
  assert.equal(result.comparable,false);
  assert.equal(result.ok,false);
  assert.equal(result.assessment,'incompatible');
  assert.equal(result.deltas,null);
  assert.ok(result.mismatches.length);
});

test('missing provenance or non-run evidence cannot establish improvement',t=>{
  for(const mutate of [e=>{e.sourceManifest=null;},e=>{e.scenarios=null;},e=>{e.charter=null;},e=>{e.charter.mode='check';},e=>{e.sourceManifest.runnerFiles=[];},e=>{delete e.charter.binary.sha256;}]){
    const result=comparison.compareEvidence(evidenceFixture(t),evidenceFixture(t,mutate));
    assert.equal(result.comparable,false);
    assert.equal(result.assessment,'incompatible');
  }
});

test('compatible cancelled runs show incomplete evidence instead of a regression',t=>{
  const candidate=evidenceFixture(t,e=>{e.summary.outcome='cancelled';e.summary.ok=false;delete e.summary.completedAt;e.summary.results[1]={scenarioId:'beta',title:'Second case',cancelled:true,cleanup:{ok:true},attempts:[]};});
  const result=comparison.compareEvidence(evidenceFixture(t),candidate);
  assert.equal(result.comparable,true);
  assert.equal(result.complete,false);
  assert.equal(result.ok,false);
  assert.equal(result.assessment,'incomplete');
  assert.equal(result.deltas,null);
  assert.equal(result.changes.find(item=>item.id==='beta').change,'unevaluated');
});

test('comparison reports regressions and mixed cases without hiding them in net totals',t=>{
  const baseline=evidenceFixture(t);
  const regressed=evidenceFixture(t,e=>{e.summary.ok=false;e.summary.outcome='candidate_failed';e.summary.results[0].attempts[0].evaluation.ok=false;});
  assert.equal(comparison.compareEvidence(baseline,regressed).assessment,'regressed');
  const mixed=evidenceFixture(t,e=>{e.summary.ok=false;e.summary.outcome='candidate_failed';e.summary.results[0].attempts[0].evaluation.ok=false;e.summary.results[1].attempts=[{attempt:1,author:{durationMs:20},evaluation:{ok:true}}];});
  const result=comparison.compareEvidence(baseline,mixed);
  assert.equal(result.assessment,'mixed');
  assert.equal(result.deltas.firstCandidatePassed,0);
});

test('malformed source records refuse comparison without throwing or silently dropping hashes',t=>{
  for(const mutate of [
    e=>{e.sourceManifest.runnerFiles[0].path=3;},
    e=>{e.sourceManifest.promptFiles=[{path:4,sha256:'a'.repeat(64)}];},
    e=>{e.sourceManifest.runnerFiles.push({...e.sourceManifest.runnerFiles[0]});},
  ]){
    const result=comparison.compareEvidence(evidenceFixture(t),evidenceFixture(t,mutate));
    assert.equal(result.comparable,false);
  }
});

function workflowEvidence(t,mutate=()=>{}) {
  return evidenceFixture(t,e=>{
    e.summary.suite=e.charter.suite='workflow-authoring';
    e.summary.suiteVersion=e.charter.suiteVersion=7;
    e.sourceManifest.runnerFiles=e.sourceManifest.runnerFiles.filter(item=>!item.path.startsWith('suites/task-repair/'));
    for(const name of ['index','business-scenarios','business-score','execution','command-safety','evaluate','fixtures','policy','scenarios'])e.sourceManifest.runnerFiles.push({path:`suites/workflow-authoring/${name}.mjs`,sha256:'a'.repeat(64)});
    for(const name of ['ensure-ready','readiness-review','review-all','code-review'])e.sourceManifest.promptFiles.push({path:`valdr-workflow/workflows/task/valdr-workflow.workflow.task-${name}.workflow.yaml`,sha256:'b'.repeat(64)});
    mutate(e);
  });
}

test('workflow comparison refuses changed required and potential transitive workflow inputs',t=>{
  const baseline=workflowEvidence(t);
  for(const changedPath of ['example/workflow.workflow.yaml',...['ensure-ready','readiness-review','review-all','code-review']
    .map(name=>`valdr-workflow/workflows/task/valdr-workflow.workflow.task-${name}.workflow.yaml`)]){
    const candidate=workflowEvidence(t,e=>{e.sourceManifest.promptFiles.find(item=>item.path===changedPath).sha256='7'.repeat(64);});
    const result=comparison.compareEvidence(baseline,candidate);
    assert.equal(result.ok,false,changedPath);
    assert.equal(result.assessment,'incompatible',changedPath);
    assert.deepEqual(result.mismatches.map(item=>item.field),['workflow fixture hashes']);
  }
});

test('workflow comparison requires every evaluator module and shipped example receipt',t=>{
  assert.equal(comparison.compareEvidence(workflowEvidence(t),workflowEvidence(t)).ok,true);
  for(const mutate of [
    e=>{e.sourceManifest.runnerFiles=e.sourceManifest.runnerFiles.filter(item=>item.path!=='core/arguments.mjs');},
    ...['business-scenarios','business-score','execution','command-safety','evaluate','fixtures','policy','scenarios'].map(name=>e=>{e.sourceManifest.runnerFiles=e.sourceManifest.runnerFiles.filter(item=>item.path!==`suites/workflow-authoring/${name}.mjs`);}),
    e=>{e.sourceManifest.promptFiles=[];},
    ...['ensure-ready','readiness-review','review-all','code-review'].map(name=>e=>{e.sourceManifest.promptFiles=e.sourceManifest.promptFiles.filter(item=>!item.path.endsWith(`task-${name}.workflow.yaml`));}),
  ]){
    const result=comparison.compareEvidence(workflowEvidence(t,mutate),workflowEvidence(t,mutate));
    assert.equal(result.comparable,false);
    assert.equal(result.assessment,'incompatible');
    assert.equal(result.deltas,null);
  }
});

test('unfinished measured runs cannot establish an improvement',t=>{
  const baseline=evidenceFixture(t,e=>{e.summary.ok=false;e.summary.outcome='candidate_failed';e.summary.results[1].attempts=[{attempt:1,evaluation:{ok:false}},{attempt:2}];});
  const result=comparison.compareEvidence(baseline,evidenceFixture(t));
  assert.equal(result.assessment,'incomplete');
  assert.equal(result.deltas,null);
});


test('comparison refuses absent or changed Codex executable provenance', t => {
  const before = evidenceFixture(t)
  for (const mutate of [
    evidence => { delete evidence.charter.authorBinary },
    ...['version', 'sha256', 'platform', 'arch'].flatMap(field => [
      evidence => { delete evidence.charter.authorBinary[field] },
      evidence => { evidence.charter.authorBinary[field] = field === 'sha256' ? 'e'.repeat(64) : 'different' },
    ]),
  ]) {
    const result = comparison.compareEvidence(before, evidenceFixture(t, mutate))
    assert.equal(result.comparable, false)
    assert.equal(result.deltas, null)
    assert.ok(result.mismatches.some(item => item.field.startsWith('authorBinary.')))
  }
})
