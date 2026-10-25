const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const own = (value, key) => value !== null && typeof value === 'object' && Object.hasOwn(value, key)
const unsafeText = value => /['\u0000-\u001f\u007f]/u.test(value) || value.includes('${')
const safeSegment = value => typeof value === 'string' && /^(?:[A-Za-z_][A-Za-z0-9_-]*|\d+)$/.test(value)
  && !/[\r\n]/u.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value)
const inputPath = value => {
  if (!value.startsWith('workflow.inputs.')) return null
  const segments = value.slice('workflow.inputs.'.length).split('.')
  return segments.every(safeSegment) ? segments : null
}
const exactReference = value => {
  if (typeof value !== 'string') return undefined
  const match = /^\$\{([^{}]+)\}$/.exec(value)
  return match?.[0] === value ? match[1] : undefined
}
const identity = workflow => `${workflow.key}@${workflow.version}`

function commandReferences(command) {
  if (typeof command !== 'string') return null
  const match = /^printf '%s' '([^']*)'$/.exec(command)
  if (!match || match[0] !== command || /[\u0000-\u001f\u007f]/u.test(match[1])) return null
  const references = []
  const rest = match[1].replace(/\$\{([^{}]+)\}/g, (_, reference) => {
    references.push(reference)
    return ''
  })
  if (rest.includes('${') || references.some(reference => reference !== 'runtime.loop.currentPass' && !inputPath(reference))) return null
  return references
}

export function isSafePrintf(command, { allowExpressions = false } = {}) {
  const references = commandReferences(command)
  return references !== null && (allowExpressions || references.length === 0)
}

function safeValue(value) {
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return !unsafeText(value)
  if (Array.isArray(value)) return value.every(safeValue)
  return record(value) && Object.entries(value).every(([key, item]) => !unsafeText(key) && safeValue(item))
}

