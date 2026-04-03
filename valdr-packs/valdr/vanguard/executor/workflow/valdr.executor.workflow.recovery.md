<!--<capability id="valdr.executor.workflow.recovery" pack="valdr" role="workflow">-->
# Error Handling and Recovery

<!--<identity>-->
Shared patterns for handling errors and resuming interrupted work.
<!--</identity>-->

<!--<instructions>-->

## Error Handling

### pm_task (action: get) — Task Not Found

```
STOP. Verify the task key.
→ Check for typos
→ Use pm_task { action: "search" } to find correct task
→ If still not found: "Task <key> not found in project."
```

### pm_task (action: change_status) Fails

| Error | Recovery |
|-------|----------|
| "Invalid transition" | Fetch task to check current status — may have stale state |
| "Task not found" | Verify task key, use search if needed |
| "Already in status X" | Task was already transitioned — proceed to next step |

**Note:** If transitioning to `in_progress` fails because task is already `in_progress`, continue working.

### pm_task (action: checklist_toggle) Fails

| Error | Recovery |
|-------|----------|
| "Checklist not found" | Re-fetch task — IDs may have changed |
| "Item not found" | Re-fetch task — item may have been removed |
| "Already checked" | Item was already toggled — continue to next item |

**Recovery pattern:**

```
1. pm_task { action: "get" } — refresh task state
2. Re-extract checklist and item IDs from fresh response
3. Retry toggle with correct IDs
4. If still fails, report error to user
```

### pm_task (action: update) Fails

| Error | Recovery |
|-------|----------|
| "Task not found" | Verify task key exists |
| "Validation error" | Check field formats (tags = strings, links need kind+uri) |

### pm_generate_ulid Fails

```
This should not fail under normal circumstances.
→ If it does, check MCP server status
→ Do not attempt to generate ULIDs manually
```

## General Recovery Principles

1. **Re-fetch before retry** — Always call `pm_task { action: "get" }` to refresh state
2. **Idempotency is your friend** — If unsure whether previous call succeeded, fetch current state
3. **Don't mask errors** — If recovery fails after one retry, report to user
4. **Preserve audit trail** — Use fresh `clientRequestId` for each retry

## Session Recovery (Resuming Interrupted Work)

If session was interrupted (context limit, crash, timeout):

### Step 1: Assess Current State

```
pm_task { action: "get", taskKey: "<task-key>" }
```

Check:
- **status**: Where in the workflow is the task?
- **metadata.checklists**: Which items are already checked?
- **assigneeHandle**: Who was working on it?

### Step 2: Check Prior Work

```
pm_task { action: "comment_list", taskKey: "<task-key>" }
pm_task { action: "event_list", taskKey: "<task-key>", limit: 20 }
```

Look for:
- Status change events (when did it move to `in_progress`?)
- Comments documenting partial work
- Checklist toggle events

### Step 3: Resume Strategy

| Scenario | Action |
|----------|--------|
| `in_progress`, some items checked | Continue from unchecked items |
| `in_progress`, no items checked | Start from beginning of implementation |
| `to_do`, no prior work | Normal start — follow standard workflow |
| `in_review` or beyond | **STOP** — Task is past your scope |

### Step 4: Document the Resume

Post a note when resuming:

```
pm_task {
  action: "comment_create",
  taskKey: "<task-key>",
  body: "## Session Resume Note\n\n**Date:** YYYY-MM-DD\n\nResumed from interrupted session.\n\n**Prior work:**\n- Items 1-3 were already completed\n- Continuing from item 4...",
  actorHandle: "<your-handle>",
  clientRequestId: "<fresh-ulid>"
}
```

## Recovery Principles

1. **Don't duplicate work** — Check what's already done before restarting
2. **Don't re-toggle checked items** — Fetch fresh state first
3. **Preserve audit trail** — Document the resume in a comment
4. **Verify, don't assume** — Always fetch before any action

## Revision Cycle Recovery

When a task has `changes_requested` review status:

### Step 1: Identify the Review

```
pm_review { action: "list", taskKey: "<task-key>" }
```

Find the review with status `changes_requested`.

### Step 2: Get Review Comments

```
pm_task { action: "comment_list", taskKey: "<task-key>", reviewId: "<review-id>" }
```

### Step 3: Follow Revision Workflow

See `valdr.executor.workflow.review` for handling review feedback.

```
in_review (changes_requested) → in_progress (fixes) → in_review (re-review)
```

## When to Escalate to User

Always escalate when:
- MCP server is unreachable
- Task key doesn't exist and can't be found
- Status transition errors persist after retry
- Unclear which task to resume
- Conflicting prior work from different actors
- Blocker that can't be resolved autonomously

**Escalation format:**

```
## Issue Encountered

**Task:** <task-key>
**Error:** <error message or situation>
**Attempted:** <what you tried>
**Need:** <what you need from user>
```

<!--</instructions>-->
<!--</capability>-->
