import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('installed Valdr CLI builds a deterministic archive with every tool source byte', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'valdr-tools-pack-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cli = process.env.VALDR_BIN || 'valdr';
  const pack = 'valdr-packs/valdr-tools';
  execFileSync(cli, ['validate-pack', pack]);
  const archives = ['one', 'two'].map(name => path.join(directory, `${name}.tar.gz`));
  for (const archive of archives) execFileSync(cli, ['generate-valdr-pack', pack, '--output', archive, '--exported-at', '0']);
  assert.deepEqual(readFileSync(archives[0]), readFileSync(archives[1]));
  const manifest = JSON.parse(execFileSync('tar', ['-xOf', archives[0], 'manifest.json'], { encoding: 'utf8' }));
  const tools = ['node', 'typescript', 'python', 'shell', 'native', 'gh', 'aws', 'gcloud', 'acli', 'maven'];
  for (const name of tools) {
    const root = path.join(pack, 'tools', name);
    const manifestName = name === 'maven' || ['gh', 'aws', 'gcloud', 'acli'].includes(name) ? `${name}.tool.yaml` : 'summary.tool.yaml';
    const source = JSON.parse(execFileSync('bun', ['-e', 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))', path.join(root, manifestName)], { encoding: 'utf8' }));
    if (name === 'maven') assert.equal(source.actions.find(action => action.id === 'build')?.retry, 'manual');
    const tool = manifest.userTools.entries.find(entry => entry.toolId === source.id);
    assert.ok(tool, `${name} is inventoried`);
    assert.match(tool.contentHash, /^sha256:[0-9a-f]{64}$/);
    for (const file of [{ path: manifestName }, ...source.files]) {
      const archivePath = `${root}/${file.path}`;
      const bytes = execFileSync('tar', ['-xOf', archives[0], archivePath]);
      assert.deepEqual(bytes, readFileSync(archivePath));
      assert.equal(manifest.archive.checksums[archivePath], createHash('sha256').update(bytes).digest('hex'));
    }
  }
});
