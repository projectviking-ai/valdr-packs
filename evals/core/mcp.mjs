import { spawn } from 'node:child_process'
import http from 'node:http'
import crypto from 'node:crypto'
import { redactEvidence, registerEvidenceSecrets } from './evidence.mjs'
import { EvaluationInfrastructureError, EvaluationCancelledError } from './lifecycle.mjs'

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

// MCP stdio uses one JSON-RPC message per line.
export async function createMcpSession({ command, args = [], cwd, env, timeoutMs = 30_000, signal }) {
  const grouped = process.platform !== 'win32'
  const child = spawn(command, args, { cwd, env, detached: grouped, stdio: ['pipe', 'pipe', 'pipe'] })
  const pending = new Map()
  let sequence = 0, buffer = '', exited = false, streamsClosed = false, failure, closePromise
  const fail = error => {
    error = error?.code === 'VALDR_EVAL_INFRASTRUCTURE' ? error : new EvaluationInfrastructureError(error.message, { cause: error })
    failure = error
    for (const item of pending.values()) { item.finish(); item.reject(error) }
    pending.clear()
  }
  child.on('error', error => { if (!child.pid) { exited = true; streamsClosed = true } fail(error) })
  child.on('exit', () => { exited = true })
  child.on('close', (code, signal) => {
    exited = true; streamsClosed = true
    fail(new Error(`Valdr MCP closed (${code ?? signal}). Check the installed valdr CLI setup and MCP availability.`))
  })
  child.stdin.on('error', fail)
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', () => {})
  const send = value => { if (!child.stdin.destroyed && !child.stdin.writableEnded) child.stdin.write(`${JSON.stringify(value)}\n`) }
  child.stdout.on('data', chunk => {
    buffer += chunk
    if (Buffer.byteLength(buffer) > 32 * 1024 * 1024) { fail(new Error('MCP response exceeds the 32 MiB budget')); child.kill(); return }
    let boundary
    while ((boundary = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1)
      if (!line.trim()) continue
      let message
      try { message = JSON.parse(line) } catch { fail(new Error('Valdr emitted invalid MCP JSON on stdout')); child.kill(); return }
      if (message.method) {
        if (message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Benchmark client does not support server-initiated requests' } })
        continue
      }
      const item = pending.get(message.id)
      if (!item) continue
      pending.delete(message.id); item.finish()
      if (message.error) item.reject(Object.assign(new EvaluationInfrastructureError(message.error.message), { rpcCode: message.error.code }))
      else item.resolve(message.result)
    }
  })
  const request = (method, params = {}, options = {}) => new Promise((resolve, reject) => {
    if (failure) { reject(failure); return }
    const requestSignal = options.signal === null ? undefined : options.signal ?? signal
    if (requestSignal?.aborted) { reject(requestSignal.reason ?? new EvaluationCancelledError()); return }
    const id = ++sequence
    const finish = () => { clearTimeout(timer); requestSignal?.removeEventListener('abort', abort) }
    const abort = () => {
      pending.delete(id); finish()
      send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: id, reason: 'Evaluation cancelled' } })
      reject(requestSignal.reason ?? new EvaluationCancelledError())
    }
    const timer = setTimeout(() => {
      pending.delete(id); finish()
      send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: id, reason: 'Benchmark request timed out' } })
      reject(new EvaluationInfrastructureError(`MCP ${method} timed out`))
    }, options.timeoutMs ?? timeoutMs)
    pending.set(id, { resolve, reject, finish })
    requestSignal?.addEventListener('abort', abort, { once: true })
    send({ jsonrpc: '2.0', id, method, params })
  })
  const groupExists = () => {
    if (!child.pid) return false
    try { process.kill(grouped ? -child.pid : child.pid, 0); return true }
    catch (error) { if (error.code === 'ESRCH') return false; throw error }
  }
  const stop = signal => {
    if (!child.pid) return
    try { if (grouped) process.kill(-child.pid, signal); else if (!exited) child.kill(signal) }
    catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  const close = () => closePromise ??= (async () => {
    child.stdin.end()
    for (let i = 0; i < 10 && !streamsClosed; i++) await pause(50)
    if (groupExists()) stop('SIGTERM')
    for (let i = 0; i < 10 && groupExists(); i++) await pause(50)
    if (groupExists()) stop('SIGKILL')
    for (let i = 0; i < 40 && !streamsClosed; i++) await pause(50)
    if (!streamsClosed) throw new Error('Owned Valdr MCP process did not close its streams')
  })()
  try {
    const initializeResult = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'valdr-agent-eval', version: '1.0.0' } })
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    return { request, initializeResult, pid: child.pid, callTool: (name, args, options) => request('tools/call', { name, arguments: args }, options),
      close, get closed() { return streamsClosed } }
  } catch (error) { try { await close() } catch (cleanupError) { error.cleanupError = cleanupError.message } throw error }
}

export async function createAuthorBroker(session, { requestAllowed = () => false } = {}) {
  const requests = []
  let lifecycleOrder = 0
  const token = crypto.randomBytes(32).toString('hex')
  registerEvidenceSecrets([token])
  const expectedAuthorization = Buffer.from(`Bearer ${token}`)
  const authorized = value => {
    const supplied = Buffer.from(typeof value === 'string' ? value : '')
    return supplied.length === expectedAuthorization.length && crypto.timingSafeEqual(supplied, expectedAuthorization)
  }
  const server = http.createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json')
    if (request.method !== 'POST' || request.url !== '/rpc' || !authorized(request.headers.authorization)) { response.writeHead(403); response.end('{}'); return }
    request.setEncoding('utf8')
    let text = ''
    try {
      for await (const chunk of request) {
        text += chunk
        if (Buffer.byteLength(text) > 16 * 1024 * 1024) throw new Error('Author request exceeds the 16 MiB budget')
      }
      const { method, params = {} } = JSON.parse(text)
      const entry = { sequence: requests.length + 1, startedOrder: ++lifecycleOrder, method, params: redactEvidence(params), allowed: false, completed: false }
      requests.push(entry)
      let result
      try {
        entry.allowed = requestAllowed(method, params) === true
        if (!entry.allowed) result = { isError: true, content: [{ type: 'text', text: `Evaluation client refused ${params.name ?? method}/${params.arguments?.action ?? ''}; the suite policy does not permit this request.` }] }
        else if (method === 'initialize') result = session.initializeResult
        else result = await session.request(method, params, { timeoutMs: 60_000 })
        entry.isError = result?.isError === true
        response.end(JSON.stringify({ result }))
      } catch (error) { entry.error = redactEvidence(error.message); entry.errorCode = error.code; throw error }
      finally { entry.completedOrder = ++lifecycleOrder; entry.completed = true }
    } catch (error) { response.end(JSON.stringify({ error: { code: Number.isInteger(error.code) ? error.code : -32603, message: redactEvidence(error.message) } })) }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return { requests, url: `http://127.0.0.1:${server.address().port}/rpc`, token,
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }) }
}
