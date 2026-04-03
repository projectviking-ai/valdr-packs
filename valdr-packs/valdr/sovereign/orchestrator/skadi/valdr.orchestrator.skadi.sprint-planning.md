<!--<capability id="valdr.orchestrator.skadi.sprint-planning" pack="valdr" role="workflow">-->
# Sprint Planning Workflow

<!--<identity>-->
Operational workflow for shaping sprint scope and keeping sprint lifecycle state consistent.
<!--</identity>-->

<!--<instructions>-->

## Inputs

Required:
- `projectKey`

Optional:
- Sprint date boundaries (if omitted, default to a 7-day window starting today)
- Sprint goal
- Velocity target
- Readiness preferences (specific executor/reviewer handles, or permission to auto-assign)

## Workflow

### 1. Preflight Project Context

1. `pm_project { action: "get", key: "<projectKey>" }`
2. `pm_sprint { action: "list", projectKey: "<projectKey>" }`
3. `pm_task { action: "search", projectKey: "<projectKey>", status: "backlog" }`
4. `pm_task { action: "search", projectKey: "<projectKey>", status: "to_do" }`

### 2. Resolve Sprint Intent

Choose one flow:

- **Kickoff flow**: create a planned/active sprint
- **Rollover flow**: close current sprint and prepare next sprint
- **Health flow**: validate existing sprint scope and status consistency

### 3. Resolve Optional Plan Context

1. If the user references a plan or requests plan-aligned sprint shaping, call `vmp { action: "list_plans", projectKey: "<projectKey>" }`
2. If a relevant plan exists, retrieve it:
   - `vmp { action: "get_plan", planKey: "<planKey>" }`
3. If no relevant plan exists, continue with ad hoc sprint shaping from explicit task keys or backlog/to-do selection and record that the sprint scope is not plan-backed

### 4. Create or Update Sprint State

For kickoff/rollover, create a sprint when needed:

```
pm_sprint {
  action: "create",
  projectKey: "<projectKey>",
  name: "<Sprint Name>",
  startTs: <epoch-ms>,
  endTs: <epoch-ms>,
  goal: "<goal>",
  status: "planned" | "active",
  velocityTarget: <target-int>
}
```

Timestamp guardrails:
- `startTs` and `endTs` are required by `pm_sprint create`
- If no explicit dates are provided, compute defaults in UTC:
  - `startTs`: current day at 00:00:00 UTC
  - `endTs`: `startTs + 7 days`
- Validate `endTs > startTs` before mutation

### 5. Build Sprint Scope Draft

From backlog and to-do tasks:

- If a relevant plan is loaded, include tasks that map to the selected plan requirements
- If no plan is loaded, include explicit user-selected tasks or the best-fit backlog/to-do tasks for the stated sprint goal
- Exclude tasks blocked by missing dependencies or missing owners
- Record scope rationale for each included task, including whether selection came from a plan or ad hoc sprint shaping

### 6. Persist Sprint Scope with Deterministic Link Operations

Do **not** attempt sprint-task assignment through `pm_task update`.

1. Query current persisted sprint membership:
   - `pm_task { action: "search", projectKey: "<projectKey>", sprintId: "<sprintId>", limit: 500 }`
2. Compute desired membership from the sprint scope draft.
3. For each task entering sprint scope:
   - `pm_sprint { action: "link_task", sprintId: "<sprintId>", taskId: "<taskId>", actorHandle: "skadi", clientRequestId: "<ulid>" }`
4. For each task leaving sprint scope:
   - `pm_sprint { action: "unlink_task", sprintId: "<sprintId>", taskId: "<taskId>", actorHandle: "skadi", clientRequestId: "<ulid>" }`
5. Re-query membership and include persisted results in the summary.

Required output:
- Explicit "In-sprint task keys" list in summary
- Explicit "Linked this run" / "Unlinked this run" list

### 7. Enforce Sprint Readiness Gate

Before reporting sprint prep complete, evaluate every in-sprint task against required readiness checks:

- Status is `to_do`
- Assignee is set
- `priority` and `points` are set
- At least one reviewer assignment exists

Readiness workflow:

1. Use the persisted in-sprint task list from Step 6.
2. For each task, confirm state:
   - Task shape/status/assignee/priority/points via `pm_task { action: "get", taskKey: "<taskKey>" }`
   - Reviewer coverage via `pm_review { action: "list", taskKey: "<taskKey>" }`
3. Build a readiness gap report by category.
4. If any gaps exist, ask targeted user questions and apply approved fixes.

Required user prompts when gaps exist:

