# Task Executor

A Valdr executor capability for task execution lifecycle management. Provides the framework for executing assigned tasks, managing checklists, performing self-review, and moving work through the review gate.

The actual persona comes from the task's assignee — this capability provides the execution framework that any agent can use.

## Role

**Executor** — Executes assigned tasks through the full lifecycle from pickup to review submission.

## Capabilities

| Capability | Role | Purpose |
|------------|------|---------|
| `valdr.executor.task.system` | `core` | Core identity, principles, tool index |

## Shared Workflow Details

The executor task flow hot-loads shared, canonical workflow details from:

- `valdr.executor.workflow.status-change`
- `valdr.executor.workflow.preflight`
- `valdr.executor.workflow.prior-work`
- `valdr.executor.workflow.handle-resolution`
- `valdr.executor.workflow.checklist`
- `valdr.executor.workflow.self-review`
- `valdr.executor.workflow.completion`
- `valdr.executor.workflow.recovery`
- `valdr.executor.workflow.blocker`
- `valdr.executor.workflow.review`

## Key Behaviors

1. **Fetch before act** — Always get task details before any operation
2. **Load persona first** — Adopt the assignee's instructions before starting work
3. **Check before start (CLI)** — Validate status, blockers before work
4. **Update as you go** — Toggle checklists immediately, not batched
5. **Self-review before submit** — Verify all requirements met before moving to review
6. **Stop at in_review** — Never move tasks to `verified` or `done`
7. **One task at a time** — Complete current task before starting another
8. **Internal launch goes straight to execution** — No status gating when user already approved

## Task Lifecycle

```
to_do → in_progress → in_review → [verified] → [done]
              ↑            │
              └────────────┘
             (revision cycle)
```

The executor manages tasks from `to_do` through `in_review`. The `verified` and `done` transitions are handled by reviewers and the verification gate.

## Hot-Loading

The task executor uses hot-loading for tool documentation:

```
pm_capability { action: "prompt", key: "valdr.core.tools.pm-task" }
→ { "role": "workflow", "capability": "<task tool docs>" }
```

Shared workflow details are hot-loaded the same way:

```
pm_capability { action: "prompt", key: "valdr.executor.workflow.completion" }
→ { "role": "workflow", "capability": "<completion summary format>" }
```

## When to Use

- Executing assigned development tasks
- Managing checklist progress during implementation
- Preparing work for code review
- Handling review feedback cycles

## Related Agents

| Agent | Role | Handoff |
|-------|------|---------|
| Sigrid | Reviewer | Executor submits to review → Sigrid reviews |
| Gunnar | Orchestrator | Gunnar discovers tasks → Executor executes |
