<!--<capability id="valdr.orchestrator.skadi.task-completion" pack="valdr" role="workflow">-->
# Task Completion & Advance Workflow

<!--<identity>-->
Workflow for closing out a finished and reviewed task — verify reviews, move to done, merge worktree, commit, and optionally launch the next task. This is the "finish line" workflow that bridges review approval to the next unit of work.
<!--</identity>-->

<!--<instructions>-->

## Purpose

Automate the end-of-task cycle that currently requires manual steps:

1. Verify reviews are approved
2. Move task to `done`
3. Merge the task's worktree branch and verify the merge (hot-load `valdr.orchestrator.skadi.worktree-merge`)
4. Purge task sessions (reviewer sessions first, then executor)
5. Launch the next sprint task

This workflow can be invoked as a single pass ("complete and advance") or stopped at any step.

## Mandatory Invariant: Code Continuity

**The next task executor launches from the local branch HEAD.** If the current task's worktree changes are not merged into the local branch, the next executor starts from stale code and cannot build on the completed work. This breaks the entire sprint chain.

Therefore: **Steps 4 (Purge) and 5 (Advance) CANNOT proceed unless `MERGE_VERIFIED = true`.**

See `valdr.orchestrator.skadi.worktree-merge` for the full merge gate workflow, including worktree inspection, auto-commit, and commit verification details.

If merge cannot be verified, **STOP the entire workflow**. Do not purge. Do not advance. Report the failure and wait for user direction.

## Required Inputs

- `taskKey` — the task to close out

Optional:
- `nextTaskKey` — explicit next task to launch (if not provided, Skadi picks from sprint backlog)
- `launcherConfigKey` — preset for next task launch
- `provider` — provider for next task launch
- `launchMode` — `standard` or `skill` (see launch-executor capability for details)
- `purgeSessions` — `true` to auto-purge all task sessions after merge, `false` to skip, omit to ask the user

## Step 1: Verify Reviews

Confirm all reviews are approved before proceeding.

1. Fetch task state:
   ```
   pm_task { action: "get", taskKey: "<taskKey>" }
   ```

2. Fetch review state:
   ```
   pm_review { action: "list", taskKey: "<taskKey>" }
   ```

3. Evaluate review status using `review.status` (not `verdict`):

   | Condition | Action |
   |-----------|--------|
   | All reviews have `status: "approved"` | Proceed to Step 2 |
   | Any review has `status: "changes_requested"` | Stop. Report which reviewer requested changes and what's needed |
   | Any review is still `pending` or `in_progress` | Stop. Report which reviews are incomplete. Offer to message the reviewer session |
   | No reviews exist | Stop. Report that no reviews were started. This should not happen for a completed task |

   **Field clarification:** The pass criterion is `review.status === "approved"` for every review assignment. Do not look for a `verdict` field — use `status`.

4. If reviews are not all approved, do **not** proceed. Report the blocker and wait for user direction.

## Step 2: Move Task to Done

Once reviews are verified:

1. If task status is `in_review`, transition through the required path:
   ```
   pm_task {
     action: "change_status",
     taskKey: "<taskKey>",
     to: "verified",
     reason: "All reviews approved — Skadi task-completion workflow",
     actorHandle: "skadi",
     clientRequestId: "<ulid>"
   }
   ```
   Then:
   ```
   pm_task {
     action: "change_status",
     taskKey: "<taskKey>",
     to: "done",
     reason: "Reviews approved, completing task — Skadi task-completion workflow",
     actorHandle: "skadi",
     clientRequestId: "<ulid>"
   }
   ```

2. If task is already `verified`, move directly to `done`.

3. If task is already `done`, skip this step.

4. Verify final state:
   ```
   pm_task { action: "get", taskKey: "<taskKey>" }
   ```
   Confirm status is `done` before proceeding.

## Step 3: Merge Worktree (Hot-Load Required)

**Hot-load `valdr.orchestrator.skadi.worktree-merge` and follow its complete workflow.**

