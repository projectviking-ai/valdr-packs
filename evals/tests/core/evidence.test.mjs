import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { redactEvidence, registerEvidenceSecrets, writeEvidence } from '../../core/evidence.mjs'

test('common short credentials do not corrupt public artifact paths or token usage', () => {
  registerEvidenceSecrets(['pack'])
  assert.deepEqual(redactEvidence({ directory: '/tmp/pack-evals', password: 'pack',
    diagnostic: 'VALDR_DB_PASSWORD=pack', usage: { cached_input_tokens: 10, cache_write_input_tokens: 2, reasoning_output_tokens: 3 } }), {
    directory: '/tmp/pack-evals', password: '[REDACTED]', diagnostic: 'VALDR_DB_PASSWORD=[REDACTED]',
    usage: { cached_input_tokens: 10, cache_write_input_tokens: 2, reasoning_output_tokens: 3 },
  })
})

test('short credentials are redacted from quoted assignments inside diagnostic text', () => {
  registerEvidenceSecrets(['short'])
  assert.equal(redactEvidence('auth failure: {"password":"short"}'), 'auth failure: {"password":"[REDACTED]"}')
  assert.equal(redactEvidence("failed 'VALDR_DB_PASSWORD' = 'short'"), "failed 'VALDR_DB_PASSWORD' = '[REDACTED]'")
})

test('unregistered plaintext credential assignments are redacted while surrounding diagnostics stay readable', () => {
  const examples = [
    ['Command returned api_key=synthetic-secret-1234567890; status=failed', 'Command returned api_key=[REDACTED]; status=failed'],
    ['Tool returned OPENAI_API_KEY="synthetic quoted secret" taskKey=REPAIR-1', 'Tool returned OPENAI_API_KEY="[REDACTED]" taskKey=REPAIR-1'],
    ["Failed 'VALDR_DB_PASSWORD' = 'synthetic spaced password'; attempts=2", "Failed 'VALDR_DB_PASSWORD' = '[REDACTED]'; attempts=2"],
    ['Diagnostic: {"access_token":"synthetic-token-value","action":"get"}', 'Diagnostic: {"access_token":"[REDACTED]","action":"get"}'],
    ['Tool error: auth_key="synthetic \\"quoted\\" value"; retry=false', 'Tool error: auth_key="[REDACTED]"; retry=false'],
    ['Result access-key=synthetic-access; credential=synthetic-credential; private_key=synthetic-private', 'Result access-key=[REDACTED]; credential=[REDACTED]; private_key=[REDACTED]'],
    ['Authorization: Basic synthetic-auth-value; endpoint=/public', 'Authorization: Basic [REDACTED]; endpoint=/public'],
    ['GET /resource?api_key=synthetic-query-secret&action=get', 'GET /resource?api_key=[REDACTED]&action=get'],
    ['usage: input_tokens=200 cached_input_tokens=100 cache_write_input_tokens=2 reasoning_output_tokens=3 output_tokens=30 tokenCount=230; token=123456', 'usage: input_tokens=200 cached_input_tokens=100 cache_write_input_tokens=2 reasoning_output_tokens=3 output_tokens=30 tokenCount=230; token=[REDACTED]'],
  ]
  for (const [input, expected] of examples) assert.equal(redactEvidence(input), expected)
  assert.equal(redactEvidence('action=get taskKey=REPAIR-1 attempt=2 /tmp/pack-evals/my-token-fixture'), 'action=get taskKey=REPAIR-1 attempt=2 /tmp/pack-evals/my-token-fixture')
})

test('evidence removes credentials in structured fields, serialized payloads and free text', () => {
  const text = 'Connect postgres://demo:fixture-pass@localhost/db; Authorization: Bearer fixture-access-token';
  const input = { databaseUrl: 'connection', privateKey: 'key', accessTokens: ['fixture-array-token'], message: text,
    nested: JSON.stringify({ message: text, input_tokens: 12 }),
    pem: '-----BEGIN PRIVATE KEY-----\nfixture-key-material\n-----END PRIVATE KEY-----' };
  const output = redactEvidence(input);
  const serialized = JSON.stringify(output);
  for (const value of ['fixture-pass', 'fixture-access-token', 'fixture-array-token', 'fixture-key-material', '"connection"', '"key"']) assert.ok(!serialized.includes(value), value);
  assert.equal(JSON.parse(output.nested).input_tokens, 12);
  assert.match(output.message, /localhost\/db/);
  assert.equal(output.privateKey, '[REDACTED]');
});

test('registered secrets are removed from unlabelled error text before evidence is saved', t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'eval-redaction-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  registerEvidenceSecrets(['fixture-opaque-credential-987654']);
  const file=path.join(directory,'summary.json');
  writeEvidence(file,{error:'Startup echoed fixture-opaque-credential-987654',assertions:3});
  const saved=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(saved,/fixture-opaque-credential-987654/);
  assert.deepEqual(JSON.parse(saved),{error:'Startup echoed [REDACTED]',assertions:3});
});
