import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseArgs } from '../cli/args.mjs';
import * as retention from '../retention/runs.mjs';
const entry=fileURLToPath(new URL('../run.mjs',import.meta.url));
const now=Date.parse('2026-10-17T12:00:00Z');
function fixture(t){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'eval-retention-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function saved(root,{day='2026-08-01',round='baseline',outcome='passed',mutate=()=>{}}={}){
  const name=`${day}T12-00-00-000Z-${round}-abcdef`,directory=path.join(root,name);
  fs.mkdirSync(directory);
  const summary={schemaVersion:1,suite:'task-repair',suiteVersion:3,ok:outcome==='passed',outcome,completedAt:`${day}T12:00:00Z`,results:[{scenarioId:'alpha',cleanup:{ok:true},attempts:[{attempt:1,evaluation:{ok:outcome==='passed'}}]}]};
  const charter={mode:'run',suite:'task-repair',suiteVersion:3,startedAt:`${day}T11:00:00Z`};
  const scenarios=[{id:'alpha',title:'Fixture'}],sourceManifest={runnerFiles:[],promptFiles:[]};mutate({summary,charter,scenarios,sourceManifest});
  for(const [file,value]of Object.entries({'summary.json':summary,'charter.json':charter,'scenario-snapshot.json':scenarios,'source-manifest.json':sourceManifest}))fs.writeFileSync(path.join(directory,file),JSON.stringify(value));
  return directory;
}
const plan=root=>retention.planPrune(retention.inventoryRuns(root),{olderThanDays:30,keep:0,now});

test('retention parser is offline, bounded and preview-first',()=>{
  const options=parseArgs(['prune'],{VALDR_BIN:'absent'});
  assert.equal(options.mode,'prune');assert.equal(options.apply,false);assert.equal(options.olderThanDays,30);assert.equal(options.keep,5);
  assert.equal(parseArgs(['runs']).mode,'runs');
  for(const args of [['runs','--apply'],['prune','--keep','-1'],['prune','--older-than-days','NaN'],['prune','--keep','10001'],['prune','--config','absent'],['prune','--apply','--dry-run'],['prune','unexpected']])assert.throws(()=>parseArgs(args));
});

test('inventory and preview preserve evidence while respecting age and newest keep',t=>{
  const root=fixture(t),old=saved(root),middle=saved(root,{day:'2026-08-02'}),recent=saved(root,{day:'2026-10-16'});
  const inventory=retention.inventoryRuns(root);assert.equal(inventory.runs.length,3);
  const result=retention.planPrune(inventory,{olderThanDays:30,keep:1,now});
  assert.equal(result.dryRun,true);assert.deepEqual(result.selected.map(item=>item.directory).sort(),[old,middle].sort());
  for(const file of [old,middle,recent])assert.ok(fs.existsSync(file));
  const applied=retention.applyPrune(result);assert.equal(applied.deleted.length,2);assert.ok(fs.existsSync(recent));assert.equal(fs.existsSync(old),false);
});

test('failed results require opt-in and active, cancelled, partial or failed-cleanup runs are always protected',t=>{
  const root=fixture(t);saved(root,{round:'failure',outcome:'candidate_failed'});
  const active=saved(root,{round:'active'});fs.writeFileSync(path.join(active,'.active'),'receipt');
  saved(root,{round:'cancelled',outcome:'cancelled'});
  saved(root,{round:'partial',mutate:({summary})=>delete summary.completedAt});
  saved(root,{round:'cleanup',mutate:({summary})=>summary.results[0].cleanup.ok=false});
  saved(root,{round:'unfinished',mutate:({summary})=>summary.results[0].attempts.push({attempt:2})});
  assert.equal(plan(root).selected.length,0);
  const opted=retention.planPrune(retention.inventoryRuns(root),{olderThanDays:30,keep:0,includeFailed:true,now});
  assert.equal(opted.selected.length,1);assert.match(opted.selected[0].name,/-failure-/);
  assert.ok(opted.protected.every(item=>item.reason));
});

