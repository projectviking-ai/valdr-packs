import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreBusinessVariant, traceOutputSources } from '../../suites/workflow-authoring/business-score.mjs'
import { businessScenarios } from '../../suites/workflow-authoring/business-scenarios.mjs'

function execution(variant, runUlid = 'root') {
  return { run: { runUlid, status: variant.expectedStatus, inputJson: variant.inputs, outputJson: { ...variant.inputs } },
    definition: { schemaVersion: '1.0', workflow: { steps: [], outputMappings: {} } },
    steps: [], attempts: [], events: [], children: [], waits: [], acceptedInputs: [], callbackSubmissions: [] }
}
function event(e, type, fields = {}) {
  const item = { runUlid: e.run.runUlid, seq: e.events.length + 1, eventType: type, ...fields }
  e.events.push(item); return item
}
function command(e, key, stdout, outputs = { receipt: '$.normalized.stdout' }, extra = {}) {
  if (!e.definition.workflow.steps.some(step => step.key === key)) e.definition.workflow.steps.push({ key, kind: 'tool', tool: { id: 'command', action: 'run' }, outputs })
  const attempt = { runUlid: e.run.runUlid, stepKey: key, stepRunUlid: `${key}-${e.attempts.length}`, status: 'completed', outputJson: { receipt: stdout }, ...extra }
  e.attempts.push(attempt)
  event(e, 'step_started', { stepKey: key, stepRunUlid: attempt.stepRunUlid, payloadJson: { toolName: 'command', action: 'run' } })
  event(e, 'step_completed', { stepKey: key, stepRunUlid: attempt.stepRunUlid,
    payloadJson: { toolName: 'command', action: 'run', outputs: attempt.outputJson, normalized: { stdout, ok: true, exitCode: 0, stdoutTruncated: false } } })
  return attempt
}
function release(variant = businessScenarios[0].variants[0]) {
  const scenario = businessScenarios[0], e = execution(variant)
  if (variant.expectedStatus === 'completed') {
    command(e, 'ship', `${variant.inputs.route}:${variant.inputs.requestId}`)
    if (variant.inputs.audit) command(e, 'record', `audit:${variant.inputs.requestId}`)
  }
  e.run.outputJson.receipt = `${variant.inputs.route}:${variant.inputs.requestId}`
  e.definition.workflow.outputMappings.receipt = '${steps.ship.outputs.receipt}'
  return { scenario, variant, execution: e }
}
function check(fixture) { return scoreBusinessVariant(fixture) }
function pass(fixture) { const assertions = check(fixture); assert.ok(assertions.length > 2); assert.deepEqual(assertions.filter(item => !item.pass), []) }
function fail(fixture, pattern) { assert.ok(check(fixture).some(item => !item.pass && pattern.test(item.message))) }

test('business release scores real command receipts with arbitrary step names', () => pass(release()))
for (const variant of businessScenarios[0].variants) test(`release ${variant.id} preserves its complete business contract`, () => pass(release(variant)))
for (const [name, mutate, pattern] of [
  ['fabricated stdout hidden by correct declared output', e => { e.events[1].payloadJson.normalized.stdout = 'forged' }, /ledger/],
  ['literal root receipt instead of operation provenance', e => { e.definition.workflow.outputMappings.receipt = e.run.outputJson.receipt }, /receipt.*origin/],
  ['audit started before publication completed', e => { [e.events[1].seq, e.events[2].seq] = [3, 2] }, /order/],
  ['duplicate operation', e => command(e, 'again', e.run.outputJson.receipt), /ledger/],
  ['missing normalized runtime receipt', e => { delete e.events[1].payloadJson.normalized }, /receipt/],
  ['failed hidden operation', e => { e.attempts.push({ stepRunUlid: 'extra', stepKey: 'ship', status: 'failed' }) }, /attempted command/],
]) test(`business release rejects ${name}`, () => { const f = release(); mutate(f.execution); fail(f, pattern) })

