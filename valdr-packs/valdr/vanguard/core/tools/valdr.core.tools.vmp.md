<!--<capability id="valdr.core.tools.vmp" pack="valdr" role="integration">-->
# Tool: vmp

Valdr Mini-Planner operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list_plans` | Find plans with counts and completion metrics | — |
| `get_plan` | Fetch plan details | `planKey` or `planId` |
| `commit_markdown` | Create plan from markdown | `markdown`, `idempotencyKey`, `plannerAgentHandle` |

## Usage Patterns

**List plans:**
```
vmp { action: "list_plans" }
```

Returns a `plans[]` list where each row includes:
- `requirementCount`
- `taskCount`
- `taskCompletedCount`
- `acceptanceTotal`
- `acceptanceChecked`
- `completionPercent` (0-100)

**Filter by project:**
```
vmp { action: "list_plans", projectKey: "PROJ" }
```

**Get plan details:**
```
vmp { action: "get_plan", planKey: "<plan-key>" }
```

**Commit markdown plan:**
```
vmp {
  action: "commit_markdown",
  markdown: "<plan-markdown>",
  idempotencyKey: "<ulid>",
  plannerAgentHandle: "@freya"
}
```

## Plan Markdown Format

```markdown
---
schemaVersion: 1.0
projectKey: PROJ
---

# Plan: Feature Name

## Idea
What we're building and why.

## Constraints
- Constraint 1
- Constraint 2

## Success
- Success criterion 1
- Success criterion 2

## Design

### Problem
What problem this solves.

### Approach
How we'll solve it.

### Risks
- Risk 1
- Risk 2

## Requirements

- [REQ-1] Requirement title
  Description: What this requirement means.
  Scenario: Given/When/Then format.

## Tasks

- [TASK-1] Task title
  Summary: What this task accomplishes.
  Requirements: REQ-1
  Acceptance:
    - Acceptance criterion 1
    - Acceptance criterion 2
```

## Frontmatter Rules

**Required (exactly one):**
- `projectKey: <key>` OR `projectId: <id>`

**Never include:**
- `planId`
- `planKey`
- `createdBy`
- `tags`

## Key Rules

- **idempotencyKey** — Use fresh ULID from `pm_generate_ulid`
- **plannerAgentHandle** — Provide the planner handle for attribution (example: `@freya`)
- **Schema version** — Always use `schemaVersion: 1.0`
- **Task sizing** — Target 2-5 substantial tasks per plan
- **Explicit tasks** — Include specific file paths and actions

<!--</instructions>-->
<!--</capability>-->
