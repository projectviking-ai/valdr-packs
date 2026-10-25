import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const pack = 'valdr-packs/valdr-tools';
const archive = 'build/valdr-tools.valdr-pack.tar.gz';
const yaml = file => JSON.parse(execFileSync('bun', ['-e', 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))', file], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}

test('built archive contains the decision tool and every existing tool source byte', () => {
  assert.ok(existsSync(archive), 'Run make build-valdr-tools before the archive test.');
  const extract = name => execFileSync('tar', ['-xOf', archive, name], { maxBuffer: 4 * 1024 * 1024 });
  const manifest = JSON.parse(extract('manifest.json'));
  const decision = manifest.userTools.entries.find(entry => entry.toolId === 'valdr-tools.user.decide');
  assert.ok(decision, 'Build the archive with the decision tool before running this test.');
  assert.equal(decision.revision, '1.0.0');
  const manifests = filesIn(`${pack}/tools`).filter(file => file.endsWith('.tool.yaml'));
  const sources = manifests.map(file => ({ file, source: yaml(file) }));
  assert.deepEqual(manifest.userTools.entries.map(entry => entry.toolId).sort(), sources.map(({ source }) => source.id).sort());
  for (const { file, source } of sources) {
    const entry = manifest.userTools.entries.find(entry => entry.toolId === source.id);
    assert.equal(entry.revision, source.revision); assert.match(entry.contentHash, /^sha256:[0-9a-f]{64}$/);
    for (const name of [path.basename(file), ...source.files.map(asset => asset.path)]) {
      const archivePath = `${path.dirname(file)}/${name}`;
      const bytes = extract(archivePath);
      assert.deepEqual(bytes, readFileSync(archivePath), archivePath);
      assert.equal(manifest.archive.checksums[archivePath], createHash('sha256').update(bytes).digest('hex'), archivePath);
    }
  }
});

test('decision runtime inventory closes over all relative imports and excludes tests', () => {
  const root = `${pack}/tools/decide`;
  const source = yaml(`${root}/decide.tool.yaml`);
  const inventory = new Set(source.files.map(file => path.resolve(root, file.path)));
  const modules = filesIn(root).filter(file => file.endsWith('.mjs')).map(file => path.resolve(file));
  assert.equal(inventory.size, 8); assert.deepEqual([...inventory].sort(), modules.sort());
  for (const file of inventory) {
    assert.ok(!file.includes('/tests/') && !file.includes('/fixtures/'));
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('node:')) continue;
      assert.ok(match[1].startsWith('.'), 'Runtime dependencies must be built-ins or inventoried local modules.');
      assert.ok(inventory.has(path.resolve(path.dirname(file), match[1])), `${file} imports an uninventoried module: ${match[1]}`);
    }
  }
});
