import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { getCodexBinaryInfo } from './binary.mjs'
import { EvaluationInfrastructureError } from './lifecycle.mjs'
import { redactEvidence, registerEvidenceSecrets, writeEvidence } from './evidence.mjs'

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const proxy = fileURLToPath(new URL('./proxy.mjs', import.meta.url))
const quoted = value => JSON.stringify(value)

function disabledSkills(directory, visited = new Set()) {
  if (!fs.existsSync(directory)) return []
  const real = fs.realpathSync(directory)
  if (visited.has(real)) return []
  visited.add(real)
  if (fs.existsSync(path.join(directory, 'SKILL.md'))) return [path.join(directory, 'SKILL.md')]
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    (entry.isDirectory() || entry.isSymbolicLink()) ? disabledSkills(path.join(directory, entry.name), visited) : [])
}

// The public Codex exec JSONL protocol has exactly one turn per invocation.
// Repairs resume its exact persisted thread; authentication stays in Codex's own storage.
export async function runAgentTurn(environment, { agent, profile, prompt, timeoutMs, sessionUlid, outputDir, submissionFile, authorBinary }, { command = 'codex', commandArgs = [] } = {}) {
  environment.lifecycle?.throwIfCancelled()
  assert.ok(environment.broker?.url && environment.broker?.token, 'An owned author broker is required')
  assert.ok(agent.expectedSystemPrompt?.trim(), 'The registered agent system prompt is required')
  assert.equal(profile.providerType, 'codex', 'The author launcher requires a Codex profile')
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, 'A positive author timeout is required')
  const providerBinary = command === 'codex' ? getCodexBinaryInfo(authorBinary?.path) : authorBinary
  if (authorBinary) assert.deepEqual(providerBinary, authorBinary, 'Codex executable changed after the run charter was recorded')
  const invocationId = crypto.randomUUID()
  const scratch = fs.mkdtempSync(path.join(environment.root, 'author-'))
  const instructionsFile = path.join(scratch, 'instructions.md')
  const finalFile = path.join(scratch, 'final.txt')
  fs.writeFileSync(instructionsFile, agent.expectedSystemPrompt, { mode: 0o600 })
  fs.mkdirSync(outputDir, { recursive: true })
  const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'SYSTEMROOT', 'WINDIR', 'CODEX_HOME', 'CODEX_API_KEY', 'OPENAI_API_KEY']
    .filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]]))
  env.HOME ??= os.homedir()
  env.TMPDIR = scratch
  env.VALDR_EVAL_PROXY_URL = environment.broker.url
  env.VALDR_EVAL_PROXY_TOKEN = environment.broker.token
  registerEvidenceSecrets([environment.broker.token, env.CODEX_API_KEY, env.OPENAI_API_KEY])
  const skillPaths = [...new Set([path.join(env.CODEX_HOME ?? path.join(env.HOME, '.codex'), 'skills'), path.join(env.HOME, '.agents', 'skills'), path.join(environment.repoRoot, '.agents', 'skills')].flatMap(directory => disabledSkills(directory)))]
  const settings = {
    model: quoted(profile.model), model_reasoning_effort: quoted(profile.reasoningEffort),
    model_instructions_file: quoted(instructionsFile), approval_policy: '"never"',
    sandbox_mode: quoted(submissionFile ? 'workspace-write' : 'read-only'),
    'features.shell_tool': 'false', 'features.hooks': 'false', 'features.multi_agent': 'false',
    'features.goals': 'false', 'features.apps': 'false', 'features.view_image': 'false', 'features.remote_plugin': 'false', 'features.memories': 'false', 'features.shell_snapshot': 'false',
    'agents.enabled': 'false', 'apps._default.enabled': 'false',
    web_search: '"disabled"', project_doc_max_bytes: '0',
    'skills.config': `[${skillPaths.map(folder => `{path=${quoted(folder)},enabled=false}`).join(',')}]`,
    mcp_servers: `{ valdr = { command = ${quoted(process.execPath)}, args = [${quoted(proxy)}], env_vars = ["VALDR_EVAL_PROXY_URL", "VALDR_EVAL_PROXY_TOKEN"], required = true, default_tools_approval_mode = "approve", startup_timeout_sec = 30, tool_timeout_sec = 70 } }`,
  }
  const args = [...commandArgs, '--no-daemon', 'exec', ...(sessionUlid ? ['resume', sessionUlid] : ['--cd', environment.repoRoot]),
    '--ignore-user-config', '--ignore-rules', '--strict-config', '--json', '--output-last-message', finalFile,
    ...Object.entries(settings).flatMap(([key, value]) => ['-c', `${key}=${value}`]), '-']
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()
  writeEvidence(path.join(outputDir, 'provider-launch.json'), { authorBinary: providerBinary, startedAt, provider: 'codex', interface: 'codex exec', invocationId,
    resumedThreadId: sessionUlid ?? null, model: profile.model, reasoningEffort: profile.reasoningEffort,
    agentHandle: agent.handle, systemPromptSha256: crypto.createHash('sha256').update(agent.expectedSystemPrompt).digest('hex'),
    cwd: environment.repoRoot, sandbox: submissionFile ? 'workspace-write' : 'read-only',
    mcpServers: ['valdr'], shellTools: false, webSearch: false, userConfiguration: false, transcriptPersistence: 'provider-managed' })
  const grouped = process.platform !== 'win32'
  const child = spawn(command === 'codex' ? providerBinary.path : command, args, { cwd: environment.repoRoot, env, detached: grouped, stdio: ['pipe', 'pipe', 'pipe'] })
  let buffer = '', stderr = '', closed = false, exitCode, exitSignal, failure, cleanupPromise
  let threadId, started = false, completed = false, finalMessage, usage
  const events = []
  const exists = () => {
    if (!child.pid) return false
    try { process.kill(grouped ? -child.pid : child.pid, 0); return true }
    catch (error) { if (error.code === 'ESRCH') return false; throw error }
  }
  const stop = signal => {
    if (!child.pid) return
    try { process.kill(grouped ? -child.pid : child.pid, signal) }
    catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  const cleanup = () => cleanupPromise ??= (async () => {
    if (exists()) stop('SIGTERM')
    for (let i = 0; i < 20 && exists(); i++) await pause(25)
    if (exists()) stop('SIGKILL')
    for (let i = 0; i < 80 && (!closed || exists()); i++) await pause(25)
    const receipt = { pid: child.pid ?? null, processClosed: closed, processGroupStopped: !exists(), ok: closed && !exists() }
    writeEvidence(path.join(outputDir, 'provider-cleanup.json'), receipt)
    if (!receipt.ok) throw new EvaluationInfrastructureError('Owned author process cleanup was not verified')
    return receipt
  })()
  const fail = error => { failure ??= error; void cleanup().catch(() => {}) }
  const onEvent = event => {
    events.push(redactEvidence(event))
    if (event.type === 'thread.started') {
      if (threadId || typeof event.thread_id !== 'string' || (sessionUlid && event.thread_id !== sessionUlid)) throw new Error('Author thread identity did not match this invocation')
      threadId = event.thread_id
    } else if (event.type === 'turn.started') {
      if (!threadId || started) throw new Error('Author emitted an ambiguous turn completion sequence')
      started = true
    } else if (event.type === 'turn.completed') {
      if (!started || completed) throw new Error('Author emitted an ambiguous turn completion sequence')
      completed = true; usage = event.usage
    } else if (event.type === 'turn.failed') throw new Error(`Author turn failed: ${event.error?.message ?? 'provider failure'}`)
    if (event.type?.startsWith('item.')) {
      if (!started || completed) throw new Error('Author item occurred outside the requested turn')
      const item = event.item
      // Codex labels native discovery as "codex"; this invocation configures only the Valdr broker.
      const scopedDiscovery = item?.server === 'codex'
        && ['list_mcp_resources', 'list_mcp_resource_templates'].includes(item.tool)
        && item.arguments !== null && typeof item.arguments === 'object' && !Array.isArray(item.arguments)
        && Object.entries(item.arguments).every(([key, value]) =>
          key === 'server' ? value === 'valdr' : key === 'cursor' && typeof value === 'string')
      if (['command_execution', 'web_search'].includes(item?.type)
        || (item?.type === 'mcp_tool_call' && item.server !== 'valdr' && !scopedDiscovery)
        || (item?.type === 'file_change' && !submissionFile)) throw new Error(`Author violated the exclusive tool scope (${item?.type}, ${item?.server ?? ''}, ${item?.tool ?? ''})`)
      if (event.type === 'item.completed' && item?.type === 'mcp_tool_call' && item.error) throw new Error(`Author MCP transport or approval failed: ${item.error.message ?? 'unknown failure'}`)
      if (event.type === 'item.completed' && item?.type === 'agent_message') finalMessage = item.text
    }
  }
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    if (Buffer.byteLength(buffer) + JSON.stringify(events).length > 32 * 1024 * 1024) { fail(new Error('Author output exceeds the 32 MiB evidence budget')); return }
    let boundary
    while ((boundary = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 1)
      if (!line.trim()) continue
      try { onEvent(JSON.parse(line)) } catch (error) { fail(error) }
    }
  })
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1024 * 1024) })
  child.stdin.on('error', fail)
  child.on('error', error => { if (!child.pid) closed = true; fail(error) })
  const finished = new Promise(resolve => child.on('close', (code, signal) => { closed = true; exitCode = code; exitSignal = signal; resolve() }))
  const abort = () => fail(environment.lifecycle.signal.reason)
  environment.lifecycle?.signal.addEventListener('abort', abort, { once: true })
  environment.registerAuthorCleanup?.(cleanup)
  environment.lifecycle?.register(cleanup)
  const timer = setTimeout(() => fail(new Error(`Author timed out after ${timeoutMs} ms`)), timeoutMs)
  child.stdin.end(prompt)
  let receipt, hardTimer, completedAtMs
  try {
    await Promise.race([finished, new Promise(resolve => { hardTimer = setTimeout(resolve, timeoutMs + 3000) })])
    if (buffer.trim()) { try { onEvent(JSON.parse(buffer)) } catch (error) { failure ??= error } }
    receipt = await cleanup()
    if (failure) throw failure
    if (exitCode !== 0) throw new Error(`Author exited unsuccessfully (${exitCode ?? exitSignal}): ${stderr.trim()}`)
    if (!threadId || !started || !completed) throw new Error('Author turn completion was not verified')
    if (!fs.existsSync(finalFile) || !fs.lstatSync(finalFile).isFile() || typeof finalMessage !== 'string'
      || fs.readFileSync(finalFile, 'utf8').trim() !== finalMessage.trim()) throw new Error('Author final output did not match its completed message')
    completedAtMs = Date.now()
    return { startedAt, completedAt: new Date(completedAtMs).toISOString(), durationMs: completedAtMs - startedAtMs,
      sessionUlid: threadId, invocationId, provider: 'codex', finalMessage: finalMessage.trim(),
      settled: true, usage, cleanup: receipt, resumed: Boolean(sessionUlid) }
  } catch (error) {
    if (error?.code === 'VALDR_EVAL_CANCELLED') throw error
    throw new EvaluationInfrastructureError(redactEvidence(error.message), { cause: error })
  } finally {
    clearTimeout(timer)
    clearTimeout(hardTimer)
    environment.lifecycle?.signal.removeEventListener('abort', abort)
    writeEvidence(path.join(outputDir, 'provider-events.json'), events)
    completedAtMs ??= Date.now()
    writeEvidence(path.join(outputDir, 'provider-diagnostics.json'), { startedAt, completedAt: new Date(completedAtMs).toISOString(), durationMs: completedAtMs - startedAtMs, stderr, exitCode, exitSignal })
    if (receipt?.ok) fs.rmSync(scratch, { recursive: true, force: true })
  }
}
