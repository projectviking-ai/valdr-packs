const KEY_SPLIT_PATTERN = /\s+/g
const BACKSLASH_PATTERN = /\\/g
const LEADING_DOT_SLASH_PATTERN = /^(?:\.\/)+/
const DUPLICATE_SLASH_PATTERN = /\/{2,}/g
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/
const DIGEST_PATTERN = /^fnv1a64:[a-f0-9]{16}$/
const KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/
const HANDLE_PATTERN = /^@[a-z0-9][a-z0-9._:-]*$/

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n
const FNV_PRIME_64 = 0x100000001b3n
const FNV_MASK_64 = 0xffffffffffffffffn

export const CAPABILITY_ROLE_VALUES = ['core', 'workflow', 'constraints', 'context', 'validation', 'integration']

export const VALDR_PACK_SCHEMA_VERSION = 'valdr-pack/v1'

export const VALDR_PACK_CANONICAL_IDENTITY_KEYS = {
  prompt: 'key',
  capability: 'key',
  agentPrimary: 'handle',
  agentFallback: 'id',
}

const textEncoder = new TextEncoder()

const normalizeChecksum = (value) => value.trim().toLowerCase()

const isUnsafeArchivePath = (value) =>
  value.startsWith('/') ||
  value === '..' ||
  value.startsWith('../') ||
  value.endsWith('/..') ||
  value.includes('/../')

export function normalizeValdrPackKey(value) {
  return value.trim().toLowerCase().replace(KEY_SPLIT_PATTERN, '-')
}

export function normalizeValdrPackIdentifier(value) {
  return normalizeValdrPackKey(value)
}

export function normalizeValdrPackHandle(value) {
  const normalized = normalizeValdrPackIdentifier(value)
  return normalized.startsWith('@') ? normalized : `@${normalized}`
}

export function normalizeValdrPackPath(value) {
  return value
    .trim()
    .replace(BACKSLASH_PATTERN, '/')
    .replace(LEADING_DOT_SLASH_PATTERN, '')
    .replace(DUPLICATE_SLASH_PATTERN, '/')
}

const toStableJsonValue = (value) => {
  if (value === null) return null
  if (Array.isArray(value)) return value.map((entry) => toStableJsonValue(entry))
  if (value instanceof Date) return value.toISOString()

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    const normalized = {}
    for (const [key, entryValue] of entries) {
      normalized[key] = toStableJsonValue(entryValue)
    }
    return normalized
  }

  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'symbol') return value.description ?? 'symbol'
  if (typeof value === 'function') return value.name.length > 0 ? `[function:${value.name}]` : '[function]'
  return 'undefined'
}

export function serializeStableValdrPackPayload(value) {
  return JSON.stringify(toStableJsonValue(value))
}

const fnv1a64Hex = (value) => {
  let hash = FNV_OFFSET_BASIS_64
  const bytes = textEncoder.encode(value)
  for (const byte of bytes) {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME_64) & FNV_MASK_64
  }
  return hash.toString(16).padStart(16, '0')
}

const getCanonicalChecksumEntries = (checksums) => {
  const normalizedPathToRaw = new Map()
  const entries = Object.entries(checksums)
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([rawPath, checksum]) => {
      const normalizedPath = assertArchivePath(rawPath)
      const priorRawPath = normalizedPathToRaw.get(normalizedPath)
      assert(
        priorRawPath === undefined || priorRawPath === rawPath,
        `checksum keys '${priorRawPath}' and '${rawPath}' normalize to the same path '${normalizedPath}'.`
      )
      normalizedPathToRaw.set(normalizedPath, rawPath)
      return [normalizedPath, assertChecksum(checksum)]
    })

  entries.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  return entries
}

export function buildCanonicalChecksumMap(checksums) {
  const canonical = {}
  for (const [entryPath, checksum] of getCanonicalChecksumEntries(checksums)) {
    canonical[entryPath] = checksum
  }
  return canonical
}

export function computeValdrPackDigestInput(checksums) {
  return serializeStableValdrPackPayload(buildCanonicalChecksumMap(checksums))
}

export function computeValdrPackDigest(checksums) {
  return `fnv1a64:${fnv1a64Hex(computeValdrPackDigestInput(checksums))}`
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const assertNormalizedKey = (value, label) => {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} is required`)
  const normalized = normalizeValdrPackKey(value)
  assert(normalized.length <= 200, `${label} must be 200 characters or fewer`)
  assert(KEY_PATTERN.test(normalized), `${label} must contain lowercase letters, numbers, and . _ : - separators`)
  return normalized
}

const assertNormalizedIdentifier = (value, label) => {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} is required`)
  const normalized = normalizeValdrPackIdentifier(value)
  assert(normalized.length <= 200, `${label} must be 200 characters or fewer`)
  assert(IDENTIFIER_PATTERN.test(normalized), `${label} must contain lowercase letters, numbers, and . _ : - separators`)
  return normalized
}

