import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { normalizeAnswers, validateInput } from '../../tools/decide/contract.mjs';
import { requestJson } from '../../tools/decide/http.mjs';
import * as laya from '../../tools/decide/adapters/laya.mjs';
import * as ollama from '../../tools/decide/adapters/ollama.mjs';
import * as jev from '../../tools/decide/adapters/jev.mjs';
import * as openai from '../../tools/decide/adapters/openai.mjs';

const adapters = { laya, ollama, jev, openai };
const fixture = provider => JSON.parse(readFileSync(new URL(`fixtures/${provider}.json`, import.meta.url)));
const env = { TYPESAFE_API_KEY: 'synthetic-jev-key', OPENAI_API_KEY: 'synthetic-openai-key' };
const signal = () => new AbortController().signal;
const endpoint = { laya: 'http://127.0.0.1:8000/v1/systemone', ollama: 'http://127.0.0.1:11434/v1/systemone', jev: 'https://api.typesafe.ai/v1/systemone', openai: 'https://api.openai.com/v1/decisions' };
async function invoke(provider, data = fixture(provider), response = data.response, extra = {}) {
  return adapters[provider].decide(validateInput(data.input), { env, signal: signal(), fetchImpl: async () => Response.json(response), ...extra });
}

for (const provider of Object.keys(adapters)) {
  test(`${provider} translates all three question types and preserves confidence/provenance`, async () => {
    const f = fixture(provider); let calls = 0;
    const result = await invoke(provider, f, f.response, { fetchImpl: async (url, options) => {
      calls++; assert.equal(String(url), endpoint[provider]); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
      assert.deepEqual(JSON.parse(options.body), f.request);
      const headers = new Headers(options.headers);
      assert.equal(headers.get('content-type'), 'application/json');
      assert.equal(headers.get('authorization'), provider === 'jev' ? 'Bearer synthetic-jev-key' : provider === 'openai' ? 'Bearer synthetic-openai-key' : null);
      return Response.json(f.response, { headers: { 'x-request-id': 'test-request' } });
    } });
    assert.equal(calls, 1); assert.equal(result.resolvedModel, f.input.engine.model); assert.equal(result.requestId, 'test-request');
    assert.equal(result.usage.inputTokens, 80);
    assert.equal(result.usage.outputTokens, provider === 'openai' ? undefined : provider === 'laya' ? 0 : 3);
    const answers = normalizeAnswers(f.input.questions, result.answers);
    assert.equal(answers.kind.outcome, 'unsure'); assert.equal(answers.kind.selectedProbability, 0.79); assert.equal(answers.kind.providerConfidence, 0.99);
    assert.equal(answers.ready.outcome, 'yes'); assert.equal(answers.size.selected, 'small'); assert.equal(answers.size.expectedIndex, 0.8);
  });

  test(`${provider} rejects missing/extra/wrong-type answers and inconsistent selections`, async () => {
    for (const mutation of ['missing', 'extra', 'type', 'selection', 'distribution', 'mean']) {
      const f = fixture(provider); const a = f.response.answers;
      if (provider === 'openai') {
        if (mutation === 'missing') a.pop();
        if (mutation === 'extra') a.push({ name: 'extra', type: 'predicate', probability: 1 });
        if (mutation === 'type') a[0].type = 'predicate';
        if (mutation === 'selection') a[0].choice = 'docs';
        if (mutation === 'distribution') a[0].probabilities.push({ value: 'extra', probability: 0 });
        if (mutation === 'mean') a[2].score = 2;
      } else {
        if (mutation === 'missing') delete a.ready;
        if (mutation === 'extra') a.extra = { type: 'noul', noul: 1 };
        if (mutation === 'type') a.kind.type = 'noul';
        if (mutation === 'selection') a.kind.choice = 'docs';
        if (mutation === 'distribution') a.kind.probabilities.extra = 0;
        if (mutation === 'mean') a.size.score = 2;
      }
      await assert.rejects(async () => normalizeAnswers(f.input.questions, (await invoke(provider, f)).answers), { code: 'invalid_response' });
    }
  });

  test(`${provider} does not invent absent metadata`, async () => {
    const f = fixture(provider); delete f.response.model; delete f.response.routing; delete f.response.usage;
    const result = await invoke(provider, f);
    for (const key of ['resolvedModel', 'usage', 'requestId', 'modelDigest']) assert.equal(Object.hasOwn(result, key), false);
  });
}

for (const [name, change] of [
  ['answer names', f => f.response.answers[1] = structuredClone(f.response.answers[0])],
  ['choice probabilities', f => f.response.answers[0].probabilities[1] = structuredClone(f.response.answers[0].probabilities[0])],
  ['score probabilities', f => f.response.answers[2].probabilities[1] = structuredClone(f.response.answers[2].probabilities[0])],
]) test(`OpenAI rejects same-length duplicate ${name} before map conversion`, async () => {
  const f = fixture('openai'); change(f);
  assert.equal(f.response.answers.length, 3);
  assert.equal(f.response.answers[0].probabilities.length, 2);
  assert.equal(f.response.answers[2].probabilities.length, 3);
  await assert.rejects(invoke('openai', f), { code: 'invalid_response' });
});

test('OpenAI rejects mismatched level labels and preserves mixed refusals', async () => {
  const invalid = fixture('openai'); invalid.response.answers[2].probabilities[0].label = 'wrong';
  await assert.rejects(invoke('openai', invalid), { code: 'invalid_response' });
  const f = fixture('openai'); f.response.answers[0] = { name: 'kind', type: 'refusal' };
  const result = normalizeAnswers(f.input.questions, (await invoke('openai', f)).answers);
  assert.deepEqual(result.kind, { type: 'choice', status: 'refused', outcome: 'refused' }); assert.equal(result.ready.outcome, 'yes');
});