This step covers worktree inspection, auto-commit of uncommitted work, pre-merge checks,
merge execution, and commit verification. The merge capability sets two flags:
- `WORKTREE_INSPECTED` — confirms the worktree was checked for both committed and uncommitted changes
- `MERGE_VERIFIED` — confirms the merge landed real file changes on the local branch

Both flags must be `true` before proceeding. Do not continue to Step 4 without them.

## Step 4: Purge Sessions

**Pre-condition: `MERGE_VERIFIED` must be `true`.** If the merge was not verified in Step 3, **do not purge**. Purging destroys worktrees — if work was not merged first, it is permanently lost.

Clean up all sessions associated with the completed task. Purging removes DB records, transcript files, and worktrees.

### 4a: Resolve Sessions

List all sessions for the task:

```
pm_session { action: "list", contextRef: "TASK-<taskKey>" }
```

Categorize sessions by role:
- **Reviewer / Auditor sessions** — role is `reviewer` or `auditor`
- **Executor session** — role is `executor`

If no sessions exist, skip this step.

### 4b: Confirm Purge

| `purgeSessions` Value | Action |
|-----------------------|--------|
| `true` (user pre-instructed at workflow start) | Proceed directly to purge — no confirmation needed |
| `false` | Skip purge entirely |
| Not provided | **Always ask the user** — never auto-purge |

When asking:

> Task `<taskKey>` has **<N>** session(s):
> - <N> executor, <N> reviewer, <N> auditor
>
> Purge all sessions? This deletes DB records, transcripts, and worktrees.

**Never auto-purge.** The user must either pre-instruct `purgeSessions: true` at the start of the workflow or explicitly confirm when prompted. There is no default-purge behavior.

### 4c: Purge Order

**Reviewer and auditor sessions must be purged first**, then the executor session. This is because reviewer/auditor worktrees may reference the executor's worktree — purging the executor first could leave dangling references.

1. **Purge each reviewer/auditor session:**
   ```
   pm_session {
     action: "purge",
     sessionUlid: "<reviewerSessionUlid>"
   }
   ```
   Repeat for each reviewer/auditor session.

2. **Purge the executor session:**
   ```
   pm_session {
     action: "purge",
     sessionUlid: "<executorSessionUlid>"
   }
   ```

3. **Verify cleanup:**
   ```
   pm_session { action: "list", contextRef: "TASK-<taskKey>" }
   ```
   Confirm no sessions remain for the task.

Report purge results (number of sessions purged, any errors).

## Step 5: Advance to Next Task

**Pre-condition: `MERGE_VERIFIED` must be `true`.** The next executor launches from the local branch HEAD. If the merge was not verified in Step 3, the next agent will start from stale code and cannot build on the completed task's work. **Do not advance.** Report the merge failure and stop.

### 5a: Verify Branch HEAD Before Advancing

Before identifying the next task, confirm the local branch HEAD in the **canonical repo root** (resolved in Step 3 via `valdr.orchestrator.skadi.worktree-merge`) contains the merged work:

```bash
git -C <canonicalRepoRoot> log --oneline -1
```

The output must show the merge commit from Step 3. If it does not, **STOP** — the merge did not land and advancing would launch the next executor on stale code.

### 5b: Identify Next Task

If `nextTaskKey` was provided, use it. Otherwise, find the next task from the sprint:

1. Get the sprint the completed task belonged to:
   ```
   pm_task { action: "get", taskKey: "<taskKey>" }
   ```
   Extract `sprintId`.

2. Search for the next ready task:
   ```
   pm_task { action: "search", projectKey: "<projectKey>", sprintId: "<sprintId>", status: "to_do" }
   ```

3. Pick the next task using this ordering:
   - **Same project prefix** (e.g., all `VALDR-*`): pick the numerically next task key. If completed task was `VALDR-2`, next is `VALDR-3`, then `VALDR-4`, etc. This applies regardless of gaps — `VALDR-2` → `VALDR-25` → `VALDR-99` is still numeric order.
   - **Mixed project prefixes** (e.g., `VALDR-BE-2`, `VALDR-WEB-3`): use the order the sprint returns them — pick the first `to_do` task in the list.
   - **Fallback**: if priority and points are set, use highest priority first (lowest number), then lowest points for tie-breaking.

