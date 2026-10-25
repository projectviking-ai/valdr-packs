import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { evidenceFixture } from './fixtures.mjs';
import { writeEvidence } from '../../core/evidence.mjs';
import { taskRepairSuite } from '../../suites/task-repair/index.mjs';

import * as reports from '../../reporting/report.mjs';
import * as loader from '../../reporting/evidence.mjs';
import * as html from '../../reporting/html.mjs';

test('saved run report derives scores and attempts without changing evidence', t => {
  const fixture=evidenceFixture(t);
  const before=fs.readFileSync(path.join(fixture.directory,'summary.json'),'utf8');
  const report=reports.buildReport(loader.loadEvidence(fixture.directory));
  assert.equal(report.kind,'run');
  assert.equal(report.complete,true);
  assert.equal(report.metrics.firstCandidatePassed,1);
  assert.equal(report.metrics.eventuallyPassed,2);
  assert.equal(report.metrics.repairsUsed,1);
  assert.equal(report.durationMs,700);
  assert.equal(report.cases[1].attempts[0].diagnostics[0].message,'beta: Expected the approved replacement');
  assert.equal(report.cases[1].firstPassed,false);
  assert.equal(report.cases[1].eventualPassed,true);
  assert.match(reports.renderTextReport(report),/First attempt: 1\/2/);
  assert.equal(fs.readFileSync(path.join(fixture.directory,'summary.json'),'utf8'),before);
});

test('partial and cancelled cases remain unknown rather than failed scores', t => {
  const fixture=evidenceFixture(t,e=>{
    e.summary.completedAt=undefined;e.summary.ok=false;e.summary.outcome='cancelled';
    e.summary.results=[{scenarioId:'alpha',title:'First case',cancelled:true,cleanup:{ok:true},attempts:[{attempt:1,infrastructureError:'Interrupted'}]}];
  });
  const report=reports.buildReport(loader.loadEvidence(path.join(fixture.directory,'summary.json')));
  assert.equal(report.complete,false);
  assert.equal(report.outcome,'cancelled');
  assert.equal(report.cases.length,2);
  assert.equal(report.cases[0].firstPassed,null);
  assert.equal(report.cases[1].outcome,'not_started');
  assert.equal(report.durationMs,null);
  assert.match(reports.renderTextReport(report),/Not recorded/);
});

test('preflight and replay reports never invent measured agent pass rates', t => {
  for(const mode of ['check','replay']){
    const fixture=evidenceFixture(t,e=>{e.charter.mode=mode;delete e.summary.results;});
    const report=reports.buildReport(loader.loadEvidence(fixture.directory));
    assert.equal(report.kind,mode);
    assert.equal(report.metrics,null);
    assert.equal(report.cases.length,0);
    assert.doesNotMatch(reports.renderTextReport(report),/First attempt:/);
  }
});

test('malformed or unsupported saved evidence gives an actionable file error', t => {
  const fixture=evidenceFixture(t);
  fs.writeFileSync(path.join(fixture.directory,'summary.json'),'{broken');
  assert.throws(()=>loader.loadEvidence(fixture.directory),/summary\.json.*JSON/);
  fs.writeFileSync(path.join(fixture.directory,'summary.json'),JSON.stringify({schemaVersion:2}));
  assert.throws(()=>loader.loadEvidence(fixture.directory),/schemaVersion/);
  fs.writeFileSync(path.join(fixture.directory,'summary.json'),JSON.stringify({schemaVersion:1,suite:'task-repair',outcome:'candidate_failed',results:[{scenarioId:'../outside',attempts:[]}]}));
  assert.throws(()=>loader.loadEvidence(fixture.directory),/scenario/i);
});

for(const mode of ['run','check','replay'])test(`${mode} summaries require an explicit outcome`,t=>{
  const fixture=evidenceFixture(t,e=>{e.charter.mode=mode;delete e.summary.outcome;});
  assert.throws(()=>loader.loadEvidence(fixture.directory),/summary\.json.*outcome/);
});

test('intermediate run summaries remain readable without final completion fields',t=>{
  const fixture=evidenceFixture(t,e=>{
    delete e.summary.ok;delete e.summary.suiteVersion;delete e.summary.completedAt;
  });
  const report=reports.buildReport(loader.loadEvidence(fixture.directory));
  assert.equal(report.complete,false);
  assert.equal(report.outcome,'infrastructure_incomplete');
  assert.equal(report.recordedOutcome,'passed');
  assert.equal(report.metrics.eventuallyPassed,2);
});