test('System One validates score index/legend identity rather than relabeling malformed data', async () => {
  for (const change of [a => a.size.probabilities.extra = 0, a => a.size.legend['0'] = 'wrong', a => delete a.size.probabilities['1'], a => a.kind.choice = undefined]) {
    const f = fixture('jev'); change(f.response.answers); await assert.rejects(invoke('jev', f), { code: 'invalid_response' });
  }
});

test('hosted keys are required before any request and Laya optional auth is explicit', async () => {
  for (const provider of ['jev', 'openai']) for (const value of [undefined, '', '  ', 'bad\nheader']) {
    await assert.rejects(invoke(provider, undefined, undefined, { env: { [provider === 'jev' ? 'TYPESAFE_API_KEY' : 'OPENAI_API_KEY']: value }, fetchImpl: () => assert.fail('must not fetch') }), { code: 'invalid_config' });
  }
  await invoke('laya', undefined, undefined, { env: { LAYA_API_KEY: 'synthetic-key', LAYA_URL: 'http://localhost:8001/prefix/' }, fetchImpl: async (url, init) => {
    assert.equal(String(url), 'http://localhost:8001/prefix/v1/systemone'); assert.equal(new Headers(init.headers).get('authorization'), 'Bearer synthetic-key'); return Response.json(fixture('laya').response);
  } });
});

test('Ollama accepts only loopback URLs and the supported local model tag', async () => {
  for (const url of ['http://localhost:9000', 'http://127.0.0.2:9000', 'http://[::1]:9000']) await invoke('ollama', undefined, undefined, { env: { OLLAMA_URL: url } });
  for (const url of ['https://ollama.com', 'http://192.168.1.2', 'http://localhost.example', 'http://user:secret@localhost', 'file:///tmp/socket', 'http://localhost/?key=x', 'http://localhost/#secret', 'not a URL']) {
    await assert.rejects(invoke('ollama', undefined, undefined, { env: { OLLAMA_URL: url }, fetchImpl: () => assert.fail('must not fetch') }), { code: 'invalid_config' });
  }
  for (const model of ['clef:cloud', 'clef-flash:9b-cloud', 'clef-flash', 'nimble:9b', 'https://host/model']) {
    const f = fixture('ollama'); f.input.engine.model = model;
    await assert.rejects(invoke('ollama', f, f.response, { fetchImpl: () => assert.fail('must not fetch') }), { code: 'invalid_input' });
  }
});

test('Laya rejects boolean-like choices, unpinned model names, contradictory routing and truncation', async () => {
  for (const id of ['yes', 'NO', 'True', 'false']) {
    const f = fixture('laya'); f.input.questions[0].options[0].id = id;
    await assert.rejects(invoke('laya', f, f.response, { fetchImpl: () => assert.fail('must not fetch') }), { code: 'invalid_input' });
  }
  for (const model of ['auto', 'jev-latest', 'convaiinnovations/laya', '/tmp/model']) {
    const f = fixture('laya'); f.input.engine.model = model;
    await assert.rejects(invoke('laya', f, f.response, { fetchImpl: () => assert.fail('must not fetch') }), { code: 'invalid_input' });
  }
  for (const change of [f => f.response.routing.model = 'multilingual', f => f.response.usage.truncated = true, f => f.response.usage.state_tokens_dropped = 1, f => f.response.usage.truncated_questions = ['kind']]) {
    const f = fixture('laya'); change(f); await assert.rejects(invoke('laya', f), { code: 'invalid_response' });
  }
});

test('HTTP errors are classified without leaking provider bodies or retrying', async () => {
  for (const [status, code] of [[401, 'authentication_failed'], [403, 'authentication_failed'], [429, 'rate_limited'], [400, 'request_rejected'], [422, 'request_rejected'], [500, 'engine_unavailable'], [503, 'engine_unavailable'], [302, 'request_rejected']]) {
    let calls = 0;
    await assert.rejects(requestJson(new URL('https://example.test'), { body: {}, headers: {}, signal: signal(), fetchImpl: async () => { calls++; return new Response('sensitive-provider-body', { status }); } }), error => error.code === code && !error.message.includes('sensitive'));
    assert.equal(calls, 1);
  }
  await assert.rejects(requestJson(new URL('https://example.test'), { body: {}, headers: {}, signal: signal(), fetchImpl: async () => { throw Error('secret credentials'); } }), error => error.code === 'engine_unavailable' && !error.message.includes('secret'));
  await assert.rejects(requestJson(new URL('https://example.test'), { body: {}, headers: {}, signal: signal(), fetchImpl: async () => new Response('not JSON') }), { code: 'invalid_response' });
});

test('chunked oversized HTTP body is cancelled before parsing', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(40000)); }, cancel() { cancelled = true; } });
  await assert.rejects(requestJson(new URL('https://example.test'), { body: {}, headers: {}, signal: signal(), fetchImpl: async () => new Response(body) }), { code: 'invalid_response' });
  assert.equal(cancelled, true);
});

test('real HTTP redirects are not followed', async t => {
  let requests = 0;
  const server = createServer((req, res) => { requests++; res.writeHead(302, { location: '/next' }); res.end(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await assert.rejects(requestJson(new URL(`http://127.0.0.1:${server.address().port}`), { body: {}, headers: {}, signal: signal(), fetchImpl: fetch }), { code: 'engine_unavailable' });
  assert.equal(requests, 1);
});
