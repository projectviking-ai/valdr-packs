import { isDeepStrictEqual } from 'node:util'
import { EvaluationInfrastructureError } from '../../core/lifecycle.mjs'
import { waitAuthorizesFixture } from './execution.mjs'

const at = (value, parts) => parts.reduce((item, key) => item?.[key], value)
const pathParts = value => /^[^.[\]]+(?:(?:\.[^.[\]]+)|(?:\[(?:0|[1-9]\d*)\]))*$/.test(value)
  ? value.replace(/\[(\d+)\]/g, '.$1').split('.') : []
const leaves = (value, prefix = []) => value && typeof value === 'object'
  ? Object.entries(value).flatMap(([key, item]) => leaves(item, [...prefix, key])) : [{ parts: prefix, value }]

function evidenceGraph(execution) {
  const nodes = [], events = [], edges = new Map(), owner = new Map()
  const visit = node => { nodes.push(node); for (const child of node.children ?? []) visit(child) }
  visit(execution)
  for (const node of nodes) {
    const ordered = [...(node.events ?? [])].sort((a, b) => a.seq - b.seq)
    for (const event of ordered) { owner.set(event, node); edges.set(event, []); events.push(event) }
    for (let index = 1; index < ordered.length; index++) edges.get(ordered[index - 1]).push(ordered[index])
  }
  for (const parent of nodes) for (const child of parent.children ?? []) {
    const childEvents = [...(child.events ?? [])].sort((a, b) => a.seq - b.seq)
    const started = parent.events?.find(event => event.eventType === 'child_run_started' && event.childRunUlid === child.run.runUlid)
    const completed = parent.events?.find(event => event.eventType === 'child_run_completed' && event.childRunUlid === child.run.runUlid)
    if (started && childEvents.length) edges.get(started).push(childEvents[0])
    if (completed && childEvents.length) edges.get(childEvents.at(-1)).push(completed)
  }
  const before = (first, last) => {
    if (!first || !last || first === last) return false
    const seen = new Set(), pending = [...(edges.get(first) ?? [])]
    while (pending.length) {
      const event = pending.pop()
      if (event === last) return true
      if (!seen.has(event)) { seen.add(event); pending.push(...(edges.get(event) ?? [])) }
    }
    return false
  }
  const completion = (node, attempt) => node.events?.find(event => ['step_completed', 'workflow_blocked', 'workflow_failed'].includes(event.eventType) && event.stepRunUlid === attempt.stepRunUlid)
  const start = (node, attempt) => node.events?.find(event => event.eventType === 'step_started' && event.stepRunUlid === attempt.stepRunUlid) ?? completion(node, attempt)
  const loopPass = (node, attempt) => {
    if (!node || !attempt) return undefined
    if (attempt.inputJson?.loopContext?.currentPass !== undefined) return attempt.inputJson.loopContext.currentPass
    const resets = (node.events ?? []).filter(event => event.payloadJson?.loopTransition?.route === 'loop_back'
      && event.payloadJson.loopTransition.resetAttempts?.some(item => item.stepRunUlid === attempt.stepRunUlid)
      && before(event, start(node, attempt)))
    return resets.length === 1 ? resets[0].payloadJson.loopTransition.toPass : undefined
  }
  return { nodes, events, owner, before, completion, start, loopPass }
}

