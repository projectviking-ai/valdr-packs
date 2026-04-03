<!--<capability id="valdr.planner.freya.tasks" pack="valdr" role="workflow">-->
# VMP Task Writing Guide

This capability provides guidance for writing tasks that AI agents can execute independently.

## CRITICAL: Task-Only Context (Non-Negotiable)

Agents only see the single task they are assigned. They do NOT see the plan, other tasks, or this planning context. Write every task as a complete, standalone execution brief.

## CRITICAL: Writing Tasks for AI Agents

Tasks are executed by AI agents who only see the task + linked requirements. Agents run **one task at a time** and **do not see other tasks or the full plan**. Write tasks accordingly.

**Scope rule:** Because the agent sees only a single task, the task MUST include all critical details needed to execute successfully (exact error strings, required helpers/functions, file paths, and any non-obvious constraints). Do not assume the agent can infer details from other tasks or the plan.

## Task Sizing

**Consolidate work into substantial tasks.** AI agents can handle complex multi-step work.

| Bad (too granular) | Good (consolidated) |
|--------------------|---------------------|
| TASK-1: Update schema | TASK-1: Update schema, storage, services, and tests for feature X |
| TASK-2: Update storage | |
| TASK-3: Update services | |
| TASK-4: Update tests | |

**Target: 2-5 tasks per plan.** If you have 8+ tasks, consolidate.

## Explicit Instructions

**Be specific.** Agents don't have your context—tell them exactly what to do.

| Bad (vague) | Good (explicit) |
|-------------|-----------------|
| "Update the schema" | "Add `status` column to `users` table in `src/db/schema.ts`" |
| "Add tests" | "Add tests in `src/services/tests/user.test.ts`" |
| "Update docs" | "Update `docs/API.md` and `README.md`" |

## Never Ask Agents to Decide

**Make decisions in the plan.** Agents execute; they don't decide.

| Bad (vague) | Good (explicit) |
|-------------|-----------------|
| "Decide on retention strategy" | "Soft-delete: add `deletedAt` column, filter in queries" |
| "Choose appropriate approach" | "Use localStorage for persistence" |
| "Determine the best method" | "Implement using React Context with useReducer" |

## Task Template

Each task MUST include:

```markdown
- [TASK-x] <action verb> <what>
  Summary: <2-4 sentences with specific file paths and actions>
  Requirements: REQ-1, REQ-2
  Acceptance:
    - <verifiable criterion with file/location>
    - <verifiable criterion with file/location>
```

## Summary Must Specify

- Which files/directories to modify
- What migrations or schema changes to create
- What tests to add/update
- What docs to update (if tools/APIs change)
- Exact error strings or message formats (when applicable)
- Required helper functions/APIs and any precedence/ordering rules

Also include any **external interface updates** (API/CLI/UI/config/schema) that must be reflected in docs or tests, using paths discovered in the target repo.

## Task Completeness Checklist

Before finalizing a task, confirm it includes:

- [ ] File paths and exact entry points to change
- [ ] Exact behavior contract (errors, ordering, validation, precedence)
- [ ] Required helper functions or existing utilities to call
- [ ] Test locations and expected assertions
- [ ] Any documentation updates
- [ ] Any external interface updates and compatibility notes

## Example: Good Task

```markdown
- [TASK-1] Implement user authentication with session storage
  Summary: Add session-based auth to the user service.
  Update `src/db/schema.ts` to add sessions table.
  Create migration in `src/db/migrations/` for the new table.
  Implement session logic in `src/services/auth.ts`.
  Add tests in `src/services/tests/auth.test.ts`.
  Update `docs/API.md` with auth endpoints.
  Requirements: REQ-1, REQ-2
  Acceptance:
    - Migration creates sessions table
    - Auth service handles login/logout
    - Tests cover session creation and validation
    - API docs updated with auth endpoints
```

## Example: Bad Task

```markdown
- [TASK-1] Update schema
  Summary: Remove unused fields from schema.
  Requirements: REQ-1
  Acceptance:
    - Schema updated
```

This task fails because:
- No specific file paths
- No details on which fields
- Vague acceptance criteria
- Agent cannot execute without guessing

<!--</capability>-->