for(const [field,filename] of [['charter','charter.json'],['scenarios','scenario-snapshot.json'],['sourceManifest','source-manifest.json']])test(`diagnostic reports remain readable without ${filename}`,t=>{
  const fixture=evidenceFixture(t,e=>{delete e[field];});
  const evidence=loader.loadEvidence(fixture.directory);
  const report=reports.buildReport(evidence);
  assert.equal(evidence[field],null);
  assert.equal(report.suite,'task-repair');
  assert.ok(report.artifacts.every(item=>item.label!==filename));
});

test('a real task-repair assertion failure appears once in the saved report',async t=>{
  const fixture=evidenceFixture(t,e=>{
    e.summary.ok=false;e.summary.outcome='candidate_failed';e.summary.results=e.summary.results.slice(0,1);e.scenarios=e.scenarios.slice(0,1);
  });
  const scenario={id:'alpha',expectedOutcome:'needs_human'};
  const context={taskKey:'REPAIR-1',guardTaskKey:'REPAIR-2',initialTask:{key:'REPAIR-1',updatedAt:20},initialGuardTask:{key:'REPAIR-2',updatedAt:10}};
  const repoRoot=path.join(fixture.directory,'repo');fs.mkdirSync(repoRoot);
  const environment={repoRoot,broker:{requests:[]},call:async(tool,args)=>{
    assert.equal(tool,'pm_task');
    if(args.action==='get')return {structuredContent:{task:structuredClone(args.taskKey===context.taskKey?context.initialTask:context.initialGuardTask)}};
    if(args.action==='event_list')return {structuredContent:{events:[]}};
    if(args.action==='comment_list')return {structuredContent:{comments:[]}};
    assert.fail(`Unexpected task action ${args.action}`);
  }};
  const beforeState=await taskRepairSuite.beforeAttempt({environment,context});
  context.initialState=structuredClone(beforeState);context.requestStart=beforeState.requestOffset;
  environment.broker.requests.push({method:'tools/call',params:{name:'pm_task',arguments:{action:'get',taskKey:context.taskKey}},allowed:true,completed:true,isError:false});
  const evaluation=await taskRepairSuite.evaluate({environment,context,scenario,beforeState,outputDir:path.join(fixture.directory,'evaluation'),authored:{finalMessage:JSON.stringify({schemaVersion:'task-repair/v1',taskKey:context.taskKey,taskUpdatedAt:20,outcome:'repaired',summary:'Needs a human decision.'})}});
  fixture.summary.results[0].attempts[0].evaluation=evaluation;
  writeEvidence(path.join(fixture.directory,'summary.json'),fixture.summary);
  const diagnostics=reports.buildReport(loader.loadEvidence(fixture.directory)).cases[0].attempts[0].diagnostics;
  assert.deepEqual(diagnostics,[{message:'alpha: receipt outcome',actual:'repaired',expected:'needs_human'}]);
});

test('reporting uses canonical variant assertions and retains execution, validation and safety diagnostics',t=>{
  const fixture=evidenceFixture(t,e=>{
    e.summary.results[0].attempts[0].evaluation={ok:false,error:'Evaluation stopped',errors:['Execution unavailable'],safety:{safe:false,errors:['Forbidden tool']},validation:[{valid:false,errors:['Invalid workflow']}],variants:[{id:'alpha',ok:false,error:'Runtime disconnected',assertions:[{pass:false,message:'Expected output',actual:'old',expected:'new'},{pass:true,message:'Passed check',actual:1,expected:1}]}]};
  });
  const diagnostics=reports.buildReport(loader.loadEvidence(fixture.directory)).cases[0].attempts[0].diagnostics;
  assert.deepEqual(diagnostics.map(item=>item.message),['Evaluation stopped','Execution unavailable','Forbidden tool','Invalid workflow','alpha: Runtime disconnected','alpha: Expected output']);
});

