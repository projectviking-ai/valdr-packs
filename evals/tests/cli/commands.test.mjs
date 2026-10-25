import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runEvaluation } from '../../run.mjs';
import { parseArgs } from '../../cli/args.mjs';

const entry = fileURLToPath(new URL('../../run.mjs', import.meta.url));
function fixture(t, value) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-config-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'config.json');
  fs.writeFileSync(file, JSON.stringify(value));
  return file;
}

test('subcommands select suites and default to a first-attempt measurement', () => {
  const options = parseArgs(['run', 'task-repair'], {});
  assert.equal(options.mode, 'run');
  assert.equal(options.suite, 'task-repair');
  assert.equal(options.maxRepairs, 0);
  assert.equal(options.evidenceRoot, fileURLToPath(new URL('../../../.valdr-evals', import.meta.url)));
  assert.equal(parseArgs(['doctor', 'task-repair'], {}).mode, 'doctor');
});

test('commands reject mode flags and require an explicit replay command', () => {
  for (const flag of ['--list', '--check', '--run']) {
    assert.throws(() => parseArgs([flag], {}));
    assert.throws(() => parseArgs(['run', flag], {}));
  }
  assert.throws(() => parseArgs(['--bundle', 'bundle.json', '--scenario', '01_routed_release'], {}));
  assert.throws(() => parseArgs(['list', '--bundle', 'bundle.json', '--scenario', '01_routed_release'], {}));
  assert.throws(() => parseArgs(['replay', '--bundle', 'bundle.json'], {}));
  assert.throws(() => parseArgs(['replay', '--bundle', 'bundle.json', '--scenario', '01_routed_release,02_loop_receipts'], {}));
  assert.equal(parseArgs(['replay', '--bundle', 'bundle.json', '--scenario', '01_routed_release'], {}).mode, 'replay');
});

