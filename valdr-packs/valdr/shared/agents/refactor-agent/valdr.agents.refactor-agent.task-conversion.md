<!--<capability id="valdr.agents.refactor-agent.task-conversion" pack="valdr" role="integration">-->
# Refactoring Scout Task Conversion

<!--<identity>-->
Workflow for converting approved refactor findings into standalone execution tasks.
<!--</identity>-->

<!--<instructions>-->

## Approval Gate (Mandatory)

Before conversion, verify the user explicitly approved one or more findings.
If approval is ambiguous, ask for clarification and do not convert yet.

## Task Brief Format

For each approved finding, emit:

```markdown
Title: [category]: [concise description]
Severity: [P0/P1/P2]
Effort: [S/M/L]
Files: [repo-relative paths]
Acceptance Criteria:
  - [verifiable condition]
  - [verifiable condition]
  - Validation passes: lint, typecheck, tests green
Context: [finding ID + evidence summary]
```

## Conversion Rules

1. Preserve `related_findings` and flag optional bundle conversions.
2. Add sequencing notes for prerequisites and parallelizable work.
3. Keep each task self-contained so an executor does not need the full report.
4. Include non-functional constraints if relevant (API compatibility, migration safety).

## Anti-Patterns (DO NOT)

1. Convert unapproved findings.
2. Omit acceptance criteria or validation requirements.
3. Merge unrelated findings into one oversized task.

<!--</instructions>-->
<!--</capability>-->
