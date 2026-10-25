import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import test from 'node:test'

import * as harness from '../../core/harness.mjs'
import { captureSubmission, redactEvidence } from '../../core/evidence.mjs'
import { configureRuntimeEnvironment } from '../runtime-environment.mjs'


test('shared PM homes cannot pass the ownership gate', () => {
  for (const candidate of [path.join(os.homedir(), '.valdr/pm'), path.join(os.tmpdir(), 'unowned'), `${harness.OWNED_PREFIX}fake/../shared`]) {
    assert.throws(() => harness.assertOwnedHome(candidate))
  }
})

test('captured submissions remain byte exact after the author edits its candidate', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verdandi-submission-test-'))
  try {
    const candidate = path.join(root, 'bundle.json')
    const target = path.join(root, 'first.json')
    fs.writeFileSync(candidate, '{"definitions":[],"entryWorkflowKey":"first"}\n')
    captureSubmission(candidate, target)
    fs.writeFileSync(candidate, '{"definitions":[],"entryWorkflowKey":"later"}\n')
    assert.equal(fs.readFileSync(target, 'utf8'), '{"definitions":[],"entryWorkflowKey":"first"}\n')
    assert.throws(() => captureSubmission(candidate, target))
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('evidence redaction removes credentials without dropping provider messages', () => {
  assert.deepEqual(redactEvidence({ callbackToken: 'private', message: 'hello', nested: { apiKey: 'secret' } }),
    { callbackToken: '[REDACTED]', message: 'hello', nested: { apiKey: '[REDACTED]' } })
})

test('serialized provider payloads are redacted without changing their envelope type', () => {
  const actual = redactEvidence({ payloadJson: JSON.stringify({ env: { apiKey: 'private' }, usage: { input_tokens: 12 } }) })
  assert.equal(typeof actual.payloadJson, 'string')
  assert.deepEqual(JSON.parse(actual.payloadJson), { env: { apiKey: '[REDACTED]' }, usage: { input_tokens: 12 } })
})

function fakeBinary(directory, behavior) {
  const executable = path.join(directory, `valdr-${behavior}`)
  fs.writeFileSync(executable, String.raw`#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), readline = require('node:readline');
if (process.argv[2] === 'version') { console.log('valdr 99.0.0 test'); process.exit(0); }
const home = process.argv[process.argv.indexOf('--pm-home') + 1];
const lines = readline.createInterface({ input: process.stdin });
lines.on('line', line => {
 const request = JSON.parse(line); fs.appendFileSync(${JSON.stringify(path.join(directory, `${behavior}-requests.jsonl`))}, line + '\n');
 if (request.id === undefined) return;
 let result;
 if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fake-valdr', version: '99' } };
 else if (request.method === 'tools/list') result = { tools: ${JSON.stringify(behavior === 'missing' ? [] : [{ name: 'pm_health' }, { name: 'pm_workflow' }])} };
 else if (${JSON.stringify(behavior)} === 'missing') result = { isError: true, content: [{ type: 'text', text: 'Required tool unavailable.' }] };
 else if (request.params.name === 'pm_health') result = { structuredContent: { data: { info: { dataDir: ${JSON.stringify(behavior)} === 'wrong-home' ? '/different/pm' : home } } } };
 else result = { structuredContent: { data: { sessions: [] } } };
 console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
});
`, { mode: 0o700 })
  return executable
}

for (const behavior of ['ready', 'wrong-home', 'missing']) test(`binary preflight ${behavior} verifies isolation and closes the owned process`, { skip: process.platform === 'win32' }, async t => {
  configureRuntimeEnvironment(t)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'verdandi-binary-test-'))
  const evidenceDir = path.join(directory, 'evidence')
  let environment, root
  try {
    const operation = harness.createIsolatedEnvironment({ valdrBin: fakeBinary(directory, behavior), evidenceDir, requiredTools: ['pm_workflow'], mode: 'runtime' })
    if (behavior === 'ready') {
      environment = await operation
      root = environment.root
      assert.equal(environment.home, environment.health.info.dataDir)
      assert.equal(environment.binary.version, 'valdr 99.0.0 test')
      assert.equal(environment.tools.length, 2)
      const [firstReceipt, concurrentReceipt] = await Promise.all([environment.close(), environment.close()])
      assert.strictEqual(concurrentReceipt, firstReceipt)
      assert.strictEqual(await environment.close(), firstReceipt)
      assert.equal(firstReceipt.authorityClosed, true)
      assert.equal(firstReceipt.root, root)
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(evidenceDir, 'cleanup.json'))), firstReceipt)
      assert.equal(environment.session.closed, true)
    } else {
      await assert.rejects(operation, behavior === 'missing' ? /preflight failed.*workflow/ : /wrong PM home/)
      root = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'startup-failure.json'))).root
    }
    const receipt = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'cleanup.json')))
    assert.equal(receipt.authorityClosed, true)
    assert.equal(fs.existsSync(root), false)
    const calls = fs.readFileSync(path.join(directory, `${behavior}-requests.jsonl`), 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(calls.some(call => call.params?.name === 'pm_session'), false, 'Unverified authority must never receive cleanup mutations')
    assert.equal(calls.some(call => ['create', 'ensure', 'save_definition'].includes(call.params?.arguments?.action)), false)
  } finally {
    await environment?.close()
    if (root) fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('shared preflight requires suite-declared tools before any fixture writes', { skip: process.platform === 'win32' }, async t => {
  configureRuntimeEnvironment(t)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-suite-tools-test-'))
  const evidenceDir = path.join(directory, 'evidence')
  let root
  try {
    await assert.rejects(harness.createIsolatedEnvironment({ valdrBin: fakeBinary(directory, 'ready'), evidenceDir, requiredTools: ['pm_task'] }), /missing pm_task/)
    root = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'startup-failure.json'))).root
    assert.equal(JSON.parse(fs.readFileSync(path.join(evidenceDir, 'cleanup.json'))).authorityClosed, true)
    const calls = fs.readFileSync(path.join(directory, 'ready-requests.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(calls.some(call => ['create', 'ensure', 'save_definition'].includes(call.params?.arguments?.action)), false)
  } finally {
    if (root) fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

