import { describe, it as test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { evaluateBundle, inspectAuthorContract, inspectBundleSafety, scoreVariant } from '../../suites/workflow-authoring/evaluate.mjs'
import { isSafePrintf } from '../../suites/workflow-authoring/command-safety.mjs'
import { scenarios } from '../../suites/workflow-authoring/scenarios.mjs'
import { configureRuntimeEnvironment } from '../runtime-environment.mjs'

const bundleOf = steps => ({ entryWorkflowKey: 'benchmark.fixture', definitions: [{ schemaVersion: '1.0', workflow: {
  key: 'benchmark.fixture', name: 'Fixture', version: '1.0.0', start: { mode: 'manual' }, inputs: {}, outputs: {}, steps,
} }] })
const score = (variant, execution) => scoreVariant({ scenario: { id: 'fixture' }, variant, execution })

function optionalLookup(variantId = 'found') {
  const scenario = scenarios.find(item => item.id === '06_optional_task_lookup')
  const variant = scenario.variants.find(item => item.id === variantId), found = variantId === 'found'
  const execution = {
    run: { runUlid: 'lookup-run', status: 'completed', inputJson: { lookupKey: found ? 'BENCH-1' : 'BENCH-404' },
      outputJson: { found, requestedKey: found ? 'BENCH-1' : 'BENCH-404' } },
    definition: { workflow: { steps: [
      { key: 'inspect_task', kind: 'tool', tool: { id: 'pm_task', action: 'get' },
        inputs: { taskKey: '${workflow.inputs.lookupKey}', allowMissing: true },
        outputs: { present: '$.normalized.found', record: '$.normalized.task' } },
      { key: 'prepare_found', kind: 'condition', outputs: { renamed: { record: '${steps.inspect_task.outputs.record}' } } },
      { key: 'report_found', kind: 'condition', outputs: { taskKey: '${steps.prepare_found.outputs.renamed.record.key}' } },
    ], outputMappings: { found: '${steps.inspect_task.outputs.present}', requestedKey: '${workflow.inputs.lookupKey}' } } },
    steps: [], attempts: [], events: [], children: [],
  }
  const values = { inspect_task: { present: found, record: found ? { key: 'BENCH-1' } : null },
    prepare_found: { renamed: { record: { key: 'BENCH-1' } } }, report_found: { taskKey: 'BENCH-1' } }
  for (const [index, stepKey] of variant.expectedSteps.entries()) {
    const attempt = { runUlid: 'lookup-run', stepKey, stepRunUlid: `${stepKey}-1`, attempt: 1, status: 'completed', outputJson: values[stepKey] ?? {},
      inputJson: stepKey === 'inspect_task' ? { taskKey: execution.run.inputJson.lookupKey, allowMissing: true,
        action: 'get', clientRequestId: 'wf:lookup-run:inspect_task:1' } : {} }
    execution.steps.push(structuredClone(attempt)); execution.attempts.push(attempt)
    execution.events.push({ runUlid: 'lookup-run', seq: index * 2 + 1, stepKey, stepRunUlid: attempt.stepRunUlid, eventType: 'step_started' },
      { runUlid: 'lookup-run', seq: index * 2 + 2, stepKey, stepRunUlid: attempt.stepRunUlid, eventType: 'step_completed',
        payloadJson: stepKey === 'inspect_task' ? { toolName: 'pm_task', action: 'get', normalized: { found, task: found ? { key: 'BENCH-1' } : null } } : {} })
  }
  return { scenario, variant, execution }
}

function separateTaskRecordLookup() {
  const fixture = optionalLookup(), e = fixture.execution
  const step = e.definition.workflow.steps.find(item => item.key === 'prepare_found')
  Object.assign(step, { kind: 'tool', tool: { id: 'pm_task', action: 'get' },
    inputs: { taskKey: '${workflow.inputs.lookupKey}' }, outputs: { renamed: { record: '$.normalized.task' } } })
  for (const attempt of [...e.steps, ...e.attempts].filter(item => item.stepKey === 'prepare_found')) {
    attempt.inputJson = { taskKey: 'BENCH-1', action: 'get', clientRequestId: 'wf:lookup-run:prepare_found:1' }
  }
  e.events.find(item => item.eventType === 'step_completed' && item.stepKey === 'prepare_found').payloadJson = {
    toolName: 'pm_task', action: 'get', normalized: { task: { key: 'BENCH-1' } },
  }
  return fixture
}

test('workflow scoring provides one canonical assertion for each observed condition', () => {
  const result = score({ expectedStatus: 'completed', expectedSteps: ['receipt'] }, {
    run: { status: 'completed' }, steps: [{ stepKey: 'receipt', status: 'skipped' }],
  })
  assert.deepEqual(result, {
    ok: false,
    assertions: [
      { message: 'explicit positive execution evidence required', actual: true, expected: true, pass: true },
      { message: 'terminal status', actual: 'completed', expected: 'completed', pass: true },
      { message: 'step receipt completed', actual: 'skipped', expected: 'completed', pass: false },
    ],
    passedAssertions: 2, totalAssertions: 3,
  })
})

test('completed-step requirements do not imply an unstated ordering', () => {
  const execution = { run: { status: 'completed' }, steps: [
    { stepKey: 'first', status: 'completed' }, { stepKey: 'second', status: 'completed' },
  ] }
  assert.equal(score({ expectedStatus: 'completed', expectedSteps: ['second', 'first'] }, execution).ok, true)
})

test('evaluation honors the selected binary and records startup failure as infrastructure', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdandi-evaluator-test-'))
  const valdrBin = path.join(outputDir, 'intentionally-missing-valdr')
  try {
    await assert.rejects(evaluateBundle({ bundle: bundleOf([]), valdrBin, outputDir,
      scenario: { id: 'fixture', variants: [{ id: 'first', inputs: {} }] } }),
    error => error.message.includes(`Valdr executable not found: ${valdrBin}`))
    const evidence = JSON.parse(fs.readFileSync(path.join(outputDir, 'first/evidence.json'), 'utf8'))
    assert.match(evidence.infrastructureError, /intentionally-missing-valdr/)
    assert.equal(evidence.ok, false)
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }) }
})