/** Certify only data origins consumed by the bounded printf language; never predict routes or outcomes. */
export function inspectCommandSafety(bundle, scenario = { variants: [] }) {
  const errors = []
  if (!record(bundle) || !Array.isArray(bundle.definitions)) return { safe: false, errors: ['Command certification requires a definition bundle.'] }
  const definitions = bundle.definitions.map(item => item?.workflow).filter(record)
  const workflows = new Map(definitions.map(workflow => [identity(workflow), workflow]))
  const incoming = new Map()
  const addError = message => errors.push(message)
  const fail = message => { throw new Error(message) }
  const staticName = value => typeof value === 'string' && !value.includes('${') && !/[\u0000-\u001f\u007f]/u.test(value)

  const checkKeys = (value, location = 'bundle') => {
    if (Array.isArray(value)) value.forEach((item, index) => checkKeys(item, `${location}[${index}]`))
    else if (record(value)) for (const [key, item] of Object.entries(value)) {
      if (!staticName(key)) addError(`${location}: dynamic or control-character object keys are forbidden.`)
      checkKeys(item, `${location}.${key}`)
    }
  }
  checkKeys(bundle)
  if (!staticName(bundle?.entryWorkflowKey)) addError('Entry workflow identity must be a literal string.')
  for (const workflow of definitions) {
    if (![workflow.key, workflow.version].every(staticName)) addError('Workflow identities must be literal strings.')
    for (const step of Array.isArray(workflow.steps) ? workflow.steps : []) {
      if (!record(step)) continue
      if (![step.key, step.kind].every(staticName)) addError(`${workflow.key}: step keys and kinds must be literal strings.`)
      if (step.kind === 'tool' && ![step.tool?.id, step.tool?.action].every(staticName)) addError(`${workflow.key}/${step.key}: tool targets must be literal strings.`)
      if (step.kind === 'subworkflow') {
        if (![step.workflow?.key, step.workflow?.version].every(staticName)) addError(`${workflow.key}/${step.key}: child identity must be literal strings.`)
        if (step.forEach && !safeSegment(step.forEach.itemName ?? '')) addError(`${workflow.key}/${step.key}: forEach itemName must be a simple literal input name.`)
        const target = identity(step.workflow ?? {})
        incoming.set(target, [...(incoming.get(target) ?? []), { workflow, step }])
      }
    }
  }

  const select = (value, segments) => {
    for (const segment of segments) {
      if (!safeSegment(segment) || !own(value, segment)) fail(`Missing safe input path ${segments.join('.')}.`)
      value = value[segment]
    }
    return value
  }
  const bounded = values => {
    if (values.length > 2000) fail('Command data-origin alternatives exceed the certification budget.')
    return values
  }
  const resolveBinding = (parent, binding, segments, visiting) => {
    const reference = exactReference(binding)
    if (reference) {
      const fromInput = inputPath(reference)
      if (fromInput) return inputValues(parent, [...fromInput, ...segments], visiting)
      if (reference === 'runtime.loop.currentPass' && segments.length === 0) return [1]
      fail(`Unsupported command data origin ${reference}; only direct workflow inputs and currentPass are permitted.`)
    }
    if (typeof binding === 'string' && binding.includes('${')) fail('Interpolated child bindings cannot feed command inputs.')
    if (segments.length) {
      if (!own(binding, segments[0])) fail(`Missing child binding path ${segments.join('.')}.`)
      return resolveBinding(parent, binding[segments[0]], segments.slice(1), visiting)
    }
    if (Array.isArray(binding) || record(binding)) {
      let alternatives = [Array.isArray(binding) ? [] : {}]
      for (const [key, item] of Object.entries(binding)) {
        if (unsafeText(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) fail('Unsafe child binding property name.')
        const values = resolveBinding(parent, item, [], visiting)
        alternatives = bounded(alternatives.flatMap(alternative => values.map(value => Object.assign(Array.isArray(binding) ? [...alternative] : { ...alternative }, { [key]: value }))))
      }
      return alternatives
    }
    return [binding]
  }
  const inputValues = (workflow, segments, visiting = new Set()) => {
    const marker = `${identity(workflow)}:${segments.join('.')}`
    if (visiting.has(marker) || visiting.size >= 100) fail(`Circular or excessive command data provenance at ${marker}.`)
    const next = new Set(visiting).add(marker)
    const [name, ...tail] = segments
    const descriptor = workflow.inputs?.[name]
    const fallback = () => {
      if (!own(descriptor, 'default')) fail(`No explicit input/default origin for ${marker}.`)
      if (!safeValue(descriptor.default)) fail(`Unsafe literal input default for ${marker}.`)
      return [select(descriptor.default, tail)]
    }
    const origins = []
    if (workflow.key === bundle.entryWorkflowKey) {
      if (!scenario.variants?.length) fail(`Command input ${marker} requires explicit scenario variants.`)
      for (const variant of scenario.variants) {
        origins.push(...(own(variant.inputs, name) ? [select(variant.inputs[name], tail)] : fallback()))
      }
    }
    const callers = incoming.get(identity(workflow)) ?? []
    if (workflow.key !== bundle.entryWorkflowKey && !callers.length) fail(`Command input ${marker} has no bundled caller.`)
    for (const { workflow: parent, step } of callers) {
      if (step.forEach?.itemName === name) {
        const reference = exactReference(step.forEach.items)
        const fromInput = reference && inputPath(reference)
        if (!fromInput) fail(`Fan-out command origin ${marker} must come directly from parent workflow inputs.`)
        for (const values of inputValues(parent, fromInput, next)) {
          if (!Array.isArray(values)) fail(`Fan-out command origin for ${marker} is not an array.`)
          for (const value of values) origins.push(select(value, tail))
        }
      } else if (own(step.inputs, name)) origins.push(...resolveBinding(parent, step.inputs[name], tail, next))
      else origins.push(...fallback())
    }
    return bounded(origins)
  }

  for (const workflow of workflows.values()) for (const step of Array.isArray(workflow.steps) ? workflow.steps : []) {
    if (step?.kind !== 'tool' || step.tool?.id !== 'command') continue
    const location = `${identity(workflow)}/${step.key}`
    const references = commandReferences(step.inputs?.command)
    if (references === null) { addError(`${location}: command must be a single printf with literal text, direct workflow inputs, or currentPass.`); continue }
    for (const reference of references) {
      if (reference === 'runtime.loop.currentPass') continue
      try {
        if (!inputValues(workflow, inputPath(reference)).every(safeValue)) fail('Consumed input contains an unsafe quote, control character, or interpolation marker.')
      } catch (error) { addError(`${location}: ${error.message}`) }
    }
  }
  return { safe: errors.length === 0, errors }
}
