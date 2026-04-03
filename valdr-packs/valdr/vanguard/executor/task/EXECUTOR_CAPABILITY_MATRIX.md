# Executor — Capability Matrix (Task)

> **Status:** Registered — capabilities available via `pm_capability { action: "prompt", key: "..." }`.

| Capability Key | Role | Pack | Prompt ID (ULID) | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.executor.task.system` | `core` | `valdr` | `01KFBHXHFWWM2SKCCVBJKHWJ9G` | `valdr.executor.task.system.md` |

## Shared Workflow Details (Hot-Load)

| Capability Key | Role | Pack | Purpose |
| --- | --- | --- | --- |
| `valdr.executor.workflow.status-change` | `workflow` | `valdr` | Status transition details |
| `valdr.executor.workflow.preflight` | `workflow` | `valdr` | CLI preflight checks |
| `valdr.executor.workflow.prior-work` | `workflow` | `valdr` | Prior work check for in_progress |
| `valdr.executor.workflow.handle-resolution` | `workflow` | `valdr` | Resolve actor handle (CLI) |
| `valdr.executor.workflow.checklist` | `workflow` | `valdr` | Checklist toggle patterns |
| `valdr.executor.workflow.self-review` | `validation` | `valdr` | Pre-submission verification |
| `valdr.executor.workflow.completion` | `workflow` | `valdr` | Completion summary format |
| `valdr.executor.workflow.recovery` | `workflow` | `valdr` | Error handling and session recovery |
| `valdr.executor.workflow.blocker` | `workflow` | `valdr` | Obstacle handling |
| `valdr.executor.workflow.review` | `workflow` | `valdr` | Review feedback handling |

## Usage

These capabilities provide a task execution framework. They are designed to be composed with agent personas loaded from task assignments.

The actual persona comes from `pm_task { action: "get_prompt" }` — these capabilities provide the execution mechanics.

## Hot-Loading Pattern

To hot-load a capability at runtime:

```
// Step 1: Get capability → returns promptId
pm_capability { action: "get", key: "valdr.executor.task.system" }
→ { promptId: "<ulid>", ... }

// Step 2: Get prompt content
pm_prompt { action: "get", id: "<ulid>" }
→ { content: "# Valdr Task Executor\n...", ... }
```

## Composition Examples

**Minimal executor:**
- `valdr.executor.task.system`

**CLI executor (system + shared workflow):**
- `valdr.executor.task.system`

**Executor with tool capabilities:**
- `valdr.executor.task.system`
- `valdr.core.tools.pm-task`
- `valdr.core.tools.pm-review`

## Integration with Skills

These capabilities can replace or augment the `valdr-task-runner` skill. Skills can hot-load these capabilities for detailed execution guidance:

```
pm_capability { action: "prompt", key: "valdr.executor.task.system" }
→ { "role": "workflow", "capability": "<execution instructions>" }
```
