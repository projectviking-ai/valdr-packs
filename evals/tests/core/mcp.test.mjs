import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthorBroker } from '../../core/mcp.mjs'

const send = async (broker, args) => (await fetch(broker.url, {
  method: 'POST', headers: { authorization: `Bearer ${broker.token}` },
  body: JSON.stringify({ method: 'tools/call', params: { name: 'pm_task', arguments: args } }),
})).json()

test('broker lifecycle audit distinguishes overlapping requests from reads after completed writes', async () => {
  let releaseUpdate, signalUpdateStarted
  const updateStarted = new Promise(resolve => { signalUpdateStarted = resolve })
  const updateBlocked = new Promise(resolve => { releaseUpdate = resolve })
  const originalParameters = []
  const broker = await createAuthorBroker({ request: async (method, params) => {
    originalParameters.push(params)
    if (params.arguments.action === 'update') {
      signalUpdateStarted()
      await updateBlocked
    }
    return { structuredContent: { data: { observed: params.arguments.action } } }
  } }, { requestAllowed: (method, params) => {
    assert.equal(params.arguments.password, 'test-credential')
    return true
  } })
  let updateResponse
  try {
    updateResponse = send(broker, { action: 'update', taskKey: 'FIX-1', password: 'test-credential' })
    await updateStarted
    const readResponse = await send(broker, { action: 'get', taskKey: 'FIX-1', password: 'test-credential' })
    assert.equal(readResponse.result.structuredContent.data.observed, 'get')
    assert.equal(broker.requests[0].completed, false, 'The read must complete while the update remains in flight')
    assert.equal(broker.requests[1].completed, true)
    assert.deepEqual(broker.requests.map(entry => entry.startedOrder), [1, 2])
    assert.equal(broker.requests[1].completedOrder, 3)
    assert.equal(broker.requests[0].completedOrder, undefined)
    releaseUpdate()
    assert.equal((await updateResponse).result.structuredContent.data.observed, 'update')
    assert.equal(broker.requests[0].completedOrder, 4)
    assert.deepEqual(broker.requests.map(entry => entry.sequence), [1, 2])
    assert.ok(broker.requests[1].startedOrder < broker.requests[0].completedOrder)
    assert.ok(broker.requests[1].completedOrder < broker.requests[0].completedOrder)
    assert.deepEqual(originalParameters.map(params => params.arguments.password), ['test-credential', 'test-credential'])
    assert.deepEqual(broker.requests.map(entry => entry.params.arguments.password), ['[REDACTED]', '[REDACTED]'])
  } finally {
    releaseUpdate()
    await updateResponse?.catch(() => {})
    await broker.close()
  }
})

test('broker lifecycle ordering includes denied calls, authority errors, and policy errors', async () => {
  const broker = await createAuthorBroker({ request: async () => { throw new Error('Authority unavailable') } },
    { requestAllowed: (method, params) => {
      if (params.arguments.action === 'policy-error') throw new Error('Policy unavailable')
      return params.arguments.action !== 'denied'
    } })
  try {
    assert.equal((await send(broker, { action: 'denied' })).result.isError, true)
    assert.equal((await send(broker, { action: 'get' })).error.message, 'Authority unavailable')
    assert.equal((await send(broker, { action: 'policy-error' })).error.message, 'Policy unavailable')
    assert.deepEqual(broker.requests.map(entry => [entry.startedOrder, entry.completedOrder, entry.completed]), [
      [1, 2, true], [3, 4, true], [5, 6, true],
    ])
    assert.deepEqual(broker.requests.map(entry => entry.allowed), [false, true, false])
  } finally { await broker.close() }
})


test('broker rejects malformed and same-length incorrect credentials without forwarding', async t => {
  let calls = 0
  const broker = await createAuthorBroker({ request: async () => { calls++; return {} } }, { requestAllowed: () => true })
  t.after(() => broker.close())
  for (const authorization of ['', 'Bearer short', `Bearer ${'z'.repeat(broker.token.length)}`, `Basic ${broker.token}`]) {
    const response = await fetch(broker.url, { method: 'POST', headers: { authorization }, body: JSON.stringify({ method: 'tools/list' }) })
    assert.equal(response.status, 403)
  }
  assert.equal(calls, 0)
  assert.equal(broker.requests.length, 0)
})