test('business receipt follows intermediate outputs and real child-run links', () => {
  const f = release(), e = f.execution, child = execution(f.variant, 'child')
  command(child, 'childShip', e.run.outputJson.receipt)
  child.run.outputJson = { receipt: e.run.outputJson.receipt }
  child.run.parentStepRunUlid = 'dispatch-1'
  child.definition.workflow.outputMappings.receipt = '${steps.childShip.outputs.receipt}'
  e.definition.workflow.steps[0] = { key: 'ship', kind: 'subworkflow' }
  e.attempts[0] = { stepKey: 'ship', stepRunUlid: 'dispatch-1', status: 'completed', outputJson: { child: { runUlid: 'child', status: 'completed', outputs: { receipt: e.run.outputJson.receipt } } } }
  e.events.splice(0, 2)
  e.events.forEach(item => { item.seq += 2 })
  e.events.unshift({ seq: 1, eventType: 'child_run_started', childRunUlid: 'child', stepRunUlid: 'dispatch-1' },
    { seq: 2, eventType: 'child_run_completed', childRunUlid: 'child', stepRunUlid: 'dispatch-1' },
    { seq: 3, eventType: 'step_completed', stepRunUlid: 'dispatch-1' })
  e.children = [child]
  e.definition.workflow.outputMappings.receipt = '${steps.ship.outputs.child.outputs.receipt}'
  pass(f)
  e.definition.workflow.steps[0].outputs = { receipt: '$.normalized.child.outputs.receipt' }
  e.attempts[0].outputJson = { receipt: e.run.outputJson.receipt }
  e.definition.workflow.outputMappings.receipt = '${steps.ship.outputs.receipt}'
  pass(f)
  e.events = e.events.filter(item => item.eventType !== 'child_run_completed')
  fail(f, /order/)
})

function fanoutRelease() {
  const f = release(), e = f.execution
  e.attempts = []; e.events = []; e.definition.workflow.steps = []
  const dispatch = { stepKey: 'dispatch', stepRunUlid: 'dispatch-1', status: 'completed', outputJson: {} }
  e.definition.workflow.steps.push({ key: 'dispatch', kind: 'subworkflow',
    forEach: { items: '${workflow.inputs.operations}', itemName: 'operation', maxConcurrent: 1 },
    outputs: { deliveries: '$.normalized.children' } })
  e.attempts.push(dispatch)
  event(e, 'step_started', { stepKey: 'dispatch', stepRunUlid: dispatch.stepRunUlid })
  const markers = [`publish:${f.variant.inputs.requestId}`, `audit:${f.variant.inputs.requestId}`]
  e.run.inputJson = { ...e.run.inputJson, operations: markers }
  e.children = markers.map((marker, index) => {
    const child = execution(f.variant, `child-${index}`)
    Object.assign(child.run, { parentRunUlid: 'root', parentStepKey: 'dispatch', parentStepRunUlid: dispatch.stepRunUlid,
      itemIndex: index, itemJson: marker, inputJson: { operation: marker }, outputJson: { parcel: { values: [marker] } } })
    command(child, 'operation', marker, undefined, { stepRunUlid: `operation-${index}` })
    child.definition.workflow.outputMappings = { parcel: { values: ['${steps.operation.outputs.receipt}'] } }
    event(e, 'child_run_started', { childRunUlid: child.run.runUlid, stepKey: 'dispatch', stepRunUlid: dispatch.stepRunUlid })
    event(e, 'child_run_completed', { childRunUlid: child.run.runUlid, stepKey: 'dispatch', stepRunUlid: dispatch.stepRunUlid })
    return child
  })
  const receipts = e.children.map(({ run }) => ({ index: run.itemIndex, item: run.itemJson,
    runUlid: run.runUlid, status: run.status, outputs: structuredClone(run.outputJson) }))
  dispatch.outputJson = { deliveries: receipts }
  event(e, 'step_completed', { stepKey: 'dispatch', stepRunUlid: dispatch.stepRunUlid, payloadJson: { normalized: { children: structuredClone(receipts) } } })
  e.definition.workflow.steps.push({ key: 'forward', kind: 'condition', outputs: { envelope: { items: '${steps.dispatch.outputs.deliveries}' } } })
  e.attempts.push({ stepKey: 'forward', stepRunUlid: 'forward-1', status: 'completed', outputJson: { envelope: { items: structuredClone(receipts) } } })
  event(e, 'step_started', { stepKey: 'forward', stepRunUlid: 'forward-1' })
  event(e, 'step_completed', { stepKey: 'forward', stepRunUlid: 'forward-1' })
  e.definition.workflow.outputMappings.receipt = '${steps.forward.outputs.envelope.items[0].outputs.parcel.values[0]}'
  return f
}

