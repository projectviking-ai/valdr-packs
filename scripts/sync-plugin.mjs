import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const plugin = path.join(root, 'plugins/valdr');
const names = ['valdr-agent', 'valdr-auditor', 'valdr-executor', 'valdr-orchestrator', 'valdr-planner', 'valdr-reviewer', 'valdr-workflow-tools'];
const check = process.argv[2] === '--check';
assert(process.argv.length === (check ? 3 : 2), 'Usage: node scripts/sync-plugin.mjs [--check]');

function files(directory, relative = '') {
  return fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    assert(!entry.isSymbolicLink(), `Plugin resources cannot be symlinks: ${entry.name}`);
    const name = path.join(relative, entry.name);
    return entry.isDirectory() ? files(directory, name) : [name];
  });
}

function bundledContent(file) {
  const bytes = fs.readFileSync(file);
  return file.endsWith(path.join('agents', 'openai.yaml'))
    ? Buffer.from(bytes.toString('utf8').replace(/\$(valdr-[a-z0-9-]+)/g, '$valdr:$1'))
    : bytes;
}

if (!check) {
  fs.mkdirSync(path.join(plugin, 'skills'), { recursive: true });
  for (const name of names) {
    fs.rmSync(path.join(plugin, 'skills', name), { recursive: true, force: true });
    fs.cpSync(path.join(root, 'skills', name), path.join(plugin, 'skills', name), { recursive: true, dereference: false });
    const metadata = path.join(root, 'skills', name, 'agents/openai.yaml');
    if (fs.existsSync(metadata)) fs.writeFileSync(path.join(plugin, 'skills', name, 'agents/openai.yaml'), bundledContent(metadata));
  }
  fs.copyFileSync(path.join(root, 'skills/README.md'), path.join(plugin, 'README.md'));
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(plugin, 'LICENSE'));
}
assert.deepEqual(fs.readdirSync(path.join(plugin, 'skills')).sort(), [...names].sort(), 'Unexpected bundled skills');
for (const name of names) {
  const source = path.join(root, 'skills', name);
  const bundled = path.join(plugin, 'skills', name);
  const expected = files(source);
  assert.deepEqual(files(bundled), expected, `Plugin file inventory differs: ${name}`);
  for (const relative of expected) assert(bundledContent(path.join(source, relative)).equals(fs.readFileSync(path.join(bundled, relative))), `Plugin content is stale: ${name}/${relative}`);
}
assert(fs.readFileSync(path.join(root, 'skills/README.md')).equals(fs.readFileSync(path.join(plugin, 'README.md'))), 'Plugin README is stale');
assert(fs.readFileSync(path.join(root, 'LICENSE')).equals(fs.readFileSync(path.join(plugin, 'LICENSE'))), 'Plugin license is stale');
console.log(check ? 'Public plugin package is current' : 'Public plugin package synced');
