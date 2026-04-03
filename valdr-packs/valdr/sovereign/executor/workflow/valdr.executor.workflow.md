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
8. Reviewer Handoff → find reviewer session, re-engage or launch, wait for callback
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

## Step 8: Reviewer Handoff

After moving to `in_review`, check for an assigned reviewer and hand off to an existing reviewer session when possible.

1. **Check for reviewer assignment:**
   ```
   pm_review { action: "list", taskKey: "{{taskKey}}" }
   ```
   If no reviewer is assigned: **STOP** — "Task moved to in_review. No reviewer assigned — waiting for orchestrator."

2. **Discover current sessions for this task:**
   ```
   pm_session { action: "list", contextRef: "TASK-{{taskKey}}" }
   ```
   From this list:
   - Resolve your executor session as the most recent item where `role === "executor"` or `launchReason` starts with `task:`.
   - Resolve an existing reviewer session as the most recent item where `role === "reviewer"` or `launchReason` starts with `review-from:`.
     **Session status does not matter.** `pm_session input` wakes up and resumes closed/idle sessions — a `closed` session is a valid target.

3. **If a reviewer session exists, re-engage it (do not launch a duplicate):**
   ```
   pm_session {
     action: "input",
     sessionUlid: "<existing-reviewer-session-ulid>",
     prompt: "Re-review valdr task {{taskKey}} using skill valdr-reviewer. Executor session: <own-session-ulid>. Fixes are ready."
   }
   ```

4. **If no reviewer session exists at all, launch one:**
   ```
   pm_review {
     action: "launch_reviewer",
     taskKey: "{{taskKey}}",
     sourceSessionUlid: "<own-session-ulid>",
     agentHandle: "<reviewerHandle>",
     actor: "@{{actorHandle}}",
     clientRequestId: "<pm_generate_ulid>",
     prompt: "Review valdr task {{taskKey}} using skill valdr-reviewer. Executor session: <own-session-ulid>. When review is complete, notify the executor via pm_session input.",
     run: true
   }
   ```

5. **Capture the reviewer `sessionUlid` you used** (existing session from Step 3, or launch response from Step 4). You will need this to message the reviewer if changes are requested.

6. **Wait for reviewer callback.** The reviewer will message you via `pm_session input` with the review outcome.
   - If `approved`: **STOP** — task complete, waiting for verification gate.
   - If `changes_requested`: hot-load `valdr.executor.workflow.review` and address the feedback. After fixes, re-notify the reviewer (see review workflow).

If reviewer handoff fails (cannot resolve executor session, `pm_session input` fails, or `pm_review launch_reviewer` fails), **STOP** and report the error. Fall back to orchestrator-mediated review.

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
- Always re-engage an existing reviewer session first (even if closed — `input` wakes it up); launch only when no reviewer session exists at all

## Completion Gate Checklist (MANDATORY)

Before moving to `in_review`, verify ALL of these:

- [ ] Persona gate completed via `pm_task { action: "get_prompt" }` (Step 0)
- [ ] Self-review completed (Step 5)
- [ ] Completion summary posted via `pm_task { action: "comment_create" }` (Step 6)
- [ ] Status changed to `in_review` with reason including a date (Step 7)
- [ ] Reviewer handoff completed via existing session input or `pm_review { action: "launch_reviewer" }` (or no reviewer assigned) (Step 8)

<!--</instructions>-->
<!--</capability>-->
