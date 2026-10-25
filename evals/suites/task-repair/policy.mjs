import { isDeepStrictEqual } from 'node:util'
import { semanticMetadata } from './state.mjs'
import { argumentsOf } from '../../core/arguments.mjs'
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)

export function policy(context) {
  return (method, params) => {
    if (['initialize', 'tools/list', 'resources/list', 'resources/templates/list', 'ping'].includes(method)) return true
    if (method !== 'tools/call') return false
    if (['pm_health', 'pm_generate_ulid'].includes(params?.name)) return true
    const args = argumentsOf(params?.arguments)
    if (!args) return false
    if (['pm_agent', 'pm_capability', 'pm_prompt'].includes(params.name)) {
      return ['help', 'get', 'list', 'get_prompt', 'prompt', 'list_with_content'].includes(args.action)
    }
    if (params.name !== 'pm_task') return false
    if (args.action === 'help') return true
    if (!context || args.taskKey !== context.taskKey) return false
    if (args.action === 'get') return Object.keys(args).every(key => ['action', 'taskKey'].includes(key))
    if (args.action !== 'update' || context.scenario.expectedOutcome !== 'repaired') return false
    if (!Object.keys(args).every(key => ['action', 'taskKey', 'description', 'metadata', 'actorHandle', 'clientRequestId'].includes(key))) return false
    const edits = context.scenario.edits ?? {}
    const labels = edits.labels ?? []
    if ('description' in args && ('description' in edits
      ? typeof args.description !== 'string' || !args.description.trim()
      : args.description !== context.initialTask.descriptionMd)) return false
    if (!(('description' in args && 'description' in edits) || ('metadata' in args && labels.length > 0))) return false
    if (!('metadata' in args)) return true
    if (!record(args.metadata)) return false
    try {
      const actual = semanticMetadata(args.metadata)
      const expected = semanticMetadata(context.initialTask.metadata)
      for (const edit of labels) {
        const item = actual.checklists?.[edit.checklist]?.items?.[edit.item]
        if (typeof item?.label !== 'string' || !item.label.trim()) return false
        item.label = expected.checklists[edit.checklist].items[edit.item].label
      }
      return isDeepStrictEqual(actual, expected)
    } catch { return false }
  }
}

