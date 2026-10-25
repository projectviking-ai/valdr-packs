import assert from 'node:assert/strict'
import test from 'node:test'
import * as evaluator from '../../suites/workflow-authoring/evaluate.mjs'

const score = (variant, execution) => evaluator.scoreVariant({ scenario: {}, variant, execution })
const event = (seq, stepKey, eventType = 'step_completed', stepRunUlid = stepKey) => ({ seq, stepKey, eventType, stepRunUlid })

test('ordered step assertions reject effects that began before their prerequisite completed', () => {
  const variant = { expectedStatus: 'completed', expectedStepOrder: [['prepare', 'release']] }
  const execution = { run: { status: 'completed' }, steps: [], attempts: [], events: [event(1, 'prepare'), event(2, 'release', 'step_started'), event(3, 'release')] }
  assert.equal(score(variant, execution).ok, true)
  execution.events = [event(1, 'release', 'step_started'), event(2, 'prepare'), event(3, 'release')]
  assert.equal(score(variant, execution).ok, false)
})

test('attempt assertions use durable history rather than the latest step number', () => {
  const variant = { expectedStatus: 'completed', expectedAttempts: { inspect: 3 } }
  const execution = { run: { status: 'completed' }, steps: [{ stepKey: 'inspect', attempt: 3, status: 'completed' }],
    attempts: [1, 2, 3].map(attempt => ({ stepKey: 'inspect', attempt, status: 'completed', stepRunUlid: `inspect-${attempt}` })) }
  assert.equal(score(variant, execution).ok, true)
  execution.attempts.splice(1, 1)
  assert.equal(score(variant, execution).ok, false)
})

test('an unselected branch fails if any earlier attempt executed it', () => {
  const execution = { run: { status: 'completed' }, steps: [{ stepKey: 'selected', status: 'completed' }, { stepKey: 'wrong', status: 'skipped' }],
    attempts: [{ stepKey: 'wrong', attempt: 1, status: 'completed' }, { stepKey: 'wrong', attempt: 2, status: 'skipped' }] }
  assert.equal(score({ expectedStatus: 'completed', expectedSteps: ['selected'], absentSteps: ['wrong'] }, execution).ok, false)
})

test('child assertions compare actual ordered run scope, typed outputs, and descendant status', () => {
  const variant = { expectedStatus: 'completed', expectedChildren: { count: 2, statuses: ['completed', 'completed'],
    taskKeys: ['BENCH-2', 'BENCH-1'], projectKeys: ['BENCH', 'BENCH'], itemOrder: ['BENCH-2', 'BENCH-1'],
    outputs: [{ count: 2 }, { count: 3 }] } }
  const execution = { run: { status: 'completed' }, steps: [], children: [
    { run: { runUlid: 'child-a', status: 'completed', taskKey: 'BENCH-2', projectKey: 'BENCH', itemJson: 'BENCH-2', outputJson: { count: 2 } }, steps: [], children: [] },
    { run: { runUlid: 'child-b', status: 'completed', taskKey: 'BENCH-1', projectKey: 'BENCH', itemJson: 'BENCH-1', outputJson: { count: 3 } }, steps: [], children: [] },
  ] }
  assert.equal(score(variant, execution).ok, true)
  execution.children.reverse()
  assert.equal(score(variant, execution).ok, false)
})

test('fanout output must identify the actual children, not a fabricated equivalent receipt', () => {
  const child = { run: { runUlid: 'actual-child', parentStepKey: 'fanout', itemIndex: 0, itemJson: 'item', status: 'completed', outputJson: { value: true } }, steps: [], children: [] }
  const receipt = { index: 0, item: 'item', runUlid: 'actual-child', status: 'completed', outputs: { value: true } }
  const execution = { run: { status: 'completed', outputJson: { children: [receipt] } }, steps: [], children: [child] }
  const variant = { expectedStatus: 'completed', expectedOutputChildren: { outputKey: 'children', stepKey: 'fanout' } }
  assert.equal(score(variant, execution).ok, true)
  execution.run.outputJson.children[0] = { ...receipt, runUlid: 'invented-child' }
  assert.equal(score(variant, execution).ok, false)
})

