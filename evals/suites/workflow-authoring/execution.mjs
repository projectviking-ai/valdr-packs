import { isDeepStrictEqual } from 'node:util'
import { EvaluationInfrastructureError } from '../../core/lifecycle.mjs'
import { registerEvidenceSecrets } from '../../core/evidence.mjs'

const terminal = new Set(['completed', 'blocked', 'failed', 'cancelled'])
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const failure = message => { throw new EvaluationInfrastructureError(message) }
const dataOf = response => {
  if (response?.isError) throw new Error(response.content?.map(item => item.text ?? '').join('\n') || 'Workflow request failed')
  return response?.structuredContent?.data ?? response?.structuredContent
}
const read = async (call, args) => {
  try { return dataOf(await call('pm_workflow', args)) }
  catch (error) {
    if (['VALDR_EVAL_CANCELLED', 'VALDR_EVAL_INFRASTRUCTURE'].includes(error.code)) throw error
    throw new EvaluationInfrastructureError(`Workflow evidence readback failed: ${error.message}`, { cause: error })
  }
}

export const flattenExecution = execution => [execution, ...(execution.children ?? []).flatMap(flattenExecution)]
export const waitAuthorizesFixture = wait => wait?.authorizedHandlesJson?.some(handle => handle === 'benchmark' || handle === '@benchmark') ?? false

async function pages(call, args, field) {
  const rows = [], seen = new Set()
  let cursor
  do {
    const response = await read(call, { ...args, ...(cursor === undefined ? {} : { cursor }) })
    if (!Array.isArray(response?.[field]) || typeof response.page?.hasMore !== 'boolean') failure(`Workflow ${args.action} returned incomplete pagination evidence.`)
    rows.push(...response[field])
    if (rows.length > 10_000) failure('Workflow evidence exceeds the 10,000-record collection budget.')
    if (!response.page.hasMore) break
    cursor = response.page.nextCursor
    if (typeof cursor !== 'string' || !cursor || seen.has(cursor) || !response[field].length) failure(`Workflow ${args.action} returned an invalid continuation cursor.`)
    seen.add(cursor)
  } while (true)
  return rows
}

export async function collectWorkflowEvidence(call, runUlid, { includeEvents = true } = {}) {
  const visited = new Set()
  const collect = async (id, parentRunUlid) => {
    if (visited.has(id) || visited.size >= 100) failure('Workflow child evidence contains a duplicate or exceeds 100 runs.')
    visited.add(id)
    const details = await read(call, { action: 'get_run', runUlid: id, includeSteps: true, includeWaits: true,
      includeAcceptedInputs: true, includeDefinition: true, includeChildren: true })
    if (!record(details?.run) || details.run.runUlid !== id || typeof details.run.status !== 'string'
      || (parentRunUlid !== undefined && details.run.parentRunUlid !== parentRunUlid)
      || !Array.isArray(details.steps) || !Array.isArray(details.attempts) || !Array.isArray(details.waits)
      || !Array.isArray(details.acceptedInputs) || !Array.isArray(details.children?.runs)
      || !record(details.definition?.definitionJson)) failure('Workflow detail is missing required public run, attempt, wait, definition, or child evidence.')
    for (const rows of [details.steps, details.attempts]) {
      if (rows.some(step => !record(step) || typeof step.stepKey !== 'string' || typeof step.status !== 'string'
        || typeof step.stepRunUlid !== 'string' || !step.stepRunUlid || step.runUlid !== id
        || !Number.isSafeInteger(step.attempt) || step.attempt < 1)) failure('Workflow step evidence is malformed.')
    }
    if (new Set(details.steps.map(step => step.stepKey)).size !== details.steps.length) failure('Workflow latest-step evidence contains duplicate step keys.')
    const attempts = new Map(details.attempts.map(attempt => [attempt.stepRunUlid, attempt]))
    if (attempts.size !== details.attempts.length) failure('Workflow attempt history contains duplicate identities.')
    for (const step of details.steps) {
      const history = details.attempts.filter(attempt => attempt.stepKey === step.stepKey)
      const latest = attempts.get(step.stepRunUlid)
      if (!latest || ['stepKey', 'attempt', 'status', 'inputJson', 'outputJson'].some(key => !isDeepStrictEqual(step[key], latest[key]))
        || history.length !== step.attempt || new Set(history.map(attempt => attempt.attempt)).size !== history.length
        || history.some(attempt => attempt.attempt > step.attempt)) failure(`Workflow attempt history is incomplete or inconsistent for ${step.stepKey}.`)
    }
    if (details.attempts.some(attempt => !details.steps.some(step => step.stepKey === attempt.stepKey))) failure('Workflow attempt history has no matching latest step.')
    const events = includeEvents ? await pages(call, { action: 'events', runUlid: id, includePayload: true, limit: 500 }, 'events') : []
    if (events.some((event, index) => !Number.isInteger(event.seq) || (index && event.seq <= events[index - 1].seq))) failure('Workflow event sequence is incomplete or out of order.')
    if (includeEvents) {
      if (terminal.has(details.run.status) && !events.some(event => event.eventType === `workflow_${details.run.status}`)) failure('Workflow terminal status has no matching history event.')
      for (const event of events) {
        if (event.stepRunUlid != null && (!attempts.has(event.stepRunUlid)
          || event.stepKey !== attempts.get(event.stepRunUlid).stepKey)) failure('Workflow event has no matching attempt identity.')
      }
      for (const attempt of details.attempts) {
        const completedEvent = { completed: 'step_completed', blocked: 'workflow_blocked', failed: 'workflow_failed' }[attempt.status]
        if (completedEvent && !events.some(event => event.eventType === completedEvent && event.stepRunUlid === attempt.stepRunUlid)) {
          failure(`Workflow attempt ${attempt.stepKey}/${attempt.attempt} has no matching completion event.`)
        }
      }
    }
    const childRows = details.children.page?.hasMore
      ? await pages(call, { action: 'list_runs', parentRunUlid: id, limit: 100 }, 'runs') : details.children.runs
    if (details.children.total !== childRows.length) failure('Workflow child listing is incomplete.')
    const startOrder = new Map(events.filter(event => event.eventType === 'child_run_started').map(event => [event.childRunUlid, event.seq]))
    if (includeEvents && childRows.some(child => !startOrder.has(child.runUlid))) failure('Workflow child is missing its public start event.')
    childRows.sort((a, b) => includeEvents ? startOrder.get(a.runUlid) - startOrder.get(b.runUlid)
      : (a.createdAt - b.createdAt || a.runUlid.localeCompare(b.runUlid)))
    const children = []
    for (const child of childRows) children.push(await collect(child.runUlid, id))
    return { run: details.run, steps: details.steps, attempts: details.attempts, waits: details.waits,
      acceptedInputs: details.acceptedInputs, definition: details.definition.definitionJson, events, children }
  }
  return collect(runUlid)
}

