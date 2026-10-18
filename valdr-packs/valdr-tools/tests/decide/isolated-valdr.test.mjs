import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { captureOutput, redactDiagnostic } from './diagnostics.mjs';
import { isolatedValdrLaunch, readValdrEnvironment } from './isolated-environment.mjs';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const fixture = provider => JSON.parse(readFileSync(new URL(`fixtures/${provider}.json`, import.meta.url)));
const enabled = process.env.VALDR_DECIDE_ISOLATED === '1';
const tool = { toolId: 'valdr-tools.user.decide', toolAction: 'decide', revision: '1.0.0' };

test('released Valdr imports and executes decisions in an isolated authority', {
  skip: !enabled && 'Set VALDR_DECIDE_ISOLATED=1 to run the installed CLI integration test.',
  timeout: 180000,
}, async t => {
  const inheritedEnv = readValdrEnvironment(path.join(repo, '.env'));
  // realpath matters on macOS, where /var and /tmp can resolve through symlinks.
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'valdr-decide-isolated-')));
  const dirs = Object.fromEntries(['data', 'pm', 'runtime', 'tmp', 'cwd'].map(name => [name, path.join(root, name)]));
  for (const directory of Object.values(dirs)) mkdirSync(directory, { mode: 0o700 });
  const { env, flags } = isolatedValdrLaunch(dirs, inheritedEnv);
  const children = new Set();
  const secrets = Object.entries(env).filter(([name, value]) => /PASSWORD|TOKEN|KEY|SECRET|USERNAME/.test(name) && value).map(([, value]) => value);
  const clean = text => redactDiagnostic(text, secrets);
  let server;
  const stop = child => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
    try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  t.after(async () => {
    for (const child of children) stop(child);
    await Promise.all([...children].map(child => child.exitCode !== null || child.signalCode !== null ? undefined : once(child, 'close').catch(() => {})));
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    rmSync(root, { recursive: true, force: true });
  });

  const bin = env.VALDR_BIN || 'valdr';
  function launch(args) {
    const child = spawn(bin, args, { cwd: dirs.cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    children.add(child);
    const stderr = captureOutput(secrets);
    child.stderr.on('data', stderr.append);
    child.stdin.on('error', () => {});
    return { child, diagnostic: stderr.diagnostic };
  }
  async function command(args) {
    const { child, diagnostic } = launch(args);
    const output = captureOutput(secrets);
    child.stdout.on('data', output.append);
    child.stdin.end();
    const timer = setTimeout(() => stop(child), 60000);
    try {
      const [code] = await once(child, 'close');
      assert.equal(code, 0, `Valdr ${args[0]} failed: ${output.diagnostic()}\n${diagnostic()}`);
      return output.text();
    } finally { clearTimeout(timer); }
  }

  const expectedVersion = readFileSync(path.join(repo, 'VALDR_WORKFLOW_CLI_VERSION'), 'utf8').trim();
  const version = (await command(['version'])).trim();
  assert.ok(version.replace(/^valdr\s+/, '').split(/\s/)[0] === expectedVersion, 'Use the released Valdr version pinned by this repository.');
  t.diagnostic(`Valdr ${expectedVersion}; disposable authority: ${root}`);

  let calls = 0;
  const requests = [];
  server = createServer(async (req, res) => {
    calls++;
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push({ method: req.method, url: req.url, body: JSON.parse(Buffer.concat(chunks)) });
    const provider = requests.at(-1).body.model === 'clef-flash:9b' ? 'ollama' : 'laya';
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(fixture(provider).response));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  env.LAYA_URL = env.OLLAMA_URL = `http://127.0.0.1:${server.address().port}`;
  env.LAYA_API_KEY = ''; // The mock does not need the user's provider credential.

  const { child, diagnostic } = launch(['pm', ...flags]);
  const pending = new Map(); let nextId = 0;
  const failPending = error => { for (const entry of pending.values()) entry.reject(error); pending.clear(); };
  child.on('error', failPending);
  child.on('close', (code, signal) => failPending(new Error(`Isolated Valdr exited (${code ?? signal}): ${diagnostic()}`)));
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); }
    catch { failPending(new Error('Valdr emitted non-JSON text on MCP stdout.')); return; }
    const entry = pending.get(message.id); if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(`MCP ${message.error.code}: ${clean(message.error.message)}`));
    else entry.resolve(message.result);
  });
  async function rpc(method, params) {
    const id = ++nextId;
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out waiting for ${method}: ${diagnostic()}`)); }, 60000);
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    } finally { clearTimeout(timer); }
  }
  async function call(name, args) {
    const result = await rpc('tools/call', { name, arguments: args });
    assert.ok(!result.isError, `MCP ${name} failed: ${clean(JSON.stringify(result))}\n${diagnostic()}`);
    const data = result.structuredContent ?? JSON.parse(result.content.find(block => block.type === 'text').text);
    return data;
  }
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'decide-isolated-test', version: '1.0.0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const health = await call('pm_health', {});
  assert.equal(health.status, 'ok');
  assert.equal(realpathSync(health.info.dataDir), dirs.pm, 'MCP must use the disposable PM home.');
  assert.ok(realpathSync(health.info.dbPath).startsWith(dirs.pm + path.sep), 'Database must stay inside the disposable PM home.');
  const inventory = await rpc('tools/list', {});
  assert.ok(inventory.tools.some(entry => entry.name === 'pm_user_tool'),
    'pm_user_tool requires a valid Sovereign license in the normal Valdr environment.');
  assert.equal(health.info.license.status, 'valid');
  assert.equal(health.info.license.tier, 'sovereign');
  // Check the live authority and its license before importing any fixtures.
  await command(['import-pack', path.join(repo, 'build/valdr-tools.valdr-pack.tar.gz'), ...flags]);
  t.diagnostic('Imported the built Tools pack into the verified disposable PM home.');
  const search = await call('pm_user_tool', { action: 'search', params: { toolId: tool.toolId } });
  assert.equal(search.ok, true); assert.equal(search.data.hits.length, 1);
  const described = await call('pm_user_tool', { action: 'describe', params: tool });
  assert.equal(described.ok, true); assert.equal(described.data.availability, 'available');
  assert.equal(described.data.revision, tool.revision);
  assert.ok(described.data.inputSchema); assert.ok(described.data.outputSchema);

  for (const provider of ['laya', 'ollama']) {
    const f = fixture(provider);
    const params = { ...tool, input: f.input, cwd: dirs.cwd, clientRequestId: randomUUID() };
    const before = calls;
    const first = await call('pm_user_tool', { action: 'run', params });
    assert.equal(first.ok, true, clean(JSON.stringify(first)));
    assert.equal(first.data.replayed, false); assert.equal(calls, before + 1);
    assert.deepEqual(requests.at(-1), { method: 'POST', url: '/v1/systemone', body: f.request });
    assert.equal(first.data.result.engine.provider, provider);
    assert.equal(first.data.result.answers.kind.status, 'uncertain');
    assert.equal(first.data.result.answers.ready.outcome, 'yes');
    assert.equal(first.data.result.answers.size.selectedIndex, 0);
    const repeated = await call('pm_user_tool', { action: 'run', params });
    assert.equal(repeated.ok, true); assert.equal(repeated.data.replayed, true);
    assert.equal(repeated.data.operationId, first.data.operationId);
    assert.deepEqual(repeated.data.result, first.data.result); assert.equal(calls, before + 1, 'Receipt replay must not call the engine again.');
    t.diagnostic(`${provider}: imported runner, schema-checked result, completed receipt replay; one mock inference.`);
  }
});
