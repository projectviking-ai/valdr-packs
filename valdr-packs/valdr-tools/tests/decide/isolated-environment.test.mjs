import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { isolatedValdrLaunch, readValdrEnvironment } from './isolated-environment.mjs';

const dirs = Object.freeze({
  data: '/tmp/decide-test/data',
  pm: '/tmp/decide-test/pm',
  runtime: '/tmp/decide-test/runtime',
  tmp: '/tmp/decide-test/tmp',
  cwd: '/tmp/decide-test/cwd',
});

test('isolated Valdr retains the host identity and credentials without mutating its environment', () => {
  const inheritedEnv = Object.freeze({
    HOME: '/home/operator',
    XDG_CONFIG_HOME: '/home/operator/.config',
    XDG_CACHE_HOME: '/home/operator/.cache',
    PATH: '/usr/local/bin:/usr/bin',
    VALDR_DB_USERNAME: 'fixture-user',
    VALDR_DB_PASSWORD: 'fixture-password',
    VALDR_AUTH_KEY_HEX: 'fixture-auth-key',
    PM_MCP_HOME: '/home/operator/.valdr/pm',
    TMPDIR: '/tmp/host-temp',
  });
  const before = { ...inheritedEnv };
  const { env } = isolatedValdrLaunch(dirs, inheritedEnv);

  assert.notEqual(env, inheritedEnv);
  assert.deepEqual(inheritedEnv, before);
  for (const name of ['HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'PATH',
    'VALDR_DB_USERNAME', 'VALDR_DB_PASSWORD', 'VALDR_AUTH_KEY_HEX']) {
    assert.equal(env[name], inheritedEnv[name], `${name} must remain unchanged.`);
  }
  assert.equal(env.PM_MCP_HOME, dirs.pm);
  assert.equal(env.TMPDIR, dirs.tmp);
});

test('isolated Valdr flags select the disposable data, PM, and runtime roots', () => {
  const { flags } = isolatedValdrLaunch(dirs, {});
  assert.deepEqual(flags, [
    '--data-root', dirs.data,
    '--pm-home', dirs.pm,
    '--runtime-root', dirs.runtime,
  ]);
});

test('isolated Valdr never synthesizes missing host credentials or identity settings', () => {
  const inheritedEnv = Object.freeze({ PATH: '/usr/bin' });
  const { env } = isolatedValdrLaunch(dirs, inheritedEnv);
  assert.deepEqual(env, { PATH: '/usr/bin', PM_MCP_HOME: dirs.pm, TMPDIR: dirs.tmp });
  for (const name of ['HOME', 'XDG_CONFIG_HOME', 'VALDR_DB_USERNAME',
    'VALDR_DB_PASSWORD', 'VALDR_AUTH_KEY_HEX']) {
    assert.equal(Object.hasOwn(env, name), false, `${name} must not be synthesized.`);
  }
  assert.deepEqual(inheritedEnv, { PATH: '/usr/bin' });
});

function temporaryEnvironment(t, contents) {
  const root = mkdtempSync(path.join(tmpdir(), 'valdr-environment-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, '.env');
  if (contents !== undefined) writeFileSync(file, contents);
  return { root, file };
}

test('dotenv values retain quoted spaces, hash signs, and literal command substitutions', t => {
  const { root, file } = temporaryEnvironment(t);
  const marker = path.join(root, 'command-must-not-run');
  const literal = `spaces # $(touch ${marker})`;
  writeFileSync(file, `VALDR_ENV_LITERAL="${literal}"\nVALDR_ENV_SINGLE='quoted # spaces'\n`);
  const inheritedEnv = Object.freeze({ PATH: '/usr/bin' });
  const processValues = ['VALDR_ENV_LITERAL', 'VALDR_ENV_SINGLE'].map(name => [name, process.env[name]]);

  const env = readValdrEnvironment(file, inheritedEnv);

  assert.deepEqual(env, { VALDR_ENV_LITERAL: literal, VALDR_ENV_SINGLE: 'quoted # spaces', PATH: '/usr/bin' });
  assert.equal(existsSync(marker), false, 'Reading dotenv must not execute command substitutions.');
  assert.deepEqual(inheritedEnv, { PATH: '/usr/bin' });
  for (const [name, value] of processValues) {
    assert.equal(process.env[name], value, 'Reading dotenv must not change process.env.');
  }
});

test('inherited environment wins over dotenv, including explicit empty values', t => {
  const { file } = temporaryEnvironment(t, 'VALDR_DB_USERNAME=file-user\nVALDR_DB_PASSWORD=file-password\nFILE_ONLY=present\n');
  const inheritedEnv = Object.freeze({ VALDR_DB_USERNAME: 'shell-user', VALDR_DB_PASSWORD: '', HOME: '/home/operator' });
  const before = { ...inheritedEnv };

  const env = readValdrEnvironment(file, inheritedEnv);

  assert.deepEqual(env, { ...before, FILE_ONLY: 'present' });
  assert.notEqual(env, inheritedEnv);
  assert.deepEqual(inheritedEnv, before);
});

test('an absent optional dotenv file returns a fresh inherited environment copy', t => {
  const { file } = temporaryEnvironment(t);
  const inheritedEnv = Object.freeze({ PATH: '/usr/bin', VALDR_DB_USERNAME: 'shell-user' });

  const env = readValdrEnvironment(file, inheritedEnv);

  assert.deepEqual(env, inheritedEnv);
  assert.notEqual(env, inheritedEnv);
  assert.equal(existsSync(file), false);
});

test('dotenv read failures other than a missing file are reported', t => {
  const { root } = temporaryEnvironment(t);
  assert.throws(() => readValdrEnvironment(root, {}), { code: 'EISDIR' });
});