describe('execution evidence scoring', () => {
  test('a completed run cannot pass without positive branch evidence', () => {
    assert.equal(score({ expectedStatus: 'completed' }, { run: { status: 'completed' }, steps: [] }).ok, false)
    assert.equal(score({ expectedStatus: 'completed', expectedSteps: ['selected'] }, {
      run: { status: 'completed' }, steps: [{ stepKey: 'other', status: 'completed' }],
    }).ok, false)
  })

  test('a deliberately blocked condition passes only with the expected branch and no downstream execution', () => {
    const variant = { expectedStatus: 'blocked', expectedStepStatuses: { gate: 'blocked' }, absentSteps: ['after'] }
    const execution = { run: { status: 'blocked' }, steps: [{ stepKey: 'gate', status: 'blocked' }, { stepKey: 'after', status: 'skipped' }] }
    assert.equal(score(variant, execution).ok, true)
    assert.equal(score(variant, { ...execution, steps: [...execution.steps, { stepKey: 'after', status: 'completed' }] }).ok, false)
  })

  test('root and step output values must match without type coercion', () => {
    const variant = { expectedStatus: 'completed', expectedSteps: ['receipt'], expectedOutputs: { count: 3 }, expectedStepOutputs: { receipt: { found: true } } }
    const execution = { run: { status: 'completed', outputJson: { count: 3 } }, steps: [{ stepKey: 'receipt', status: 'completed', outputJson: { found: true } }] }
    assert.equal(score(variant, execution).ok, true)
    assert.equal(score(variant, { ...execution, run: { status: 'completed', outputJson: { count: '3' } } }).ok, false)
    assert.equal(score(variant, { ...execution, steps: [{ stepKey: 'receipt', status: 'completed', outputJson: { found: 'true' } }] }).ok, false)
  })

  test('unknown assertions fail closed before reading execution evidence', () => {
    const execution = new Proxy({}, { get() { throw new Error('Execution must not be inspected') } })
    assert.throws(() => score({ expectedStatus: 'completed', expectedUnknownProof: true }, execution),
      error => error.code === 'VALDR_EVAL_INFRASTRUCTURE')
  })

  test('each optional lookup branch needs its executed steps and typed declared outputs', () => {
    const scenario = scenarios.find(item => item.id === '06_optional_task_lookup')
    for (const variant of scenario.variants) {
      const { execution } = optionalLookup(variant.id)
      assert.equal(scoreVariant({ scenario, variant, execution }).ok, true, variant.id)
      assert.equal(scoreVariant({ scenario, variant, execution: { ...execution, steps: [] } }).ok, false, `${variant.id}: missing execution`)
      assert.equal(scoreVariant({ scenario, variant, execution: { ...execution, run: { status: variant.expectedStatus, outputJson: {} } } }).ok, false, `${variant.id}: missing output`)
      assert.equal(scoreVariant({ scenario, variant, execution: { ...execution,
        attempts: [...execution.attempts, { stepKey: variant.absentSteps[0], status: 'completed' }],
        steps: [...execution.steps, { stepKey: variant.absentSteps[0], status: 'completed' }] } }).ok, false, `${variant.id}: wrong branch`)
      assert.equal(scoreVariant({ scenario, variant, execution: { ...execution, events: [] } }).ok, false, `${variant.id}: missing actual lookup`)
    }
  })

  test('optional lookup rejects a literal found-task key despite a real matching lookup elsewhere', () => {
    const fixture = optionalLookup()
    fixture.execution.definition.workflow.steps.find(step => step.key === 'report_found').outputs.taskKey = 'BENCH-1'
    const result = scoreVariant(fixture)
    assert.equal(result.ok, false)
    assert.ok(result.assertions.some(item => !item.pass && /report_found.*taskKey.*actual.*task/.test(item.message)))
  })

  for (const variantId of ['found', 'missing']) test(`optional lookup rejects literal root presence on the ${variantId} branch`, () => {
    const fixture = optionalLookup(variantId)
    fixture.execution.definition.workflow.outputMappings.found = variantId === 'found'
    const result = scoreVariant(fixture)
    assert.equal(result.ok, false)
    assert.ok(result.assertions.some(item => !item.pass && /output found.*actual.*task/.test(item.message)))
  })

  test('optional lookup accepts the found-task key from a separate actual read of the requested task', () => {
    const result = scoreVariant(separateTaskRecordLookup())
    assert.deepEqual(result.assertions.filter(item => !item.pass), [])
    assert.equal(result.ok, true)
  })

  test('optional lookup keeps root presence tied to inspect_task when another read finds the task', () => {
    const fixture = separateTaskRecordLookup(), e = fixture.execution
    e.events.find(item => item.eventType === 'step_completed' && item.stepKey === 'prepare_found').payloadJson.normalized.found = true
    e.definition.workflow.steps.find(item => item.key === 'prepare_found').outputs.present = '$.normalized.found'
    for (const attempt of [...e.steps, ...e.attempts].filter(item => item.stepKey === 'prepare_found')) attempt.outputJson.present = true
    e.definition.workflow.outputMappings.found = '${steps.prepare_found.outputs.present}'
    const result = scoreVariant(fixture)
    assert.equal(result.ok, false)
    assert.ok(result.assertions.some(item => !item.pass && /output found.*actual.*task/.test(item.message)))
  })

  for (const [name, mutate] of [
    ['wrong resolved task target', e => { e.attempts.find(item => item.stepKey === 'prepare_found').inputJson.taskKey = 'BENCH-2' }],
    ['missing resolved task target', e => { delete e.attempts.find(item => item.stepKey === 'prepare_found').inputJson.taskKey }],
    ['wrong resolved action', e => { e.attempts.find(item => item.stepKey === 'prepare_found').inputJson.action = 'create' }],
    ['wrong task record', e => { e.events.find(item => item.eventType === 'step_completed' && item.stepKey === 'prepare_found').payloadJson.normalized.task.key = 'BENCH-2' }],
    ['spoofed run identity', e => { e.events.find(item => item.eventType === 'step_completed' && item.stepKey === 'prepare_found').runUlid = 'other-run' }],
    ['spoofed attempt identity', e => { e.events.find(item => item.eventType === 'step_completed' && item.stepKey === 'prepare_found').stepRunUlid = 'other-attempt' }],
    ['fabricated report despite the extra real read', e => { e.definition.workflow.steps.find(item => item.key === 'report_found').outputs.taskKey = 'BENCH-1' }],
  ]) test(`optional lookup rejects a separate record read with ${name}`, () => {
    const fixture = separateTaskRecordLookup(); mutate(fixture.execution)
    const result = scoreVariant(fixture)
    assert.equal(result.ok, false)
    assert.ok(result.assertions.some(item => !item.pass && /report_found.*taskKey.*actual.*task/.test(item.message)))
  })

  test('optional lookup rejects presence from inspect_task reading a different missing task', () => {
    const fixture = optionalLookup('missing')
    fixture.execution.attempts.find(item => item.stepKey === 'inspect_task').inputJson.taskKey = 'BENCH-999'
    assert.equal(scoreVariant(fixture).ok, false)
  })

  test('optional lookup rejects a read receipt detached from the actual step attempt', () => {
    const fixture = optionalLookup()
    fixture.execution.events.find(item => item.eventType === 'step_completed' && item.stepKey === 'inspect_task').stepRunUlid = 'invented-attempt'
    assert.equal(scoreVariant(fixture).ok, false)
  })

})