4. If no `to_do` tasks remain in the sprint, report: "Sprint has no remaining to_do tasks. Sprint may be ready to close." and stop.

### 5c: Launch Next Task

Present the next task to the user before launching:

> **Next task:** `<nextTaskKey>` — <title>
> **Priority:** <priority> | **Points:** <points>
> **Assignee:** <handle>
> **Launch mode:** <standard or skill> | **Preset:** <launcherConfigKey>
>
> Ready to launch? Confirm and I'll check readiness and dispatch.

**Do not launch without user confirmation.**

### Launch Mode Continuity

Carry forward the launch configuration from the completed task unless the user specifies otherwise:

- **`launcherConfigKey`** — Reuse the same preset.
- **`launchMode`** — Reuse the same mode (`standard` or `skill`). If the previous task was launched with skill mode (i.e., the `prompt` field was used), default to skill mode for the next task.
- **`provider`** — Reuse the same provider.

If any of these were not captured from the previous launch, ask the user.

### Dispatch

Once confirmed, hot-load `valdr.orchestrator.skadi.launch-readiness` → then `valdr.orchestrator.skadi.launch-executor` and follow the readiness → launch flow.

For **skill mode** launches, ensure the `prompt` field is set in the `launch_task` call:
```
prompt: "Execute valdr task <nextTaskKey> using skill valdr-executor"
```

For **standard mode** launches, omit the `prompt` field and let the system build prompts from agent capabilities.

## Output Contract

```markdown
# Task Completion Summary
Task: <taskKey>

## Review Gate
- Reviews: <N> approved, <N> pending, <N> changes_requested
- Verdict: <PASSED or BLOCKED>

## Status
- Previous: <previous-status>
- Current: done

## Worktree Merge (from valdr.orchestrator.skadi.worktree-merge)
- Canonical repo root: <canonicalRepoRoot>
- REPO_RESOLVED: <YES / FAILED>
- WORKTREE_INSPECTED: <YES / SKIPPED>
- MERGE_VERIFIED: <YES / NO — gates purge AND advance>
- Merge commit: <hash>
- Files changed: <count>

## Session Purge (gated on MERGE_VERIFIED)
- Sessions purged: <N> (executor: <N>, reviewer: <N>, auditor: <N>)
- Status: <purged / skipped / user declined / BLOCKED (merge not verified)>

## Next Task (gated on MERGE_VERIFIED)
- Task: <nextTaskKey or "none remaining">
- Launch mode: <standard or skill>
- Preset: <launcherConfigKey>
- Base branch HEAD at launch: <hash — must match merge commit>
- Status: <launched / awaiting confirmation / sprint complete / BLOCKED (merge not verified)>
```

## Anti-Patterns (DO NOT)

1. Move task to `done` when reviews are not all approved
2. Force-merge or auto-resolve git conflicts — always stop and report
3. Discard or stash uncommitted changes without user permission
4. Launch next task without user confirmation
5. Skip the `verified` status when transitioning from `in_review` to `done`
6. Proceed past any blocking step — each step is a gate
7. Clean up worktrees or branches manually — worktree cleanup is handled by session purge
8. Purge the executor session before reviewer/auditor sessions — reviewers may reference the executor's worktree
9. Purge sessions without user confirmation unless `purgeSessions: true` was explicitly provided
10. Push to remote — this workflow is local merge and commit only
11. **Advance to the next task when `MERGE_VERIFIED` is not `true`** — the next executor launches from the local branch HEAD. Without a verified merge, it starts from stale code and cannot build on the completed task's work. This breaks the sprint chain
12. **Report "no-op merge" and proceed to advance** — a no-op merge means the work never reached the local branch. STOP. Do not purge. Do not advance. Report the failure

<!--</instructions>-->
<!--</capability>-->
