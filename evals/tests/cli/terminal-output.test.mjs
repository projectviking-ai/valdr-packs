import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evidenceFixture } from '../reporting/fixtures.mjs';
import { configureRuntimeEnvironment } from '../runtime-environment.mjs';

const entry = fileURLToPath(new URL('../../run.mjs', import.meta.url));
const controls = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/;
const hostile = '\x1b[31mVisible\x1b[0m\x1b]52;c;clipboard-payload\x07\x1b]8;;https://example.invalid\x1b\\Link\x1b]8;;\x1b\\\x07\x08\r\x00\x1b[2J\u009b31mC1\u009b0m';
const execute = args => spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 10000 });

for (const json of [false, true]) test(`doctor ${json ? 'JSON' : 'text'} output redacts configured credentials echoed by a runtime failure`, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-terminal-secrets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  configureRuntimeEnvironment(t, { HOME: root });
  const binary = path.join(root, 'valdr');
  fs.writeFileSync(binary, `#!/usr/bin/env node
if(process.argv[2]==='version'){console.log('valdr 99.0.0 fixture');process.exit(0)}
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
 const request=JSON.parse(line);if(request.id===undefined)return;
 const response=request.method==='initialize'?{result:{protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fixture',version:'1'}}}
 :{error:{code:-32000,message:'fixture connection failed using '+process.env.VALDR_DB_USERNAME+' / '+process.env.VALDR_DB_PASSWORD}};
 console.log(JSON.stringify({jsonrpc:'2.0',id:request.id,...response}));
});`, { mode: 0o700 });
  const result = execute(['doctor', 'task-repair', '--valdr-bin', binary,
    '--evidence-root', path.join(root, 'evidence'), ...(json ? ['--json'] : [])]);
  assert.equal(result.status, 1, result.stderr);
  const message = json ? JSON.parse(result.stdout).checks.find(check => check.id === 'fixtures')?.message : result.stdout;
  assert.match(message, /fixture connection failed using eval-fixture-user \/ \[REDACTED\]/);
  assert.doesNotMatch(message, /eval-fixture-password/);
});

test('report output removes terminal commands without changing saved evidence or scores', t => {
  const fixture = evidenceFixture(t, e => { e.charter.agentPath = hostile; e.scenarios[0].title = hostile; });
  const before = fs.readFileSync(path.join(fixture.directory, 'charter.json'), 'utf8');
  const result = execute(['report', fixture.directory]);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, controls);
  assert.doesNotMatch(result.stdout, /clipboard-payload|example\.invalid/);
  assert.match(result.stdout, /VisibleLinkC1/);
  assert.match(result.stdout, /First attempt: 1\/2/);
  assert.match(result.stdout, /Eventual pass: 2\/2/);
  assert.equal(fs.readFileSync(path.join(fixture.directory, 'charter.json'), 'utf8'), before);
});

test('JSON keeps original evidence values encoded while terminal text is sanitized', t => {
  const fixture = evidenceFixture(t, e => { e.charter.agentPath = hostile; });
  const result = execute(['report', fixture.directory, '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).agentPath, hostile);
  assert.doesNotMatch(result.stdout, controls);
  assert.equal(JSON.parse(result.stdout).metrics.eventuallyPassed, 2);
});

test('run preview progress and command errors remove terminal controls', t => {
  const fixture = evidenceFixture(t);
  const config = path.join(fixture.directory, 'config.json');
  fs.writeFileSync(config, JSON.stringify({ schemaVersion: 1, profiles: { custom: { model: hostile, reasoningEffort: 'high' } } }));
  const result = execute(['run', 'task-repair', '--config', config, '--profile', 'custom', '--scenario', '01_exact_replacement', '--valdr-bin', '/absent/valdr']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Live evaluation: task-repair/);
  assert.match(result.stderr, /VisibleLinkC1/);
  assert.doesNotMatch(result.stderr, controls);
  assert.doesNotMatch(result.stderr, /clipboard-payload|example\.invalid/);

  const error = execute([hostile.replaceAll('\x00', '')]);
  assert.equal(error.status, 1);
  assert.match(error.stderr, /Unknown command VisibleLinkC1/);
  assert.doesNotMatch(error.stderr, controls);
});

test('comparison output sanitizes evidence paths and preserves its assessment', t => {
  const fixture = evidenceFixture(t);
  const candidate = path.join(fixture.directory, '\x1b[31mcandidate\x1b[0m');
  fs.mkdirSync(candidate);
  for (const name of ['summary.json', 'charter.json', 'scenario-snapshot.json', 'source-manifest.json']) {
    fs.copyFileSync(path.join(fixture.directory, name), path.join(candidate, name));
  }
  const result = execute(['compare', fixture.directory, candidate]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Comparison: unchanged/);
  assert.match(result.stdout, /candidate/);
  assert.doesNotMatch(result.stdout, controls);
});