test('business receipt traces numeric indexes through renamed fanout and nested child outputs', () => {
  const f = fanoutRelease()
  pass(f)
  assert.deepEqual(traceOutputSources(f.execution, 'receipt').sources,
    [{ kind: 'command', runUlid: 'child-0', stepRunUlid: 'operation-0' }])
})

test('business receipt traces a direct normalized numeric selector and default fanout outputs', () => {
  const f = fanoutRelease(), e = f.execution
  e.definition.workflow.steps[0].outputs = { selected: '$.normalized.children[0].outputs.parcel.values[0]' }
  e.attempts[0].outputJson = { selected: e.run.outputJson.receipt }
  e.definition.workflow.outputMappings.receipt = '${steps.dispatch.outputs.selected}'
  pass(f)
  delete e.definition.workflow.steps[0].outputs
  e.attempts[0].outputJson = structuredClone(e.events.find(item => item.stepKey === 'dispatch' && item.eventType === 'step_completed').payloadJson.normalized)
  e.definition.workflow.outputMappings.receipt = '${steps.dispatch.outputs.children[0].outputs.parcel.values[0]}'
  pass(f)
})

for (const [name, mutate] of [
  ['wrong parent attempt', e => { e.children[0].run.parentStepRunUlid = 'dispatch-old' }],
  ['wrong parent run', e => { e.children[0].run.parentRunUlid = 'unrelated-root' }],
  ['wrong item index', e => { e.children[0].run.itemIndex = 1 }],
  ['spoofed child identity in renamed output', e => { e.attempts[0].outputJson.deliveries[0].runUlid = 'invented-child' }],
  ['spoofed child identity in intermediate output', e => { e.attempts[1].outputJson.envelope.items[0].runUlid = 'invented-child' }],
  ['spoofed child value in renamed output', e => { e.attempts[0].outputJson.deliveries[0].outputs.parcel.values[0] = 'fabricated' }],
  ['fabricated child receipt despite a matching operation', e => { e.children[0].definition.workflow.outputMappings.parcel.values[0] = e.run.outputJson.receipt }],
]) test(`business indexed receipt rejects ${name}`, () => {
  const f = fanoutRelease(); mutate(f.execution); fail(f, /receipt.*origin/)
})

