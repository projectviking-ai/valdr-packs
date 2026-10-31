import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const plugin = path.join(root, 'plugins/valdr');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('marketplaces expose only the public plugin and both clients share its identity', () => {
  const codex = read('plugins/valdr/.codex-plugin/plugin.json');
  const claude = read('plugins/valdr/.claude-plugin/plugin.json');
  assert.equal(codex.name, 'valdr');
  assert.equal(claude.name, codex.name);
  assert.match(codex.version, /^\d+\.\d+\.\d+$/);
  assert.equal(claude.version, codex.version);
  assert.equal(codex.skills, './skills/');
  for (const [catalog, source] of [
    [read('.agents/plugins/marketplace.json'), './plugins/valdr'],
    [read('.claude-plugin/marketplace.json'), './plugins/valdr'],
  ]) {
    assert.equal(catalog.name, 'valdr-packs');
    assert.equal(catalog.plugins.length, 1);
    assert.equal(catalog.plugins[0].name, codex.name);
    const actual = typeof catalog.plugins[0].source === 'string' ? catalog.plugins[0].source : catalog.plugins[0].source.path;
    assert.equal(actual, source);
    assert.equal(path.resolve(root, actual), plugin);
  }
  assert.deepEqual(fs.readdirSync(plugin).sort(), ['.claude-plugin', '.codex-plugin', 'LICENSE', 'README.md', 'skills']);
  for (const relative of [codex.interface.logo, codex.interface.composerIcon, claude.icon]) {
    assert(relative.startsWith('./'));
    const file = path.resolve(plugin, relative);
    assert(file.startsWith(`${plugin}${path.sep}`));
    assert(fs.readFileSync(file).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  }
  for (const manifest of [codex, claude]) {
    assert.equal(manifest.mcpServers, undefined);
    assert.equal(manifest.hooks, undefined);
  }
});


test('plugin payload excludes private files and development-only instructions', () => {
  const forbidden = new Set(['.env', '.mcp.json', '.app.json', '.git', '.agents', '.claude', '.codex', '.valdr', '.superpowers', 'AGENTS.md', 'CLAUDE.md', 'node_modules', 'evals']);
  const pending = [plugin];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), `Unexpected symlink: ${entry.name}`);
      assert(!forbidden.has(entry.name) && !entry.name.startsWith('.env.'), `Private/development entry: ${entry.name}`);
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(file);
      else if (/\.(md|mjs|json|yaml)$/.test(entry.name)) {
        assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\/Users\/|\/private\/tmp\/|valdr_dev|valdr-internal|scripts\/generate-user-workflow-cli-tools|make (?:validate-user-workflow-tools|test-user-workflow-tools|build-valdr-tools|sync-skills)/, path.relative(plugin, file));
      }
    }
  }
});

test('Codex starter prompts bind to the installed plugin skill names', () => {
  for (const name of fs.readdirSync(path.join(plugin, 'skills'))) {
    const metadata = fs.readFileSync(path.join(plugin, 'skills', name, 'agents/openai.yaml'), 'utf8');
    assert(metadata.includes(`$valdr:${name}`), name);
    assert.doesNotMatch(metadata, /\$valdr-[a-z0-9-]+/);
  }
});

test('bundled public skills and resources match the canonical sources', () => {
  const result = spawnSync(process.execPath, ['scripts/sync-plugin.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('CLI discovery works from an installed skill with a user-supplied manifest', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-plugin-discovery-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const script = path.join(temporary, 'installed-skill/scripts/discover-cli.mjs');
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.copyFileSync(path.join(plugin, 'skills/valdr-workflow-tools/scripts/discover-cli.mjs'), script);
  const bin = path.join(temporary, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\ncase "$*" in\n  --version) echo "gh fixture" ;;\n  "help reference") printf "## gh repo <command>\\n\\n### gh repo view [flags]\\n" ;;\n  "extension list"|"alias list") ;;\n  *) exit 1 ;;\nesac\n', { mode: 0o755 });
  const manifest = path.join(temporary, 'my-tool.yaml');
  fs.writeFileSync(manifest, JSON.stringify({ id: 'my-tools.user.gh', revision: '1.0.0', actions: [{ id: 'repo-view', path: ['repo', 'view'], execution: 'supported' }] }));
  const output = path.join(temporary, 'evidence');
  const result = spawnSync('bun', [script, 'gh', output, manifest], { cwd: temporary, encoding: 'utf8', env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
  assert.equal(result.status, 0, result.stderr);
  const inventory = JSON.parse(fs.readFileSync(path.join(output, 'inventory.json'), 'utf8'));
  assert.equal(inventory.toolId, 'my-tools.user.gh');
  assert.equal(inventory.commands.find(row => row.path.join(' ') === 'repo view').actionId, 'repo-view');
  assert.equal(inventory.commands.find(row => row.path.join(' ') === 'repo').execution, 'unsupported');
});
