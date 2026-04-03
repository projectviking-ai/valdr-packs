<!--<capability id="valdr.orchestrator.skadi.task-staffing" pack="valdr" role="workflow">-->
# Task Staffing Workflow

<!--<identity>-->
Deterministic task staffing workflow for assigning execution owners to sprint tasks.
<!--</identity>-->

<!--<instructions>-->

## Inputs

Required:
- `projectKey`

Optional:
- `sprintId`
- Preferred executor handles
- Optional sprint scope corrections (`linkTaskIds`, `unlinkTaskIds`) when staffing runs also need membership reconciliation

## Workflow

### 1. Reconcile Sprint Membership (Optional)

If `sprintId` and explicit membership deltas are provided:

1. For each `taskId` in `linkTaskIds`:
   - `pm_sprint { action: "link_task", sprintId: "<sprintId>", taskId: "<taskId>", actorHandle: "skadi", clientRequestId: "<ulid>" }`
2. For each `taskId` in `unlinkTaskIds`:
   - `pm_sprint { action: "unlink_task", sprintId: "<sprintId>", taskId: "<taskId>", actorHandle: "skadi", clientRequestId: "<ulid>" }`
3. Never use `pm_task update` for sprint membership changes.

### 2. Discover Candidate Tasks

If `sprintId` is provided, query sprint-scoped tasks directly:

1. `pm_task { action: "search", projectKey: "<projectKey>", status: "to_do", sprintId: "<sprintId>" }`
2. `pm_task { action: "search", projectKey: "<projectKey>", status: "in_progress", sprintId: "<sprintId>" }`

Otherwise query all project tasks:

1. `pm_task { action: "search", projectKey: "<projectKey>", status: "to_do" }`
2. `pm_task { action: "search", projectKey: "<projectKey>", status: "in_progress" }`

### 3. Discover Executor Pool

1. `pm_agent { action: "list", defaultRoles: ["executor"] }`
2. Filter to handles aligned with project constraints
3. Exclude unavailable or deprecated agents

### 4. Build Assignment Plan

For each unassigned task:

- Pick one executor using deterministic ordering:
  1. Explicit user preference
  2. Domain tag match (task metadata vs agent tags)
  3. Lexicographic handle fallback

### 5. Apply Assignments

For each selected task:

```
pm_task {
  action: "update",
  taskKey: "<taskKey>",
  assignee: "<executorHandle>"
}
```

Then add traceability comment:

```
pm_task {
  action: "comment_create",
  taskKey: "<taskKey>",
  body: "Skadi staffing: assigned <executorHandle> based on sprint staffing policy.",
  actorHandle: "skadi"
}
```

### 6. Validate Coverage

After updates, re-query:

1. `pm_task { action: "search", projectKey: "<projectKey>", status: "to_do" }`
2. `pm_task { action: "search", projectKey: "<projectKey>", status: "in_progress" }`

Report any remaining unassigned tasks in either state as blockers.

## Staffing Policy

- One primary assignee per task
- Do not replace explicit human assignments unless requested
- Keep assignment policy transparent via comments

## Anti-Patterns (DO NOT)

1. Assign reviewers as executors by default
2. Overwrite explicit assignees without user approval
3. Declare staffing complete without re-checking task state
4. Treat sprint membership updates as `pm_task update` work instead of `pm_sprint` `link_task`/`unlink_task`

<!--</instructions>-->
<!--</capability>-->
