import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evidenceFixture } from './fixtures.mjs';
const entry=fileURLToPath(new URL('../../run.mjs',import.meta.url));
const execute=(args,cwd)=>spawnSync(process.execPath,[entry,...args],{cwd,env:{PATH:'/absent',HOME:cwd,CODEX_HOME:path.join(cwd,'no-auth')},encoding:'utf8',timeout:10000});

test('report works offline with readable text or one JSON result and preserves sources',t=>{
  const fixture=evidenceFixture(t);
  const before=fs.readFileSync(path.join(fixture.directory,'summary.json'),'utf8');
  const text=execute(['report',fixture.directory],fixture.directory);
  assert.equal(text.status,0,text.stderr);
  assert.match(text.stdout,/First attempt: 1\/2/);
  const json=execute(['report',path.join(fixture.directory,'summary.json'),'--json'],fixture.directory);
  assert.equal(json.status,0,json.stderr);
  assert.equal(JSON.parse(json.stdout).cases.length,2);
  assert.equal(fs.readFileSync(path.join(fixture.directory,'summary.json'),'utf8'),before);
});

test('standalone HTML escapes embedded evidence and refuses overwrite',t=>{
  const fixture=evidenceFixture(t,e=>{e.summary.results[0].title='<script>alert("bad")</script>';e.charter.agentPath='<img src=x onerror=alert(1)>';});
  const output=path.join(fixture.directory,'report.html');
  const result=execute(['report',fixture.directory,'--format','html','--output',output,'--json'],fixture.directory);
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).outputPath,output);
  const html=fs.readFileSync(output,'utf8');
  assert.match(html,/<!doctype html>/i);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script\b|<img\b[^>]*src="(?!data:image\/svg\+xml;)|<link\b/i);
  assert.doesNotMatch(html,/href="[^"]*\.json(?:[?#][^"]*)?"/);
  assert.match(html,/First fixture/);
  assert.match(html,/<details/);
  const repeated=execute(['report',fixture.directory,'--format','html','--output',output],fixture.directory);
  assert.equal(repeated.status,1);
  assert.match(repeated.stderr,/already exists|overwrite/i);
  assert.equal(fs.readFileSync(output,'utf8'),html);
  assert.equal(execute(['report',fixture.directory,'--format','html','--output',path.join(fixture.directory,'summary.json')],fixture.directory).status,1);
});

test('compare CLI succeeds offline but refuses changed budgets with parseable diagnostics',t=>{
  const baseline=evidenceFixture(t),candidate=evidenceFixture(t);
  const compared=execute(['compare',baseline.directory,candidate.directory,'--json'],baseline.directory);
  assert.equal(compared.status,0,compared.stderr);
  assert.equal(JSON.parse(compared.stdout).assessment,'unchanged');
  candidate.charter.maxRepairs=0;
  fs.writeFileSync(path.join(candidate.directory,'charter.json'),JSON.stringify(candidate.charter));
  const refused=execute(['compare',baseline.directory,candidate.directory,'--json'],baseline.directory);
  assert.equal(refused.status,1);
  const result=JSON.parse(refused.stdout);
  assert.equal(result.comparable,false);
  assert.equal(result.deltas,null);
  assert.ok(result.mismatches.some(item=>item.field==='maxRepairs'));
});

test('offline commands reject irrelevant execution options and unsafe scenario links',t=>{
  const fixture=evidenceFixture(t);
  for(const args of [['report'],['compare',fixture.directory],['report',fixture.directory,'--run'],['report',fixture.directory,'--config','absent.json'],['report',fixture.directory,'--format','html']]){
    const result=execute([...args,'--json'],fixture.directory);
    assert.equal(result.status,1);
    assert.equal(JSON.parse(result.stdout).ok,false);
  }
  fixture.summary.results[0].scenarioId='../escape';
  fs.writeFileSync(path.join(fixture.directory,'summary.json'),JSON.stringify(fixture.summary));
  assert.equal(execute(['report',fixture.directory,'--format','html','--output',path.join(fixture.directory,'bad.html')],fixture.directory).status,1);
  assert.equal(fs.existsSync(path.join(fixture.directory,'bad.html')),false);
});