test('no command and explicit help display usage without accessing the runtime', () => {
  for (const args of [[], ['--help']]) {
    const result = spawnSync(process.execPath, [entry, ...args], { cwd: os.tmpdir(), encoding: 'utf8', env: { ...process.env, VALDR_BIN: '/absent/valdr' } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: bun evals\/run.mjs <command>/);
  }
});

test('strict named configuration reaches the selected effective execution profile', t => {
  const file = fixture(t, { schemaVersion: 1, defaults: { suite: 'task-repair', profile: 'fast', timeoutMs: 5000 },
    profiles: { fast: { providerType: 'codex', model: 'test-model', reasoningEffort: 'low' } } });
  const options = parseArgs(['run', '--config', file, '--timeout-ms', '8000'], {});
  assert.equal(options.suite, 'task-repair');
  assert.equal(options.timeoutMs, 8000);
  assert.equal(options.profile.model, 'test-model');
  assert.equal(options.profile.reasoningEffort, 'low');
  assert.equal(options.profile.sandboxMode, 'workspace-write');
  assert.equal(options.profile.approvalPolicy, 'never');
  assert.equal(parseArgs(['run', '--config', file, '--profile', 'sol-high'], {}).profile.model, 'gpt-6.1-sol');
});

test('the selected configuration file supplies the effective run settings', async t => {
  const first = fixture(t, { schemaVersion: 1, defaults: { profile: 'custom', maxRepairs: 2 },
    profiles: { custom: { model: 'first-model', reasoningEffort: 'high' } } });
  const selected = fixture(t, { schemaVersion: 1, defaults: { profile: 'custom', maxRepairs: 0, evidenceRoot: 'receipts' },
    profiles: { custom: { model: 'selected-model', reasoningEffort: 'low' } } });
  const options = parseArgs(['run', 'task-repair', '--config', first, '--config', selected,
    '--scenario', '01_exact_replacement', '--dry-run', '--valdr-bin', '/absent'], {});
  const preview = await runEvaluation(options);
  assert.equal(options.configPath, selected);
  assert.equal(preview.profile.model, 'selected-model');
  assert.equal(preview.profile.reasoningEffort, 'low');
  assert.equal(preview.maximumAuthorTurns, 1);
  assert.equal(options.evidenceRoot, path.join(path.dirname(selected), 'receipts'));
});

test('unsupported license overrides are rejected in flags and configuration', t => {
  const config = fixture(t, { schemaVersion: 1, defaults: { licenseFile: 'licenses/evaluation.lic' } });
  assert.throws(() => parseArgs(['doctor', '--license-file', '~/.valdr/valdr.lic'], {}), /Unknown option --license-file/);
  assert.throws(() => parseArgs(['doctor', '--config', config], {}), /Unsupported defaults field: licenseFile/);
});

test('configuration rejects unknown, secret, unsafe and unsupported settings before running', t => {
  const bad = [
    { schemaVersion: 2 },
    { schemaVersion: 1, apiKey: 'do-not-print' },
    { schemaVersion: 1, defaults: { typo: true } },
    { schemaVersion: 1, profiles: { custom: { providerType: 'claude', model: 'm', reasoningEffort: 'high' } } },
    { schemaVersion: 1, profiles: { custom: { model: 'm', reasoningEffort: 'high', approvalPolicy: 'always' } } },
    { schemaVersion: 1, profiles: { custom: { model: ' ', reasoningEffort: 'high' } } },
    { schemaVersion: 1, profiles: { custom: { model: 'm', reasoningEffort: 'invented' } } },
    { schemaVersion: 1, defaults: { maxRepairs: 9 } },
    ...[false, 0, '', null].map(agentPath => ({ schemaVersion: 1, defaults: { agentPath } })),
  ];
  for (const value of bad) {
    const file = fixture(t, value);
    assert.throws(() => parseArgs(['run', '--config', file], {}));
  }
});

test('offline dry-run previews selected turns without binary or credential access', async () => {
  const options = parseArgs(['run', 'task-repair', '--scenario', '01_exact_replacement,04_exact_description',
    '--max-repairs', '1', '--dry-run', '--valdr-bin', '/absent/valdr'], {});
  const result = await runEvaluation(options);
  assert.equal(result.dryRun, true);
  assert.equal(result.maximumAuthorTurns, 4);
  assert.equal(result.scenarios.length, 2);
  assert.equal(result.profile.model, 'gpt-6.1-sol');
});

test('offline commands give readable output or exactly one JSON document from any directory', () => {
  const human = spawnSync(process.execPath, [entry, 'list', 'task-repair'], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /01_exact_replacement/);
  assert.match(human.stdout, /Apply an exact checklist replacement/);
  assert.doesNotMatch(human.stdout.trimStart(), /^\[/);
  const json = spawnSync(process.execPath, [entry, 'run', 'task-repair', '--dry-run', '--json', '--valdr-bin', '/absent'], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).maximumAuthorTurns, 9);
});

test('all workflow cases are executable and previews remain offline', () => {
  const listed = spawnSync(process.execPath, [entry, 'list', 'workflow-authoring', '--json'], { encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  const scenarios = JSON.parse(listed.stdout);
  assert.equal(scenarios.length, 11);
  assert.ok(scenarios.every(scenario => scenario.evaluationUnavailable === undefined));
  const preview = spawnSync(process.execPath, [entry, 'run', 'workflow-authoring', '--scenario', scenarios[2].id, '--dry-run', '--json', '--valdr-bin', '/absent'], { encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stderr);
  const result = JSON.parse(preview.stdout);
  assert.equal(result.liveAuthoringAvailable, true);
  assert.equal(result.maximumAuthorTurns, 1);
  assert.equal(result.profile.sandboxMode, 'workspace-write');
  const repair = spawnSync(process.execPath, [entry, 'run', 'task-repair', '--dry-run', '--json'], { encoding: 'utf8' });
  assert.equal(JSON.parse(repair.stdout).profile.sandboxMode, 'read-only');
});

test('doctor failure is actionable structured output without a model call', () => {
  const result = spawnSync(process.execPath, [entry, 'doctor', 'task-repair', '--json', '--valdr-bin', '/absent/valdr'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.providerCalls, 0);
  assert.ok(report.checks.some(check => check.id === 'valdr' && !check.ok && check.fix));
});

test('doctor rejects license overrides before creating evidence or invoking Valdr', t => {
  const config = fixture(t, { schemaVersion: 1, defaults: { licenseFile: '~/.valdr/valdr.lic' } });
  const root = path.dirname(config);
  const binary = path.join(root, 'valdr');
  const launched = path.join(root, 'launched');
  fs.writeFileSync(binary, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(launched)},'unexpected execution');process.exit(1);\n`, { mode: 0o700 });
  for (const args of [['--config', config], ['--license-file', '~/.valdr/valdr.lic']]) {
    const result = spawnSync(process.execPath, [entry, 'doctor', 'task-repair', ...args,
      '--valdr-bin', binary, '--evidence-root', path.join(root, 'evidence'), '--json'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(JSON.parse(result.stdout).error, /Unknown option --license-file|Unsupported defaults field: licenseFile/);
    assert.equal(result.stderr, '');
    assert.equal(fs.existsSync(launched), false);
    assert.equal(fs.existsSync(path.join(root, 'evidence')), false);
  }
});

test('fixture readiness does not require Codex or authentication and never claims live authoring', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-doctor-fixtures-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const binary = path.join(root, 'valdr');
  fs.writeFileSync(binary, '#!/bin/sh\necho "valdr 99.0.0 fixture"\n', { mode: 0o700 });
  fs.writeFileSync(path.join(root, 'git'), '#!/bin/sh\necho "git version fixture"\n', { mode: 0o700 });
  const doctor = new URL('../../cli/doctor.mjs', import.meta.url).href;
  const args = new URL('../../cli/args.mjs', import.meta.url).href;
  const registry = new URL('../../suites/registry.mjs', import.meta.url).href;
  const script = `import { runDoctor } from ${JSON.stringify(doctor)};
import { parseArgs } from ${JSON.stringify(args)};
import { getSuite } from ${JSON.stringify(registry)};
const options = parseArgs(['doctor', 'task-repair', '--valdr-bin', ${JSON.stringify(binary)}]);
const report = await runDoctor(options, {suite: await getSuite('task-repair'), preflight: async () => ({ok: true, cleanup: {ok: true}})});
console.log(JSON.stringify(report));`;
  const result = spawnSync(process.execPath, ['--eval', script], { encoding: 'utf8', timeout: 10000,
    env: { PATH: root, HOME: root, CODEX_HOME: path.join(root, 'no-auth') } });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.equal(report.liveAuthoringAvailable, true);
  assert.equal(report.authorReadiness, 'not_checked');
  assert.equal(report.providerCalls, 0);
  assert.ok(report.checks.some(check => check.id === 'fixtures' && check.ok));
});

test('missing credentials keep progress off JSON output and prevent live startup', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-json-progress-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const binary = path.join(root, 'valdr');
  const launched = path.join(root, 'launched');
  fs.writeFileSync(binary, `#!/usr/bin/env node\nif(process.argv[2]==='version'){console.log('valdr 99.0.0 fixture');process.exit(0); }\nrequire('node:fs').writeFileSync(${JSON.stringify(launched)},'unexpected execution');process.exit(1);\n`, { mode: 0o700 });
  const result = spawnSync(process.execPath, [entry, 'run', 'task-repair', '--json', '--scenario', '01_exact_replacement',
    '--valdr-bin', binary, '--evidence-root', path.join(root, 'evidence')], { encoding: 'utf8', timeout: 10000,
      env: { ...process.env, VALDR_DB_USERNAME: '', VALDR_DB_PASSWORD: '' } });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.outcome, 'infrastructure_incomplete');
  assert.equal(report.authorScenariosEvaluated, 0);
  assert.equal(report.repairsUsed, 0);
  assert.match(result.stderr, /incomplete/);
  assert.equal(fs.existsSync(launched), false);
});