function outputTracer(execution, graph) {
  function traceRun(node, parts, seen = new Set()) {
    const actual = at(node.run.outputJson, parts)
    return mapped(node, null, node.definition?.workflow?.outputMappings, parts, actual, seen)
  }
  function previous(node, attempt) {
    const transition = node.events?.find(event => event.payloadJson?.loopTransition?.route === 'loop_back'
      && event.payloadJson.loopTransition.resetAttempts?.some(item => item.stepRunUlid === attempt?.stepRunUlid))
    const sourceId = attempt?.inputJson?.loopContext?.previousSourceStepRunUlid ?? transition?.stepRunUlid
    if (!sourceId || !transition || transition.stepRunUlid !== sourceId) return null
    return node.attempts?.find(item => item.stepRunUlid === sourceId)
  }
  function traceStep(node, attempt, parts, seen) {
    if (!attempt) return { value: undefined, sources: [] }
    const actual = at(attempt.outputJson, parts), id = `${node.run.runUlid}/${attempt.stepRunUlid}/${parts.join('.')}`
    if (seen.has(id)) return { value: actual, sources: [] }
    seen = new Set([...seen, id])
    const step = node.definition?.workflow?.steps?.find(item => item.key === attempt.stepKey)
    if (step?.kind === 'subworkflow' && step.outputs === undefined) {
      return childOutput(node, attempt, parts, actual, seen, [], attempt.outputJson)
    }
    return mapped(node, attempt, step?.outputs, parts, actual, seen)
  }
  function childOutput(node, attempt, parts, actual, seen, selectedParts, selectedValue) {
    const children = (node.children ?? []).filter(item => item.run.parentStepRunUlid === attempt.stepRunUlid)
    if (children.some(({ run }) => run.parentRunUlid !== undefined && run.parentRunUlid !== node.run.runUlid
      || run.parentStepKey !== undefined && run.parentStepKey !== attempt.stepKey)) return { value: actual, sources: [] }
    let child, outputParts, normalized
    if (parts[0] === 'child' && parts[1] === 'outputs' && children.length === 1) {
      child = children[0]; outputParts = parts.slice(2)
      normalized = { child: { runUlid: child.run.runUlid, status: child.run.status, outputs: child.run.outputJson } }
    } else if (parts[0] === 'children' && /^\d+$/.test(parts[1]) && parts[2] === 'outputs') {
      const ordered = [...children].sort((a, b) => a.run.itemIndex - b.run.itemIndex)
      if (!ordered.every(({ run }, index) => run.itemIndex === index)) return { value: actual, sources: [] }
      child = ordered[Number(parts[1])]; outputParts = parts.slice(3)
      normalized = { children: ordered.map(({ run }) => ({ index: run.itemIndex, item: run.itemJson,
        runUlid: run.runUlid, status: run.status, outputs: run.outputJson })) }
    }
    if (child && isDeepStrictEqual(at(normalized, selectedParts), selectedValue)) {
      const traced = traceRun(child, outputParts, seen)
      if (isDeepStrictEqual(traced.value, actual)) return { value: actual, sources: traced.sources }
    }
    return { value: actual, sources: [] }
  }
  function mapped(node, attempt, mapping, parts, actual, seen) {
    let rest = [...parts], selectedValue = attempt ? attempt.outputJson : node.run.outputJson
    while (mapping && typeof mapping === 'object' && rest.length) {
      const key = rest.shift(); mapping = mapping[key]; selectedValue = selectedValue?.[key]
    }
    let traced = { value: undefined, sources: [] }
    if (typeof mapping === 'string') {
      const reference = /^\$\{([^{}]+)\}$/.exec(mapping)
      if (reference) {
        const referencedParts = pathParts(reference[1])
        if (!rest.length || isDeepStrictEqual(selectedValue, expression(node, attempt, referencedParts, seen).value)) {
          traced = expression(node, attempt, [...referencedParts, ...rest], seen)
        }
      }
      else if (attempt && /^\$\.(?:normalized|raw)\./.test(mapping)) {
        const selectedParts = pathParts(mapping).slice(2), selector = [...selectedParts, ...rest]
        const event = graph.completion(node, attempt)
        if (selector.join('.') === 'stdout' && event?.payloadJson?.toolName === 'command' && event.payloadJson.action === 'run') {
          traced = { value: event.payloadJson.normalized?.stdout, sources: [{ kind: 'command', runUlid: node.run.runUlid, stepRunUlid: attempt.stepRunUlid }] }
        } else if (selector[0] === 'input') {
          const wait = node.waits?.find(item => item.stepRunUlid === attempt.stepRunUlid)
          const accepted = node.acceptedInputs?.filter(item => item.waitUlid === wait?.waitUlid && item.kind === 'callback') ?? []
          if (accepted.length === 1) {
            const source = { kind: 'callback', runUlid: node.run.runUlid, stepRunUlid: attempt.stepRunUlid, inputUlid: accepted[0].inputUlid }
            if (selector[1] === 'outcome' && selector.length === 2) traced = { value: accepted[0].outcome, sources: [source] }
            if (selector[1] === 'payload') {
              const submissions = (execution.callbackSubmissions ?? []).filter(item => item.accepted === true
                && item.inputUlid === accepted[0].inputUlid && item.waitUlid === wait.waitUlid && item.runUlid === node.run.runUlid)
              if (submissions.length === 1) traced = { value: at(submissions[0].payload, selector.slice(2)), sources: [source] }
            }
          }
        } else if (['child', 'children'].includes(selector[0])) {
          traced = childOutput(node, attempt, selector, actual, seen, selectedParts, selectedValue)
        } else if (event?.eventType === 'step_completed' && event.stepKey === attempt.stepKey
          && attempt.status === 'completed' && event.runUlid === node.run.runUlid && attempt.runUlid === node.run.runUlid
          && attempt.inputJson?.action === 'get' && event.payloadJson?.toolName === 'pm_task' && event.payloadJson.action === 'get') {
          const step = node.definition?.workflow?.steps?.find(item => item.key === attempt.stepKey)
          if (step?.kind === 'tool' && step.tool?.id === 'pm_task' && step.tool.action === 'get') traced = {
            value: at(event.payloadJson.normalized, selector),
            sources: [{ kind: 'task', runUlid: node.run.runUlid, stepRunUlid: attempt.stepRunUlid,
              requestedTaskKey: attempt.inputJson.taskKey, path: selector.join('.') }],
          }
        }
      }
    }
    return { value: actual, sources: isDeepStrictEqual(actual, traced.value) ? traced.sources : [] }
  }
  function expression(node, attempt, parts, seen = new Set()) {
    if (parts[0] === 'workflow' && parts[1] === 'inputs') return { value: at(node.run.inputJson, parts.slice(2)), sources: [] }
    if (parts[0] === 'steps' && parts[2] === 'outputs') {
      const boundary = attempt ? graph.start(node, attempt)?.seq ?? -1 : Infinity
      const prior = (node.attempts ?? []).filter(item => item.stepKey === parts[1] && graph.completion(node, item)?.seq < boundary)
        .sort((a, b) => graph.completion(node, b).seq - graph.completion(node, a).seq)[0]
      return traceStep(node, prior, parts.slice(3), seen)
    }
    if (parts.slice(0, 3).join('.') === 'runtime.loop.previous') {
      const source = previous(node, attempt)
      if (parts.length === 3) return { value: source ? { sourceStepRunUlid: source.stepRunUlid, outputs: source.outputJson } : null, sources: [] }
      if (parts[3] === 'outputs') {
        const traced = traceStep(node, source, parts.slice(4), seen)
        return { ...traced, sources: traced.sources.map(item => ({ ...item, previous: true })) }
      }
    }
    return { value: undefined, sources: [] }
  }
  function value(node, attempt, input) {
    if (Array.isArray(input)) return input.map(item => value(node, attempt, item))
    if (typeof input !== 'string') return input
    const exact = /^\$\{([^{}]+)\}$/.exec(input)
    if (exact) return expression(node, attempt, pathParts(exact[1])).value
    let resolved = true
    const text = input.replace(/\$\{([^{}]+)\}/g, (_, reference) => {
      const result = expression(node, attempt, pathParts(reference)).value
      if (!['string', 'number', 'boolean'].includes(typeof result)) resolved = false
      return String(result)
    })
    return resolved ? text : undefined
  }
  return { run: traceRun, step: traceStep, expression, value }
}

