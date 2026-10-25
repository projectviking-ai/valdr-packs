import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const dataOf = result => {
  if (result?.isError) throw new Error(result.content?.map(item => item.text ?? '').join('\n') || 'MCP call failed')
  return result?.structuredContent?.data ?? result?.structuredContent
}

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(root, item.name)) : [path.join(root, item.name)])
}

export async function seedWorkflowFixtures(environment, { packsRoot }) {
  assert.ok(globalThis.Bun?.YAML?.parse, 'Authoring requires Bun with Bun.YAML support; run the benchmark with bun.')
  await seedRuntimeFixtures(environment)
  const parse = text => Bun.YAML.parse(text)
  const files = walk(packsRoot)
  const manifest = { examples: [] }
  const allDefinitions = files.filter(file => file.endsWith('.workflow.yaml')).map(sourcePath =>
    ({ sourcePath, content: fs.readFileSync(sourcePath, 'utf8'), definition: parse(fs.readFileSync(sourcePath, 'utf8')) }))
  const selected = new Map()
  const include = key => {
    if (selected.has(key)) return
    const entry = allDefinitions.find(item => item.definition.workflow.key === key)
    assert.ok(entry, `Missing shipped example ${key}`)
    selected.set(key, entry)
    for (const step of entry.definition.workflow.steps) if (step.kind === 'subworkflow') include(step.workflow.key)
  }
  for (const key of ['valdr-workflow.task.ensure-ready', 'valdr-workflow.task.review-all']) include(key)
  fs.mkdirSync(path.join(environment.repoRoot, 'examples'), { recursive: true })
  for (const { sourcePath, content, definition } of [...selected.values()].reverse()) {
    fs.writeFileSync(path.join(environment.repoRoot, 'examples', path.basename(sourcePath)), content, { mode: 0o444 })
    const saved = await environment.call('pm_workflow', { action: 'save_definition', definitionJson: definition,
      capabilityKey: definition.workflow.key, packKey: 'benchmark-reference', sourceRelpath: path.basename(sourcePath) }, { allowIsError: true })
    manifest.examples.push({ key: definition.workflow.key, sourcePath, localPath: path.join(environment.repoRoot, 'examples', path.basename(sourcePath)), sha256: digest(content), saved: !saved.isError,
      ...(saved.isError ? { registrationError: saved.content?.find(item => item.type === 'text')?.text } : {}) })
  }
  return manifest
}

export async function seedRuntimeFixtures(environment) {
  const { call, repoRoot } = environment
  dataOf(await call('pm_agent', { action: 'create', handle: 'benchmark', name: 'Benchmark operator', kind: 'human', defaultRole: 'orchestrator' }))
  dataOf(await call('pm_project', { action: 'create', key: 'BENCH', name: 'Isolated workflow benchmark', taskKeyPrefix: 'BENCH', repos: [{ rootPath: repoRoot, isPrimary: true }] }))
  dataOf(await call('pm_task', { action: 'create', key: 'BENCH-1', projectKey: 'BENCH', title: 'Fixture task', description: 'Isolated workflow benchmark fixture.', status: 'to_do', reporter: '@benchmark' }))
  dataOf(await call('pm_task', { action: 'create', key: 'BENCH-2', projectKey: 'BENCH', title: 'Second fixture task', description: 'Second isolated workflow benchmark fixture.', status: 'to_do', reporter: '@benchmark' }))
}

