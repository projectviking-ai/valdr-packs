import assert from 'node:assert/strict'
import { closeIntegrationResources } from './cleanup.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createIsolatedEnvironment, dataOf } from '../../core/harness.mjs'
import { writeEvidence } from '../../core/evidence.mjs'
import { createMcpSession, createAuthorBroker } from '../../core/mcp.mjs'
import { authorRequestAllowed } from '../../suites/workflow-authoring/policy.mjs'
import { inspectBundleSafety } from '../../suites/workflow-authoring/evaluate.mjs'

import { seedRuntimeFixtures } from '../../suites/workflow-authoring/fixtures.mjs'

// Installed CLI integration smoke: one owned Valdr authority, one filtered author client.
const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdandi-policy-evidence-'))
const report = { ok: false, evidenceDir, providerCalls: 0 }
let environment, broker, client
try {
  environment = await createIsolatedEnvironment({ valdrBin: process.argv[2], evidenceDir, mode: 'runtime', label: 'public-policy-smoke', requiredTools: ['pm_workflow'] })
  report.binary = environment.binary
  report.root = environment.root
  await seedRuntimeFixtures(environment)
  broker = await createAuthorBroker(environment.session, { requestAllowed: authorRequestAllowed })
  client = await createMcpSession({ command: process.execPath,
    args: [fileURLToPath(new URL('../../core/proxy.mjs', import.meta.url))],
    cwd: environment.repoRoot, env: { PATH: process.env.PATH,
      VALDR_EVAL_PROXY_URL: broker.url, VALDR_EVAL_PROXY_TOKEN: broker.token } })
  const request = (name, args) => client.callTool(name, args)
  for (const [name, args] of [
    ['pm_task', { action: 'create', key: 'BENCH-3', projectKey: 'BENCH', title: 'Must not be created', status: 'to_do', reporter: '@benchmark' }],
    ['pm_workflow', { action: 'test_definition' }],
    ['pm_workflow', { action: 'start' }],
    ['pm_session', { action: 'launch_prompt' }],
    ['pm_provider', { action: 'create_preset' }],
  ]) {
    const rejected = await request(name, args)
    assert.equal(rejected.isError, true)
    assert.match(rejected.content[0].text, /client refused/)
  }
  const missing = await environment.call('pm_task', { action: 'get', taskKey: 'BENCH-3' }, { allowIsError: true })
  assert.equal(missing.isError, true, 'Rejected author mutation must not reach authority')
  assert.notEqual((await request('pm_workflow', { action: 'help', topic: 'validate' })).isError, true)
  const definition = { schemaVersion: '1.0', workflow: {
    key: 'benchmark.policy-probe', name: 'Policy probe', version: '0.1.0', pack: 'benchmark',
    source: { kind: 'capability', capabilityKey: 'benchmark.policy-probe' }, start: { mode: 'manual' },
    inputs: {}, outputs: {}, steps: [{ key: 'probe', name: 'Probe', kind: 'tool',
      tool: { id: 'command', action: 'run' }, inputs: { command: "printf '%s' 'safe'", timeoutSeconds: 5 } }],
  } }
  assert.equal(dataOf(await request('pm_workflow', { action: 'validate', definitionJson: definition })).valid, true)
  const saved = await request('pm_workflow', { action: 'save_definition', definitionJson: definition,
    capabilityKey: 'benchmark.policy-probe', packKey: 'benchmark', sourceRelpath: 'policy-probe.workflow.yaml' })
  assert.notEqual(saved.isError, true, 'Author must retain definition registration')
  assert.deepEqual(dataOf(await environment.call('pm_workflow', { action: 'list_runs', limit: 10 })).runs, [])
  const safety = inspectBundleSafety({ entryWorkflowKey: definition.workflow.key, definitions: [definition] })
  assert.equal(safety.safe, true, JSON.stringify(safety.errors))
  const executed = dataOf(await environment.call('pm_workflow', { action: 'test_definition', definitionJson: definition,
    taskKey: 'BENCH-1', actorHandle: '@benchmark', clientRequestId: await environment.uid() }))
  const runUlid = executed.run.runUlid
  let run
  for (let i = 0; i < 10; i++) {
    run = dataOf(await environment.call('pm_workflow', { action: 'get_run', runUlid, includeSteps: true }))
    if (['completed', 'blocked', 'failed', 'cancelled'].includes(run.run.status)) break
    await environment.call('pm_workflow', { action: 'advance', runUlid })
  }
  run = dataOf(await environment.call('pm_workflow', { action: 'get_run', runUlid, includeSteps: true }))
  assert.equal(run.run.status, 'completed', 'Trusted evaluator must execute the safe command through the binary')
  writeEvidence(path.join(evidenceDir, 'execution.json'), run)
  report.ok = true
} catch (error) {
  report.error = error.message
} finally {
  report.cleanup = await closeIntegrationResources({client,broker,environment})
  if (!report.cleanup.ok) { report.ok = false; report.cleanupError = report.cleanup.errors.join('; ') }
  writeEvidence(path.join(evidenceDir, 'integration.json'), report)
}
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