describe('execution safety boundary', () => {
  test('resolved interpolation cannot introduce a second command', () => {
    assert.equal(isSafePrintf("printf '%s' 'safe'"), true)
    assert.equal(isSafePrintf("printf '%s' ''; touch /tmp/unsafe; printf ''"), false)
    assert.equal(isSafePrintf("printf '%s' '${workflow.inputs.value}'"), false)
  })
  test('rejects missing entry, duplicate identity, and external child dependencies', () => {
    assert.equal(inspectBundleSafety({ definitions: [] }).safe, false)
    assert.equal(inspectBundleSafety({ entryWorkflowKey: 'bad', definitions: [null] }).safe, false)
    assert.equal(inspectBundleSafety(bundleOf([null])).safe, false)
    const duplicate = bundleOf([])
    duplicate.definitions.push(duplicate.definitions[0])
    assert.equal(inspectBundleSafety(duplicate).safe, false)
    assert.equal(inspectBundleSafety(bundleOf([{ key: 'child', kind: 'subworkflow', workflow: { key: 'external.workflow', version: '1.0.0' } }])).safe, false)
  })

  test('rejects filesystem, launch, and command interpolation escape attempts', () => {
    const tool = (id, action, inputs) => bundleOf([{ key: 'act', name: 'Act', kind: 'tool', tool: { id, action }, inputs }])
    assert.equal(inspectBundleSafety(tool('command', 'run', { command: 'touch /tmp/unsafe' })).safe, false)
    assert.equal(inspectBundleSafety(tool('command', 'run', { command: "printf '%s' 'safe'; touch /tmp/unsafe" })).safe, false)
    assert.equal(inspectBundleSafety(tool('command', 'run', { command: "printf '%s' 'safe'", cwd: '/tmp' })).safe, false)
    assert.equal(inspectBundleSafety(tool('pm_session', 'launch_task', {})).safe, false)
    assert.equal(inspectBundleSafety(tool('command', 'run', { command: "printf '%s' '${workflow.inputs.value}'" }), { variants: [{ inputs: { value: "'; touch /tmp/unsafe; printf '" } }] }).safe, false)
  })

  test('permits literal printf, bounded pass interpolation, and fixture reads', () => {
    const bundle = bundleOf([
      { key: 'literal', name: 'Literal', kind: 'tool', tool: { id: 'command', action: 'run' }, inputs: { command: "printf '%s' 'ready'" } },
      { key: 'pass', name: 'Pass', kind: 'tool', tool: { id: 'command', action: 'run' }, inputs: { command: "printf '%s' '${runtime.loop.currentPass}'" } },
      { key: 'read', name: 'Read', kind: 'tool', tool: { id: 'pm_task', action: 'get' }, inputs: { taskKey: 'BENCH-1' } },
    ])
    assert.equal(inspectBundleSafety(bundle).safe, true)
  })
})

