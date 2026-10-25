import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const clone = value => structuredClone(value)
export const dataOf = result => {
  if (result?.isError) throw new Error(result.content?.map(item => item.text ?? '').join('\n') || 'Public PM request failed')
  return result?.structuredContent?.data ?? result?.structuredContent ?? {}
}

// The public update contract rebuilds these metadata rows, even when their IDs
// are supplied. Compare their content; retain the unmodified records in evidence.
export function semanticMetadata(metadata) {
  if (!record(metadata)) return metadata
  const normalized = clone(metadata)
  for (const link of normalized.links ?? []) delete link.id
  for (const checklist of normalized.checklists ?? []) {
    delete checklist.id
    for (const item of checklist.items ?? []) {
      delete item.id
      if (item.checkedBy === null) delete item.checkedBy
      if (item.checkedAt === null) delete item.checkedAt
    }
  }
  return normalized
}

export function semanticTask(task) {
  const normalized = clone(task)
  delete normalized.updatedAt
  normalized.metadata = semanticMetadata(normalized.metadata)
  return normalized
}

function snapshotFiles(root) {
  const files = {}
  const walk = directory => {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name), relative = path.relative(root, file)
      const stat = fs.lstatSync(file)
      if (stat.isDirectory()) { files[relative] = { type: 'directory', mode: stat.mode & 0o777 }; walk(file) }
      else if (stat.isSymbolicLink()) files[relative] = { type: 'link', target: fs.readlinkSync(file) }
      else if (stat.isFile()) files[relative] = { type: 'file', mode: stat.mode & 0o777,
        sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }
      else files[relative] = { type: 'special' }
    }
  }
  walk(root)
  return files
}

export async function captureState({ environment, context }) {
  const task = dataOf(await environment.call('pm_task', { action: 'get', taskKey: context.taskKey })).task
  const guardTask = dataOf(await environment.call('pm_task', { action: 'get', taskKey: context.guardTaskKey })).task
  assert.ok(task?.key === context.taskKey && guardTask?.key === context.guardTaskKey, 'Task Repairer fixture readback is incomplete')
  const events = dataOf(await environment.call('pm_task', { action: 'event_list', taskKey: context.taskKey, limit: 100 }))
  const comments = dataOf(await environment.call('pm_task', { action: 'comment_list', taskKey: context.taskKey }))
  return { task, guardTask, events: events.events ?? [], comments: comments.comments ?? [], files: snapshotFiles(environment.repoRoot),
    requestOffset: environment.broker?.requests?.length ?? 0 }
}