function review(variant = businessScenarios[1].variants[1]) {
  const scenario = businessScenarios[1], e = execution(variant)
  const history = { receipt: '$.normalized.stdout', history: '${runtime.loop.previous}' }
  const passes = variant.inputs.readyPass === 'never' ? 3 : Number(variant.inputs.readyPass)
  e.definition.workflow.steps.push({ key: 'decide', kind: 'condition', outputs: { receipt: '${steps.inspect.outputs.receipt}' },
    checks: [{ kind: 'value_equals', value: '${steps.inspect.outputs.receipt}', equals: `review:${variant.inputs.readyPass}` }] })
  const reviews = [], decisions = []
  let priorTransition
  for (let current = 1; current <= passes; current++) {
    const prior = decisions.at(-1)
    const review = command(e, 'inspect', `review:${current}`, history, prior ? {
      inputJson: { loopContext: { currentPass: current, previousSourceStepRunUlid: prior.stepRunUlid } },
      outputJson: { receipt: `review:${current}`, history: { sourceStepRunUlid: prior.stepRunUlid, outputs: { receipt: `review:${current - 1}` } } },
    } : {})
    reviews.push(review)
    if (priorTransition) priorTransition.payloadJson.loopTransition.resetAttempts.push({ stepRunUlid: review.stepRunUlid })
    if (current < passes) command(e, `repair${current}`, `remediate:${variant.inputs.requestId}:${current}`)
    const exhausted = current === passes && variant.inputs.readyPass === 'never'
    const decision = { stepKey: 'decide', stepRunUlid: `decision-${current}`, status: exhausted ? 'blocked' : 'completed', outputJson: { receipt: `review:${current}` } }
    decisions.push(decision); e.attempts.push(decision)
    priorTransition = event(e, exhausted ? 'workflow_blocked' : 'step_completed', { stepKey: 'decide', stepRunUlid: decision.stepRunUlid,
      payloadJson: { loopTransition: { route: current < passes ? 'loop_back' : exhausted ? 'exhausted' : 'matched',
        fromPass: current, toPass: current < passes ? current + 1 : null, maxPasses: 3, resetAttempts: [] } } })
  }
  if (variant.inputs.readyPass !== 'never') command(e, 'ship', `publish:${variant.inputs.requestId}`)
  return { scenario, variant, execution: e, first: reviews[0], second: reviews[1], decision: decisions[0], reviews }
}
for (const variant of businessScenarios[1].variants) test(`review ${variant.id} scores complete durable history`, () => pass(review(variant)))
test('downstream review attempts recover their pass from the preceding reset event', () => {
  const f = review(businessScenarios[1].variants[2])
  for (const attempt of f.reviews.slice(1)) delete attempt.inputJson
  pass(f)
  const transition = f.execution.events.find(event => event.payloadJson?.loopTransition?.toPass === 2)
  transition.payloadJson.loopTransition.toPass = 3
  fail(f, /review 2 uses the actual runtime pass/)
})
test('an unrelated reset attempt cannot establish the review pass', () => {
  const f = review()
  delete f.second.inputJson
  f.execution.events.find(event => event.payloadJson?.loopTransition?.route === 'loop_back').payloadJson.loopTransition.resetAttempts = [{ stepRunUlid: 'unrelated' }]
  fail(f, /review 2 uses the actual runtime pass/)
})
test('business review requires actual preceding-review lineage on the next pass', () => {
  const f = review(); pass(f)
  f.execution.definition.workflow.steps.find(step => step.key === 'inspect').outputs.history = { outputs: { receipt: 'review:1' } }
  fail(f, /history/)
})
test('business review rejects a stale previous-source identity despite matching receipt text', () => {
  const f = review(); f.second.inputJson.loopContext.previousSourceStepRunUlid = 'unrelated'; fail(f, /history/)
})
test('business review must compare the actual review receipt before publishing', () => {
  const f = review(); f.execution.definition.workflow.steps.find(step => step.key === 'decide').checks[0].value = 'review:2'; fail(f, /decision/)
})
test('an irrelevant receipt comparison cannot stand in for the requested readiness decision', () => {
  const f = review(); f.execution.definition.workflow.steps.find(step => step.key === 'decide').checks[0].equals = 'unrelated'
  fail(f, /decision/)
})

