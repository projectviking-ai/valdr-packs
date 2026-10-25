import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runEvaluation, snapshotSource } from '../run.mjs';
import { parseArgs } from '../cli/args.mjs';

test('selects a task suite and public agent source independently of the execution profile', () => {
  const options = parseArgs(['run', 'task-repair', '--agent', 'custom/agent.yaml', '--tier', 'vanguard'], {});
  assert.equal(options.suite, 'task-repair');
  assert.equal(options.agentPath, 'custom/agent.yaml');
  assert.equal(options.tier, 'vanguard');
  assert.equal(options.profileName, 'sol-high');
  assert.equal(options.profile.model, 'gpt-6.1-sol');
  assert.equal(options.profile.reasoningEffort, 'high');
  assert.equal(options.mode, 'run');
});

test('rejects unsupported suites, unsafe source paths, incompatible replay and unbounded runs', () => {
  for (const args of [['run','unknown'], ['run','--agent','../private/agent.yaml'], ['run','--agent','/private/agent.yaml'],
    ['run','--tier','custom'], ['run','--profile','unknown'], ['run','--max-repairs','-1'], ['run','--max-repairs','3'],
    ['run','--timeout-ms','0'], ['run','--timeout-ms','NaN'], ['run','--scenaro','all'], ['run','--source-root','../other-checkout'],
    ['replay','task-repair','--bundle','receipt.json','--scenario','01_exact_replacement']]) assert.throws(() => parseArgs(args));
});

test('selects an explicit binary before the environment default', () => {
  assert.equal(parseArgs(['doctor'], {}).valdrBin, 'valdr');
  assert.equal(parseArgs(['doctor'], { VALDR_BIN: 'valdr-custom' }).valdrBin, 'valdr-custom');
  assert.equal(parseArgs(['doctor', '--valdr-bin', './bin/valdr'], { VALDR_BIN: 'ignored' }).valdrBin, './bin/valdr');
});

test('lists both suites without binary, provider credentials, or additional checkout', async () => {
  for (const [suite, count] of [['workflow-authoring',11],['task-repair',9]]) {
    const listed = await runEvaluation(parseArgs(['list',suite,'--valdr-bin','absent','--packs-root','absent']));
    assert.equal(listed.length, count);
    assert.equal(new Set(listed.map(s => s.id)).size, count);
  }
});

test('source snapshots retain runner/suite hashes and exclude dotenv credentials', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-source-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'valdr-packs', 'custom'), { recursive: true });
  fs.writeFileSync(path.join(root, '.env'), 'PRIVATE_CREDENTIAL=do-not-copy');
  fs.writeFileSync(path.join(root, 'valdr-packs/custom/.env.local'), 'PRIVATE_CREDENTIAL=do-not-copy');
  fs.writeFileSync(path.join(root, 'valdr-packs/custom/agent.yaml'), 'public agent source');
  const directory = path.join(root, 'evidence');
  fs.mkdirSync(directory);
  const snapshot = snapshotSource({ packsRoot: root }, directory, { version: 'fake' });
  assert.ok(fs.existsSync(path.join(snapshot,'valdr-packs/custom/agent.yaml')));
  assert.equal(fs.existsSync(path.join(snapshot,'valdr-packs/custom/.env.local')), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory,'source-manifest.json')));
  assert.ok(manifest.runnerFiles.some(f => f.path === 'core/runner.mjs'));
  assert.ok(manifest.runnerFiles.some(f => f.path === 'suites/workflow-authoring/evaluate.mjs'));
  assert.equal(JSON.stringify(manifest).includes('do-not-copy'), false);
});

test('source snapshots exclude the default license and links exposing it', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-license-snapshot-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, 'valdr-packs');
  const source = path.join(sourceRoot, 'local-license', 'evaluation.lic');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, 'fixture-license-secret');
  fs.writeFileSync(path.join(sourceRoot, 'agent.yaml'), 'public agent source');
  fs.symlinkSync(source, path.join(sourceRoot, 'license-alias'));
  fs.symlinkSync(path.dirname(source), path.join(sourceRoot, 'license-directory'));
  fs.symlinkSync(path.join(sourceRoot, 'agent.yaml'), path.join(sourceRoot, 'public-alias'));
  const userHome = path.join(root, 'user');
  const defaultLicense = path.join(userHome, '.valdr', 'valdr.lic');
  fs.mkdirSync(path.dirname(defaultLicense), { recursive: true });
  fs.symlinkSync(source, defaultLicense);
  t.mock.method(os, 'homedir', () => userHome);
  const before = fs.statSync(source);
  const directory = path.join(root, 'evidence');
  const snapshot = snapshotSource({ packsRoot: root }, directory, { version: 'fake' });
  for (const relative of ['local-license/evaluation.lic', 'license-alias', 'license-directory']) {
    assert.equal(fs.existsSync(path.join(snapshot, 'valdr-packs', relative)), false, `${relative} must not expose the default license`);
  }
  assert.equal(fs.readFileSync(path.join(snapshot, 'valdr-packs', 'agent.yaml'), 'utf8'), 'public agent source');
  assert.equal(fs.readFileSync(path.join(snapshot, 'valdr-packs', 'public-alias'), 'utf8'), 'public agent source');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'source-manifest.json')));
  assert.ok(manifest.promptFiles.some(file => file.path === 'agent.yaml'));
  assert.equal(manifest.promptFiles.some(file => file.path.endsWith('evaluation.lic')), false);
  assert.equal(fs.readFileSync(source, 'utf8'), 'fixture-license-secret');
  assert.equal(fs.statSync(source).ino, before.ino);
  assert.equal(fs.statSync(source).mtimeMs, before.mtimeMs);
});

test('CLI lists workflow scenarios as JSON from another directory', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const result = spawnSync(process.execPath, [path.join(repo, 'evals/run.mjs'), 'list', 'workflow-authoring', '--json', '--valdr-bin', 'does-not-exist'], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).length, 11);
});
