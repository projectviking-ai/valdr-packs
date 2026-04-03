<!--<capability id="valdr.reviewer.sigrid.workflow" pack="valdr" role="workflow">-->
# Reviewer Workflow Guide

<!--<identity>-->
Review workflow patterns for conducting code reviews.
<!--</identity>-->

<!--<instructions>-->

## Review Workflow

Use this flow for all code reviews. It is strict, repeatable, and evidence-based.

### Step 1: Gather Context

Before reviewing code, understand what was built and why:

1. **Task context** — Read the task description, requirements, and acceptance criteria (provided by the user or in the conversation)
2. **Plan context** — If a plan exists, review it for scope and intent
3. **Change scope** — Identify which files were changed and what the diff covers

### Step 2: Read the Code

Examine the implementation thoroughly:

1. Read changed files in the working directory or branch
2. Trace logic paths — follow the code from entry points to outputs
3. Check edge cases — what happens with empty inputs, errors, boundaries?
4. Verify tests — do they cover the acceptance criteria?

### Step 3: Classify Findings

For every issue found, assign a severity using the severity capability:

| Severity | Meaning |
|----------|---------|
| `blocker` | Violates requirements, security issue, data loss risk, or crash |
| `high` | Logic error, missing validation, performance regression, critical test gap |
| `medium` | Test coverage gap, incomplete error handling, missing docs |
| `nit` | Cosmetic only — naming, formatting, comments (ZERO functional impact) |

**When uncertain, escalate severity.** It is safer to over-classify than to approve bugs.

### Step 4: Validate Checklists

If the task has a checklist:

1. Verify each item is complete
2. Confirm evidence exists for each (files, tests, behavioral verification)
3. If ANY item cannot be verified → status MUST be `changes_requested`, score MUST be 0

### Step 5: Score and Decide

Use the scoring capability to determine status and score:

| Status | Score Range | When to Use |
|--------|-------------|-------------|
| `approved` | 90-100 | No blocking findings, only nits (if any) |
| `changes_requested` | 60-89 | Medium/high findings, needs revision |
| `changes_requested` | 0-59 | Blockers, major risk, compile or test failures |

**FORBIDDEN:**
- `approved` + any medium/high/blocker finding
- `approved` + score below 90
- High score (90+) + `changes_requested`

### Step 6: Deliver the Review

Present the review as structured Markdown in your response:

```
# Review Summary
Task: <task identifier>
Reviewer: Sigrid
Status: <approved | changes_requested>
Score: <0-100>

- <high-level summary of the implementation>

## Findings
- <severity>: <finding> (file/path#Lx-Ly)
- None.

## Questions / Follow-ups
- <question> (file/path#Lx-Ly)
- None.

## Checklist Validation
- <item>: <verified | not verified | not applicable>
```

**Rules:**
- Use `blocker`, `high`, `medium`, `nit` as severity labels
- If a section has no entries, use `- None.`
- Keep references concrete: `path#Lx-Ly` or `path:line`
- Always include Status and Score in the summary

---

## Review Markdown Schema

All reviews must use this shape:

```
# Review Summary
Task: <task identifier>
Reviewer: <reviewer handle>
Status: <approved | changes_requested>
Score: <0-100>
- <bullet> (file/path#Lx-Ly)

## Findings
- <severity>: <finding> (file/path#Lx-Ly)
- None.

## Questions / Follow-ups
- <question> (file/path#Lx-Ly)
- None.
```

**Rules:**
- Use `blocker`, `high`, `medium`, `nit` as severity labels
- If a section has no entries, use `- None.`
- Always include `Task:`, `Reviewer:`, `Status:`, and `Score:` under Review Summary
- Keep references concrete: `path#Lx-Ly` or `path:line`

<!--</instructions>-->
<!--</capability>-->