test('unknown or malformed evidence, linked roots, child directories and receipts cannot be pruned',t=>{
  const root=fixture(t),outside=fixture(t);fs.writeFileSync(path.join(outside,'preserve'),'keep');
  fs.mkdirSync(path.join(root,'unrelated'));fs.symlinkSync(outside,path.join(root,'linked'));
  const malformed=saved(root,{round:'malformed'});fs.writeFileSync(path.join(malformed,'summary.json'),'{bad');
  const linked=saved(root,{round:'linked-receipt'});fs.unlinkSync(path.join(linked,'charter.json'));fs.symlinkSync(path.join(malformed,'charter.json'),path.join(linked,'charter.json'));
  assert.equal(plan(root).selected.length,0);assert.equal(fs.readFileSync(path.join(outside,'preserve'),'utf8'),'keep');
  const alias=path.join(root,'alias');fs.symlinkSync(outside,alias);assert.throws(()=>retention.inventoryRuns(alias),/link/i);
});

for(const receipt of ['summary.json','charter.json','scenario-snapshot.json','source-manifest.json'])test(`missing ${receipt} protects an otherwise complete run from pruning`,t=>{
  const root=fixture(t),directory=saved(root);
  fs.unlinkSync(path.join(directory,receipt));
  const preview=plan(root);
  assert.equal(preview.selected.length,0);
  assert.equal(preview.protected.length,1);
  assert.match(preview.protected[0].reason,new RegExp(receipt.replaceAll('.','\\.')));
  assert.equal(retention.applyPrune(preview).deleted.length,0);
  assert.ok(fs.existsSync(directory));
});

for(const mode of ['run','check','replay'])for(const receipt of ['summary.json','charter.json','scenario-snapshot.json','source-manifest.json'])test(`null ${receipt} protects a completed ${mode} from pruning`,t=>{
  const root=fixture(t),directory=saved(root,{mutate:({summary,charter})=>{charter.mode=mode;summary.cleanup={ok:true};}});
  assert.equal(plan(root).selected.length,1);
  fs.writeFileSync(path.join(directory,receipt),'null');
  const preview=plan(root);
  assert.equal(preview.selected.length,0);
  assert.equal(preview.protected.length,1);
  assert.ok(preview.protected[0].reason);
  assert.equal(retention.applyPrune(preview).deleted.length,0);
  assert.ok(fs.existsSync(directory));
});

test('apply rejects changed receipts, replaced directories or newly active runs before deleting anything',t=>{
  for(const mutate of [
    directory=>fs.appendFileSync(path.join(directory,'summary.json'),' '),
    directory=>fs.writeFileSync(path.join(directory,'.active'),'active'),
    directory=>{fs.renameSync(directory,directory+'-saved');fs.mkdirSync(directory);},
  ]){
    const root=fixture(t),directory=saved(root),preview=plan(root);assert.equal(preview.selected.length,1);mutate(directory);
    assert.throws(()=>retention.applyPrune(preview),/changed|active|replaced|receipt/i);
    assert.ok(fs.existsSync(directory));
  }
});

test('exclusive active marker protects a run until its owner releases it',t=>{
  const root=fixture(t),directory=saved(root);const release=retention.markActive(directory);
  assert.equal(plan(root).selected.length,0);assert.throws(()=>retention.markActive(directory),/exist/i);
  release();release();assert.equal(plan(root).selected.length,1);
});

test('retention CLI previews and applies only disposable roots without binary or authentication access',t=>{
  const root=fixture(t),directory=saved(root);
  const run=args=>spawnSync(process.execPath,[entry,...args,'--evidence-root',root,'--json'],{cwd:os.tmpdir(),env:{PATH:'/absent',CODEX_HOME:'/absent',VALDR_BIN:'/absent'},encoding:'utf8'});
  const listed=run(['runs']);assert.equal(listed.status,0,listed.stdout+listed.stderr);assert.equal(JSON.parse(listed.stdout).runs.length,1);
  const preview=run(['prune','--keep','0']);assert.equal(preview.status,0,preview.stdout);assert.equal(JSON.parse(preview.stdout).dryRun,true);assert.ok(fs.existsSync(directory));
  const applied=run(['prune','--keep','0','--apply']);assert.equal(applied.status,0,applied.stdout);assert.equal(JSON.parse(applied.stdout).deleted.length,1);assert.equal(fs.existsSync(directory),false);
});


test('malformed completion timestamps never displace usable history from newest keep',t=>{
  for(const keep of [1,5]){
    const root=fixture(t);
    for(let index=1;index<=keep;index++)saved(root,{day:`2026-01-0${index}`});
    saved(root,{day:'2026-02-01',mutate:({summary})=>summary.completedAt='bad-date'});
    const preview=retention.planPrune(retention.inventoryRuns(root),{olderThanDays:30,keep,now});
    assert.equal(preview.selected.length,0);
    assert.equal(preview.protected.length,keep+1);
  }
});
