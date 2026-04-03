<!--<capability id="valdr.executor.workflow" pack="valdr" role="workflow">-->
# Task Execution Workflow

Execute the assigned task following this flow. Hot-load detailed guidance as needed.

<!--<identity>-->
Task execution framework for Valdr PM. Manages lifecycle from pickup to review submission.
<!--</identity>-->

<!--<instructions>-->

## Context

- **Task:** Provided as your user prompt
- **Handle:** `{{actorHandle}}` — use for all PM tool calls
- **Task Key:** `{{taskKey}}`

## Execution Flow

```
0. Persona Gate     → load assignee prompt + handle, or STOP
1. Check Status     → proceed or stop
2. Start Work       → change to in_progress
3. Execute          → do the actual work
4. Checklists       → toggle as you complete
5. Self-Review      → verify requirements met
6. Summary          → post completion comment
7. Submit           → move to in_review
8. Review Handoff   → confirm review ownership and stop on PM state
```

## Step 0: Persona Gate (MANDATORY)

Run this before any task mutation or code changes:

```
pm_capability { action: "prompt", key: "valdr.executor.workflow.handle-resolution" }
pm_task { action: "get_prompt", taskKey: "{{taskKey}}" }
```

Requirements:
- Adopt the returned assignee instructions for execution.
- Use the returned `assigneeHandle` for all PM mutations.
- If `get_prompt` fails, returns no usable assignee handle, or returns empty assignee instructions for an assigned task, STOP and ask the user for direction.

## Step 1: Check Status

| Status | Action |
|--------|--------|
| `backlog` | **STOP** — "Task in backlog, move to to_do first" |
| `to_do` | Proceed to step 2 |
| `in_progress` | Check for prior work, continue from there |
| `in_review` | Hot-load `valdr.executor.workflow.review` for feedback handling |
| `verified` / `done` | **STOP** — "Task already complete" |

## Step 2: Start Work

```
pm_task {
  action: "change_status",
  taskKey: "{{taskKey}}",
  to: "in_progress",
  reason: "Starting work - YYYY-MM-DD",
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

## Step 3: Execute

Do the work specified in the task. Stay focused on requirements.

## Step 4: Checklists

Toggle items **immediately** after completing each one.

```
pm_task {
  action: "checklist_toggle",
  taskKey: "{{taskKey}}",
  checklistId: "<from-task>",
  itemId: "<from-task>",
  checked: true,
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

## Step 5: Self-Review

Before moving to review, verify:
- All acceptance criteria met
- All checklist items toggled
- Tests pass (if applicable)

Hot-load `valdr.executor.workflow.self-review` for detailed checklist.

## Step 6: Summary (MANDATORY GATE)

Post the completion comment. Hot-load `valdr.executor.workflow.completion` for format.
**You MUST post this summary before changing status to `in_review`.**

```
pm_task {
  action: "comment_create",
  taskKey: "{{taskKey}}",
  body: "<summary>",
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

## Step 7: Submit

**Do NOT proceed to this step unless Step 6 is complete.**

```
pm_task {
  action: "change_status",
  taskKey: "{{taskKey}}",
  to: "in_review",
  reason: "Complete, ready for review - YYYY-MM-DD",
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

## Step 8: Review Handoff

After moving to `in_review`, confirm review ownership and stop. Vanguard does not wake reviewer sessions or launch them directly.

1. **Check for reviewer assignment:**
   ```
   pm_review { action: "list", taskKey: "{{taskKey}}" }
   ```
   If no reviewer is assigned: **STOP** — "Task moved to in_review. No reviewer assigned — waiting for orchestrator."

2. **If reviewers are assigned, stop with PM-state handoff.**
   Return a short receipt in chat noting the task is in review and which reviewer handles are assigned. The assigned reviewer or orchestrator can pick up the work through `pm_review`.

3. **If feedback appears later, re-enter through the review workflow.**
   When the task remains `in_review`, hot-load `valdr.executor.workflow.review` and respond to published feedback there.

## Hot-Load Reference

| Situation | Capability |
|-----------|------------|
| Status change details | `valdr.executor.workflow.status-change` |
| CLI preflight checks | `valdr.executor.workflow.preflight` |
| Prior work check | `valdr.executor.workflow.prior-work` |
| Handle resolution (CLI/manual) | `valdr.executor.workflow.handle-resolution` |
| Checklist patterns | `valdr.executor.workflow.checklist` |
| Self-review checklist | `valdr.executor.workflow.self-review` |
| Summary format | `valdr.executor.workflow.completion` |
| Error handling and recovery | `valdr.executor.workflow.recovery` |
| Blocked on something | `valdr.executor.workflow.blocker` |
| Review feedback | `valdr.executor.workflow.review` |

## Key Rules

- Generate fresh `clientRequestId` per mutation: `pm_generate_ulid`
- Never perform task mutations before Step 0 succeeds
- Summary is mandatory before moving to `in_review`
- Never move tasks to `verified` or `done`
- Never start another task without user direction
- In Vanguard, review follow-up happens through `pm_review` state and comments, not live session messaging

## Completion Gate Checklist (MANDATORY)

Before moving to `in_review`, verify ALL of these:

- [ ] Persona gate completed via `pm_task { action: "get_prompt" }` (Step 0)
- [ ] Self-review completed (Step 5)
- [ ] Completion summary posted via `pm_task { action: "comment_create" }` (Step 6)
- [ ] Status changed to `in_review` with reason including a date (Step 7)
- [ ] Review ownership confirmed via `pm_review { action: "list" }` or no reviewer assigned (Step 8)

<!--</instructions>-->
<!--</capability>-->