const assertNormalizedHandle = (value, label) => {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} is required`)
  const normalized = normalizeValdrPackHandle(value)
  assert(normalized.length <= 200, `${label} must be 200 characters or fewer`)
  assert(HANDLE_PATTERN.test(normalized), `${label} must be an @-prefixed lowercase identifier with . _ : - separators`)
  return normalized
}

const assertArchivePath = (value) => {
  assert(typeof value === 'string' && value.trim().length > 0, 'archive path is required')
  const normalized = normalizeValdrPackPath(value)
  assert(normalized.length > 0, 'archive path must not be empty after normalization')
  assert(normalized.length <= 1024, 'archive path must be 1024 characters or fewer')
  assert(!isUnsafeArchivePath(normalized), `archive path '${normalized}' must be relative and cannot include parent traversal`)
  return normalized
}

const assertChecksum = (value) => {
  assert(typeof value === 'string', 'checksum is required')
  const normalized = normalizeChecksum(value)
  assert(CHECKSUM_PATTERN.test(normalized), 'checksum must be a 64-character lowercase hex digest')
  return normalized
}

const assertDigest = (value) => {
  assert(typeof value === 'string' && DIGEST_PATTERN.test(value.trim().toLowerCase()), 'digest must use fnv1a64:<16-hex> format')
  return value.trim().toLowerCase()
}

const assertNonNegativeInt = (value, label) => {
  assert(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`)
  return value
}

export function createPromptIdentity({ kind, key }) {
  assert(kind === 'prompt', "prompt identity kind must be 'prompt'")
  return { kind: 'prompt', key: assertNormalizedKey(key, 'prompt key') }
}

export function createCapabilityIdentity({ kind, key }) {
  assert(kind === 'capability', "capability identity kind must be 'capability'")
  return { kind: 'capability', key: assertNormalizedKey(key, 'capability key') }
}

export function createAgentIdentity({ kind, handle, id }) {
  assert(kind === 'agent', "agent identity kind must be 'agent'")
  const normalizedHandle = handle === null || handle === undefined ? null : assertNormalizedHandle(handle, 'agent handle')
  const normalizedId = id === null || id === undefined ? null : assertNormalizedIdentifier(id, 'agent id')
  assert(normalizedHandle !== null || normalizedId !== null, 'Agent identity requires id when handle is null.')
  return { kind: 'agent', handle: normalizedHandle, id: normalizedId }
}

export function toCanonicalValdrPackEntityKey(entity) {
  switch (entity.kind) {
    case 'prompt':
      return `prompt:${assertNormalizedKey(entity.key, 'prompt key')}`
    case 'capability':
      return `capability:${assertNormalizedKey(entity.key, 'capability key')}`
    case 'agent':
      if (entity.handle !== null && entity.handle !== undefined) {
        return `agent:${assertNormalizedHandle(entity.handle, 'agent handle')}`
      }
      return `agent:${assertNormalizedIdentifier(entity.id, 'agent id')}`
    default:
      throw new Error('Unsupported entity kind.')
  }
}

