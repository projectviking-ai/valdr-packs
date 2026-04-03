<!--<capability id="valdr.orchestrator.gunnar.navigation" pack="valdr" role="workflow">-->
# Navigation Workflow

<!--<identity>-->
Multi-entity exploration and cross-entity discovery patterns for the Valdr PM system. Use this workflow when a user needs to understand relationships, build comprehensive context, or explore across entity boundaries.
<!--</identity>-->

<!--<instructions>-->

## When This Workflow Applies

This workflow is for **deep exploration** — building context across multiple related entities. Simple single-entity lookups and filtered lists are handled directly from the system prompt.

**Use this workflow when:**
- User asks about relationships ("what tasks are in this sprint?", "who's working on project X?")
- User needs a project overview or health check
- User asks to trace from one entity to its related entities
- User wants to compare or correlate data across entity types

## Entity Relationships

```
Project
├── Sprints (time-boxed work periods)
├── Tasks (work items)
│   ├── Checklists (acceptance criteria)
│   ├── Comments (discussion)
│   ├── Events (history/audit)
│   └── Reviews (quality gate)
└── Plans (feature specifications)
    ├── Requirements (REQ-n)
    └── Tasks (generated from plan)
```

## Cross-Entity Workflows

### Project Overview

Build a comprehensive project picture. Run steps 1-2 in parallel, then 3-4 if needed.

1. `pm_project { action: "get", key }` → project details
2. `pm_task { action: "search", projectKey }` → all tasks (scan statuses, assignees)
3. `pm_sprint { action: "list", projectKey }` → sprints (if user asks about timelines)
4. `vmp { action: "list_plans", projectKey }` → plans (if user asks about specs)

**Present:** Status summary, task breakdown by status, blockers, what's in review.

### Cross-Project Sprint Discovery

For prompts like "show active sprints across all projects" or "find release sprints":

1. `pm_sprint { action: "query", status: "active" }` → active sprints across projects
2. `pm_sprint { action: "query", projectKeys: ["PROJ", "OPS"], query: "release" }` → filtered cross-project sprint search

**Present:** project key, sprint name, status, window, and any obvious overlaps or missing coverage.

### Task Deep-Dive

Build full context for a specific task. Run steps 1-3 in parallel.

1. `pm_task { action: "get", taskKey }` → task details, checklists
2. `pm_task { action: "plan", taskKey }` → linked plan with requirements
3. `pm_review { action: "list", taskKey }` → review status

Load if needed:
4. `pm_task { action: "comment_list", taskKey }` → discussion history
5. `pm_task { action: "event_list", taskKey }` → status change audit trail

**Present:** Current state, what's done vs remaining (checklist), review status, blockers.

### Sprint Status

Understand what's happening in a sprint.

1. `pm_sprint { action: "get", sprintId }` → sprint details, dates, status
2. `pm_task { action: "search", projectKey, sprintId }` → tasks in sprint

**Present:** Sprint progress (tasks by status), at-risk items, review bottlenecks.

### Agent Workload

Find what an agent is working on across projects.

1. `pm_agent { action: "get", handle }` → agent details
2. `pm_task { action: "search", projectKey }` → filter by `assigneeHandle`

**Present:** Active tasks, review assignments, workload distribution.

### Plan Traceability

Trace from plan requirements to task implementation.

1. `vmp { action: "get_plan", planKey }` → full plan with requirements
2. `pm_task { action: "search", projectKey, query: "<plan name>" }` → tasks generated from plan

**Present:** Requirements coverage — which REQs have tasks, which are unstarted.

## Efficiency Rules

- **Parallelize** — When multiple calls are independent, make them simultaneously
- **Stop early** — If the first call answers the user's question, don't fetch the rest
- **Summarize, don't dump** — Present findings in the response format, don't echo raw API responses
- **Follow the thread** — If exploration reveals something interesting, ask the user before going deeper

<!--</instructions>-->

<!--</capability>-->