const api = value => ({ structuredContent: { data: value } })
const detail = (id, overrides = {}) => ({ run: { runUlid: id, status: 'completed', parentRunUlid: null }, steps: [], attempts: [], waits: [], acceptedInputs: [],
  definition: { definitionJson: { schemaVersion: '1.0', workflow: { key: id, steps: [] } } },
  children: { runs: [], total: 0, page: { hasMore: false, nextCursor: null } }, ...overrides })
const loadExecution = async () => {
  const module = await import('../../suites/workflow-authoring/execution.mjs').catch(() => ({}))
  assert.equal(typeof module.collectWorkflowEvidence, 'function', 'Public workflow evidence collection must be available')
  return module
}

test('public collection reads every event page and orders children by their actual start events', async () => {
  const { collectWorkflowEvidence } = await loadExecution()
  const root = detail('root', { children: { total: 2, runs: [{ runUlid: 'second' }, { runUlid: 'first' }], page: { hasMore: false } } })
  const calls = []
  const call = async (tool, args) => {
    calls.push(args)
    assert.equal(tool, 'pm_workflow')
    if (args.action === 'get_run') return api(args.runUlid === 'root' ? root : detail(args.runUlid, { run: { runUlid: args.runUlid, status: 'completed', parentRunUlid: 'root' } }))
    assert.equal(args.action, 'events')
    if (args.runUlid !== 'root') return api({ runUlid: args.runUlid, events: [{seq:1,eventType:'workflow_completed'}], page: { hasMore: false, nextCursor: null } })
    return api(args.cursor === undefined
      ? { runUlid: 'root', events: [{ seq: 1, eventType: 'child_run_started', childRunUlid: 'first' }], page: { hasMore: true, nextCursor: '1' } }
      : { runUlid: 'root', events: [{ seq: 2, eventType: 'child_run_started', childRunUlid: 'second' },{seq:3,eventType:'workflow_completed'}], page: { hasMore: false, nextCursor: null } })
  }
  const result = await collectWorkflowEvidence(call, 'root')
  assert.deepEqual(result.events.map(event => event.seq), [1, 2, 3])
  assert.deepEqual(result.children.map(child => child.run.runUlid), ['first', 'second'])
  assert.ok(calls.some(call => call.action === 'events' && call.cursor === '1' && call.includePayload === true))
})

test('public collection rejects incomplete pagination instead of scoring partial evidence', async () => {
  const { collectWorkflowEvidence } = await loadExecution()
  await assert.rejects(collectWorkflowEvidence(async (_, args) => api(args.action === 'get_run' ? detail('root') : {
    runUlid: 'root', events: [{ seq: 1 }], page: { hasMore: true, nextCursor: null },
  }), 'root'), error => error.code === 'VALDR_EVAL_INFRASTRUCTURE')
})

