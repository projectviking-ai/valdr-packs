import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runRequest } from '../../tools/decide/runner.mjs';
import { HTTP_TIMEOUT_MS } from '../../tools/decide/contract.mjs';

const runner = fileURLToPath(new URL('../../tools/decide/runner.mjs', import.meta.url));
const fixture = provider => JSON.parse(readFileSync(new URL(`fixtures/${provider}.json`, import.meta.url)));
const request = (provider = 'laya') => ({ protocolVersion: 1, toolId: 'valdr-tools.user.decide', toolRevision: '1.0.0', action: 'decide', input: fixture(provider).input, operationId: 'test-operation', attemptId: 'test-attempt' });
const env = { TYPESAFE_API_KEY: 'synthetic-jev-key', OPENAI_API_KEY: 'synthetic-openai-key' };
const neverFetch = () => assert.fail('validation must happen before HTTP');
async function serverFor(t, handler) {
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}
function childRun(t, stdin, extraEnv = {}, cwd = tmpdir()) {
  const child = spawn(process.execPath, [runner], { cwd, env: { PATH: process.env.PATH, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', bytes => stdout += bytes.toString()); child.stderr.on('data', bytes => stderr += bytes.toString());
  child.stdin.on('error', error => { if (error.code !== 'EPIPE') throw error; });
  child.stdin.end(typeof stdin === 'string' ? stdin : JSON.stringify(stdin));
  const done = once(child, 'close').then(([code, signal]) => ({ code, signal, stdout, stderr }));
  return { child, done };
}
function envelope(result) {
  assert.equal(result.stdout.trim().split('\n').length, 1); assert.ok(Buffer.byteLength(result.stdout) <= 65536);
  assert.ok(Buffer.byteLength(result.stderr) <= 8192); return JSON.parse(result.stdout);
}

test('protocol and explicit metadata reject malformed requests before HTTP', async () => {
  for (const [key, value] of [['protocolVersion', 2], ['toolId', 'other'], ['toolRevision', '0.0.0'], ['action', 'other'], ['operationId', undefined], ['attemptId', 2]]) {
    const req = request(); req[key] = value; const result = await runRequest(req, { fetchImpl: neverFetch });
    assert.equal(result.ok, false); assert.equal(result.error.code, 'invalid_request'); assert.equal(Object.hasOwn(result, 'data'), false);
  }
  for (const req of [null, [], 'input']) assert.equal((await runRequest(req, { fetchImpl: neverFetch })).error.code, 'invalid_request');
});

test('invalid authored input cannot add endpoints, credentials, or generation options', async () => {
  for (const modify of [v => v.input.url = 'http://localhost', v => v.input.apiKey = 'secret', v => v.input.engine.temperature = 0, v => v.input.questions[0].id = 'bad.id', v => v.input.questions[0].acceptance = {}]) {
    const req = request(); modify(req); assert.equal((await runRequest(req, { fetchImpl: neverFetch })).error.code, 'invalid_input');
  }
});

for (const provider of ['laya', 'ollama', 'jev', 'openai']) test(`${provider} dispatch normalizes a single selected provider response`, async () => {
  let calls = 0; const f = fixture(provider);
  const result = await runRequest(request(provider), { env, fetchImpl: async (url, init) => {
    calls++; assert.equal(new URL(url).hostname, { laya: '127.0.0.1', ollama: '127.0.0.1', jev: 'api.typesafe.ai', openai: 'api.openai.com' }[provider]);
    assert.deepEqual(JSON.parse(init.body), f.request); return Response.json(f.response);
  } });
  assert.equal(calls, 1); assert.equal(result.ok, true); assert.equal(result.data.engine.provider, provider);
  assert.equal(result.data.engine.requestedModel, f.input.engine.model); assert.equal(result.data.engine.resolvedModel, f.input.engine.model);
  assert.equal(result.data.answers.kind.status, 'uncertain'); assert.equal(result.data.answers.ready.outcome, 'yes'); assert.equal(result.data.answers.size.selectedIndex, 0);
  assert.ok(result.data.latencyMs >= 0); assert.equal(Object.hasOwn(result.data.engine, 'modelDigest'), false);
});

test('actual runner emits exactly one envelope from an arbitrary cwd', { timeout: 5000 }, async t => {
  let calls = 0; const f = fixture('laya');
  const url = await serverFor(t, async (req, res) => {
    calls++; const chunks = []; for await (const chunk of req) chunks.push(chunk);
    assert.deepEqual(JSON.parse(Buffer.concat(chunks)), f.request); assert.equal(req.url, '/v1/systemone');
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(f.response));
  });
  const cwd = mkdtempSync(path.join(tmpdir(), 'decide-process-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = await childRun(t, request(), { LAYA_URL: url }, cwd).done;
  assert.equal(result.code, 0); assert.equal(envelope(result).data.answers.ready.outcome, 'yes'); assert.equal(result.stderr, ''); assert.equal(calls, 1);
});

test('malformed JSON and oversized multibyte stdin return bounded errors', { timeout: 5000 }, async t => {
  for (const [value, code] of [['{bad json', 'invalid_request'], ['é'.repeat(32769), 'input_limit']]) {
    const result = await childRun(t, value).done; assert.equal(result.code, 0); assert.equal(envelope(result).error.code, code);
  }
});

test('output expansion beyond the result limit returns one error instead of partial JSON', async () => {
  const req = request('jev');
  req.input.questions = Array.from({ length: 20 }, (_, index) => ({ id: 'q'.repeat(60) + index, type: 'choice', instructions: 'Choose.', options: [{ id: 'a'.repeat(64), description: 'First' }, { id: 'b'.repeat(64), description: 'Second' }], acceptance: { minSelectedProbability: 0.8 } }));
  const body = { model: 'm'.repeat(58000), answers: Object.fromEntries(req.input.questions.map(q => [q.id, { type: 'choice', choice: 'a'.repeat(64), probabilities: { ['a'.repeat(64)]: 0.9, ['b'.repeat(64)]: 0.1 } }])) };
  assert.ok(Buffer.byteLength(JSON.stringify(body)) < 65536);
  const result = await runRequest(req, { env, fetchImpl: async () => Response.json(body) });
  assert.equal(result.ok, false); assert.equal(result.error.code, 'result_limit'); assert.ok(Buffer.byteLength(JSON.stringify(result)) < 1024);
});

test('HTTP deadline aborts delayed headers and stalled bodies without retries', { timeout: 5000 }, async t => {
  assert.equal(HTTP_TIMEOUT_MS, 50000);
  for (const mode of ['headers', 'body']) {
    let calls = 0; let closed;
    const disconnected = new Promise(resolve => closed = resolve);
    const url = await serverFor(t, (req, res) => { calls++; res.on('close', closed); if (mode === 'body') { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); } });
    const result = await runRequest(request(), { env: { LAYA_URL: url }, timeoutMs: 100 });
    assert.equal(result.error.code, 'timeout'); assert.equal(calls, 1); await disconnected;
  }
});

for (const killSignal of ['SIGTERM', 'SIGINT']) test(`process ${killSignal} aborts HTTP and emits no success`, { timeout: 5000 }, async t => {
  let started; let closed;
  const receiving = new Promise(resolve => started = resolve); const disconnected = new Promise(resolve => closed = resolve);
  const url = await serverFor(t, (req, res) => { res.on('close', closed); res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); started(); });
  const { child, done } = childRun(t, request(), { LAYA_URL: url }); await receiving; child.kill(killSignal);
  const result = await done; await disconnected;
  assert.equal(result.code, 0); assert.equal(envelope(result).error.code, 'cancelled');
});

test('provider failures omit task text, credentials and raw errors', { timeout: 5000 }, async t => {
  const secret = 'sentinel-credential-1234'; const task = 'sentinel-private-task-5678';
  const url = await serverFor(t, (req, res) => { res.writeHead(401); res.end(`${secret} ${task}`); });
  const req = request(); req.input.text = task;
  const result = await childRun(t, req, { LAYA_URL: url, LAYA_API_KEY: secret }).done;
  assert.equal(envelope(result).error.code, 'authentication_failed');
  for (const value of [secret, task]) assert.equal((result.stdout + result.stderr).includes(value), false);
  const failure = await runRequest(req, { fetchImpl: async () => { throw Error(`${secret} ${task}`); } });
  assert.equal(failure.error.code, 'engine_unavailable'); assert.equal(JSON.stringify(failure).includes(secret), false);
});

test('HTTP and malformed success responses are errors while uncertainty and refusal are data', async () => {
  for (const [status, body, code] of [[429, '{}', 'rate_limited'], [500, '{}', 'engine_unavailable'], [200, 'malformed', 'invalid_response'], [200, 'x'.repeat(65537), 'invalid_response']]) {
    let calls = 0;
    const result = await runRequest(request(), { fetchImpl: async () => { calls++; return new Response(body, { status }); } });
    assert.equal(result.error.code, code); assert.equal(Object.hasOwn(result, 'data'), false); assert.equal(calls, 1);
  }
  const f = fixture('openai'); f.response.answers[0] = { name: 'kind', type: 'refusal' };
  const result = await runRequest(request('openai'), { env, fetchImpl: async () => Response.json(f.response) });
  assert.equal(result.ok, true); assert.equal(result.data.answers.kind.outcome, 'refused'); assert.equal(result.data.answers.ready.outcome, 'yes');
  const cancelled = new AbortController(); cancelled.abort();
  assert.equal((await runRequest(request(), { signal: cancelled.signal, fetchImpl: neverFetch })).error.code, 'cancelled');
});
