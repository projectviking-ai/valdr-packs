import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { captureOutput, redactDiagnostic } from './diagnostics.mjs';

test('diagnostics join UTF-8 bytes before redaction and preserve original stdout for parsing', () => {
  const secret = 'synthetic-clé-🔑';
  const capture = captureOutput([secret, 'valdr']);
  const output = `valdr 0.4.0\ncredential: ${secret}\n`;
  for (const byte of Buffer.from(output)) capture.append(Buffer.from([byte]));
  assert.equal(capture.text(), output);
  assert.equal(capture.diagnostic(), '[redacted] 0.4.0\ncredential: [redacted]\n');
});

test('capture overflow omits all output instead of exposing a truncated credential', () => {
  const secret = 'synthetic-password-at-buffer-boundary';
  const capture = captureOutput([secret]);
  const split = Math.floor(secret.length / 2);
  capture.append(Buffer.from('x'.repeat(8192 - split) + secret.slice(0, split)));
  capture.append(Buffer.from(secret.slice(split)));
  capture.append(Buffer.alloc(16384, 'x'));
  assert.equal(capture.diagnostic(), '[output omitted: diagnostic limit exceeded]');
  assert.equal(capture.text(), capture.diagnostic());
  assert.equal(capture.diagnostic().includes(secret.slice(0, split)), false);
  assert.equal(capture.diagnostic().includes(secret.slice(split)), false);
});

test('diagnostic limits also apply after redaction expands short credentials', () => {
  const capture = captureOutput(['x']);
  capture.append(Buffer.alloc(8192, 'x'));
  assert.equal(capture.diagnostic(), '[output omitted: diagnostic limit exceeded]');
  assert.equal(redactDiagnostic('synthetic-long-password', ['password', 'synthetic-long-password']), '[redacted]');
});

test('isolated harness redacts credentials split across stderr writes without changing version parsing', { timeout: 15000 }, t => {
  const root = mkdtempSync(path.join(tmpdir(), 'decide-diagnostic-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tests = path.join(root, 'valdr-packs/valdr-tools/tests/decide');
  cpSync(new URL('.', import.meta.url), tests, { recursive: true });
  cpSync(new URL('../../../../VALDR_WORKFLOW_CLI_VERSION', import.meta.url), path.join(root, 'VALDR_WORKFLOW_CLI_VERSION'));
  const home = path.join(root, 'home');
  mkdirSync(home);
  const bin = path.join(root, 'fake-valdr.mjs');
  writeFileSync(bin, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
if (process.argv[2] === 'version') {
  console.log('valdr ' + readFileSync(new URL('./VALDR_WORKFLOW_CLI_VERSION', import.meta.url), 'utf8').trim());
} else {
  const secret = process.env.VALDR_DB_PASSWORD;
  const split = Math.floor(secret.length / 2);
  process.stderr.write('fixture pm failure: ' + secret.slice(0, split), () => {
    setTimeout(() => process.stderr.write(secret.slice(split) + '\\n', () => process.exit(1)), 100);
  });
}
`, { mode: 0o700 });
  const secret = 'synthetic-password-split-across-stream-chunks';
  const result = spawnSync(process.execPath, ['--test', path.join(tests, 'isolated-valdr.test.mjs')], {
    cwd: root,
    env: {
      PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`,
      HOME: home, TMPDIR: root,
      VALDR_BIN: bin, VALDR_DECIDE_ISOLATED: '1',
      VALDR_DB_USERNAME: 'valdr', VALDR_DB_PASSWORD: secret,
    },
    encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, 'The fake PM must fail without invoking a real CLI.');
  const report = result.stdout + result.stderr;
  assert.equal(report.includes(secret), false, 'Failure diagnostics must not reveal the synthetic password.');
  assert.match(report, /fixture pm failure: \[redacted\]/);
  assert.doesNotMatch(report, /Use the released Valdr version pinned/);
});