test('authored no-op conditions cannot impersonate required commands or fanout', () => {
  const bundle = bundleOf([{ key: 'probe', name: 'Probe', kind: 'condition', outputs: { receipt: 'ready' } }])
  const scenario = { entryWorkflowKey: 'benchmark.fixture', requiredSteps: [{ workflowKey: 'benchmark.fixture', stepKey: 'probe', kind: 'tool', toolId: 'command', action: 'run' }] }
  assert.equal(inspectAuthorContract(bundle, scenario).valid, false)
  assert.equal(inspectAuthorContract(bundle, { ...scenario, requiredSteps: [], features: ['for_each'] }).valid, false)
})

test('loops, children, and waits reach the selected public runtime rather than being disabled', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-unavailable-'))
  const valdrBin = path.join(outputDir, 'must-not-start')
  const variant = { id: 'variant', expectedStatus: 'completed', expectedSteps: ['receipt'] }
  const child = { schemaVersion: '1.0', workflow: { key: 'benchmark.child', version: '1.0.0', steps: [] } }
  const fanout = bundleOf([{ key: 'child', kind: 'subworkflow', workflow: { key: 'benchmark.child', version: '1.0.0' } }])
  fanout.definitions.push(child)
  const cases = [
    { bundle: bundleOf([]), variant: { ...variant, expectedStepOrder: [['prepare', 'receipt']] } },
    { bundle: bundleOf([{ key: 'decide', kind: 'condition', onFailure: { action: 'loop_back' } }]), variant },
    { bundle: bundleOf([{ key: 'receive', kind: 'await_condition' }]), variant },
    { bundle: fanout, variant },
  ]
  try {
    for (const [index, item] of cases.entries()) {
      const directory = path.join(outputDir, String(index))
      await assert.rejects(evaluateBundle({ bundle: item.bundle, valdrBin, outputDir: directory,
        scenario: { id: 'fixture', variants: [item.variant] } }),
      error => error.code === 'VALDR_EVAL_INFRASTRUCTURE' && /executable not found/.test(error.message))
      const report = JSON.parse(fs.readFileSync(path.join(directory, 'variant/evidence.json')))
      assert.equal(report.ok, false)
      assert.match(report.infrastructureError, /executable not found/)
    }
  } finally { fs.rmSync(outputDir, { recursive: true, force: true }) }
})

