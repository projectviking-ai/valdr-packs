// Uses a local mock Responses endpoint: exercises installed Codex without a model call.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { getCodexBinaryInfo } from '../../core/binary.mjs'
import { runAgentTurn } from '../../core/author.mjs'
import { createAuthorBroker } from '../../core/mcp.mjs'
import { authorRequestAllowed } from '../../suites/workflow-authoring/policy.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-author-scope-'))
const repoRoot = path.join(root, 'repo')
fs.mkdirSync(repoRoot)
execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' })
const authorBinary = getCodexBinaryInfo()
const requests = [], forwarded = []
const provider = http.createServer(async (request, response) => {
  let text = ''
  for await (const chunk of request) text += chunk
  if (!text) { response.writeHead(404); response.end(); return }
  const payload = JSON.parse(text)
  requests.push(payload)
  response.writeHead(200, { 'content-type': 'text/event-stream' })
  const item = requests.length % 2 === 1
    ? { type: 'custom_tool_call', id: `ct_${requests.length}`, call_id: `call_${requests.length}`, name: 'exec', namespace: 'functions',
      input: `const resources=await tools.list_mcp_resources({});
const page=await tools.list_mcp_resources({server:"valdr",cursor:"resource-page-2"});
const templates=await tools.list_mcp_resource_templates({});
const templatePage=await tools.list_mcp_resource_templates({server:"valdr",cursor:"template-page-2"});
const denied=await tools.mcp__valdr__pm_task({action:"delete",taskKey:"GUARD-1"});
text({tools:ALL_TOOLS.map(t=>t.name),forbidden:typeof tools.mcp__valdr_alpha__pm_task,shell:typeof tools.exec_command,denied:denied.isError,resources,page,templates,templatePage});` }
    : { type: 'message', id: `msg_${requests.length}`, role: 'assistant', status: 'completed',
      content: [{ type: 'output_text', text: 'Scope probe completed.', annotations: [] }] }
  const result = { id: `resp_${requests.length}`, object: 'response', created_at: Math.floor(Date.now() / 1000),
    model: 'gpt-6.1-sol', status: 'completed', output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }
  for (const event of [
    { type: 'response.created', response: { ...result, status: 'in_progress', output: [] } },
    { type: 'response.output_item.added', output_index: 0, item },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: result },
  ]) response.write(`data: ${JSON.stringify(event)}\n\n`)
  response.end()
})
let broker
try {
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve))
  broker = await createAuthorBroker({
    initializeResult: { protocolVersion: '2024-11-05', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'scope-probe', version: '1' } },
    request: async (method, params) => {
      forwarded.push({ method, params })
      if (method === 'tools/list') return { tools: [{ name: 'pm_task', description: 'Scope probe task', inputSchema: {
        type: 'object', properties: { action: { type: 'string' }, taskKey: { type: 'string' } }, required: ['action', 'taskKey'],
      } }] }
      if (method === 'resources/list') return { resources: [{
        uri: params?.cursor === 'resource-page-2' ? 'scope://second' : 'scope://first', name: 'Scope resource', mimeType: 'text/plain',
      }] }
      if (method === 'resources/templates/list') return { resourceTemplates: [{
        uriTemplate: params?.cursor === 'template-page-2' ? 'scope://second-template/{id}' : 'scope://template/{id}', name: 'Scope template', mimeType: 'text/plain',
      }] }
      throw new Error(`Unexpected scope-probe request: ${method}`)
    },
  }, { requestAllowed: authorRequestAllowed })
  const config = `{name="Local scope probe",base_url="http://127.0.0.1:${provider.address().port}/v1",wire_api="responses",requires_openai_auth=false}`
  const wrapper = path.join(root, 'codex.mjs')
  fs.writeFileSync(wrapper, `import {spawn} from 'node:child_process';
const args=process.argv.slice(2);args.splice(args.includes('resume') ? args.indexOf('resume')+2 : args.indexOf('exec')+1,0,'-c','model_provider="eval_scope_probe"','-c','features.enable_request_compression=false','-c',${JSON.stringify(`model_providers.eval_scope_probe=${config}`)});
const child=spawn(${JSON.stringify(authorBinary.path)},args,{stdio:'inherit',env:process.env});child.on('error',()=>process.exit(1));child.on('exit',code=>process.exit(code??1));`)
  const environment = { root, repoRoot, broker }
  const options = { authorBinary, agent: { handle: 'scope-probe', expectedSystemPrompt: 'Scope verification only.' },
    profile: { providerType: 'codex', model: 'gpt-6.1-sol', reasoningEffort: 'high' },
    prompt: 'Run the scope probe.', timeoutMs: 20000 }
  const first = await runAgentTurn(environment, { ...options, outputDir: path.join(root, 'first') }, { command: process.execPath, commandArgs: [wrapper] })
  const second = await runAgentTurn(environment, { ...options, prompt: 'Continue the same probe.', sessionUlid: first.sessionUlid,
    outputDir: path.join(root, 'repair') }, { command: process.execPath, commandArgs: [wrapper] })
  assert.equal(second.sessionUlid, first.sessionUlid)
  assert.equal(second.resumed, true)
  for (const attempt of ['first','repair']) {
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,attempt,'provider-launch.json'))).authorBinary,authorBinary)
    const events = JSON.parse(fs.readFileSync(path.join(root,attempt,'provider-events.json')))
    const discovery = events.filter(event => event.type === 'item.completed' && event.item?.type === 'mcp_tool_call'
      && ['list_mcp_resources','list_mcp_resource_templates'].includes(event.item.tool))
    assert.deepEqual(discovery.map(event => [event.item.server,event.item.tool,event.item.arguments]), [
      ['codex','list_mcp_resources', {}],
      ['valdr','list_mcp_resources', {server:'valdr',cursor:'resource-page-2'}],
      ['codex','list_mcp_resource_templates', {}],
      ['valdr','list_mcp_resource_templates', {server:'valdr',cursor:'template-page-2'}],
    ])
    assert.ok(discovery.every(event => event.item.status === 'completed' && !event.item.error))
  }
  assert.equal(first.settled && second.settled && first.cleanup.ok && second.cleanup.ok, true)
  assert.equal(requests.length, 4)
  const allInput = requests.flatMap(request => request.input)
  const catalog = allInput.filter(item => item.type === 'custom_tool_call_output')
    .flatMap(item => item.output).filter(item => item.text?.startsWith('{"tools":')).map(item => JSON.parse(item.text))
  assert.ok(catalog.length >= 2)
  for (const item of catalog) {
    assert.deepEqual(item.tools.filter(name => name.startsWith('mcp__')), ['mcp__valdr__pm_task'])
    assert.equal(item.forbidden, 'undefined')
    assert.equal(item.shell, 'undefined')
    assert.equal(item.denied, true)
    assert.deepEqual(JSON.parse(item.resources).resources.map(resource=>[resource.server,resource.uri]), [['valdr','scope://first']])
    assert.deepEqual(JSON.parse(item.page).resources.map(resource=>[resource.server,resource.uri]), [['valdr','scope://second']])
    assert.deepEqual(JSON.parse(item.templates).resourceTemplates.map(template=>[template.server,template.uriTemplate]), [['valdr','scope://template/{id}']])
    assert.deepEqual(JSON.parse(item.templatePage).resourceTemplates.map(template=>[template.server,template.uriTemplate]), [['valdr','scope://second-template/{id}']])
    for (const forbidden of ['create_goal', 'spawn_agent', 'exec_command']) assert.ok(!item.tools.includes(forbidden))
  }
  assert.equal(forwarded.some(entry => entry.method === 'tools/call'), false)
  assert.equal(broker.requests.filter(entry => entry.method === 'tools/call' && !entry.allowed).length, 2)
  assert.equal(forwarded.filter(entry => entry.method === 'resources/list' && entry.params?.cursor === 'resource-page-2').length, 2)
  assert.equal(forwarded.filter(entry => entry.method === 'resources/templates/list' && entry.params?.cursor === 'template-page-2').length, 2)
  assert.ok(broker.requests.filter(entry => ['resources/list','resources/templates/list'].includes(entry.method)).every(entry => entry.allowed && entry.completed))
  const text = JSON.stringify(requests[0].input)
  assert.ok(text.includes('Scope verification only.'))
  assert.ok(!text.includes('<skills_instructions>'))
  assert.equal(requests[0].model, options.profile.model)
  assert.equal(requests[0].reasoning.effort, 'high')
  console.log(JSON.stringify({ ok: true, providerCalls: 0, turns: 2, sameThread: true, brokerOnly: true, resourceDiscoveryCalls: 8, deniedCalls: 2 }))
} finally {
  await broker?.close()
  provider.closeAllConnections()
  await new Promise(resolve => provider.close(resolve))
  fs.rmSync(root, { recursive: true, force: true })
}
