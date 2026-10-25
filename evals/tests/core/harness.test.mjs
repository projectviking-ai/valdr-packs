import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createAuthorBroker } from '../../core/mcp.mjs'
import { installAgent, loadAgentSource } from '../../core/agents.mjs'


test('shared broker denies by default and records denials without leaking request secrets', async () => {
  let forwarded = 0
  const broker = await createAuthorBroker({ request: async () => { forwarded++; return {} } })
  try {
    const response = await fetch(broker.url, { method: 'POST', headers: { authorization: `Bearer ${broker.token}` },
      body: JSON.stringify({ method: 'tools/call', params: { name: 'pm_task', arguments: { action: 'get', password: 'hidden' } } }) })
    assert.equal((await response.json()).result.isError, true)
    assert.equal(forwarded, 0)
    assert.equal(broker.requests[0].allowed, false)
    assert.equal(broker.requests[0].params.arguments.password, '[REDACTED]')
  } finally { await broker.close() }
})

test('suite policy scopes tool arguments and audits accepted and refused mutations', async () => {
  const broker = await createAuthorBroker({ request: async () => ({ structuredContent: { data: { saved: true } } }) },
    { requestAllowed: (method, params) => method === 'tools/call' && params.name === 'pm_task' && params.arguments.taskKey === 'FIX-1' })
  try {
    for (const taskKey of ['FIX-1', 'OTHER-2']) {
      const response = await fetch(broker.url, { method: 'POST', headers: { authorization: `Bearer ${broker.token}` },
        body: JSON.stringify({ method: 'tools/call', params: { name: 'pm_task', arguments: { action: 'update', taskKey } } }) })
      assert.equal(Boolean((await response.json()).result.isError), taskKey !== 'FIX-1')
    }
    assert.deepEqual(broker.requests.map(item => [item.allowed, item.completed]), [[true, true], [false, true]])
  } finally { await broker.close() }
})

test('agent sources require an explicit tier and resolve capabilities without crossing upward', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-agent-source-'))
  try {
    const put = (name, content) => { const target = path.join(root, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content) }
    put('sample/agent.agent.yaml', 'agent:\n  handle: sample\n  name: Sample\n  defaultRole: executor\ncapabilities:\n  - key: sample.system\n    role: core\n  - key: valdr.tool\n    role: integration\n    hot-load: true\n')
    put('sample/sample.system.md', '<!--<capability id="sample.system" pack="sample" role="core">-->\nSample persona.\n<!--</capability>-->')
    for (const tier of ['raider', 'vanguard', 'sovereign']) put(`valdr/${tier}/valdr.tool.md`, `<!--<capability id="valdr.tool" pack="valdr" role="integration">-->\n${tier} tool.\n<!--</capability>-->`)
    assert.throws(() => loadAgentSource({ packsRoot: root, agentPath: 'sample/agent.agent.yaml' }), /tier/)
    const agent = loadAgentSource({ packsRoot: root, agentPath: 'sample/agent.agent.yaml', tier: 'vanguard' })
    assert.equal(agent.handle, 'sample')
    assert.equal(agent.role, 'executor')
    assert.equal(agent.capabilities[1].sourcePath, 'valdr/vanguard/valdr.tool.md')
    assert.equal(agent.capabilities[1].hotLoad, true)
    assert.equal(agent.capabilities[1].role, 'integration')
    assert.deepEqual(agent.capabilities.map(item => item.position), [0, 10])
    assert.ok(agent.agent.sha256)
    assert.throws(() => loadAgentSource({ packsRoot: root, agentPath: '../escape.yaml', tier: 'sovereign' }), /inside/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('agent installation rejects mismatched registered capability binding metadata', async () => {
  const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-install-test-'))
  const source = loadAgentSource({ packsRoot: 'valdr-packs', agentPath: 'valdr-workflow/agents/task-repairer/task-repairer.agent.yaml', tier: 'sovereign' })
  const data = value => ({ structuredContent: { data: value } })
  const calls = []
  const environment = { evidenceDir, call: async (name, args) => {
    calls.push([name, args])
    if (name === 'pm_prompt') return data({ prompt: { id: `prompt-${args.key}` } })
    if (name === 'pm_capability' && args.action === 'prompt') return data({ capability: source.capabilities.find(item => item.key === args.key).content })
    if (name === 'pm_agent' && args.action === 'get_prompt') return data({ systemPrompt: source.capabilities.filter(item => !item.hotLoad).map(item => item.content).join('\n') })
    if (name === 'pm_agent' && args.action === 'get') return data({ agent: { handle: source.handle, defaultRole: source.role,
      capabilities: source.capabilities.map(item => ({ ...item, hotLoad: false })) } })
    return data({})
  } }
  try {
    await assert.rejects(installAgent(environment, { packsRoot: 'valdr-packs', agentPath: source.agent.path, tier: 'sovereign' }), /binding/)
  } finally { fs.rmSync(evidenceDir, { recursive: true, force: true }) }
})