for (const requiredAdvances of [2, 3]) test(`a ${requiredAdvances}-advance workflow respects the two-advance budget`, async t => {
  configureRuntimeEnvironment(t)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-advance-budget-'))
  const binary = path.join(root, 'valdr')
  const receiptPath = path.join(root, 'calls.json')
  const argsPath = path.join(root, 'args.json')
  fs.writeFileSync(binary, `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv[2] === 'version') { console.log('valdr 99.0.0 fixture'); process.exit(0); }
fs.writeFileSync(${JSON.stringify(argsPath)}, JSON.stringify(process.argv.slice(2)));
let advances = 0;
const actions = [];
require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  let result;
  const data = value => ({ structuredContent: { data: value } });
  if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fixture', version: '1' } };
  else if (request.method === 'tools/list') result = { tools: [{ name: 'pm_health' }, { name: 'pm_workflow' }] };
  else {
    const { name, arguments: input = {} } = request.params;
    if (name === 'pm_health') result = data({ info: { dataDir: process.argv[process.argv.indexOf('--pm-home') + 1] } });
    else if (name === 'pm_generate_ulid') result = data({ ulid: 'fixture-request' });
    else if (name !== 'pm_workflow') result = data({});
    else {
      actions.push(input.action);
      if (input.action === 'validate') result = data({ valid: true });
      else if (input.action === 'save_definition') result = data({});
      else if (input.action === 'events') result = data({ runUlid: 'fixture-run', events: advances >= ${requiredAdvances} ? [
        { seq: 1, eventType: 'step_started', stepKey: 'receipt', stepRunUlid: 'receipt-1' },
        { seq: 2, eventType: 'step_completed', stepKey: 'receipt', stepRunUlid: 'receipt-1' },
        { seq: 3, eventType: 'workflow_completed' }
      ] : [], page: { hasMore: false, nextCursor: null } });
      else if (input.action === 'start') result = data({ run: { runUlid: 'fixture-run' } });
      else if (input.action === 'advance') { advances++; result = data({}); }
      else if (input.action === 'get_run') {
        const completed = advances >= ${requiredAdvances};
        result = data({ run: { runUlid: 'fixture-run', status: completed ? 'completed' : 'running', outputJson: completed ? { receipt: 'ready' } : {} },
          steps: [{ runUlid: 'fixture-run', stepKey: 'receipt', stepRunUlid: 'receipt-1', attempt: 1, status: completed ? 'completed' : 'pending', outputJson: completed ? { receipt: 'ready' } : {} }],
          attempts: [{ runUlid: 'fixture-run', stepKey: 'receipt', stepRunUlid: 'receipt-1', attempt: 1, status: completed ? 'completed' : 'pending', outputJson: completed ? { receipt: 'ready' } : {} }],
          waits: [], acceptedInputs: [], children: { runs: [], total: 0, page: { hasMore: false } },
          definition: { definitionJson: { schemaVersion: '1.0', workflow: { key: 'benchmark.fixture', steps: [] } } } });
      } else result = { isError: true, content: [{ type: 'text', text: 'Unexpected workflow action' }] };
      fs.writeFileSync(${JSON.stringify(receiptPath)}, JSON.stringify({ advances, actions }));
    }
  }
  console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
});`, { mode: 0o700 })
  try {
    const report = await evaluateBundle({ bundle: bundleOf([{ key: 'receipt', kind: 'tool', tool: { id: 'command', action: 'run' }, inputs: { command: "printf '%s' 'ready'" } }]),
      valdrBin: binary, outputDir: path.join(root, 'evidence'), maxAdvances: 2,
      scenario: { id: 'fixture', variants: [{ id: 'variant', expectedStatus: 'completed', expectedSteps: ['receipt'], expectedOutputs: { receipt: 'ready' }, expectedStepOutputs: { receipt: { receipt: 'ready' } } }] } })
    const calls = JSON.parse(fs.readFileSync(receiptPath))
    assert.equal(calls.advances, 2)
    assert.equal(calls.actions.at(-1), 'events')
    assert.ok(calls.actions.every(action => ['validate', 'save_definition', 'start', 'get_run', 'advance', 'events'].includes(action)))
    const args = JSON.parse(fs.readFileSync(argsPath))
    assert.equal(args[0], 'pm')
    assert.deepEqual(args.filter(arg => arg.startsWith('--')), ['--pm-home', '--data-root', '--runtime-root'])
    assert.equal(report.ok, requiredAdvances === 2)
    const variant = report.variants[0]
    assert.equal(variant.cleanup.ok, true)
    assert.deepEqual(variant.advanceTargets, ['fixture-run', 'fixture-run'])
    if (requiredAdvances === 2) {
      assert.equal(variant.actualStatus, 'completed')
      assert.ok(variant.assertions.length >= 5)
      assert.ok(variant.assertions.every(item => item.pass))
    } else {
      assert.equal(variant.actualStatus, 'running')
      assert.match(variant.error, /Workflow exceeded 2 advances/)
      assert.equal(variant.infrastructureError, undefined)
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

for (const behavior of ['recovery_transport', 'readback_error']) test(`${behavior} remains infrastructure after candidate execution starts`, async t => {
  configureRuntimeEnvironment(t)
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'eval-readback-fault-'));
  const binary = path.join(root,'valdr');
  fs.writeFileSync(binary, `#!/usr/bin/env node
const fs=require('node:fs');
if(process.argv[2]==='version'){console.log('valdr 99.0.0 fixture');process.exit(0);}
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
const r=JSON.parse(line);if(r.id===undefined)return;let result;
if(r.method==='initialize') result={protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fixture',version:'1'}};
else if(r.method==='tools/list')result={tools:[{name:'pm_health'},{name:'pm_workflow'}]};
else {const a=r.params.arguments||{};const name=r.params.name;
 if(name==='pm_health')result={structuredContent:{data:{info:{dataDir:process.argv[process.argv.indexOf('--pm-home')+1]}}}};
 else if(a.action==='validate')result={structuredContent:{data:{valid:true}}};
 else if(a.action==='start')result=${JSON.stringify(behavior)}==='readback_error'?{structuredContent:{data:{run:{runUlid:'fixture-run'}}}}:{isError:true,content:[{type:'text',text:'Candidate execution rejected'}]};
 else if(a.action==='get_run')result={isError:true,content:[{type:'text',text:'Readback unavailable'}]};
 else if(a.action==='list_runs'){console.log(JSON.stringify({jsonrpc:'2.0',id:r.id,error:{code:-32000,message:'MCP disconnected during recovery'}}));return;}
 else result={structuredContent:{data:{}}};
}
console.log(JSON.stringify({jsonrpc:'2.0',id:r.id,result}));});`,{mode:0o700});
  const outputDir = path.join(root,'evidence');
  try {
    await assert.rejects(evaluateBundle({bundle:bundleOf([]),valdrBin:binary,outputDir,
      scenario:{id:'fault',variants:[{id:'variant',inputs:{}}]}}),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE');
    const evidence = JSON.parse(fs.readFileSync(path.join(outputDir,'variant/evidence.json')));
    assert.ok(evidence.infrastructureError);
    assert.equal(evidence.cleanup.ok,true);
  } finally {
    const cleanup = path.join(outputDir,'variant/cleanup.json');
    if(fs.existsSync(cleanup)) fs.rmSync(JSON.parse(fs.readFileSync(cleanup)).root,{recursive:true,force:true});
    fs.rmSync(root,{recursive:true,force:true});
  }
});