function approval(variant = businessScenarios[2].variants[0]) {
  const scenario = businessScenarios[2], e = execution(variant)
  const outcome = variant.callbacks[0].outcome
  command(e, 'announce', `request:${variant.inputs.requestId}`)
  const wait = { runUlid: 'root', waitUlid: 'wait', stepKey: 'approval', stepRunUlid: 'approval-1', kind: 'workflow_input', status: 'resolved', expectedOutcomesJson: ['approved', 'rejected'], authorizedHandlesJson: ['@benchmark'] }
  e.waits.push(wait)
  e.definition.workflow.steps.push({ key: 'approval', kind: 'await_condition', outputs: { decision: '$.normalized.input.outcome' } })
  e.attempts.push({ stepKey: 'approval', stepRunUlid: 'approval-1', status: 'completed', outputJson: { decision: outcome } })
  event(e, 'wait_started', { ...wait })
  event(e, 'callback_received', { ...wait, inputUlid: 'input', payloadJson: { outcome } })
  event(e, 'wait_resolved', { ...wait, inputUlid: 'input' })
  event(e, 'step_completed', { stepKey: 'approval', stepRunUlid: 'approval-1' })
  e.acceptedInputs.push({ runUlid: 'root', inputUlid: 'input', waitUlid: 'wait', stepKey: 'approval', kind: 'callback', outcome })
  e.callbackSubmissions.push({ runUlid: 'root', waitUlid: 'wait', stepKey: 'approval', inputUlid: 'input', accepted: true, ...variant.callbacks[0] })
  if (variant.expectedStatus === 'completed') {
    command(e, 'ship', `${outcome === 'approved' ? 'publish' : 'archive'}:${variant.inputs.requestId}`)
    command(e, 'audit', `audit:${variant.inputs.requestId}`)
  }
  e.run.outputJson = { requestId: variant.inputs.requestId, decision: outcome, receipt: `audit:${variant.inputs.requestId}` }
  e.definition.workflow.outputMappings = { decision: '${steps.approval.outputs.decision}', receipt: '${steps.audit.outputs.receipt}' }
  return { scenario, variant, execution: e }
}
for (const variant of businessScenarios[2].variants) test(`approval ${variant.id} verifies correlation and allowed effects`, () => pass(approval(variant)))
test('business approval ties its result to one accepted callback and the real audit', () => pass(approval()))
test('business approval accepts the canonical fixture handle while rejecting another actor', () => {
  const f = approval()
  f.execution.waits[0].authorizedHandlesJson = ['benchmark']
  pass(f)
  f.execution.waits[0].authorizedHandlesJson = ['other-benchmark']
  fail(f, /authorizes the fixture actor/)
})
test('callback payload provenance requires the acknowledged durable input, including empty arrays', () => {
  const { execution: e } = approval()
  e.callbackSubmissions[0].payload = { evidence: [] }
  e.definition.workflow.steps.find(step => step.key === 'approval').outputs.evidence = '$.normalized.input.payload.evidence'
  e.attempts.find(attempt => attempt.stepKey === 'approval').outputJson.evidence = []
  e.run.outputJson.evidence = []
  e.definition.workflow.outputMappings.evidence = '${steps.approval.outputs.evidence}'
  assert.deepEqual(traceOutputSources(e, 'evidence'), { value: [], sources: [{ kind: 'callback', runUlid: 'root', stepRunUlid: 'approval-1', inputUlid: 'input' }] })
  e.acceptedInputs = []
  assert.deepEqual(traceOutputSources(e, 'evidence').sources, [])
})
for (const [name, mutate, pattern] of [
  ['forged decision', e => { e.definition.workflow.outputMappings.decision = 'approved' }, /decision.*origin/],
  ['missing accepted input', e => { e.acceptedInputs = [] }, /accepted callback/],
  ['duplicate matching wait', e => { e.waits.push({ ...e.waits[0], waitUlid: 'other' }) }, /unique.*wait/],
  ['wait before announcement', e => { e.events[2].seq = 0 }, /announcement.*wait/],
  ['publication before accepted callback', e => { e.events[6].seq = 3.5 }, /callback.*effects/],
  ['incorrect acknowledged payload', e => { e.callbackSubmissions[0].payload.seal = 'wrong' }, /payload/],
]) test(`business approval rejects ${name}`, () => { const f = approval(); f.execution.callbackSubmissions = structuredClone(f.execution.callbackSubmissions); mutate(f.execution); fail(f, pattern) })

test('business authoring briefs keep unpublished scenario values out of agent prompts', async () => {
  const { workflowAuthoringSuite } = await import('../../suites/workflow-authoring/index.mjs')
  for (const scenario of businessScenarios) {
    assert.equal(scenario.briefStyle, 'business')
    assert.equal(scenario.requiredSteps, undefined)
    const prompt = workflowAuthoringSuite.prompt({ environment: { repoRoot: '/tmp/eval-author' }, scenario, agent: { handle: '@verdandi' } })
    assert.doesNotMatch(prompt, /semantic step keys|required observable step names|evaluator will exercise these inputs/i)
    for (const variant of scenario.variants) {
      assert.ok(!prompt.includes(variant.inputs.requestId))
      if (variant.inputs.seal) assert.ok(!prompt.includes(variant.inputs.seal))
    }
  }
})

test('business fixtures preserve catalog membership and held-out scenario boundaries', async () => {
  const { scenarios, developmentScenarioIds, heldOutScenarioIds } = await import('../../suites/workflow-authoring/scenarios.mjs')
  assert.equal(scenarios.length, 11)
  assert.deepEqual(heldOutScenarioIds, ['07_child_loop_exhaustion', '08_callback_task_fanout'])
  for (const scenario of businessScenarios) {
    assert.equal(scenarios.find(item => item.id === scenario.id), scenario)
    assert.ok(developmentScenarioIds.includes(scenario.id))
    assert.ok(!heldOutScenarioIds.includes(scenario.id))
    assert.equal(scenario.requiredOutputTypes.requestId, 'string')
  }
})
