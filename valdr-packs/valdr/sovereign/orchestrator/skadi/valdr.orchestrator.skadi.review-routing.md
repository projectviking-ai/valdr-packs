<!--<capability id="valdr.orchestrator.skadi.review-routing" pack="valdr" role="workflow">-->
# Review Routing Workflow

<!--<identity>-->
Workflow for assigning reviewers to in-review tasks and ensuring review queue continuity.
<!--</identity>-->

<!--<instructions>-->

## Inputs

Required:
- `projectKey`

Optional:
- Preferred reviewer handles

## Workflow

### 1. Load In-Review Tasks

`pm_task { action: "search", projectKey: "<projectKey>", status: "in_review" }`

### 2. Load Reviewer Pool

1. `pm_agent { action: "list", defaultRoles: ["reviewer"] }`
2. Build deterministic reviewer order:
   1. User-specified reviewer first
   2. Domain/tag match
   3. Lexicographic fallback

### 3. Detect Missing Review Assignments

For each in-review task:

1. `pm_review { action: "list", taskKey: "<taskKey>" }`
2. If at least one assignment exists, skip task
3. If none exist, prepare review start action

### 4. Start Reviews

For each uncovered task:

```
pm_review {
  action: "start",
  taskKey: "<taskKey>",
  reviewerHandles: ["<reviewerHandle>"],
  summary: "Skadi review routing assignment",
  actorHandle: "skadi"
}
```

### 5. Verify Review Readiness

After assignment:

`pm_review { action: "verify_ready", taskKey: "<taskKey>" }`

If not ready, flag task and include corrective next steps.

## Launching Reviewer Sessions

**Critical:** Reviewer sessions must be launched via `pm_review launch_reviewer`, **never** via `pm_session launch_task`.

### Why This Matters

| Launch Path | Worktree Behavior | `launchReason` |
|-------------|-------------------|----------------|
| `pm_review { action: "launch_reviewer" }` | **Attaches to executor's worktree** — shared path and branch, no new worktree created | `review-from:<executorSessionUlid>` |
| `pm_session { action: "launch_task" }` | **Creates a new separate worktree** — reviewer cannot see executor's uncommitted work | `task:<taskKey>` |

If reviewers are launched with `pm_session launch_task`, they get their own worktree and cannot inspect the executor's actual working state (uncommitted changes, local-only artifacts). This causes reviewers to report "not committed" or "not found" for work that exists in the executor's worktree.

### Launch Reviewer Flow

**Prerequisites:**
- The task must have an **active executor session** with a worktree
- The reviewer must be assigned via `pm_review start` (Step 4 above)

**Steps:**

1. Resolve the executor session for the task:
   ```
   pm_session { action: "list", contextRef: "TASK-<taskKey>" }
   ```
   Find the session with `role: "executor"` and status `active` or `running`. Extract `sessionUlid` — this is the `sourceSessionUlid`.

2. Generate a fresh ULID:
   ```
   pm_generate_ulid
   ```

3. Launch the reviewer session:
   ```
   pm_review {
     action: "launch_reviewer",
     clientRequestId: "<ulid>",
     taskKey: "<taskKey>",
     sourceSessionUlid: "<executorSessionUlid>",
     agentHandle: "<reviewerHandle>",
     actor: "@skadi",
     launcherConfigKey: "coder-codex",          // optional preset override
     prompt: "Review for correctness only.",    // optional first-turn override
     systemPrompt: "You are a strict reviewer", // optional system override
     config: { temperature: 0.1 },              // optional preset config overrides
     run: true
   }
   ```

   **Parameter notes:**
   - `sourceSessionUlid` is **required** — this connects the reviewer to the executor's worktree
   - `agentHandle` — the reviewer agent's registered handle (required for token tracking, same as executor launches)
   - `launcherConfigKey` (optional) applies launch preset behavior like executor launches; provider mismatch returns an explicit error
   - `prompt` (optional) overrides the first turn message
   - `systemPrompt` (optional) overrides generated reviewer system prompt
   - `config` (optional) applies launch-time config overrides
   - `run: true` to auto-start the reviewer session

4. Verify the launch result includes:
   - `sessionUlid`
   - `worktreePath` matching the executor's worktree path
   - `branchName` matching the executor's branch

### Multiple Reviewers

When launching multiple reviewers for the same task, use the **same `sourceSessionUlid`** (the executor session) for each. All reviewers attach to the same executor worktree.

## Review Routing Policy

- Every `in_review` task must have at least one reviewer assignment
- Prefer stable reviewer/task mapping within a sprint
- Avoid reassigning active review work unless explicitly requested
- Always launch reviewer sessions via `pm_review launch_reviewer` with `sourceSessionUlid`

## Anti-Patterns (DO NOT)

1. Start duplicate reviews when one already exists
2. Assign reviewers not registered with reviewer default role
3. Mark routing complete without readiness verification
4. **Launch reviewer sessions with `pm_session launch_task`** — this creates separate worktrees and reviewers cannot see the executor's working state
5. Launch a reviewer without `sourceSessionUlid` — the executor worktree attachment will fail
6. Launch a reviewer without `agentHandle` — token tracking will attribute to `UNKNOWN_AGENT_HANDLE`

<!--</instructions>-->
<!--</capability>-->
