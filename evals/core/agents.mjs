import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const tiers = ['raider', 'vanguard', 'sovereign']
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const dataOf = result => result?.structuredContent?.data ?? result?.structuredContent ?? {}
const normalized = text => text.trim().replace(/\s+/g, ' ')

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(item => item.isDirectory()
    ? walk(path.join(root, item.name)) : item.isFile() ? [path.join(root, item.name)] : [])
}

export function loadAgentSource({ packsRoot, agentPath, tier }) {
  assert.ok(tiers.includes(tier), 'An explicit tier (raider, vanguard, or sovereign) is required')
  assert.ok(globalThis.Bun?.YAML?.parse, 'Agent evaluation requires Bun with Bun.YAML support')
  packsRoot = fs.realpathSync(packsRoot)
  assert.ok(typeof agentPath === 'string' && !path.isAbsolute(agentPath), 'Agent manifest must be relative and inside the public packs root')
  const manifestPath = path.resolve(packsRoot, agentPath)
  assert.ok(manifestPath.startsWith(`${packsRoot}${path.sep}`), 'Agent manifest must stay inside the public packs root')
  assert.ok(fs.realpathSync(manifestPath).startsWith(`${packsRoot}${path.sep}`), 'Agent manifest must stay inside the public packs root')
  const definition = Bun.YAML.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.ok(definition.agent?.handle && definition.agent?.defaultRole, 'Agent manifest must declare a handle and defaultRole')
  assert.ok(Array.isArray(definition.capabilities) && definition.capabilities.length, 'Agent manifest must declare capabilities')
  const files = walk(packsRoot)
  const seen = new Set()
  const capabilities = definition.capabilities.map((binding, index) => {
    assert.ok(typeof binding.key === 'string' && !seen.has(binding.key), `Duplicate or invalid capability key ${binding.key}`)
    seen.add(binding.key)
    const candidates = files.filter(file => path.basename(file) === `${binding.key}.md`).map(file => {
      const relative = path.relative(packsRoot, file).split(path.sep).join('/')
      const sourceTier = relative.split('/').find(part => tiers.includes(part))
      return { file, relative, rank: sourceTier ? tiers.indexOf(sourceTier) : -1 }
    }).filter(item => item.rank <= tiers.indexOf(tier))
    const rank = Math.max(...candidates.map(item => item.rank))
    const matches = candidates.filter(item => item.rank === rank)
    assert.equal(matches.length, 1, `Expected one source for capability ${binding.key} at tier ${tier}, found ${matches.length}`)
    const source = matches[0]
    const content = fs.readFileSync(source.file, 'utf8')
    const header = content.match(/<capability\b([^>]+)>/)
    const attributes = Object.fromEntries([...header?.[1]?.matchAll(/([\w-]+)="([^"]*)"/g) ?? []].map(match => [match[1], match[2]]))
    assert.equal(attributes.id, binding.key, `Capability header must identify ${binding.key}`)
    assert.ok(attributes.pack, `Capability ${binding.key} must declare its pack`)
    return { key: binding.key, role: binding.role ?? attributes.role, pack: attributes.pack,
      position: binding.position ?? index * 10, hotLoad: binding['hot-load'] === true,
      sourcePath: source.relative, sha256: digest(content), content }
  })
  assert.ok(capabilities.some(item => !item.hotLoad), 'Agent must have at least one composed capability')
  return { handle: definition.agent.handle.replace(/^@/, ''), role: definition.agent.defaultRole, tier,
    agent: { path: agentPath.split(path.sep).join('/'), sha256: digest(fs.readFileSync(manifestPath)) },
    definition: definition.agent, capabilities }
}

export async function installAgent(environment, options) {
  const manifest = loadAgentSource(options)
  for (const capability of manifest.capabilities) {
    const prompt = dataOf(await environment.call('pm_prompt', { action: 'create', key: capability.key,
      name: capability.key, role: 'system', content: capability.content })).prompt
    assert.ok(prompt?.id, `Missing created prompt identity for ${capability.key}`)
    await environment.call('pm_capability', { action: 'ensure', key: capability.key, name: capability.key,
      category: capability.pack, promptId: prompt.id, role: capability.role, pack: capability.pack })
  }
  await environment.call('pm_agent', { action: 'create', ...manifest.definition,
    capabilities: manifest.capabilities.map(item => ({ key: item.key, role: item.role, position: item.position,
      hotLoad: item.hotLoad, sourceRelpath: item.sourcePath })) })
  const registered = dataOf(await environment.call('pm_agent', { action: 'get', handle: manifest.handle })).agent
  assert.equal(registered?.handle, manifest.handle, 'Registered agent identity does not match the selected manifest')
  assert.equal(registered?.defaultRole, manifest.role, 'Registered agent role does not match the selected manifest')
  assert.equal(registered?.capabilities?.length, manifest.capabilities.length, 'Registered capability binding count changed')
  for (const expected of manifest.capabilities) {
    const actual = registered.capabilities.find(item => item.key === expected.key)
    for (const key of ['role', 'position', 'hotLoad']) assert.equal(actual?.[key], expected[key], `Capability binding ${expected.key}.${key} changed`)
    assert.equal(actual?.sourceRelpath, expected.sourcePath, `Capability binding ${expected.key} source changed`)
  }
  const composed = dataOf(await environment.call('pm_agent', { action: 'get_prompt', handle: manifest.handle }))
  manifest.expectedSystemPrompt = composed.systemPrompt ?? composed.prompt
  assert.ok(typeof manifest.expectedSystemPrompt === 'string' && manifest.expectedSystemPrompt.trim(), 'Public agent composition returned no system prompt')
  for (const capability of manifest.capabilities) {
    if (!capability.hotLoad) assert.ok(normalized(manifest.expectedSystemPrompt).includes(normalized(capability.content)),
      `Composed persona is missing capability ${capability.key}`)
    else {
      const loaded = dataOf(await environment.call('pm_capability', { action: 'prompt', key: capability.key }))
      assert.equal(normalized(loaded.capability ?? ''), normalized(capability.content), `Hot-load capability ${capability.key} is unavailable or changed`)
      capability.promptVerified = true
    }
  }
  return manifest
}