- Status normalization:
  - `Some sprint tasks are not in to_do. I can move backlog tasks to to_do. Tasks already in in_progress/in_review/verified/done cannot be moved backward during sprint prep. Would you like me to normalize backlog tasks now and list non-eligible tasks for scope decisions?`
- Missing assignee:
  - `Task <taskKey> does not have an assigned executor. Do you have one in mind, or should I choose the best available executor?`
- Missing priority/points:
  - `Some sprint tasks are missing priority and/or points. Would you like me to evaluate and set them now?`
- Missing reviewer:
  - `Task <taskKey> has no reviewer assignment. Do you have one in mind, should I choose a reviewer, or should I skip for now?`

Approved fix actions:

1. Status normalization:
   - If user approves, move only `backlog` tasks to `to_do` with `pm_task { action: "change_status", ... }`
   - Include `actorHandle: "skadi"` and fresh `clientRequestId` per mutation
   - Use reason: `skadi sprint-readiness normalization`
   - Do not move tasks backward from `in_progress`, `in_review`, `verified`, or `done`; report them as non-eligible for sprint prep normalization and ask user whether to keep, re-scope, or handle manually
2. Assignee coverage:
   - Resolve deterministic executor order:
     1. User-provided handle
     2. `task-executor` when available
     3. First executor handle in lexicographic order
   - Apply `pm_task { action: "update", taskKey: "<taskKey>", assignee: "<executorHandle>", actorHandle: "skadi", clientRequestId: "<ulid>" }`
3. Priority/points coverage:
   - Do not overwrite existing values unless user requests override
   - If user approves auto-fill:
     1. Hot-load sizing guide: `pm_capability { action: "prompt", key: "valdr.core.sizing.ai-story-points" }`
     2. Prefer plan-derived values when available
     3. Evaluate each task against the sizing guide dimensions (complexity, surface area, uncertainty, coordination, risk) and assign Fibonacci points (1, 2, 3, 5, 8, 13)
     4. If a task exceeds 13 points, flag it for splitting instead of assigning points
     5. For priority, derive from the sizing assessment: 1 (critical/high-risk) through 5 (trivial)
   - **CRITICAL: `priority` and `points` must be numeric integers, not strings.** Pass `priority: 3` not `priority: "3"`. The `pm_task` schema enforces `type: number` — string values will fail validation.
   - Apply `pm_task { action: "update", taskKey: "<taskKey>", priority: 3, points: 5, actorHandle: "skadi", clientRequestId: "<ulid>" }`
   - Include the one-sentence justification as a task comment
4. Reviewer coverage:
   - Resolve deterministic reviewer order:
     1. User-provided handle
     2. `sigrid` when available
     3. First reviewer handle in lexicographic order
   - Start assignment with:
     - `pm_review { action: "start", taskKey: "<taskKey>", reviewerHandles: ["<reviewerHandle>"], summary: "Skadi sprint readiness reviewer assignment", requestedByHandle: "skadi", clientRequestId: "<ulid>" }`

After all approved mutations, re-check every readiness criterion and report pass/fail.

### 8. Publish Sprint Plan Summary

Return:
- Sprint identity (name, dates, status)
- Planned task list
- Out-of-scope list with reasons
- Readiness gate report:
  - Tasks failing `to_do`
  - Tasks missing assignee
  - Tasks missing priority/points
  - Tasks missing reviewer
- Explicit open decisions when user input is still required

## Decision Rules

- Do not activate a sprint with zero candidate tasks
- If a plan is loaded, do not expand scope beyond plan boundaries without explicit user approval
- Prefer closing stale sprints before creating overlapping active sprints
- Do not report sprint scope as finalized until post-mutation membership is verified via `pm_task search` with `sprintId`
- Do not move a sprint to `active` until readiness gate passes or the user explicitly waives specific readiness checks
- Do not move task statuses backward during sprint prep normalization

## Anti-Patterns (DO NOT)

1. Create sprints without validating either the loaded plan scope or the explicit ad hoc task scope
2. Mix rollover and kickoff actions in one mutation burst
3. Treat `backlog` tasks as sprint-ready without staffing checks
4. Mutate sprint membership through `pm_task update` instead of `pm_sprint` `link_task`/`unlink_task`
5. Report sprint prep complete when any in-sprint task is missing status/assignee/priority-points/reviewer coverage without surfacing a user decision
6. Move `in_progress`, `in_review`, `verified`, or `done` tasks back to `to_do` as part of sprint prep
7. Pass `priority` or `points` as strings — these must be numeric integers (e.g., `priority: 3` not `priority: "3"`)

<!--</instructions>-->
<!--</capability>-->
