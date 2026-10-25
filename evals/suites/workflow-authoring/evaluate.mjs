import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { seedRuntimeFixtures } from './fixtures.mjs'
import { writeEvidence } from '../../core/evidence.mjs'
import { EvaluationInfrastructureError } from '../../core/lifecycle.mjs'
import { inspectCommandSafety, isSafePrintf } from './command-safety.mjs'
import { collectWorkflowEvidence, executeWorkflow, flattenExecution, waitAuthorizesFixture } from './execution.mjs'
import { scoreBusinessVariant, traceOutputSources, traceStepOutputSources } from './business-score.mjs'

export const EVALUATOR_VERSION = 11

const safeKinds = new Set(['condition', 'tool', 'subworkflow', 'await_condition', 'human_gate'])
const safeReads = new Set(['pm_task/get', 'pm_project/get', 'pm_agent/get'])
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const dataOf = result => {
  if (result?.isError) throw new Error(result.content?.map(item => item.text ?? '').join('\n') || 'MCP call failed')
  return result?.structuredContent?.data ?? result?.structuredContent
}
const saveJson = async (file, value) => writeEvidence(file, value)
const safeScalar = value => ['string', 'number', 'boolean'].includes(typeof value) && !/[\u0000-\u001f']/u.test(String(value))
const safeValues = value => value === null || (Array.isArray(value) ? value.every(safeValues) : record(value) ? Object.values(value).every(safeValues) : safeScalar(value))

export function inspectBundleSafety(bundle, scenario = { variants: [] }) {
  const errors = []
  if (!record(bundle) || !Array.isArray(bundle.definitions) || bundle.definitions.length === 0 || typeof bundle.entryWorkflowKey !== 'string') {
    return { safe: false, errors: ['Bundle requires nonempty definitions and entryWorkflowKey.'] }
  }
  if (bundle.definitions.length > 20) errors.push('Bundle exceeds the 20-definition budget.')
  const identities = new Set()
  for (const definition of bundle.definitions) {
    const workflow = definition?.workflow
    if (!record(workflow) || typeof workflow.key !== 'string' || !Array.isArray(workflow.steps)) {
      errors.push('Every definition must contain workflow.key and workflow.steps.')
      continue
    }
    const identity = `${workflow.key}@${workflow.version}`
    if (identities.has(identity)) errors.push(`Duplicate definition ${identity}.`)
    identities.add(identity)
    if (workflow.steps.length > 100) errors.push(`${identity} exceeds the 100-step budget.`)
    for (const step of workflow.steps) {
      if (!record(step)) {
        errors.push(`${identity}: every step must be an object.`)
        continue
      }
      const prefix = `${identity}/${step.key}`
      if (!safeKinds.has(step.kind)) errors.push(`${prefix}: step kind ${step.kind} is not permitted.`)
      if (step.session || step.review || step.resolveExisting || step.cwd) errors.push(`${prefix}: runtime/session overrides are not permitted.`)
      if (step.gates?.length) errors.push(`${prefix}: session evidence gates are not supported by this isolated benchmark.`)
      if (step.kind === 'tool') {
        const target = `${step.tool?.id}/${step.tool?.action}`
        if (target === 'command/run') {
          if (!isSafePrintf(step.inputs?.command, { allowExpressions: true })) errors.push(`${prefix}: only one single-quoted printf '%s' payload is permitted.`)
          const extra = Object.keys(step.inputs ?? {}).filter(key => !['command', 'timeoutSeconds'].includes(key))
          if (extra.length) errors.push(`${prefix}: command override fields are forbidden: ${extra.join(', ')}.`)
          if (step.inputs?.timeoutSeconds !== undefined && (step.inputs.timeoutSeconds < 1 || step.inputs.timeoutSeconds > 5)) errors.push(`${prefix}: command timeout must be 1–5 seconds.`)
        } else if (!safeReads.has(target)) errors.push(`${prefix}: tool ${target} is outside the isolated read allowlist.`)
      }
      if (step.kind === 'subworkflow' && !bundle.definitions.some(item => item?.workflow?.key === step.workflow?.key && item?.workflow?.version === step.workflow?.version)) errors.push(`${prefix}: child reference must pin a definition included in the bundle.`)
      if (step.detached) errors.push(`${prefix}: detached children would escape bounded evaluation.`)
    }
  }
  if (bundle.definitions.filter(item => item?.workflow?.key === bundle.entryWorkflowKey).length !== 1) errors.push('Entry workflow must resolve to exactly one included definition.')
  for (const variant of scenario.variants ?? []) {
    if (!safeValues(variant.inputs ?? {}) || !safeValues(variant.callbacks ?? [])) errors.push(`${variant.id}: input/callback strings contain command-unsafe quotes or control characters.`)
  }
  errors.push(...inspectCommandSafety(bundle, scenario).errors)
  return { safe: errors.length === 0, errors }
}

export function inspectAuthorContract(bundle, scenario) {
  const assertions = []
  const check = (message, actual, expected) => assertions.push({ message, actual, expected, pass: isDeepStrictEqual(actual, expected) })
  const root = bundle.definitions.find(item => item.workflow.key === bundle.entryWorkflowKey)?.workflow
  if (scenario.entryWorkflowKey) check('required root workflow identity', bundle.entryWorkflowKey, scenario.entryWorkflowKey)
  for (const requirement of scenario.requiredSteps ?? []) {
    const step = bundle.definitions.find(item => item.workflow.key === requirement.workflowKey)?.workflow.steps.find(item => item.key === requirement.stepKey)
    const label = `${requirement.workflowKey}/${requirement.stepKey}`
    check(`${label} kind`, step?.kind, requirement.kind)
    if (requirement.toolId) check(`${label} tool`, step?.tool?.id, requirement.toolId)
    if (requirement.action) check(`${label} tool action`, step?.tool?.action, requirement.action)
    if (requirement.childKey) check(`${label} child workflow`, step?.workflow?.key, requirement.childKey)
    if (requirement.forEach) check(`${label} forEach`, Boolean(step?.forEach), true)
    if (requirement.onFailure) check(`${label} failure policy`, step?.onFailure?.action, requirement.onFailure)
  }
  for (const [key, type] of Object.entries(scenario.requiredOutputTypes ?? {})) check(`root output ${key} declared type`, root?.outputs?.[key]?.type, type)
  const steps = bundle.definitions.flatMap(item => item.workflow.steps)
  const serialized = JSON.stringify(bundle)
  const featureChecks = {
    conditional_routes: () => steps.some(step => step.when !== undefined),
    skipped_dependencies: () => steps.some(step => step.when !== undefined) && steps.some(step => step.needs?.length),
    command_outputs: () => steps.some(step => step.tool?.id === 'command' && Object.values(step.outputs ?? {}).some(value => ['$.normalized.stdout', '$.raw.stdout'].includes(value))),
    loop_back: () => steps.some(step => step.onFailure?.action === 'loop_back'),
    loop_previous: () => serialized.includes('${runtime.loop.previous.'),
    runtime_phase: () => serialized.includes('${runtime.loop.'),
    for_each: () => steps.some(step => step.kind === 'subworkflow' && step.forEach),
    subworkflow: () => steps.some(step => step.kind === 'subworkflow'),
    nested_subworkflow: () => bundle.definitions.some(item => item.workflow.key !== bundle.entryWorkflowKey && item.workflow.steps.some(step => step.kind === 'subworkflow')),
    required_inputs: () => bundle.definitions.some(item => item.workflow.key !== bundle.entryWorkflowKey && Object.values(item.workflow.inputs ?? {}).some(field => field.required === true)),
    callback_wait: () => steps.some(step => step.kind === 'await_condition' && step.waitsFor?.kind === 'workflow_input'),
    pm_tool: () => steps.some(step => step.tool?.id === 'pm_task' && step.tool.action === 'get'),
    nullable_output: () => steps.some(step => step.tool?.id === 'pm_task' && step.inputs?.allowMissing === true),
    child_scope: () => serialized.includes('${runtime.taskKey}') && serialized.includes('${runtime.projectKey}'),
    loop_exhaustion: () => steps.some(step => step.onFailure?.action === 'loop_back' && ['block', 'fail', undefined].includes(step.onFailure.exhausted)),
  }
  for (const feature of scenario.features ?? []) if (featureChecks[feature]) check(`required feature ${feature}`, featureChecks[feature](), true)
  return { valid: assertions.every(item => item.pass), assertions, errors: assertions.filter(item => !item.pass) }
}

function unsupportedAssertionReason(variants) {
  const supportedExpectations = new Set(['expectedStatus', 'expectedSteps', 'expectedStepStatuses', 'expectedOutputs', 'expectedStepOutputs', 'expectedStepOrder', 'expectedAttempts', 'expectedChildren', 'expectedOutputChildren'])
  for (const variant of variants) {
    const unsupported = Object.keys(variant).filter(key => key.startsWith('expected') && !supportedExpectations.has(key))
    if (unsupported.length) return `Unsupported execution assertions: ${unsupported.join(', ')}.`
  }
  return null
}

export function scoreVariant({ scenario = {}, variant, execution }) {
  const unsupported = unsupportedAssertionReason([variant])
  if (unsupported) throw new EvaluationInfrastructureError(unsupported)
  if (scenario.briefStyle === 'business') {
    const assertions = scoreBusinessVariant({ scenario, variant, execution })
    if (execution.error) assertions.push({ message: 'execution error absent', actual: execution.error, expected: undefined, pass: false })
    return { ok: assertions.every(item => item.pass), assertions, passedAssertions: assertions.filter(item => item.pass).length, totalAssertions: assertions.length }
  }
  const assertions = []
  const check = (message, actual, expected) => assertions.push({ message, pass: isDeepStrictEqual(actual, expected), actual, expected })
  const steps = execution.steps ?? []
  const attempts = execution.attempts ?? steps
  const stepFor = key => steps.find(step => step.stepKey === key)
  const positiveProof = Boolean(variant.expectedSteps?.length || Object.keys(variant.expectedStepStatuses ?? {}).length || Object.keys(variant.expectedOutputs ?? {}).length || Object.keys(variant.expectedStepOutputs ?? {}).length
    || variant.expectedStepOrder?.length || Object.keys(variant.expectedAttempts ?? {}).length || variant.expectedChildren || variant.expectedOutputChildren || variant.callbacks?.length)
  check('explicit positive execution evidence required', positiveProof, true)
  check('terminal status', execution.run?.status, variant.expectedStatus)
  if (execution.error) check('execution error absent', execution.error, undefined)
  for (const key of variant.expectedSteps ?? []) check(`step ${key} completed`, stepFor(key)?.status, 'completed')
  for (const [key, status] of Object.entries(variant.expectedStepStatuses ?? {})) check(`step ${key} status`, stepFor(key)?.status, status)
  for (const key of variant.absentSteps ?? []) check(`step ${key} never executed`, !attempts.some(step => step.stepKey === key && !['pending', 'ready', 'skipped'].includes(step.status)), true)
  for (const [key, value] of Object.entries(variant.expectedOutputs ?? {})) check(`output ${key}`, execution.run?.outputJson?.[key], value)
  for (const [stepKey, values] of Object.entries(variant.expectedStepOutputs ?? {})) {
    for (const [key, value] of Object.entries(values)) check(`step ${stepKey} output ${key}`, stepFor(stepKey)?.outputJson?.[key], value)
  }
  for (const [before, after] of variant.expectedStepOrder ?? []) {
    const completed = execution.events?.filter(event => event.stepKey === before && event.eventType === 'step_completed').at(-1)
    const began = execution.events?.find(event => event.stepKey === after && ['step_started', 'step_completed'].includes(event.eventType))
    check(`step ${before} completed before ${after} began`, Boolean(completed && began && completed.seq < began.seq), true)
  }
  for (const [stepKey, count] of Object.entries(variant.expectedAttempts ?? {})) {
    check(`step ${stepKey} attempt count`, execution.attempts?.filter(attempt => attempt.stepKey === stepKey).length, count)
  }
  const children = flattenExecution(execution).slice(1)
  if (variant.expectedChildren) {
    const expected = variant.expectedChildren
    check('child run count', children.length, expected.count)
    for (const [key, field] of [['statuses', 'status'], ['itemOrder', 'itemJson'], ['taskKeys', 'taskKey'], ['projectKeys', 'projectKey']]) {
      if (expected[key]) check(`child ${key}`, children.map(child => child.run[field]), expected[key])
    }
    for (const [index, outputs] of (expected.outputs ?? []).entries()) for (const [key, value] of Object.entries(outputs)) {
      check(`child ${index} output ${key}`, children[index]?.run.outputJson?.[key], value)
    }
    for (const [index, statuses] of (expected.stepStatuses ?? []).entries()) for (const [key, status] of Object.entries(statuses)) {
      check(`child ${index} step ${key} status`, children[index]?.steps.find(step => step.stepKey === key)?.status, status)
    }
    for (const [index, keys] of (expected.absentSteps ?? []).entries()) for (const key of keys) {
      check(`child ${index} step ${key} never executed`, Boolean(children[index]) && !(children[index].attempts ?? children[index].steps).some(step => step.stepKey === key && !['pending', 'ready', 'skipped'].includes(step.status)), true)
    }
  }
  if (variant.expectedOutputChildren) {
    const { outputKey, stepKey } = variant.expectedOutputChildren
    const receipts = (execution.children ?? []).filter(child => child.run.parentStepKey === stepKey).map(({ run }) => ({
      index: run.itemIndex, item: run.itemJson, runUlid: run.runUlid, status: run.status, outputs: run.outputJson,
    }))
    check(`output ${outputKey} identifies actual child receipts`, execution.run.outputJson?.[outputKey], receipts)
  }
  for (const [index, callback] of (variant.callbacks ?? []).entries()) {
    const waits = flattenExecution(execution).flatMap(run => (run.waits ?? []).filter(wait => wait.kind === 'workflow_input'
      && (callback.stepKey ? wait.stepKey === callback.stepKey
        : isDeepStrictEqual([...(wait.expectedOutcomesJson ?? [])].sort(), [...(callback.select?.outcomes ?? [])].sort()))).map(wait => ({ run, wait })))
    check(`callback ${index} has one authorized wait`, waits.length === 1 && waitAuthorizesFixture(waits[0].wait), true)
    const proof = waits.length === 1 && (execution.callbackSubmissions ?? []).some(submission => {
      const { run, wait } = waits[0]
      return submission.accepted === true && submission.runUlid === run.run.runUlid && submission.waitUlid === wait.waitUlid
        && submission.stepKey === wait.stepKey && submission.outcome === callback.outcome && isDeepStrictEqual(submission.payload, callback.payload ?? {})
        && run.acceptedInputs?.some(input => input.inputUlid === submission.inputUlid && input.waitUlid === wait.waitUlid && input.stepKey === wait.stepKey && input.kind === 'callback' && input.outcome === callback.outcome)
        && run.events?.some(event => event.eventType === 'callback_received' && event.inputUlid === submission.inputUlid && event.waitUlid === wait.waitUlid && event.payloadJson?.outcome === callback.outcome)
    })
    check(`callback ${index} exact payload was durably accepted`, Boolean(proof), true)
  }
  const commandReceipts = (run, stepKey, expected) => {
    const results = (run.events ?? []).filter(event => event.eventType === 'step_completed' && event.stepKey === stepKey
      && event.payloadJson?.toolName === 'command' && event.payloadJson?.action === 'run').map(event => event.payloadJson.normalized)
    check(`${run.run.workflowKey ?? 'root'}/${stepKey} actual command receipts`, results.map(result => result?.ok === true ? result.stdout : undefined), expected)
  }
  if (scenario.id === '01_routed_release') commandReceipts(execution, 'probe', variant.expectedStatus === 'completed' ? ['ready'] : [])
  if (scenario.id === '02_loop_receipts') {
    commandReceipts(execution, 'inspect', variant.inputs.permit ? ['1', '2', '3'] : [])
    if (variant.inputs.permit) {
      const captures = attempts.filter(attempt => attempt.stepKey === 'capture_previous').sort((a, b) => a.attempt - b.attempt)
      check('previous-pass capture only executes on passes two and three', captures.map(attempt => attempt.status), ['skipped', 'completed', 'completed'])
      check('previous-pass capture retains each immediate receipt', captures.filter(attempt => attempt.status === 'completed').map(attempt => attempt.outputJson?.priorReason), ['1', '2'])
    }
  }
  if (scenario.id === '03_typed_fanout') for (const child of children) {
    commandReceipts(child, 'receipt', child.run.status === 'completed' ? [child.run.itemJson?.label] : [])
    check(`child ${child.run.itemIndex} received its typed item`, child.run.inputJson?.item, variant.inputs.items[child.run.itemIndex])
    check(`child ${child.run.itemIndex} received its batch`, child.run.inputJson?.batch, variant.inputs.batch)
  }
  if (scenario.id === '04_nested_contracts') for (const child of children.filter(child => child.run.workflowKey === 'benchmark.contract-leaf')) {
    commandReceipts(child, 'probe_leaf', child.run.status === 'completed' ? ['leaf-ok'] : [])
  }
  if (scenario.id === '05_callback_quality_gate') commandReceipts(execution, 'prepare_request', [variant.inputs.requestId])
  if (scenario.id === '07_child_loop_exhaustion') for (const child of children) commandReceipts(child, 'probe_observation', [variant.inputs.observed])
  if (scenario.id === '08_callback_task_fanout') commandReceipts(execution, 'announce', [variant.inputs.batch])
  const taskRead = (run, stepKey, key, found) => {
    const results = (run.events ?? []).filter(event => event.eventType === 'step_completed' && event.stepKey === stepKey
      && event.payloadJson?.toolName === 'pm_task' && event.payloadJson?.action === 'get')
    check(`${stepKey} actual task read count`, results.length, 1)
    if (found !== undefined) check(`${stepKey} actual lookup presence`, results[0]?.payloadJson.normalized?.found, found)
    if (found !== false) check(`${stepKey} actual task key`, results[0]?.payloadJson.normalized?.task?.key, key)
    return results.length === 1 ? results[0] : undefined
  }
  if (scenario.id === '06_optional_task_lookup') {
    const receipt = taskRead(execution, 'inspect_task', variant.inputs.lookupKey, variant.expectedOutputs.found)
    const fromLookup = (traced, path) => Boolean(receipt && traced.sources.some(source => source.kind === 'task'
      && source.runUlid === execution.run.runUlid && source.stepRunUlid === receipt.stepRunUlid
      && source.requestedTaskKey === variant.inputs.lookupKey && source.path === path))
    check('output found traces to the actual inspect_task result', fromLookup(traceOutputSources(execution, 'found'), 'found'), true)
    if (variant.expectedOutputs.found) check('step report_found output taskKey traces to an actual read of the requested task record',
      traceStepOutputSources(execution, 'report_found', 'taskKey').sources.some(source => source.kind === 'task'
        && source.requestedTaskKey === variant.inputs.lookupKey && source.path === 'task.key'), true)
  }
  if (scenario.id === '08_callback_task_fanout') for (const child of children) taskRead(child, 'read_task', child.run.taskKey)
  if (variant.expectedStatus === 'completed') {
    const origins = {
      '01_routed_release': { probe: 'command' },
      '02_loop_receipts': { finalPass: 'command', priorReason: 'command' },
      '04_nested_contracts': { probe: 'command' },
      '05_callback_quality_gate': { outcome: 'callback', evidence: 'callback' },
      '07_child_loop_exhaustion': { observed: 'command' },
    }
    for (const [field, kind] of Object.entries(origins[scenario.id] ?? {})) {
      check(`output ${field} traces to actual ${kind} evidence`, traceOutputSources(execution, field).sources.some(source => source.kind === kind), true)
    }
  }
  return { ok: assertions.every(item => item.pass), assertions, passedAssertions: assertions.filter(item => item.pass).length, totalAssertions: assertions.length }
}

async function readWorkflowEvidence(call, input) {
  try { return dataOf(await call('pm_workflow', input)) }
  catch (error) {
    if (error.code === 'VALDR_EVAL_CANCELLED' || error.code === 'VALDR_EVAL_INFRASTRUCTURE') throw error
    throw new EvaluationInfrastructureError(`Workflow evidence readback failed: ${error.message}`, { cause: error })
  }
}

export async function evaluateBundle({ bundle, scenario, valdrBin, outputDir, maxAdvances = 150, lifecycle }) {
  assert(outputDir, 'An explicit evidence output directory is required')
  await mkdir(outputDir, { recursive: true })
  const report = { evaluatorVersion: EVALUATOR_VERSION, scenarioId: scenario.id, title: scenario.title, variants: [], validation: [], ok: false }
  const unsupported = unsupportedAssertionReason(scenario.variants)
  if (unsupported) {
    report.infrastructureError = unsupported
    report.error = unsupported
    await saveJson(path.join(outputDir, 'evaluation.json'), report)
    throw new EvaluationInfrastructureError(unsupported)
  }
  report.safety = inspectBundleSafety(bundle, scenario)
  if (!report.safety.safe) {
    await saveJson(path.join(outputDir, 'evaluation.json'), report)
    return report
  }
  report.contract = inspectAuthorContract(bundle, scenario)
  report.validation.push({ tier: 'benchmark_contract', ...report.contract })
  if (!report.contract.valid) {
    await saveJson(path.join(outputDir, 'evaluation.json'), report)
    return report
  }
  const root = bundle.definitions.find(item => item.workflow.key === bundle.entryWorkflowKey)
  const { createIsolatedEnvironment } = await import('../../core/harness.mjs')
  for (const variant of scenario.variants) {
    lifecycle?.throwIfCancelled()
    const variantDir = path.join(outputDir, variant.id)
    await mkdir(variantDir, { recursive: true })
    const result = { id: variant.id, expectedStatus: variant.expectedStatus, validation: [], advanceTargets: [], execution: null, ok: false, assertions: [] }
    report.variants.push(result)
    let environment
    let stage = 'isolation', activeRunUlid
    try {
      environment = await createIsolatedEnvironment({ valdrBin, evidenceDir: variantDir, mode: 'runtime', requiredTools: ['pm_workflow'], label: `${scenario.id}-${variant.id}`, lifecycle })
      result.isolation = { home: environment.home, repoRoot: environment.repoRoot, health: environment.health }
      await seedRuntimeFixtures(environment)
      stage = 'validation'
      const { call, uid } = environment
      const saved = new Set(), visiting = new Set()
      const save = async definition => {
        const key = `${definition.workflow.key}@${definition.workflow.version}`
        if (saved.has(key)) return
        assert(!visiting.has(key), `Cyclic child workflow reference: ${key}`)
        visiting.add(key)
        for (const step of definition.workflow.steps.filter(step => step.kind === 'subworkflow')) {
          await save(bundle.definitions.find(child => child.workflow.key === step.workflow.key && child.workflow.version === step.workflow.version))
        }
        const validation = dataOf(await call('pm_workflow', { action: 'validate', definitionJson: definition }))
        result.validation.push({ workflowKey: definition.workflow.key, ...validation })
        report.validation.push({ variantId: variant.id, workflowKey: definition.workflow.key, ...validation })
        assert(validation.valid === true, `Definition ${definition.workflow.key} failed contextual validation: ${JSON.stringify(validation.errors)}`)
        dataOf(await call('pm_workflow', { action: 'save_definition', definitionJson: definition,
          capabilityKey: definition.workflow.source?.capabilityKey, packKey: 'benchmark', sourceRelpath: `${definition.workflow.key}.workflow.yaml` }))
        visiting.delete(key)
        saved.add(key)
      }
      for (const definition of bundle.definitions) await save(definition)
      stage = 'execution'
      const response = dataOf(await call('pm_workflow', { action: 'start', workflowKey: root.workflow.key, version: root.workflow.version,
        inputs: variant.inputs ?? {}, taskKey: 'BENCH-1', actorHandle: '@benchmark', clientRequestId: await uid() }))
      const runUlid = response.run.runUlid
      activeRunUlid = runUlid
      result.callbackSubmissions = []
      const executed = await executeWorkflow({ call, uid, runUlid, callbacks: variant.callbacks, maxAdvances,
        advanceTargets: result.advanceTargets, callbackSubmissions: result.callbackSubmissions })
      result.execution = executed.execution
      const { ok, assertions } = scoreVariant({ scenario, variant, execution: result.execution })
      result.ok = ok
      result.assertions = assertions
    } catch (error) {
      result.error = error.message
      if (stage === 'isolation' || error.code === 'VALDR_EVAL_INFRASTRUCTURE') result.infrastructureError = error.message
      if (lifecycle?.signal.aborted || error.code === 'VALDR_EVAL_CANCELLED') throw error
      if (stage === 'execution' && !activeRunUlid && environment) {
        try {
          const runs = (await readWorkflowEvidence(environment.call, { action: 'list_runs', rootOnly: true, limit: 10 })).runs
          if (runs?.length === 1) activeRunUlid = runs[0].runUlid
        } catch (evidenceError) {
          result.evidenceError = evidenceError.message
          if (evidenceError.code === 'VALDR_EVAL_CANCELLED') throw evidenceError
          result.infrastructureError = evidenceError.message
        }
      }
      if (activeRunUlid && environment) {
        try {
          result.execution = await collectWorkflowEvidence(environment.call, activeRunUlid)
          result.execution.callbackSubmissions = result.callbackSubmissions ?? []
        } catch (evidenceError) {
          result.evidenceError = evidenceError.message
          if (evidenceError.code === 'VALDR_EVAL_CANCELLED') throw evidenceError
          result.infrastructureError = evidenceError.message
        }
      }
    } finally {
      if (environment) {
        result.cleanup = await environment.close()
        if (!result.cleanup?.ok) result.infrastructureError = 'Workflow variant cleanup was not verified.'
      }
      result.actualStatus = result.execution?.run?.status ?? null
      await saveJson(path.join(variantDir, 'evidence.json'), result)
    }
    if (result.infrastructureError) throw Object.assign(new Error(`Benchmark infrastructure failure: ${result.infrastructureError}`), { code: 'VALDR_EVAL_INFRASTRUCTURE' })
  }
  report.ok = report.variants.length > 0 && report.variants.every(item => item.ok)
  report.summary = { variants: report.variants.length, passedVariants: report.variants.filter(item => item.ok).length, passedAssertions: report.variants.reduce((sum, item) => sum + item.assertions.filter(assertion => assertion.pass).length, 0), totalAssertions: report.variants.reduce((sum, item) => sum + item.assertions.length, 0) }
  await saveJson(path.join(outputDir, 'evaluation.json'), report)
  return report
}