test('unknown variant fields cannot override canonical assertion results',t=>{
  const fixture=evidenceFixture(t,e=>{
    e.summary.results[0].attempts[0].evaluation={ok:false,variants:[
      {id:'alpha',ok:false,score:{assertions:[{passed:false,name:'Ignored field'}]},assertions:[{pass:true,message:'Canonical pass',passed:false,ok:false,name:'Ignored field'}]},
    ]};
  });
  assert.deepEqual(reports.buildReport(loader.loadEvidence(fixture.directory)).cases[0].attempts[0].diagnostics,[]);
});

test('saved variant assertions require canonical pass and message fields',t=>{
  for(const assertion of [{passed:false,name:'Legacy failure'},{pass:'false',message:'Invalid pass flag'},{pass:false,name:'Missing message'}]){
    const fixture=evidenceFixture(t,e=>{e.summary.results[0].attempts[0].evaluation={ok:false,variants:[{id:'alpha',ok:false,assertions:[assertion]}]};});
    assert.throws(()=>loader.loadEvidence(fixture.directory),/summary\.json.*variant\.assertions/);
  }
});

test('historical safety rejection does not erase permitted repaired success', t => {
  const fixture=evidenceFixture(t,e=>{e.summary.results[1].attempts[0].evaluation.safety={safe:false,errors:['Unsafe original candidate']};});
  const report=reports.buildReport(loader.loadEvidence(fixture.directory));
  assert.equal(report.cases[1].outcome,'passed');
  assert.equal(report.metrics.safetyRejected,1);
});

test('contradictory, extra, or missing-first-attempt evidence cannot form a complete run',t=>{
  for(const mutate of [
    e=>{e.summary.results[0].attempts[0].attempt=2;},
    e=>{e.summary.results.push({scenarioId:'extra',title:'Unexpected case',cleanup:{ok:true},attempts:[{attempt:1,evaluation:{ok:true}}]});},
    e=>{e.summary.outcome='candidate_failed';},
  ]){
    const fixture=evidenceFixture(t,mutate);
    const report=reports.buildReport(loader.loadEvidence(fixture.directory));
    assert.equal(report.complete,false);
    assert.notEqual(report.outcome,'passed');
    assert.ok(report.warnings.length);
  }
});

test('malformed diagnostic containers fail with the source filename',t=>{
  const fixture=evidenceFixture(t,e=>{e.summary.results[1].attempts[0].evaluation.errors={unexpected:'shape'};});
  assert.throws(()=>loader.loadEvidence(fixture.directory),/summary\.json.*errors/);
});

test('unfinished or absent attempts never count as measured eventual failures',t=>{
  for(const attempts of [[],[{attempt:1,evaluation:{ok:false}},{attempt:2}],[{attempt:2,evaluation:{ok:true}}]]){
    const fixture=evidenceFixture(t,e=>{e.summary.ok=false;e.summary.outcome='candidate_failed';e.summary.results[1].attempts=attempts;});
    const report=reports.buildReport(loader.loadEvidence(fixture.directory));
    assert.equal(report.complete,false);
    assert.equal(report.cases[1].outcome,'infrastructure_incomplete');
    assert.equal(report.cases[1].eventualPassed,null);
    assert.equal(report.metrics.eventualEvaluated,1);
  }
});

test('invalid diagnostic members name the saved source instead of crashing rendering',t=>{
  for(const diagnostic of [{validation:[null]},{validation:[{valid:false,errors:[null]}]},{variants:[null]},{variants:[{ok:false,assertions:[null]}]}]){
    const fixture=evidenceFixture(t,e=>Object.assign(e.summary.results[1].attempts[0].evaluation,diagnostic));
    assert.throws(()=>loader.loadEvidence(fixture.directory),/summary\.json.*(validation|variant)/);
  }
});

test('reports retain startup errors and the recorded outcome when evidence disagrees',t=>{
  const fixture=evidenceFixture(t,e=>{e.summary.error='MCP startup failed';e.summary.outcome='candidate_failed';});
  const report=reports.buildReport(loader.loadEvidence(fixture.directory));
  const text=reports.renderTextReport(report);
  assert.match(text,/MCP startup failed/);
  assert.match(text,/Recorded outcome: candidate_failed/);
  assert.match(html.renderHtmlReport(report),/Recorded outcome<\/dt><dd>candidate_failed/);
  assert.match(html.renderHtmlReport(report),/MCP startup failed/);
});
