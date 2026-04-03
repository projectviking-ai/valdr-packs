<!--<capability id="valdr.orchestrator.skadi.launch-readiness" pack="valdr" role="workflow">-->
# Launch Readiness Workflow

<!--<identity>-->
Workflow for verifying a task is ready for agent execution. Does not launch — hot-load `valdr.orchestrator.skadi.launch-executor` once readiness is confirmed and the user instructs launch.
<!--</identity>-->

<!--<instructions>-->

## Purpose

Use this workflow when a task must be validated as launch-ready before dispatching an executor.

Launch-ready means:
- Task has an assignee (executor)
- Task has reviewer coverage
- Task status is `to_do`
- Task has `priority` and `points`

## Required Inputs

- `taskKey`

Optional:
- preferred `assigneeHandle`
- preferred `reviewerHandle`
- preferred `priority`
- preferred `points`

## Step 1: Load Current State

1. `pm_task { action: "get", taskKey: "<taskKey>" }`
2. `pm_review { action: "list", taskKey: "<taskKey>" }`
3. `pm_session { action: "list", contextRef: "TASK-<taskKey>" }` (optional for observability)

## Step 2: Ensure Assignee Coverage

The assignee must be a **registered agent handle** from the agent registry. This handle is passed as `agentHandle` during launch and is used for token attribution — if missing or wrong, token costs cannot be tracked per agent.

If task assignee is missing:

1. `pm_agent { action: "list", defaultRoles: ["executor"] }`
2. Choose assignee deterministically:
   1. Explicit user-provided assignee
   2. `task-executor` if present
   3. First executor handle in lexicographic order
3. **Verify the handle exists in the registry:** `pm_agent { action: "get", handle: "<executorHandle>" }` — must succeed.
4. `pm_task { action: "update", taskKey: "<taskKey>", assignee: "<executorHandle>" }`

If task already has an assignee, keep it unless user requests override. In either case, **confirm the assignee handle is a valid registered agent** before passing to launch-executor.

## Step 3: Ensure Reviewer Coverage

If no review assignments exist:

1. `pm_agent { action: "list", defaultRoles: ["reviewer"] }`
2. Choose reviewer deterministically:
   1. Explicit user-provided reviewer
   2. `sigrid` if present
   3. First reviewer handle in lexicographic order
3. Generate `clientRequestId` with `pm_generate_ulid`
4. `pm_review { action: "start", taskKey: "<taskKey>", reviewerHandles: ["<reviewerHandle>"], summary: "Skadi prelaunch reviewer assignment", requestedByHandle: "skadi", clientRequestId: "<ulid>" }`

If at least one assignment exists, do not create duplicates.

## Step 4: Normalize Task Status to `to_do`

If status is not `to_do`, enforce launch staging:

- If status is `backlog`:
  - `pm_task { action: "change_status", taskKey: "<taskKey>", to: "to_do", reason: "skadi launch-readiness normalization before executor launch" }`
- If status is `in_progress`, `in_review`, `verified`, or `done`:
  - Stop and report a readiness blocker (no backward status moves allowed); ask user to pick a `backlog`/`to_do` task or handle status changes outside Skadi launch normalization

## Step 5: Ensure Priority/Points Coverage

If `priority` or `points` is missing:

1. Ask the user:
   - `Task <taskKey> is missing priority and/or points. Would you like me to evaluate and set them now?`
2. If approved:
   - Resolve values in this order:
     1. Explicit user-provided values
     2. Plan-derived values (if available)
     3. Fallback defaults: `priority: 3`, `points: 2`
   - Apply with:
     - `pm_task { action: "update", taskKey: "<taskKey>", priority: <1-5>, points: <0+> }`
3. If user declines, stop launch and report readiness blocker.

## Output Contract

When readiness is confirmed, report:

```markdown
# Readiness Result
Task: <taskKey>

## Status
- assignee: <handle> (registered agent handle — pass as `agentHandle` to launch-executor)
- reviewer: <handle or existing>
- status: to_do
- priority: <value>
- points: <value>

## Next Step
Task is launch-ready. Awaiting launch instruction.
Pass `agentHandle: "<handle>"` to launch-executor — this is required for token tracking.
```

Then wait for the user to instruct launch. When they do, hot-load `valdr.orchestrator.skadi.launch-executor`.

## Anti-Patterns (DO NOT)

1. Re-open or duplicate review assignments unnecessarily
2. Move `in_progress`/`in_review`/`verified`/`done` tasks backward to `to_do` during launch normalization
3. Launch when priority/points are missing and no user waiver exists
4. Proceed to launch without user confirmation after readiness check
5. Hot-load launch-executor before readiness is confirmed
6. Pass an assignee handle to launch-executor without verifying it exists in the agent registry — unregistered handles break token attribution

<!--</instructions>-->
<!--</capability>-->
