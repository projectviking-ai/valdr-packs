import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { snapshotSource } from '../run.mjs';
import { compareEvidence } from '../reporting/compare.mjs';
import { evidenceFixture } from './reporting/fixtures.mjs';
import * as registry from '../suites/registry.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));

test('suite registry preserves suite versions and frozen scenario contracts',async()=>{
  assert.deepEqual(registry.suiteNames,['workflow-authoring','task-repair']);
  for(const [id,version,hash] of [
    ['task-repair',5,'cd77976e5a53389aa9cb6d0af8db28fb118ff4eb72d2699077887008ac08c002'],
    ['workflow-authoring',11,'cec74a63c7a845a485bd97cfc72daa56a4f6dee52cebfde81382d5a5c942c50c'],
  ]){
    const suite=await registry.getSuite(id);
    assert.equal(suite.version,version);
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(suite.scenarios)).digest('hex'),hash);
  }
  await assert.rejects(()=>registry.getSuite('../outside'),/Unknown suite/);
});

test('real source snapshot includes every registered evaluator dependency',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'eval-registry-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  snapshotSource({packsRoot:repo},directory,{version:'fixture'});
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'source-manifest.json')));
  for(const id of registry.suiteNames){
    const requirements=registry.sourceRequirements(id);
    const suiteFiles=fs.readdirSync(path.join(repo,'evals/suites',id)).filter(file=>file.endsWith('.mjs')).map(file=>`suites/${id}/${file}`);
    for(const file of [...suiteFiles,'run.mjs','suites/registry.mjs'])assert.ok(requirements.runnerFiles.includes(file),file);
    for(const file of requirements.runnerFiles)assert.ok(manifest.runnerFiles.some(item=>item.path===file),file);
    for(const file of requirements.promptFiles)assert.ok(manifest.promptFiles.some(item=>item.path===file),file);
  }
  assert.equal(registry.sourceRequirements('unknown'),null);
});

test('missing split evaluator receipts cannot establish task repair compatibility',t=>{
  const baseline=evidenceFixture(t),candidate=evidenceFixture(t);
  assert.equal(compareEvidence(baseline,candidate).ok,true);
  for(const file of ['scenarios','state','fixtures','policy','evaluate']){
    const evidence=evidenceFixture(t,e=>{e.sourceManifest.runnerFiles=e.sourceManifest.runnerFiles.filter(item=>item.path!==`suites/task-repair/${file}.mjs`);});
    assert.equal(compareEvidence(evidence,evidence).comparable,false,file);
  }
  const missingAuthor=evidenceFixture(t,e=>{e.sourceManifest.runnerFiles=e.sourceManifest.runnerFiles.filter(item=>item.path!=='core/author.mjs');});
  assert.equal(compareEvidence(missingAuthor,missingAuthor).comparable,false,'author launcher receipt');
});
