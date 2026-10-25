import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectCommandSafety, isSafePrintf } from '../../suites/workflow-authoring/command-safety.mjs'
import { inspectBundleSafety } from '../../suites/workflow-authoring/evaluate.mjs'

const command = text => ({ key: 'print', kind: 'tool', tool: { id: 'command', action: 'run' }, inputs: { command: `printf '%s' '${text}'`, timeoutSeconds: 5 } })
const workflow = (key, steps, inputs = {}) => ({ workflow: { key, version: '0.1.0', inputs, steps } })
const bundle = (...definitions) => ({ entryWorkflowKey: definitions[0].workflow.key, definitions })
const child = (inputs, forEach) => ({ key: 'child', kind: 'subworkflow', workflow: { key: 'benchmark.child', version: '0.1.0' }, inputs, ...(forEach ? { forEach } : {}) })
const fixture = inputs => ({ variants: [{ inputs }] })

test('command language accepts only literal text, simple workflow inputs, and current pass', () => {
  assert.equal(isSafePrintf("printf '%s' 'ready'"), true)
  assert.equal(isSafePrintf("printf '%s' 'ready'\n"), false)
  assert.equal(isSafePrintf("printf '%s' '${workflow.inputs.value}'"), false)
  assert.equal(isSafePrintf("printf '%s' 'pass ${runtime.loop.currentPass}'", { allowExpressions: true }), true)
  for (const value of ['${steps.generated.outputs.payload}', '${runtime.loop.previous.outputs.reason}', '${workflow.inputs.__proto__.value}', '${workflow.inputs.value[0]}', '${workflow.inputs.value || bad}']) {
    assert.equal(isSafePrintf(`printf '%s' '${value}'`, { allowExpressions: true }), false, value)
  }
})

test('root command values must be proved for every scenario variant and default', () => {
  const candidate = bundle(workflow('benchmark.root', [command('${workflow.inputs.value}')], { value: { default: 'safe' } }))
  assert.equal(inspectCommandSafety(candidate, fixture({ value: 'safe' })).safe, true)
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, true)
  for (const value of ["'; touch /tmp/unsafe; printf '", 'line\nbreak', '${steps.other.outputs.value}']) {
    assert.equal(inspectCommandSafety(candidate, { variants: [{ inputs: { value: 'safe' } }, { inputs: { value } }] }).safe, false)
  }
  assert.equal(inspectCommandSafety(candidate, { variants: [] }).safe, false)
  delete candidate.definitions[0].workflow.inputs.value.default
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, false)
})

test('a condition-generated quote cannot flow through a child into a shell command', () => {
  const candidate = bundle(
    workflow('benchmark.root', [
      { key: 'generated', kind: 'condition', outputs: { payload: "'; touch /tmp/unsafe; printf '" } },
      child({ value: '${steps.generated.outputs.payload}' }),
    ]),
    workflow('benchmark.child', [command('${workflow.inputs.value}')]),
  )
  assert.equal(inspectBundleSafety(candidate, fixture({})).safe, false)
  candidate.definitions[1].workflow.steps[0] = command('${steps.generated.outputs.payload}')
  assert.equal(inspectBundleSafety(candidate, fixture({})).safe, false)
})

test('every incoming binding is checked even when another call is safe', () => {
  const candidate = bundle(
    workflow('benchmark.root', [child({ value: 'safe' }), { ...child({ value: '${steps.generated.outputs.value}' }), key: 'second' }]),
    workflow('benchmark.child', [command('${workflow.inputs.value}')]),
  )
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, false)
  candidate.definitions[0].workflow.steps[1].inputs.value = 'also safe'
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, true)
})

