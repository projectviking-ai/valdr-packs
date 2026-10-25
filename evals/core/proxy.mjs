import readline from 'node:readline'

const endpoint = process.env.VALDR_EVAL_PROXY_URL
const token = process.env.VALDR_EVAL_PROXY_TOKEN
if (!endpoint || !token || new URL(endpoint).hostname !== '127.0.0.1') throw new Error('An owned local benchmark broker is required')
const lines = readline.createInterface({ input: process.stdin })
const active = new Set()
let closing = false
const close = () => { closing = true; for (const controller of active) controller.abort(); lines.close() }
lines.on('close', close)
process.once('SIGTERM', close)
process.once('SIGINT', close)
lines.on('line', async line => {
  let request
  const controller = new AbortController()
  active.add(controller)
  try {
    request = JSON.parse(line)
    if (request.id === undefined) return
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method: request.method, params: request.params }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]) })
    if (!response.ok) throw new Error(`Benchmark broker refused request (${response.status})`)
    const reply = await response.json()
    if (!closing) process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, ...reply })}\n`)
  } catch (error) {
    if (!closing && request?.id !== undefined) process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32603, message: error.message } })}\n`)
  } finally { active.delete(controller) }
})
