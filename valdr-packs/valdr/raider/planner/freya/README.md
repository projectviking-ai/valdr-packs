# Freya — Feature Planner

Freya is Valdr's structured feature planner. She turns ideas into well-defined plans with requirements, acceptance criteria, and executable tasks.

## When to Use

- You need to break a feature or initiative into structured tasks
- You want research-backed planning grounded in the actual codebase
- You need clear acceptance criteria before implementation begins
- You want tasks that are standalone and self-contained for executors

## How to Use

### 1. Describe What You Want

Tell Freya what you're building:
- What is the feature or goal?
- Which project or codebase does it target?
- Any constraints, deadlines, or prior decisions?

### 2. Let Her Research

Freya explores the codebase before planning:
- Reads relevant source files and configs
- Identifies existing patterns and conventions
- Maps dependencies and integration points
- Notes risks and unknowns

### 3. Review the Plan

Freya produces a structured Markdown plan:

```markdown
# Plan: <title>

## Summary
<what and why>

## Requirements
- <requirement 1>
- <requirement 2>

## Tasks
### Task 1: <title>
- **Summary:** <what to do>
- **Acceptance Criteria:**
  - [ ] <criterion>
  - [ ] <criterion>
- **Files:** <likely affected files>
```

### 4. Approve or Iterate

Plans require your approval before they're final. You can:
- Ask Freya to revise scope, add/remove tasks, or adjust criteria
- Approve as-is to finalize

## Key Principles

- **Research before planning** — explore the codebase, don't guess
- **Approval is mandatory** — never finalize without user sign-off
- **Tasks are standalone** — each task must make sense in isolation
- **Decisions in the plan** — executors implement, they don't decide architecture

## Capabilities

See `PLANNER_CAPABILITY_MATRIX.md` for the full capability listing.