export function createManifest(manifest) {
  assert(manifest && typeof manifest === 'object', 'manifest is required')
  assert(manifest.schemaVersion === VALDR_PACK_SCHEMA_VERSION, `Unsupported schemaVersion '${manifest.schemaVersion}'. Expected '${VALDR_PACK_SCHEMA_VERSION}'.`)
  const packKey = assertNormalizedKey(manifest.packKey, 'packKey')
  const digest = assertDigest(manifest.digest)

  const exportMetadata = manifest.exportMetadata ?? {}
  assertNonNegativeInt(exportMetadata.exportedAt, 'exportMetadata.exportedAt')
  assert(typeof exportMetadata.sourceSystem === 'string' && exportMetadata.sourceSystem.trim().length > 0, 'exportMetadata.sourceSystem is required')
  const entityCounts = exportMetadata.entityCounts ?? {}
  assertNonNegativeInt(entityCounts.prompts, 'exportMetadata.entityCounts.prompts')
  assertNonNegativeInt(entityCounts.capabilities, 'exportMetadata.entityCounts.capabilities')
  assertNonNegativeInt(entityCounts.agents, 'exportMetadata.entityCounts.agents')

  const identityKeys = exportMetadata.canonicalIdentityKeys ?? {}
  assert(identityKeys.prompt === VALDR_PACK_CANONICAL_IDENTITY_KEYS.prompt, 'canonicalIdentityKeys.prompt is invalid')
  assert(identityKeys.capability === VALDR_PACK_CANONICAL_IDENTITY_KEYS.capability, 'canonicalIdentityKeys.capability is invalid')
  assert(identityKeys.agentPrimary === VALDR_PACK_CANONICAL_IDENTITY_KEYS.agentPrimary, 'canonicalIdentityKeys.agentPrimary is invalid')
  assert(identityKeys.agentFallback === VALDR_PACK_CANONICAL_IDENTITY_KEYS.agentFallback, 'canonicalIdentityKeys.agentFallback is invalid')

  const archive = manifest.archive ?? {}
  const checksums = buildCanonicalChecksumMap(archive.checksums ?? {})
  const entryPaths = new Set()
  const entries = (archive.entries ?? []).map((entry) => {
    const entryPath = assertArchivePath(entry.path)
    const checksum = assertChecksum(entry.checksum)
    const sizeBytes = assertNonNegativeInt(entry.sizeBytes, `archive entry '${entryPath}' sizeBytes`)
    assert(!entryPaths.has(entryPath), `Duplicate archive entry path '${entryPath}'.`)
    entryPaths.add(entryPath)
    const mappedChecksum = checksums[entryPath]
    assert(mappedChecksum !== undefined, `Missing checksum map entry for archive file '${entryPath}'.`)
    assert(mappedChecksum === checksum, `Checksum mismatch for archive entry '${entryPath}'.`)
    return { path: entryPath, checksum, sizeBytes }
  })
  assert(entries.length > 0, 'archive entries must include at least one file.')

  for (const checksumPath of Object.keys(checksums)) {
    assert(entryPaths.has(checksumPath), `Checksum map includes file missing from archive entries: ${checksumPath}.`)
  }

  const expectedDigest = computeValdrPackDigest(checksums)
  assert(digest === expectedDigest, `Manifest digest mismatch. Expected '${expectedDigest}' but received '${digest}'.`)

  const references = (manifest.dependencyGraph?.references ?? []).map((reference) => {
    const entity = reference.entity
    assert(entity && typeof entity === 'object', 'dependencyGraph reference entity is required')
    const dependsOn = reference.dependsOn ?? {}
    return {
      entity:
        entity.kind === 'prompt'
          ? createPromptIdentity(entity)
          : entity.kind === 'capability'
            ? createCapabilityIdentity(entity)
            : createAgentIdentity(entity),
      dependsOn: {
        prompts: (dependsOn.prompts ?? []).map((dependency) => createPromptIdentity(dependency)),
        capabilities: (dependsOn.capabilities ?? []).map((dependency) => createCapabilityIdentity(dependency)),
        agents: (dependsOn.agents ?? []).map((dependency) => createAgentIdentity(dependency)),
      },
    }
  })
  const referenceKeys = new Set()
  const duplicateReferenceKeys = new Set()
  for (const reference of references) {
    const key = toCanonicalValdrPackEntityKey(reference.entity)
    if (referenceKeys.has(key)) {
      duplicateReferenceKeys.add(key)
    }
    referenceKeys.add(key)
  }
  assert(
    duplicateReferenceKeys.size === 0,
    `dependencyGraph contains duplicate entity references: ${[...duplicateReferenceKeys].sort((left, right) => left.localeCompare(right)).join(', ')}.`
  )

  const missingDependencyKeys = new Set()
  for (const reference of references) {
    const dependencies = [
      ...reference.dependsOn.prompts,
      ...reference.dependsOn.capabilities,
      ...reference.dependsOn.agents,
    ]
    for (const dependency of dependencies) {
      const dependencyKey = toCanonicalValdrPackEntityKey(dependency)
      if (!referenceKeys.has(dependencyKey)) {
        missingDependencyKeys.add(dependencyKey)
      }
    }
  }
  assert(
    missingDependencyKeys.size === 0,
    `dependencyGraph references missing entities: ${[...missingDependencyKeys].sort((left, right) => left.localeCompare(right)).join(', ')}.`
  )

  return {
    schemaVersion: VALDR_PACK_SCHEMA_VERSION,
    packKey,
    digest,
    exportMetadata: {
      exportedAt: exportMetadata.exportedAt,
      sourceSystem: exportMetadata.sourceSystem.trim(),
      entityCounts: {
        prompts: entityCounts.prompts,
        capabilities: entityCounts.capabilities,
        agents: entityCounts.agents,
      },
      canonicalIdentityKeys: { ...VALDR_PACK_CANONICAL_IDENTITY_KEYS },
    },
    archive: {
      entries,
      checksums,
    },
    dependencyGraph: {
      references,
    },
  }
}