test('public collection rejects missing or contradictory attempt history before scoring absence', async () => {
  const { collectWorkflowEvidence } = await loadExecution()
  const stopped = { runUlid:'root', stepRunUlid:'gate-1', stepKey:'validate_lane', attempt:1, status:'blocked' }
  const complete = detail('root', { run:{runUlid:'root',status:'blocked'},steps:[stopped],attempts:[stopped] })
  const events = [{ seq:1,eventType:'workflow_started' },event(2,'validate_lane','workflow_blocked','gate-1')]
  const collect = (details, timeline=events) => collectWorkflowEvidence(async(_,args)=>api(args.action==='get_run'?details:{events:timeline,page:{hasMore:false}}),'root')
  assert.equal((await collect(complete)).attempts.length,1)
  for (const changed of [
    {...complete,attempts:[]},
    {...complete,attempts:[{...stopped,stepRunUlid:'different'}]},
    {...complete,attempts:[{...stopped,status:'completed'}]},
    {...complete,attempts:[stopped,stopped]},
    {...complete,steps:[]},
  ]) await assert.rejects(collect(changed),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE')
  await assert.rejects(collect(complete,[]),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE')
  await assert.rejects(collect(complete,[{seq:2,eventType:'workflow_blocked'}]),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE')
})

test('public collection requires prior attempts and their completion evidence, while skipped attempts need no event', async () => {
  const { collectWorkflowEvidence } = await loadExecution()
  const first={runUlid:'root',stepRunUlid:'review-1',stepKey:'review',attempt:1,status:'completed'}
  const last={...first,stepRunUlid:'review-2',attempt:2}
  const skipped={runUlid:'root',stepRunUlid:'unused-1',stepKey:'unused',attempt:1,status:'skipped'}
  const details=detail('root',{steps:[last,skipped],attempts:[first,last,skipped]})
  const timeline=[event(2,'review','step_completed','review-1'),event(5,'review','step_completed','review-2'),{seq:8,eventType:'workflow_completed'}]
  const collect=(value,events=timeline)=>collectWorkflowEvidence(async(_,args)=>api(args.action==='get_run'?value:{events,page:{hasMore:false}}),'root')
  assert.equal((await collect(details)).attempts.length,3)
  await assert.rejects(collect({...details,attempts:[last,skipped]}),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE')
  await assert.rejects(collect(details,timeline.slice(1)),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE')
  await assert.rejects(collect(details,[...timeline,{seq:9,stepKey:'other',stepRunUlid:'absent',eventType:'step_completed'}]),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE')
})

for (const handle of ['benchmark', '@benchmark']) test(`callback execution accepts the public ${handle} handle spelling and correlates its receipt`, async () => {
  const { executeWorkflow } = await loadExecution()
  let state = 'pending', request = 0, accepted
  const wait = { runUlid: 'root', waitUlid: 'wait', stepRunUlid: 'attempt', stepKey: 'receive', kind: 'workflow_input', status: 'waiting',
    expectedOutcomesJson: ['approved', 'rejected'], authorizedHandlesJson: [handle] }
  const call = async (_, args) => {
    if (args.action === 'get_run') return api(detail('root', { run: { runUlid: 'root', status: state },
      waits: state === 'waiting' ? [wait] : [], acceptedInputs: accepted ? [accepted] : [] }))
    if (args.action === 'advance') {
      if (state === 'pending') { state = 'waiting'; return api({ run: { runUlid: 'root', status: state }, wait, callbackToken: 'issued-once', advanced: true }) }
      assert.equal(state, 'running'); state = 'completed'; return api({ run: { runUlid: 'root', status: state }, advanced: true })
    }
    if (args.action === 'input') {
      assert.equal(args.callbackToken, 'issued-once')
      assert.equal(args.origin, 'orchestrator')
      assert.deepEqual(args.payload, { digest: 'exact' })
      accepted = { inputUlid: 'input', runUlid: 'root', waitUlid: 'wait', stepKey: 'receive', kind: 'callback', outcome: 'approved', accepted: true }
      state = 'running'; return api({ input: accepted, wait: { ...wait, status: 'resolved' } })
    }
    assert.equal(args.action, 'events')
    return api({ runUlid: 'root', events: [{seq:1,eventType:'workflow_completed'}], page: { hasMore: false } })
  }
  const result = await executeWorkflow({ call, uid: async () => String(++request), runUlid: 'root', callbacks: [{ stepKey: 'receive', outcome: 'approved', payload: { digest: 'exact' } }], maxAdvances: 2 })
  assert.equal(result.execution.run.status, 'completed')
  assert.deepEqual(result.advanceTargets, ['root', 'root'])
  assert.deepEqual(result.execution.callbackSubmissions, [{ runUlid: 'root', waitUlid: 'wait', stepKey: 'receive', outcome: 'approved', payload: { digest: 'exact' }, inputUlid: 'input', accepted: true }])
})

for (const handle of ['benchmark', '@benchmark']) test(`callback scoring accepts ${handle} only with durable acknowledgement of the exact payload`, () => {
  const variant = { expectedStatus: 'completed', callbacks: [{ stepKey: 'receive', outcome: 'approved', payload: { digest: 'exact' } }] }
  const submission = { runUlid: 'root', waitUlid: 'wait', stepKey: 'receive', outcome: 'approved', payload: { digest: 'exact' }, inputUlid: 'input', accepted: true }
  const execution = { run: { runUlid: 'root', status: 'completed' }, steps: [], children: [],
    waits: [{ runUlid: 'root', waitUlid: 'wait', stepKey: 'receive', status: 'resolved', kind: 'workflow_input', authorizedHandlesJson: [handle], expectedOutcomesJson: ['approved', 'rejected'] }],
    acceptedInputs: [{ inputUlid: 'input', waitUlid: 'wait', stepKey: 'receive', outcome: 'approved', kind: 'callback' }],
    events: [{ eventType: 'callback_received', inputUlid: 'input', waitUlid: 'wait', stepKey: 'receive', payloadJson: { outcome: 'approved' } }],
    callbackSubmissions: [submission] }
  assert.equal(score(variant, execution).ok, true)
  execution.acceptedInputs = []
  assert.equal(score(variant, execution).ok, false)
  execution.acceptedInputs = [{ inputUlid: 'input', waitUlid: 'wait', stepKey: 'receive', outcome: 'approved', kind: 'callback' }]
  submission.payload.digest = 'different'
  assert.equal(score(variant, execution).ok, false)
  submission.payload.digest = 'exact'
  execution.waits[0].authorizedHandlesJson = ['another-operator']
  assert.equal(score(variant, execution).ok, false)
})

test('semantic command scoring does not accept a declared receipt that differs from actual stdout', () => {
  const execution = { run: { status: 'completed' }, steps: [{ stepKey: 'probe', status: 'completed' }],
    events: [{ eventType: 'step_completed', stepKey: 'probe', payloadJson: { toolName: 'command', action: 'run', normalized: { ok: true, stdout: 'wrong' }, outputs: { receipt: 'ready' } } }] }
  const result = evaluator.scoreVariant({ scenario: { id: '01_routed_release' },
    variant: { expectedStatus: 'completed', expectedSteps: ['probe'] }, execution })
  assert.equal(result.ok, false)
  assert.ok(result.assertions.some(assertion => assertion.message.includes('actual command') && !assertion.pass))
})

test('semantic root receipts must trace to actual operations rather than same-valued constants', () => {
  const execution = { run: { runUlid: 'root', status: 'completed', outputJson: { probe: 'ready' } },
    steps: [{ stepKey: 'probe', stepRunUlid: 'probe-1', status: 'completed', outputJson: { receipt: 'ready' } }],
    attempts: [{ stepKey: 'probe', stepRunUlid: 'probe-1', status: 'completed', outputJson: { receipt: 'ready' } }],
    definition: { workflow: { outputMappings: { probe: 'ready' }, steps: [{ key: 'probe', kind: 'tool', tool: { id: 'command', action: 'run' }, outputs: { receipt: '$.normalized.stdout' } }] } },
    events: [{ seq: 1, eventType: 'step_completed', stepRunUlid: 'probe-1', stepKey: 'probe', payloadJson: { toolName: 'command', action: 'run', normalized: { ok: true, stdout: 'ready' } } }] }
  const input = { scenario: { id: '01_routed_release' }, variant: { expectedStatus: 'completed', expectedOutputs: { probe: 'ready' } }, execution }
  assert.equal(evaluator.scoreVariant(input).ok, false)
  execution.definition.workflow.outputMappings.probe = '${steps.probe.outputs.receipt}'
  assert.equal(evaluator.scoreVariant(input).ok, true)
})

test('typed fanout cannot pass with correct outputs but the wrong actual child inputs', () => {
  const item = { label: 'alpha', count: 2, enabled: true }
  const child = { run: { status: 'completed', itemJson: item, itemIndex: 0, inputJson: { item, batch: 'wrong' } }, steps: [], children: [],
    events: [{ eventType: 'step_completed', stepKey: 'receipt', payloadJson: { toolName: 'command', action: 'run', normalized: { ok: true, stdout: 'alpha' } } }] }
  const request = { scenario: { id: '03_typed_fanout' }, variant: { expectedStatus: 'completed', expectedChildren: { count: 1 }, inputs: { items: [item], batch: 'exact' } },
    execution: { run: { status: 'completed' }, steps: [], children: [child] } }
  assert.equal(evaluator.scoreVariant(request).ok, false)
  child.run.inputJson.batch = 'exact'
  assert.equal(evaluator.scoreVariant(request).ok, true)
})

test('previous-pass capture must skip the first pass even when the final receipt is correct', () => {
  const execution = { run: { runUlid: 'root', status: 'completed', outputJson: { finalPass: '3', priorReason: '2' } }, steps: [], attempts: [], events: [],
    definition: { workflow: { outputMappings: { finalPass: '${steps.inspect.outputs.receipt}', priorReason: '${steps.capture_previous.outputs.priorReason}' }, steps: [
      { key: 'inspect', kind: 'tool', tool: { id: 'command', action: 'run' }, outputs: { receipt: '$.normalized.stdout' } },
      { key: 'capture_previous', kind: 'condition', outputs: { priorReason: '${runtime.loop.previous.outputs.reason}' } },
      { key: 'decide', kind: 'condition', outputs: { reason: '${steps.inspect.outputs.receipt}' } },
    ] } } }
  for (let pass = 1; pass <= 3; pass++) {
    const inspect = { stepKey: 'inspect', stepRunUlid: `inspect-${pass}`, attempt: pass, status: 'completed', outputJson: { receipt: String(pass) } }
    const capture = { stepKey: 'capture_previous', stepRunUlid: `capture-${pass}`, attempt: pass, status: 'completed', outputJson: { priorReason: String(pass - 1) } }
    const decide = { stepKey: 'decide', stepRunUlid: `decide-${pass}`, attempt: pass, status: 'completed', outputJson: { reason: String(pass) } }
    execution.attempts.push(inspect, capture, decide)
    const append = (attempt, eventType, payloadJson) => execution.events.push({ seq: execution.events.length + 1, stepKey: attempt.stepKey, stepRunUlid: attempt.stepRunUlid, eventType, payloadJson })
    append(inspect, 'step_started', {})
    append(inspect, 'step_completed', { toolName: 'command', action: 'run', normalized: { ok: true, stdout: String(pass) } })
    append(capture, 'step_completed', { outputs: capture.outputJson })
    append(decide, 'step_completed', { outputs: decide.outputJson, loopTransition: { route: pass < 3 ? 'loop_back' : 'matched',
      resetAttempts: pass < 3 ? [{ stepRunUlid: `inspect-${pass + 1}` }, { stepRunUlid: `capture-${pass + 1}` }, { stepRunUlid: `decide-${pass + 1}` }] : [] } })
  }
  execution.steps = execution.attempts.slice(-3)
  const input = { scenario: { id: '02_loop_receipts' }, variant: { inputs: { permit: true }, expectedStatus: 'completed', expectedOutputs: { finalPass: '3', priorReason: '2' } }, execution }
  assert.equal(evaluator.scoreVariant(input).ok, false)
  execution.attempts[1].status = 'skipped'
  execution.events[2].eventType = 'step_skipped'
  assert.equal(evaluator.scoreVariant(input).ok, true)
})
