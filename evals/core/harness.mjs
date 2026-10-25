import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createMcpSession, createAuthorBroker } from './mcp.mjs'
import { getBinaryInfo } from './binary.mjs'
import { registerEvidenceSecrets, writeEvidence } from './evidence.mjs'
import { EvaluationInfrastructureError } from './lifecycle.mjs'

const temporaryParent = fs.realpathSync(os.tmpdir())
export const OWNED_PREFIX = path.join(temporaryParent, 'valdr-eval-')
export const dataOf = result => result?.structuredContent?.data ?? result?.structuredContent ?? {}

export function assertOwnedHome(candidate) {
  assert.ok(typeof candidate === 'string' && path.isAbsolute(candidate), 'An absolute owned home is required')
  const resolved = fs.realpathSync(candidate)
  const root = path.dirname(resolved)
  assert.equal(path.dirname(root), temporaryParent, 'Owned home must use the evaluation temporary directory')
  assert.ok(path.basename(root).startsWith(path.basename(OWNED_PREFIX)), 'Refusing an unowned evaluation home')
  assert.equal(path.basename(resolved), 'pm', 'PM home must be the owned root/pm')
  const marker = JSON.parse(fs.readFileSync(path.join(root, '.benchmark-owner.json'), 'utf8'))
  assert.equal(marker.root, root, 'Ownership marker does not match the real root')
  assert.equal(marker.kind, 'valdr-agent-eval', 'Unknown ownership marker')
  return resolved
}

export function isolatedEnvironment({ root, mode, inherited = process.env }) {
  assertOwnedHome(path.join(root, 'pm'))
  assert.ok(['runtime', 'author'].includes(mode), 'Unknown evaluation environment mode')
  const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'SYSTEMROOT', 'WINDIR']
    .filter(key => typeof inherited[key] === 'string').map(key => [key, inherited[key]]))
  const username = inherited.VALDR_DB_USERNAME
  const password = inherited.VALDR_DB_PASSWORD
  registerEvidenceSecrets([password])
  if (![username, password].every(value => typeof value === 'string' && value.trim())) {
    throw new EvaluationInfrastructureError('Configure both VALDR_DB_USERNAME and VALDR_DB_PASSWORD for your existing Valdr setup. Run with Bun from the repository root to load .env, or set both environment variables.')
  }
  return { ...env, HOME: inherited.HOME || os.homedir(), XDG_CONFIG_HOME: path.join(root, 'config'),
    XDG_CACHE_HOME: path.join(root, 'cache'), TMPDIR: path.join(root, 'tmp'),
    VALDR_DB_USERNAME: username, VALDR_DB_PASSWORD: password }
}

