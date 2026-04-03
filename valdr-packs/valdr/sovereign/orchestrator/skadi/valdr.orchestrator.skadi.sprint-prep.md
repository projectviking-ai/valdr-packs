<!--<capability id="valdr.orchestrator.skadi.sprint-prep" pack="valdr" role="workflow">-->
# Sprint Prep Workflow

<!--<identity>-->
End-to-end sprint preparation from a plan — creates the sprint, links tasks, and autonomously normalizes all readiness gates with a single confirmation checkpoint.
<!--</identity>-->

<!--<instructions>-->

## Purpose

This workflow replaces the manual back-and-forth of sprint-planning's readiness gate. Instead of asking per-category questions, sprint-prep collects defaults upfront, confirms once, then runs the full normalization autonomously.

Use this workflow when the user says things like:
- "Prepare a sprint from plan X"
- "Sprint prep from plan_20260219_002"
- "Set up a sprint for this plan"
- "Create and prepare sprint from plan X"

## Inputs

Required:
- `planKey` — the VMP plan to build the sprint from

Optional (collected at confirmation checkpoint if not provided):
- `assignee` — default executor handle for all tasks (default: resolve from executor pool)
- `reporter` — reporter handle for all tasks (default: none, skip if not provided)
- `reviewer` — default reviewer handle (default: `sigrid` if available, else first reviewer)
- `sprintWindow` — start/end dates (default: 7-day window starting tomorrow at 00:00 UTC)
- `sprintName` — override sprint name (default: derived from plan title)
- `autoSize` — whether to evaluate and assign points/priority (default: `true`)

## Workflow

### Phase 1: Discovery

1. Resolve the plan:
   - `vmp { action: "get_plan", planKey: "<planKey>" }`
   - Extract: plan title, project key, plan task list
   - If plan not found, STOP with error

2. Resolve the project:
   - `pm_project { action: "get", key: "<projectKey>" }`

3. Check for existing sprints:
   - `pm_sprint { action: "list", projectKey: "<projectKey>" }`
   - If an active or planned sprint already exists for overlapping dates, warn the user

4. Resolve agent pools:
   - `pm_agent { action: "list", defaultRoles: ["executor"] }` → executor pool
   - `pm_agent { action: "list", defaultRoles: ["reviewer"] }` → reviewer pool

5. Resolve plan tasks:
   - For each plan task, look up the corresponding PM task:
     - `pm_task { action: "search", projectKey: "<projectKey>" }` filtered to plan task keys
   - Record current state of each task (status, assignee, reviewer, priority, points)

### Phase 2: Prep Plan — Single Confirmation Checkpoint

Present the user with a prep plan before executing any mutations:

```markdown
## Sprint Prep Plan

**Plan:** <planKey> — <plan title>
**Project:** <projectKey>
**Sprint window:** <startDate> to <endDate>
**Tasks:** <count> tasks from plan

### Prep actions (pending your approval):

| Task | Current Status | Will Set |
|------|---------------|----------|
| <taskKey> | backlog, no assignee, no reviewer, no points | → to_do, @<assignee>, reviewer @<reviewer>, evaluate points |
| ... | ... | ... |

### Defaults:
- **Assignee:** @<resolved-assignee>
- **Reporter:** @<reporter> (if provided)
- **Reviewer:** @<resolved-reviewer>
- **Sizing:** Auto-evaluate points and priority

Approve to proceed, or override any defaults.
```

**IMPORTANT:** Wait for explicit user approval before proceeding to Phase 3. The user may:
- Approve as-is → proceed
- Override specific defaults → apply overrides, then proceed
- Cancel → stop

### Phase 3: Sprint Creation

1. Generate sprint name (if not overridden):
   - Format: `Sprint: <plan title>`

2. Compute sprint window:
   - Default: tomorrow 00:00 UTC → +7 days
   - Override with user-provided dates

3. Create the sprint:
   ```
   pm_sprint {
     action: "create",
     projectKey: "<projectKey>",
     name: "<sprintName>",
     startTs: <epoch-ms>,
     endTs: <epoch-ms>,
     status: "planned"
   }
   ```

4. Link all plan tasks to the sprint:
   - For each task: `pm_sprint { action: "link_task", sprintId: "<sprintId>", taskId: "<taskId>", actorHandle: "skadi", clientRequestId: "<ulid>" }`

5. Verify sprint membership:
   - `pm_task { action: "search", projectKey: "<projectKey>", sprintId: "<sprintId>" }`

### Phase 4: Batch Task Normalization

Process all sprint tasks in a single pass. For each task:

#### 4a. Status Normalization
- If `backlog` → `pm_task { action: "change_status", taskKey: "<taskKey>", to: "to_do", reason: "skadi sprint-prep normalization", actorHandle: "skadi", clientRequestId: "<ulid>" }`
- If already `to_do` → skip
- If `in_progress`/`in_review`/`verified`/`done` → do NOT move backward; flag in summary as non-standard but keep in sprint

#### 4b. Assignee
- If no assignee → set to the confirmed default:
  `pm_task { action: "update", taskKey: "<taskKey>", assignee: "<assignee>", actorHandle: "skadi", clientRequestId: "<ulid>" }`
- If assignee already set → keep existing (do not overwrite)

#### 4c. Reporter
- If reporter was provided and task has no reporter → set it:
  `pm_task { action: "update", taskKey: "<taskKey>", reporter: "<reporter>", actorHandle: "skadi", clientRequestId: "<ulid>" }`