export function matchingCallbackWaits(execution, callback) {
  return flattenExecution(execution).flatMap(run => run.waits.filter(wait => wait.kind === 'workflow_input' && wait.status === 'waiting'
    && (callback.stepKey ? wait.stepKey === callback.stepKey : callback.select?.outcomes
      ? isDeepStrictEqual([...wait.expectedOutcomesJson].sort(), [...callback.select.outcomes].sort()) : false))
    .map(wait => ({ execution: run, wait })))
}

export async function executeWorkflow({ call, uid, runUlid, callbacks = [], maxAdvances = 150, advanceTargets = [], callbackSubmissions = [] }) {
  const tokens = new Map(), remaining = [...callbacks]
  let signature, unchanged = 0
  while (true) {
    const snapshot = await collectWorkflowEvidence(call, runUlid, { includeEvents: false })
    if (terminal.has(snapshot.run.status)) {
      const execution = await collectWorkflowEvidence(call, runUlid)
      execution.callbackSubmissions = callbackSubmissions
      return { execution, advanceTargets }
    }
    let submitted = false
    for (const callback of [...remaining]) {
      const matches = matchingCallbackWaits(snapshot, callback)
      if (matches.length > 1) throw new Error('The callback contract matches more than one live workflow wait.')
      if (!matches.length) continue
      const { wait } = matches[0]
      if (!waitAuthorizesFixture(wait) || !wait.expectedOutcomesJson?.includes(callback.outcome)) throw new Error('The authored wait does not authorize the fixture callback.')
      const callbackToken = tokens.get(wait.waitUlid)
      if (!callbackToken) failure('The public advance response did not provide the callback token for this owned wait.')
      const request = { runUlid: wait.runUlid, waitUlid: wait.waitUlid, stepKey: wait.stepKey, outcome: callback.outcome, payload: callback.payload ?? {} }
      const response = dataOf(await call('pm_workflow', { action: 'input', ...request, kind: 'callback', origin: 'orchestrator', callbackToken, clientRequestId: await uid() }))
      const input = response?.input
      if (input?.accepted !== true || input.runUlid !== wait.runUlid || input.waitUlid !== wait.waitUlid || input.stepKey !== wait.stepKey || input.outcome !== callback.outcome || typeof input.inputUlid !== 'string') {
        failure('The public callback response did not acknowledge the exact submitted input.')
      }
      callbackSubmissions.push({ ...request, inputUlid: input.inputUlid, accepted: true })
      remaining.splice(remaining.indexOf(callback), 1)
      tokens.delete(wait.waitUlid)
      submitted = true
    }
    if (submitted) continue
    if (advanceTargets.length >= maxAdvances) throw new Error(`Workflow exceeded ${maxAdvances} advances.`)
    const runs = flattenExecution(snapshot)
    const target = [...runs].reverse().find(run => !terminal.has(run.run.status))
    if (target.run.status === 'waiting' && target.waits.some(wait => wait.kind === 'workflow_input' && wait.status === 'waiting')) {
      throw new Error('Workflow is waiting without a matching fixture callback.')
    }
    const current = JSON.stringify(runs.map(run => ({ run: run.run.runUlid, status: run.run.status, steps: run.steps })))
    unchanged = signature === current ? unchanged + 1 : 0
    signature = current
    if (unchanged >= 3) throw new Error('Workflow made no progress after three transitions.')
    advanceTargets.push(target.run.runUlid)
    const result = dataOf(await call('pm_workflow', { action: 'advance', runUlid: target.run.runUlid, clientRequestId: await uid() }))
    if (typeof result?.callbackToken === 'string' && typeof result.wait?.waitUlid === 'string') {
      registerEvidenceSecrets([result.callbackToken])
      tokens.set(result.wait.waitUlid, result.callbackToken)
    }
  }
}
