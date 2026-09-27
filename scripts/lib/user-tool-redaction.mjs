// Generated from Valdr packages/util/src/redaction.ts; refresh via the CLI generator.
const SENSITIVE_VALUE_PATTERN = /\b(?:sk|pk|rk)[_-][a-z0-9._-]{16,}|\b(?:gh[pousr]|github_pat|xox[baprs]?)[_-][a-z0-9._-]{12,}|\b(?:ctx7|ya29)[a-z0-9._-]{12,}/gi;
const SENSITIVE_ASSIGNMENT_PATTERN = /(\b[\w.-]*(?:api[_-]?key|access[_-]?key|private[_-]?key|token|secret|authorization|password|credential)[\w.-]*\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|bearer\s+[^\s,;]+|[^\s,;]+)/gi;
const BEARER_VALUE_PATTERN = /(\bbearer\s+)[^\s,;]+/gi;
export const redactSensitiveText = (value, knownSecrets = []) => {
  if (value.length === 0) {
    return value;
  }
  let scrubbed = value;
  for (const secret of new Set(knownSecrets)) {
    if (secret && secret !== "[REDACTED]")
      scrubbed = scrubbed.replaceAll(secret, "[REDACTED]");
  }
  const keyValuePattern = /("([^"]*(?:api[_-]?key|access[_-]?key|private[_-]?key|token|secret|authorization|auth|password|credential)[^"]*)"\s*:\s*")([^"]+)(")/gi;
  return scrubbed.replace(keyValuePattern, "$1[REDACTED]$4").replace(SENSITIVE_ASSIGNMENT_PATTERN, "$1[REDACTED]").replace(BEARER_VALUE_PATTERN, "$1[REDACTED]").replace(SENSITIVE_VALUE_PATTERN, "[REDACTED]");
};
