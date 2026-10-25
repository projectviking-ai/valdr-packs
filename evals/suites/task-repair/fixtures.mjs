import assert from 'node:assert/strict'
import path from 'node:path'
import { writeEvidence as save } from '../../core/evidence.mjs'
import { dataOf, captureState } from './state.mjs'
import { originalLabel, expiryLabel } from './scenarios.mjs'
const clone = value => structuredClone(value)

export async function prepare(environment, { scenario }) {
  const projectKey = 'REPAIR'
  await environment.call('pm_project', { action: 'create', key: projectKey, taskKeyPrefix: projectKey, name: 'Isolated Task Repairer evaluation' })
  for (const [handle, name] of [['fixture-owner', 'Fixture Owner'], ['fixture-reporter', 'Fixture Reporter']]) {
    await environment.call('pm_agent', { action: 'create', handle, name, kind: 'bot', defaultRole: 'executor' })
  }
  const metadata = { tags: ['preserve-me', 'task-repair-fixture'],
    links: [{ kind: 'documentation', uri: 'https://example.invalid/fixture', label: 'Preserve link' }],
    checklists: [{ name: 'Acceptance Criteria', items: [
      { label: originalLabel, checked: false },
      { label: 'Existing sessions remain valid.', checked: true, checkedBy: '@fixture-reviewer', checkedAt: 1700000000000 },
    ] }] }
  if (scenario.fixture === 'multiple-checklists') {
    metadata.checklists[0].items.push({ label: expiryLabel, checked: false })
    metadata.checklists.push({ name: 'Delivery Acceptance Criteria', items: [
      { label: 'Reset emails do not contain plaintext passwords.', checked: true, checkedBy: '@fixture-reviewer', checkedAt: 1700000000000 },
      { label: 'Reset links can be used once.', checked: false },
      { label: expiryLabel, checked: false },
    ] })
  }
  if (scenario.fixture === 'duplicate-label') metadata.checklists[0].items.push({ label: originalLabel, checked: false })
  const created = dataOf(await environment.call('pm_task', { action: 'create', projectKey,
    title: 'Preserve this password reset task title', description: 'Support password reset requests.', type: 'task', status: 'to_do',
    points: 5, priority: 2, assignee: '@fixture-owner', reporter: '@fixture-reporter', metadata })).task
  const guard = dataOf(await environment.call('pm_task', { action: 'create', projectKey,
    title: 'Unrelated task must remain unchanged', description: 'This is outside the repair authority.', status: 'backlog', points: 8, priority: 4 })).task
  assert.ok(created?.key && guard?.key, 'Task Repairer fixture creation returned no task identity')
  const context = { projectKey, taskKey: created.key, guardTaskKey: guard.key, scenario, findings: clone(scenario.findings),
    initialTask: created, initialGuardTask: guard, requestStart: environment.broker?.requests?.length ?? 0 }
  context.initialState = await captureState({ environment, context })
  save(path.join(environment.evidenceDir, 'task-repair-fixture.json'), context)
  return context
}

