import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

function resolveExecutable(binary) {
  const candidates = binary.includes(path.sep) ? [path.resolve(binary)] : (process.env.PATH ?? '').split(path.delimiter).map(directory => path.join(directory, binary))
  for (const candidate of candidates) {
    try { fs.accessSync(candidate, fs.constants.X_OK); if (fs.statSync(candidate).isFile()) return fs.realpathSync(candidate) } catch {}
  }
  return null
}

export function resolveValdrBinary(binary = process.env.VALDR_BIN || 'valdr') {
  const executable = resolveExecutable(binary)
  if (!executable) throw new Error(`Valdr executable not found: ${binary}. Install Valdr or pass --valdr-bin.`)
  return executable
}

export function getBinaryInfo(binary) {
  const executable = resolveValdrBinary(binary)
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-version-'))
  try {
    let version
    try {
      version = execFileSync(executable, ['version', '--pm-home', path.join(temporary, 'pm'), '--data-root', path.join(temporary, 'data'), '--runtime-root', path.join(temporary, 'runtime')], { cwd: temporary, env: { PATH: process.env.PATH, HOME: temporary,
        XDG_CONFIG_HOME: temporary, XDG_CACHE_HOME: temporary, TMPDIR: temporary }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 15_000 }).trim()
    } catch {
      throw new Error('Valdr version check failed. Verify the installed valdr CLI or pass --valdr-bin.')
    }
    if (!/^valdr\s+\S+/.test(version)) throw new Error('Executable did not report a Valdr version')
    return { path: executable, version, sha256: crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex'), platform: process.platform, arch: process.arch }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}

export function getCodexBinaryInfo(binary = 'codex') {
  const executable = resolveExecutable(binary)
  if (!executable) throw new Error(`Codex executable not found: ${binary}. Install the public Codex CLI on PATH.`)
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-version-'))
  try {
    let version
    try {
      version = execFileSync(executable, ['--version'], { cwd: temporary,
        env: { PATH: process.env.PATH, HOME: temporary, TMPDIR: temporary },
        stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 15_000 }).trim()
    } catch { throw new Error('Codex version check failed. Verify the installed public Codex CLI.') }
    if (!/^codex(?:-cli)?\s+\S+/.test(version)) throw new Error('Executable did not report a Codex version')
    return { path: executable, version, sha256: crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),
      platform: process.platform, arch: process.arch }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}
