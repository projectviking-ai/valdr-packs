import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const pack = path.resolve('valdr-packs/valdr-tools');
const languages = ['node', 'typescript', 'python', 'shell', 'native'];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-tools-test-'));
test.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60_000, ...options });
  assert.equal(result.status, 0, `${command}: ${result.error ?? result.stderr}`);
  return result.stdout;
};

const readManifest = file => JSON.parse(run('bun', ['-e', "console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))", file]));

for (const language of languages) {
  test(`${language} summarizes Unicode and empty text and rejects invalid requests`, () => {
    const root = path.join(pack, 'tools', language);
    assert.ok(fs.existsSync(path.join(root, 'summary.tool.yaml')), 'starter manifest must exist');
    const manifest = readManifest(path.join(root, 'summary.tool.yaml'));
    let executable = manifest.process.executable;
    if (language === 'native') {
      executable = path.join(temporary, 'valdr-tools-native');
      run('go', ['build', '-trimpath', '-o', executable, path.join(root, 'main.go')]);
    }
    const envelope = { protocolVersion: 1, toolId: manifest.id, toolRevision: manifest.revision, action: 'summarize', input: { text: '' }, operationId: 'example-operation', attemptId: 'example-attempt' };
    for (const { input, data } of JSON.parse(fs.readFileSync(path.join(pack, 'fixtures.json'), 'utf8'))) {
      const result = run(executable, manifest.process.args, { cwd: root, input: JSON.stringify({ ...envelope, input }) });
      assert.deepEqual(JSON.parse(result), { ok: true, data });
    }
    if (language === 'native') {
      const legacy = { ...envelope, toolId: 'user.valdr-tools.native', toolRevision: '1.0.2' };
      assert.deepEqual(JSON.parse(run(executable, [], { cwd: root, input: JSON.stringify(legacy) })), { ok: true, data: { characters: 0, words: 0, lines: 0 } });
    }
    for (const invalid of [
      { ...envelope, action: 'unknown' }, { ...envelope, protocolVersion: 2 },
      { ...envelope, toolId: 'user.other' }, { ...envelope, input: { text: 12 } },
      { ...envelope, input: {} }, { ...envelope, input: { text: '', extra: true } },
      null, '{', `${JSON.stringify(envelope)}\n${JSON.stringify(envelope)}`,
    ]) {
      const result = run(executable, manifest.process.args, { cwd: root, input: typeof invalid === 'string' ? invalid : JSON.stringify(invalid) });
      assert.equal(JSON.parse(result).ok, false);
      assert.equal(JSON.parse(result).error.code, 'invalid_request');
    }
  });
}