export async function createIsolatedEnvironment({ valdrBin, evidenceDir, mode = 'runtime', label = mode, requiredTools = [], lifecycle, requestAllowed }) {
  lifecycle?.throwIfCancelled()
  assert.ok(['runtime', 'author'].includes(mode), 'Unknown evaluation environment mode')
  const binary = getBinaryInfo(valdrBin)
  const root = fs.mkdtempSync(OWNED_PREFIX)
  const home = path.join(root, 'pm')
  for (const directory of ['pm', 'repo', 'user-home', 'runtime', 'config', 'cache', 'tmp', 'git-template']) fs.mkdirSync(path.join(root, directory), { recursive: true, mode: 0o700 })
  fs.writeFileSync(path.join(root, '.benchmark-owner.json'), JSON.stringify({ root, kind: 'valdr-agent-eval', label, mode }), { mode: 0o600 })
  evidenceDir = path.resolve(evidenceDir)
  assert.ok(evidenceDir !== root && !evidenceDir.startsWith(`${root}${path.sep}`), 'Evidence must be outside the disposable environment')
  fs.mkdirSync(evidenceDir, { recursive: true })
  const repoRoot = path.join(root, 'repo')
  let env, session, broker, authorCleanup, closePromise, startupCleanupError, cleaning = false, licenseAvailable = false
  const call = async (tool, input, options = {}) => {
    const result = await session.callTool(tool, input, { ...options, signal: cleaning ? null : lifecycle?.signal })
    if (result.isError && !options.allowIsError) {
      const error = new Error(result.content?.find(item => item.type === 'text')?.text || `${tool} failed`)
      error.action = `${tool}.${input.action ?? ''}`
      throw error
    }
    return result
  }
  const close = () => {
    closePromise ??= (async () => {
      cleaning = true
      const errors = startupCleanupError ? [startupCleanupError] : []
      try { if ((await authorCleanup?.())?.ok === false) errors.push('Owned author process cleanup was not verified') }
      catch (error) { errors.push(error.message) }
      try { await broker?.close() } catch (error) { errors.push(error.message) }
      try { await session?.close() } catch (error) { errors.push(error.message) }
      const authorityClosed = !startupCleanupError && (session?.closed ?? true)
      if (authorityClosed && errors.length === 0) {
        try { assertOwnedHome(home); fs.rmSync(root, { recursive: true, force: true }) }
        catch (error) { errors.push(error.message) }
      }
      const homeRetained = fs.existsSync(root)
      const receipt = { pid: session?.pid ?? null, authorityClosed, homeRetained, root,
        sessionsStopped: authorityClosed && errors.length === 0, authenticationRemoved: true,
        errors, ok: authorityClosed && !homeRetained && errors.length === 0 }
      writeEvidence(path.join(evidenceDir, 'cleanup.json'), receipt)
      return receipt
    })()
    return closePromise
  }
  lifecycle?.register(close)
  try {
    env = isolatedEnvironment({ root, mode })
    licenseAvailable = fs.existsSync(path.join(env.HOME, '.valdr', 'valdr.lic'))
    const gitEnv = { PATH: env.PATH, HOME: path.join(root, 'user-home'), GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'), GIT_TEMPLATE_DIR: path.join(root, 'git-template') }
    const git = (...args) => execFileSync('git', args, { cwd: repoRoot, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git('init', '-b', 'main')
    git('config', 'user.name', 'Valdr Agent Evaluation')
    git('config', 'user.email', 'benchmark@example.invalid')
    fs.writeFileSync(path.join(repoRoot, 'README.md'), 'Disposable Valdr agent evaluation workspace.\n')
    git('add', 'README.md')
    git('commit', '-m', 'Initialize disposable evaluation workspace')
    session = await createMcpSession({ command: binary.path,
      args: ['pm', '--pm-home', home, '--data-root', path.join(env.HOME, '.valdr'), '--runtime-root', path.join(root, 'runtime')],
      cwd: repoRoot, env, signal: lifecycle?.signal })
    const tools = (await session.request('tools/list')).tools ?? []
    const missing = [...new Set(['pm_health', ...requiredTools])].filter(name => !tools.some(tool => tool.name === name))
    const healthResult = await call('pm_health', { detail: true }, { allowIsError: true })
    if (missing.length || healthResult.isError) {
      const diagnosis = healthResult.isError ? healthResult.content?.find(item => item.type === 'text')?.text || 'Runtime health check failed.' : ''
      throw new EvaluationInfrastructureError(`Valdr evaluation preflight failed${missing.length ? `: missing ${missing.join(', ')}` : ''}. ${diagnosis} ${licenseAvailable ? 'The existing license file was referenced. Check disposable-workspace initialization and installed CLI compatibility.' : 'Configure Valdr in Settings > Settings or make ~/.valdr/valdr.lic available, then check the available MCP tools.'}`)
    }
    const health = dataOf(healthResult)
    assert.equal(health.info?.dataDir, home, 'Valdr used the wrong PM home; refusing fixture writes')
    if (mode === 'author') broker = await createAuthorBroker(session, { requestAllowed })
    writeEvidence(path.join(evidenceDir, 'environment.json'), { root, home, repoRoot, binary, mode, label, pid: session.pid })
    return { lifecycle, root, home, repoRoot, evidenceDir, mode, env, binary, tools, call, broker,
      registerAuthorCleanup(cleanup) { assert.equal(cleaning, false, 'Cannot launch an author while closing'); authorCleanup = cleanup },
      uid: async () => dataOf(await call('pm_generate_ulid', {})).ulid, health, close, session }
  } catch (error) {
    startupCleanupError = error.cleanupError
    try { const receipt = await close(); if (!receipt.ok) error.cleanupError = receipt.errors.join('; ') } catch (cleanupError) {
      writeEvidence(path.join(evidenceDir, 'cleanup-failure.json'), { root, error: cleanupError.message })
    }
    writeEvidence(path.join(evidenceDir, 'startup-failure.json'), { root, error: error.message })
    throw error
  }
}
