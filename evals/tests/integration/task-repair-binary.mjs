import assert from 'node:assert/strict';
import { closeIntegrationResources } from './cleanup.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIsolatedEnvironment, dataOf } from '../../core/harness.mjs';
import { writeEvidence } from '../../core/evidence.mjs';
import { createAuthorBroker } from '../../core/mcp.mjs';
import { taskRepairSuite as suite } from '../../suites/task-repair/index.mjs';

export const smokeHelp = {
  usage:'bun evals/tests/integration/task-repair-binary.mjs [public-valdr-binary]',
  providerCalls:0,
  checks:['exact persisted repair','unchanged refusal','denied unauthorized update'],
};
async function runCase(valdrBin,evidenceDir,scenario,report) {
  const result={scenarioId:scenario.id,ok:false};report.cases.push(result);
  let environment,broker,context;
  try {
    environment=await createIsolatedEnvironment({valdrBin,evidenceDir,mode:'runtime',label:`task-repair-smoke:${scenario.id}`,requiredTools:suite.requiredTools});
    report.binary=environment.binary;result.root=environment.root;
    broker=await createAuthorBroker(environment.session,{requestAllowed:(method,params)=>context!==undefined && suite.policy(context)(method,params)});
    environment.broker=broker;
    context=await suite.prepare(environment,{scenario});
    const beforeState=await suite.beforeAttempt({environment,context,scenario});
    const request=async args=>{
      const response=await fetch(broker.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${broker.token}`},body:JSON.stringify({method:'tools/call',params:{name:'pm_task',arguments:args}})});
      assert.equal(response.ok,true);const payload=await response.json();
      if (payload.error) throw new Error(payload.error.message);
      return payload.result;
    };
    const read=async()=>{
      const response=await request({action:'get',taskKey:context.taskKey});
      assert.notEqual(response.isError,true,JSON.stringify(response));
      return dataOf(response).task;
    };
    const initial=await read();
    if (scenario.expectedOutcome==='repaired') {
      const metadata=structuredClone(initial.metadata);
      metadata.checklists[0].items[0].label=scenario.edits.labels[0].value;
      for (const checklist of metadata.checklists) for (const item of checklist.items) {
        if (item.checkedBy===null) delete item.checkedBy;
        if (item.checkedAt===null) delete item.checkedAt;
      }
      const response=await request({action:'update',taskKey:context.taskKey,metadata,actorHandle:'@fixture-owner',clientRequestId:await environment.uid()});
      assert.notEqual(response.isError,true,JSON.stringify(response));
    }
    const reloaded=await read();
    const receipt={schemaVersion:'task-repair/v1',taskKey:context.taskKey,taskUpdatedAt:reloaded.updatedAt,outcome:scenario.expectedOutcome,summary:'Synthetic public-protocol integration check; no agent or model turn.'};
    const evaluation=await suite.evaluate({environment,context,scenario,beforeState,authored:{events:[],finalMessage:JSON.stringify(receipt)},outputDir:path.join(evidenceDir,'execution')});
    assert.equal(evaluation.ok,true,JSON.stringify(evaluation.variants));
    result.assertions=evaluation.variants[0].assertions.length;result.outcome=receipt.outcome;
    if (scenario.expectedOutcome==='needs_human') {
      const denied=await request({action:'update',taskKey:context.taskKey,title:'Unauthorized title',actorHandle:'@fixture-owner'});
      assert.equal(denied.isError,true);assert.match(denied.content[0].text,/refused/);
      assert.deepEqual(await read(),initial,'Denied request must not reach the persisted task');
      result.unauthorizedUpdateDenied=true;
    }
    writeEvidence(path.join(evidenceDir,'broker-requests.json'),broker.requests);
    result.ok=true;
  } finally {
    result.cleanup=await closeIntegrationResources({broker,environment});
    result.ok=result.ok && result.cleanup.ok;
    assert.equal(result.cleanup.ok,true,JSON.stringify(result.cleanup));
  }
}
export async function runTaskRepairSmoke(valdrBin) {
  const evidenceDir=fs.mkdtempSync(path.join(os.tmpdir(),'task-repair-binary-'));
  const report={ok:false,evidenceDir,providerCalls:0,synthetic:true,cases:[]};
  try {
    for (const id of ['01_exact_replacement','02_missing_replacement']) {
      const scenario=suite.scenarios.find(item=>item.id===id);
      await runCase(valdrBin,path.join(evidenceDir,id),scenario,report);
    }
    report.ok=true;
  } catch (error) {report.error=error.stack??error.message;}
  writeEvidence(path.join(evidenceDir,'summary.json'),report);
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=process.argv.includes('--help')?smokeHelp:await runTaskRepairSmoke(process.argv[2]);
  console.log(JSON.stringify(report,null,2));
  if (report.ok===false) process.exitCode=1;
}
