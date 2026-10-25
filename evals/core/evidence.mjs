import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const evidenceSecrets = new Set()

export function registerEvidenceSecrets(values) {
  for (const value of values) if (typeof value === 'string' && value.length) evidenceSecrets.add(value)
}

const tokenUsageKey = /^(?:(?:(?:input|output|total|cached|reasoning|cache_write)_?)*tokens|tokenCount)$/i
const sensitiveKey = (key, value) => /(?:token|password|username|secret|api.?key|auth.?key|authorization|private.?key|database.?url|connection.?string)/i.test(key)
  && !(typeof value === 'number' && tokenUsageKey.test(key))
const sensitiveAssignment = /(\b([\w.-]*(?:api[_-]?key|access[_-]?key|private[_-]?key|auth[_-]?key|token|secret|authorization|password|credential|username|database[_-]?url|connection[_-]?string)[\w.-]*)\b["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:bearer|basic)\s+(?:\[REDACTED\]|[^\s"'<>;,&)\]}]+)|\[REDACTED\]|[^\s"'<>;,&)\]}]+)/gi

function redactText(value) {
  let text = value
    .replace(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g, '[REDACTED]')
    .replace(/\bBearer\s+[^\s"'<>;,]+/gi, 'Bearer [REDACTED]')
    .replace(/\b([a-z][a-z\d+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(sensitiveAssignment, (assignment, prefix, key, assigned) => {
      if (tokenUsageKey.test(key) && /^\d+$/.test(assigned)) return assignment
      const quote = /^["']/.test(assigned) ? assigned[0] : ''
      const scheme = /^(Bearer|Basic)\s+/i.exec(assigned)?.[0] ?? ''
      return `${prefix}${quote}${scheme}[REDACTED]${quote}`
    })
  for (const secret of [...evidenceSecrets].sort((a, b) => b.length - a.length)) {
    if (secret.length >= 8) text = text.split(secret).join('[REDACTED]')
    else {
      const literal = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const assignment = new RegExp(`((?:[a-z][a-z0-9_]*_)?(?:password|secret|token|api_?key)["']?\\s*[:=]\\s*["']?)${literal}`, 'gi')
      text = text.replace(assignment, '$1[REDACTED]')
    }
  }
  return text
}

export function redactEvidence(value) {
  if (typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
    try { return JSON.stringify(redactEvidence(JSON.parse(value))) } catch { return redactText(value) }
  }
  if (typeof value === 'string') return redactText(value)
  if (Array.isArray(value)) return value.map(redactEvidence)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, sensitiveKey(key, item) ? '[REDACTED]' : redactEvidence(item)]))
  return value
}

export function writeEvidence(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(redactEvidence(value), null, 2)}\n`, { mode: 0o600 })
}

export function captureSubmission(candidatePath, target) {
  assert.ok(fs.lstatSync(candidatePath).isFile(), 'Submission must be a regular file, never a link')
  const bytes = fs.readFileSync(candidatePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o444 })
  return { path: target, sha256: digest(bytes), bytes: bytes.length }
}

