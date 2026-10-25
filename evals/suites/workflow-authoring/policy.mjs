import { argumentsOf } from '../../core/arguments.mjs'
const authorActions = new Map([
  ['pm_workflow', ['help', 'list', 'get', 'validate', 'save_definition', 'list_runs', 'get_run', 'events']],
  ['pm_agent', ['help', 'get', 'list', 'get_prompt']],
  ['pm_capability', ['help', 'get', 'list', 'prompt']],
  ['pm_prompt', ['help', 'get', 'list', 'list_with_content']],
  ['pm_project', ['help', 'get', 'list']], ['pm_task', ['help', 'get', 'search']],
  ['pm_user_tool', ['help', 'search', 'describe']], ['pm_knowledge', ['help', 'get', 'search', 'code_map', 'status']],
])
export function authorRequestAllowed(method, params) {
  if (['initialize', 'tools/list', 'resources/list', 'resources/templates/list', 'ping'].includes(method)) return true
  if (method !== 'tools/call') return false
  if (['pm_health', 'pm_generate_ulid'].includes(params?.name)) return true
  const args = argumentsOf(params?.arguments)
  return Boolean(args && authorActions.get(params?.name)?.includes(args.action))
}