test('transitive child forwarding checks consumed object properties and rejects control suffixes', () => {
  const middle = { ...child({ value: '${workflow.inputs.object.label}' }), workflow: { key: 'benchmark.middle', version: '0.1.0' } }
  const candidate = bundle(
    workflow('benchmark.root', [middle]),
    workflow('benchmark.middle', [child({ value: '${workflow.inputs.value}' })]),
    workflow('benchmark.child', [command('${workflow.inputs.value}')]),
  )
  const scenario = fixture({ object: { label: 'safe' } })
  assert.equal(inspectCommandSafety(candidate, scenario).safe, true)
  middle.inputs.value += '\n'
  assert.equal(inspectCommandSafety(candidate, scenario).safe, false)
  middle.inputs.value = '${workflow.inputs.object.label}'
  scenario.variants[0].inputs.object.label = "unsafe'quote"
  assert.equal(inspectCommandSafety(candidate, scenario).safe, false)
})

test('typed fanout proves command item fields from direct parent fixture arrays', () => {
  const candidate = bundle(
    workflow('benchmark.root', [child({ batch: '${workflow.inputs.batch}' }, { items: '${workflow.inputs.items}', itemName: 'item', maxConcurrent: 1 })]),
    workflow('benchmark.child', [command('${workflow.inputs.item.label}'), command('${workflow.inputs.batch}')]),
  )
  const scenario = { variants: [{ inputs: { batch: 'a', items: [{ label: 'alpha' }, { label: 'beta' }] } }, { inputs: { batch: 'empty', items: [] } }] }
  assert.equal(inspectCommandSafety(candidate, scenario).safe, true)
  scenario.variants[0].inputs.items[1].label = "bad'value"
  assert.equal(inspectCommandSafety(candidate, scenario).safe, false)
})

test('loop children can forward parent inputs and currentPass through nested bindings', () => {
  const candidate = bundle(
    workflow('benchmark.root', [child({ observation: { text: '${workflow.inputs.observed}', pass: '${runtime.loop.currentPass}' } })]),
    workflow('benchmark.child', [command('${workflow.inputs.observation.text}'), command('${workflow.inputs.observation.pass}')]),
  )
  assert.equal(inspectCommandSafety(candidate, fixture({ observed: 'ready' })).safe, true)
  candidate.definitions[0].workflow.steps[0].inputs.observation.text = '${runtime.loop.previous.outputs.reason}'
  assert.equal(inspectCommandSafety(candidate, fixture({ observed: 'ready' })).safe, false)
})

test('callback-fed read-only children need no shell provenance proof', () => {
  const candidate = bundle(
    workflow('benchmark.root', [child({}, { items: '${steps.await_tasks.outputs.taskKeys}', itemName: 'taskKey', maxConcurrent: 1 })]),
    workflow('benchmark.child', [{ key: 'read', kind: 'tool', tool: { id: 'pm_task', action: 'get' }, inputs: { taskKey: '${workflow.inputs.taskKey}' } }]),
  )
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, true)
  candidate.definitions[1].workflow.steps.push(command('${workflow.inputs.taskKey}'))
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, false)
})

test('dynamic JSON keys, tool targets, command overrides, and identity fields are rejected', () => {
  const good = () => bundle(workflow('benchmark.root', [command('safe')]))
  for (const mutate of [
    value => { value.definitions[0].workflow.steps[0].inputs['${workflow.inputs.override}'] = '/tmp' },
    value => { value.definitions[0].workflow.steps[0].inputs.env = {} },
    value => { value.definitions[0].workflow.steps[0].tool.id = '${workflow.inputs.target}' },
    value => { value.definitions[0].workflow.steps[0].kind = '${workflow.inputs.kind}' },
    value => { value.definitions[0].workflow.steps[0].key = '${workflow.inputs.key}' },
  ]) {
    const candidate = good()
    mutate(candidate)
    assert.equal(inspectBundleSafety(candidate, fixture({})).safe, false)
  }
})

test('missing, cyclic, and unreferenced child input origins fail closed', () => {
  const candidate = bundle(workflow('benchmark.root', []), workflow('benchmark.child', [command('${workflow.inputs.value}')]))
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, false)
  candidate.definitions[0].workflow.steps.push(child({}))
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, false)
  candidate.definitions[1].workflow.steps.push(child({ value: '${workflow.inputs.value}' }))
  assert.equal(inspectCommandSafety(candidate, fixture({})).safe, false)
})
