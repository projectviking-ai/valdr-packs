<!--<capability id="valdr.executor.workflow.preflight" pack="valdr" role="workflow">-->
# CLI Preflight Checks

<!--<identity>-->
Start-of-task gating for CLI/manual launches.
<!--</identity>-->

<!--<instructions>-->

## Prerequisite

Fetch the task first and review its metadata:

```
pm_task { action: "get", taskKey: "<task-key>" }
```

Ensure `actorHandle` is resolved (see `valdr.executor.workflow.handle-resolution`).

**MANDATORY BEFORE CONTINUING**

Run persona loading and verify it succeeded:

```
pm_capability { action: "prompt", key: "valdr.executor.workflow.handle-resolution" }
pm_task { action: "get_prompt", taskKey: "<task-key>" }
```

Do not continue preflight unless:
- The call completed successfully
- A usable `assigneeHandle` is available for mutations
- Assignee instructions were loaded for execution

If any of the above is missing, STOP and ask the user for direction.

## Status Check

| Current Status | Action |
|----------------|--------|
| `backlog` | **STOP** — Ask user to move to `to_do` |
| `to_do` | Proceed |
| `in_progress` | Hot-load `valdr.executor.workflow.prior-work` |
| `in_review` | Check for review feedback (below) |
| `verified` / `done` | **STOP** — Task already complete |

## In-Review Check (for `in_review` tasks)

```
pm_review { action: "list", taskKey: "<task-key>" }
```

| Scenario | Action |
|----------|--------|
| No reviews exist | **STOP** — "Waiting for reviewer." |
| `pending` or `in_progress` | **STOP** — "Review in progress." |
| `approved` | **STOP** — "Waiting for verification gate." |
| `changes_requested` | **Hot-load** `valdr.executor.workflow.review` |

## Prior Work Check (for `in_progress` tasks)

Hot-load `valdr.executor.workflow.prior-work` and follow its steps.

## Requirements Check

| Scenario | Action |
|----------|--------|
| Description is clear | Proceed |
| Empty or vague description | **STOP** — Ask user for clarification |
| Missing acceptance criteria/checklists | Proceed, note in completion summary |

## Blocker Check

Check `metadata.tags` for `blocked`.

| Scenario | Action |
|----------|--------|
| No blocker tags | Proceed |
| Has `blocked` tag | **STOP** — "Task is blocked. Check metadata.links." |

**Only proceed after ALL checks pass.**

<!--</instructions>-->
<!--</capability>-->