#### 4d. Reviewer Assignment
- Check existing: `pm_review { action: "list", taskKey: "<taskKey>" }`
- If no review exists → start one:
  `pm_review { action: "start", taskKey: "<taskKey>", reviewerHandles: ["<reviewer>"], summary: "Skadi sprint-prep reviewer assignment", requestedByHandle: "skadi", clientRequestId: "<ulid>" }`
- If review already exists → skip

#### 4e. Points and Priority (Sizing)
- If `autoSize` is true and task is missing `priority` or `points`:
  1. Hot-load sizing guide: `pm_capability { action: "prompt", key: "valdr.core.sizing.ai-story-points" }`
  2. Evaluate each task against sizing dimensions (complexity, surface area, uncertainty, coordination, risk)
  3. Assign Fibonacci points (1, 2, 3, 5, 8, 13) — flag tasks exceeding 13 for splitting
  4. Derive priority: 1 (critical) through 5 (trivial)
  5. **CRITICAL: `priority` and `points` must be numeric integers, not strings.** Pass `priority: 3` not `priority: "3"`. The `pm_task` schema enforces `type: number` — string values will fail validation.
   6. Apply: `pm_task { action: "update", taskKey: "<taskKey>", priority: 3, points: 5, actorHandle: "skadi", clientRequestId: "<ulid>" }`
  7. Add sizing rationale comment:
     `pm_task { action: "comment_create", taskKey: "<taskKey>", body: "<one-sentence rationale>", actorHandle: "skadi" }`
- If task already has points and priority → keep existing

### Phase 5: Readiness Verification

After all mutations, verify the full readiness gate:

1. Re-fetch all sprint tasks:
   - `pm_task { action: "search", projectKey: "<projectKey>", sprintId: "<sprintId>" }`
2. For each task, verify:
   - `pm_task { action: "get", taskKey: "<taskKey>" }` → status, assignee, priority, points
   - `pm_review { action: "list", taskKey: "<taskKey>" }` → reviewer coverage
3. Build final readiness report

### Phase 6: Activate Sprint

**If all readiness checks pass**, activate the sprint:

```
pm_sprint {
  action: "update",
  sprintId: "<sprintId>",
  status: "active",
  actorHandle: "skadi",
  clientRequestId: "<ulid>"
}
```

Verify the activation:
```
pm_sprint { action: "get", sprintId: "<sprintId>" }
```
Confirm `status` is `active` before reporting.

**If readiness checks have failures**, do NOT activate. Keep the sprint as `planned`, report the failures, and let the user decide whether to waive checks or fix gaps first.

### Phase 7: Summary Report

```markdown
## Sprint Prep Complete

**Sprint:** <sprintName>
**ID:** <sprintId>
**Status:** <active (readiness passed) | planned (readiness failures — see below)>
**Window:** <startDate> to <endDate>
**Linked:** <task-key-list>

### Readiness Gate
- status_to_do: <pass|fail> (<details>)
- assignee_coverage: <pass|fail>
- priority_points: <pass|fail>
- reviewer_coverage: <pass|fail>

### Task Summary
| Task | Status | Assignee | Reviewer | Points | Priority |
|------|--------|----------|----------|--------|----------|
| <taskKey> | to_do | @<handle> | @<handle> | <pts> | <prio> |
| ... | ... | ... | ... | ... | ... |

### Sizing Rationale
- <taskKey>: <one-sentence rationale>
- ...

### Next Steps
- Launch tasks: hot-load `valdr.orchestrator.skadi.launch-readiness` per task
```

If readiness gate has failures, include specific remediation guidance per failure.

## Relationship to Other Workflows

Sprint-prep **composes** the logic from these existing workflows but runs them as a unified batch rather than individual interactive flows:

| Existing Workflow | How Sprint-Prep Uses It |
|-------------------|------------------------|
| `sprint-planning` | Phase 1 discovery + Phase 3 sprint creation/linking |
| `task-staffing` | Phase 4b assignee resolution |
| `review-routing` | Phase 4d reviewer assignment |
| `launch-readiness` | Phase 5 readiness verification |
| `ai-story-points` | Phase 4e sizing evaluation |

Sprint-prep does NOT replace these workflows. They remain available for targeted single-concern operations. Sprint-prep is the "do it all at once" shortcut.

## Decision Rules

- Never skip the confirmation checkpoint (Phase 2) — the user must approve the prep plan
- Never overwrite existing assignees, reviewers, or sizing unless the user explicitly requests it
- Never move task statuses backward
- Always generate fresh `clientRequestId` ULIDs per mutation
- Always include `actorHandle: "skadi"` on mutations
- If a task exceeds 13 story points, flag it for splitting rather than assigning points
- If sizing guide cannot be hot-loaded, fall back to plan-derived values, then defaults (priority: 3, points: 3)

## Anti-Patterns (DO NOT)

1. Skip the confirmation checkpoint and start mutating immediately
2. Ask per-category readiness questions — that's what sprint-planning does; sprint-prep batches it
3. Overwrite existing task state (assignee, reviewer, points) without explicit user override
4. Mutate sprint membership through `pm_task update` instead of `pm_sprint link_task`
5. Move tasks backward in status during normalization
6. Report prep complete without post-mutation readiness verification
7. Activate a sprint before the readiness gate passes — only activate after Phase 5 confirms all checks pass
8. Pass `priority` or `points` as strings — these must be numeric integers (e.g., `priority: 3` not `priority: "3"`)

<!--</instructions>-->
<!--</capability>-->
