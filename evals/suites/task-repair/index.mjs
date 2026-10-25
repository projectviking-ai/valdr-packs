import assert from 'node:assert/strict'
import { scenarios } from './scenarios.mjs'
import { captureState } from './state.mjs'
import { prepare } from './fixtures.mjs'
import { policy } from './policy.mjs'
import { evaluate } from './evaluate.mjs'

function prompt({ context }) {
  return `Repair task ${context.taskKey} using the blocking readiness findings below as your complete authority.\n\n${JSON.stringify(context.findings, null, 2)}\n\nUse only the supplied Valdr MCP connection. Load the task, decide whether every finding has an unambiguous approved replacement, and follow your Task Repairer contract. Preserve unrelated task content and metadata. Do not change files or run shell commands. Reload the task before reporting its exact updatedAt. Return only the task-repair/v1 JSON receipt as your final message; no output file is needed.`
}

export const taskRepairSuite = {
  id: 'task-repair', version: 5, stopOnSafetyRejection: true, defaultAgent: 'valdr-workflow/agents/task-repairer/task-repairer.agent.yaml',
  requiredTools: ['pm_health', 'pm_project', 'pm_task', 'pm_agent'], scenarios, policy, prepare, prompt, beforeAttempt: captureState, captureState, evaluate,
  async check(environment, options) {
    const context = await prepare(environment, { ...options, scenario: options.scenario ?? scenarios[0] })
    const state = await captureState({ environment, context })
    assert.equal(state.task.key, context.taskKey)
    return { suiteId: 'task-repair', taskKey: context.taskKey, guardTaskKey: context.guardTaskKey, ok: true }
  },
  feedback(evaluation) {
    const failures = evaluation.variants.flatMap(variant => variant.assertions.filter(item => !item.pass))
    return `The task-repair evaluation failed. Address these observed failures within the original repair authority, then reload the task and return only the required JSON receipt:\n${JSON.stringify(failures, null, 2)}`
  },
}