export function traceOutputSources(execution, field) {
  return outputTracer(execution, evidenceGraph(execution)).run(execution, pathParts(field))
}

export function traceStepOutputSources(execution, stepKey, field) {
  const step = execution.steps?.find(item => item.stepKey === stepKey)
  const attempt = step && execution.attempts?.find(item => item.stepRunUlid === step.stepRunUlid && item.stepKey === stepKey)
  const parts = pathParts(field), value = at(step?.outputJson, parts)
  const traced = outputTracer(execution, evidenceGraph(execution)).step(execution, attempt, parts, new Set())
  return { value, sources: isDeepStrictEqual(value, traced.value) ? traced.sources : [] }
}

export function scoreBusinessVariant({ scenario, variant, execution }) {
  if (!['release', 'review', 'approval'].includes(scenario.businessOracle)) throw new EvaluationInfrastructureError('Unknown business execution oracle.')
  const assertions = [], graph = evidenceGraph(execution), tracer = outputTracer(execution, graph)
  const check = (message, actual, expected) => assertions.push({ message, actual, expected, pass: isDeepStrictEqual(actual, expected) })
  const commands = graph.events.filter(event => event.eventType === 'step_completed' && event.payloadJson?.toolName === 'command' && event.payloadJson.action === 'run')
    .map(event => ({ event, node: graph.owner.get(event), stdout: event.payloadJson.normalized?.stdout }))
  for (const command of commands) {
    command.attempt = command.node.attempts?.find(item => item.stepRunUlid === command.event.stepRunUlid)
    command.start = command.attempt && graph.start(command.node, command.attempt)
  }
  const attempted = graph.nodes.flatMap(node => (node.attempts ?? []).filter(attempt => {
    const step = node.definition?.workflow?.steps?.find(item => item.key === attempt.stepKey)
    return step?.tool?.id === 'command' && step.tool.action === 'run' && !['pending', 'ready', 'skipped'].includes(attempt.status)
  }))
  check('terminal status', execution.run?.status, variant.expectedStatus)
  check('every attempted command has one durable completion receipt', commands.length === attempted.length
    && new Set(commands.map(item => item.event.stepRunUlid)).size === attempted.length
    && commands.every(item => item.attempt?.status === 'completed'), true)
  check('command receipt evidence is successful and untruncated', commands.every(({ event, start }) => start && start !== event
    && graph.before(start, event) && event.payloadJson.normalized?.ok === true && event.payloadJson.normalized.exitCode === 0
    && event.payloadJson.normalized.stdoutTruncated === false && typeof event.payloadJson.normalized.stdout === 'string'), true)
  const { requestId } = variant.inputs
  let expected = []
  if (scenario.businessOracle === 'release' && ['publish', 'archive'].includes(variant.inputs.route)) {
    expected = [`${variant.inputs.route}:${requestId}`, ...(variant.inputs.audit ? [`audit:${requestId}`] : [])]
  } else if (scenario.businessOracle === 'review') {
    const passes = variant.inputs.readyPass === 'never' ? 3 : Number(variant.inputs.readyPass)
    for (let pass = 1; pass <= passes; pass++) {
      expected.push(`review:${pass}`)
      if (pass < passes) expected.push(`remediate:${requestId}:${pass}`)
    }
    if (variant.inputs.readyPass !== 'never') expected.push(`publish:${requestId}`)
  } else if (scenario.businessOracle === 'approval') {
    const callback = variant.callbacks[0]
    const matches = callback.payload.requestId === requestId && callback.payload.seal === variant.inputs.seal
    expected = [`request:${requestId}`, ...(matches ? [`${callback.outcome === 'approved' ? 'publish' : 'archive'}:${requestId}`, `audit:${requestId}`] : [])]
  }
  check('operation ledger has exact markers and multiplicity', commands.map(item => item.stdout).sort(), [...expected].sort())
  const ordered = expected.map(marker => commands.find(item => item.stdout === marker))
  check('business operations have proven completion-before-start order', ordered.every((item, index) => item && (index === 0 || graph.before(ordered[index - 1]?.event, item.start))), true)
  if (variant.expectedStatus === 'completed') {
    check('returned requestId', execution.run.outputJson?.requestId, requestId)
    if (scenario.businessOracle === 'release') check('returned route', execution.run.outputJson?.route, variant.inputs.route)
    if (scenario.businessOracle === 'review') check('returned readyPass', execution.run.outputJson?.readyPass, variant.inputs.readyPass)
    if (scenario.businessOracle !== 'review') {
      const marker = scenario.businessOracle === 'release' ? expected[0] : `audit:${requestId}`
      const operation = commands.find(item => item.stdout === marker)
      const traced = tracer.run(execution, ['receipt'])
      check('returned receipt', traced.value, marker)
      check('returned receipt has actual operation origin', Boolean(operation && traced.sources.some(source => source.kind === 'command'
        && source.runUlid === operation.node.run.runUlid && source.stepRunUlid === operation.event.stepRunUlid)), true)
    }
  }
  if (scenario.businessOracle === 'review') {
    const reviews = expected.filter(marker => marker.startsWith('review:')).map(marker => commands.find(item => item.stdout === marker))
    reviews.forEach((review, index) => {
      const next = reviews[index + 1]
      const decisions = review ? graph.nodes.flatMap(node => (node.attempts ?? []).map(attempt => ({ node, attempt }))).filter(({ node, attempt }) => {
        const finish = graph.completion(node, attempt)
        return finish && graph.before(review.event, finish) && (!next || graph.before(finish, next.start))
      }) : []
      const readReceipt = decisions.some(({ node, attempt }) => {
        const step = node.definition.workflow.steps.find(item => item.key === attempt.stepKey)
        const isReceipt = value => typeof value === 'string' && tracer.value(node, attempt, value) === review.stdout
          && [...value.matchAll(/\$\{([^{}]+)\}/g)].some(match => tracer.expression(node, attempt, pathParts(match[1])).sources
            .some(source => source.kind === 'command' && source.stepRunUlid === review.event.stepRunUlid && source.runUlid === review.node.run.runUlid))
        const target = `review:${variant.inputs.readyPass}`
        return step?.kind === 'condition' && (step.checks ?? []).some(condition =>
          condition.kind === 'value_equals' && (isReceipt(condition.value) && tracer.value(node, attempt, condition.equals) === target
            || isReceipt(condition.equals) && tracer.value(node, attempt, condition.value) === target)
          || condition.kind === 'value_in' && isReceipt(condition.value) && isDeepStrictEqual(tracer.value(node, attempt, condition.allowed), [target]))
      })
      check(`review ${index + 1} decision reads its actual receipt`, readReceipt, true)
      let passNode = review?.node, passAttempt = review?.attempt
      let runtimePass = graph.loopPass(passNode, passAttempt)
      while (runtimePass === undefined && passNode?.run.parentStepRunUlid) {
        const parent = graph.nodes.find(node => node.children?.includes(passNode))
        passAttempt = parent?.attempts?.find(attempt => attempt.stepRunUlid === passNode.run.parentStepRunUlid)
        passNode = parent
        runtimePass = graph.loopPass(passNode, passAttempt)
      }
      check(`review ${index + 1} uses the actual runtime pass`, runtimePass ?? 1, index + 1)
      if (index > 0) {
        const prior = reviews[index - 1]
        const nextOperation = ordered[expected.indexOf(`review:${index + 1}`) + 1]
        const candidates = review && prior ? graph.nodes.flatMap(node => (node.attempts ?? []).map(attempt => ({ node, attempt })))
          .filter(({ node, attempt }) => {
            const finish = graph.completion(node, attempt)
            return finish && graph.before(prior.event, finish) && (!nextOperation || graph.before(finish, nextOperation.start))
          }) : []
        const retained = candidates.some(({ node, attempt }) => leaves(attempt.outputJson).some(leaf => leaf.value === prior.stdout
          && tracer.step(node, attempt, leaf.parts, new Set()).sources.some(source => source.kind === 'command' && source.previous
            && source.stepRunUlid === prior.event.stepRunUlid && source.runUlid === prior.node.run.runUlid)))
        check(`review ${index + 1} retains immediately previous receipt history`, retained, true)
      }
    })
    if (variant.inputs.readyPass === 'never') check('review budget exhaustion is durable', graph.events.some(event => {
      const transition = event.payloadJson?.loopTransition
      return transition?.route === 'exhausted' && transition.fromPass === 3 && transition.maxPasses === 3
    }), true)
  }
  if (scenario.businessOracle === 'approval') {
    const waits = graph.nodes.flatMap(node => (node.waits ?? []).filter(wait => wait.kind === 'workflow_input'
      && isDeepStrictEqual([...(wait.expectedOutcomesJson ?? [])].sort(), ['approved', 'rejected'])).map(wait => ({ node, wait })))
    check('unique external disposition wait', waits.length, 1)
    const selected = waits[0], wait = selected?.wait, node = selected?.node
    check('external wait authorizes the fixture actor', waitAuthorizesFixture(wait), true)
    const accepted = graph.nodes.flatMap(item => item.acceptedInputs ?? []).filter(item => item.kind === 'callback')
    const submissions = (execution.callbackSubmissions ?? []).filter(item => item.accepted === true)
    const callback = variant.callbacks[0], input = accepted[0], submitted = submissions[0]
    check('one accepted callback matches the acknowledged input', accepted.length === 1 && submissions.length === 1
      && input.inputUlid === submitted.inputUlid && input.waitUlid === wait?.waitUlid
      && input.runUlid === node?.run.runUlid && submitted.runUlid === input.runUlid
      && submitted.waitUlid === input.waitUlid && input.outcome === callback.outcome && submitted.outcome === callback.outcome, true)
    check('acknowledged callback payload matches the supplied variant', submitted?.payload, callback.payload)
    const start = node?.events?.find(event => event.eventType === 'wait_started' && event.waitUlid === wait?.waitUlid)
    const received = node?.events?.find(event => event.eventType === 'callback_received' && event.waitUlid === wait?.waitUlid && event.inputUlid === input?.inputUlid)
    const resolved = node?.events?.find(event => event.eventType === 'wait_resolved' && event.waitUlid === wait?.waitUlid && event.inputUlid === input?.inputUlid)
    check('announcement completed before the external wait', graph.before(ordered[0]?.event, start), true)
    check('callback accepted after waiting and before all disposition effects', graph.before(start, received) && graph.before(received, resolved)
      && ordered.slice(1).every(operation => graph.before(resolved, operation?.start)), true)
    if (variant.expectedStatus === 'completed') {
      const decision = tracer.run(execution, ['decision'])
      check('returned decision', decision.value, callback.outcome)
      check('returned decision has accepted callback origin', decision.sources.some(source => source.kind === 'callback' && source.inputUlid === input?.inputUlid), true)
    }
  }
  return assertions
}
