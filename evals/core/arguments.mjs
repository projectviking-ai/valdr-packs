const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
export function argumentsOf(args) {
  if (!record(args) || typeof args.action !== 'string') return null
  if (!('params' in args)) return args
  if (!record(args.params) || Object.keys(args).some(key => !['action', 'params'].includes(key))) return null
  if ('action' in args.params && args.params.action !== args.action) return null
  return { ...args.params, action: args.action }
}

