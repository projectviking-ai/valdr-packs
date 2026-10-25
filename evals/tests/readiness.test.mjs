import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { closeIntegrationResources } from './integration/cleanup.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const entry=path.join(repo,'evals/tests/integration/task-repair-binary.mjs');

test('task repair integration advertises its synthetic protocol checks without binary or provider setup',()=>{
  const result=spawnSync(process.execPath,[entry,'--help'],{cwd:os.tmpdir(),env:{PATH:'/absent',CODEX_HOME:'/absent'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const help=JSON.parse(result.stdout);
  assert.equal(help.providerCalls,0);assert.match(help.usage,/task-repair-binary/);
  assert.deepEqual(help.checks,['exact persisted repair','unchanged refusal','denied unauthorized update']);
});

test('readiness target keeps pinned validation and installed evaluation binaries separate',()=>{
  const result=spawnSync('make',['-n','check-evals-readiness','VALDR_BIN=/tmp/evaluation-valdr','PACK_VALDR_BIN=/tmp/pinned-valdr'],{cwd:repo,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/ci-validate/);
  assert.match(result.stdout,/validate-valdr-workflow validate-user-workflow-tools.*\/tmp\/pinned-valdr/);
  assert.match(result.stdout,/check-evals test-evals-integration.*\/tmp\/evaluation-valdr/);
  const integration=spawnSync('make',['-n','test-evals-integration','VALDR_BIN=/tmp/evaluation-valdr'],{cwd:repo,encoding:'utf8'});
  assert.equal(integration.status,0,integration.stderr);
  assert.match(integration.stdout,/workflow-binary\.mjs.*\/tmp\/evaluation-valdr/);
  assert.match(integration.stdout,/task-repair-binary\.mjs.*\/tmp\/evaluation-valdr/);
});


test('integration cleanup treats missing or failed authority receipts as failure and still closes everything',async()=>{
  for(const receipt of [{ok:false,errors:['owned child did not stop']},undefined]){
    const closed=[];
    const result=await closeIntegrationResources({
      client:{close:async()=>{closed.push('client');throw new Error('client shutdown failed');}},
      broker:{close:async()=>{closed.push('broker');}},
      environment:{close:async()=>{closed.push('authority');return receipt;}},
    });
    assert.equal(result.ok,false);assert.ok(result.errors.length>=2);
    assert.deepEqual(closed,['client','broker','authority']);
  }
  const verified=await closeIntegrationResources({environment:{close:async()=>({ok:true,authorityClosed:true})}});
  assert.equal(verified.ok,true);assert.equal(verified.authority.authorityClosed,true);
});
