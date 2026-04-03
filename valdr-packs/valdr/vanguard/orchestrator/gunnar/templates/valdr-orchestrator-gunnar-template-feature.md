<!--<prompt key="valdr-orchestrator-gunnar-template-feature" role="guide">-->
# Task Template: Feature / Task

Use this template when creating feature or enhancement tasks. Fill every section with specific, verifiable details.

---

## Context

<Why this feature is needed — user need, business driver, or technical motivation>

- Describe the user problem or business requirement this solves
- Reference any related features, APIs, or systems
- Note any prior art or existing patterns in the codebase

## Requirements

<Numbered list — specific, testable requirements>

1. Requirement 1: `<specific, measurable behavior>`
2. Requirement 2: ...
3. Requirement 3: ...

Each requirement must be independently testable. Avoid subjective language like "should be fast" — use "responds within 200ms" instead.

## Implementation

<Numbered steps — what to build, which patterns to follow, which existing code to reuse>

1. Step 1: In `<file path>`, add/modify `<what>`
2. Step 2: ...
3. Step 3: ...

Reference existing patterns in the codebase that the implementation should follow. Name specific functions, classes, or modules to reuse.

## Files to Modify

- `path/to/file.ts` — Description of change
- `path/to/new-file.ts` — New file: purpose and contents
- `path/to/test.ts` — Add tests for new functionality

List every file that needs creation or modification. Include test and documentation files.

## Acceptance Criteria

- [ ] `<feature>` produces `<expected output>` when `<input/action>`
- [ ] Tests in `<test file>` cover `<scenarios>`
- [ ] `<API/UI/CLI>` exposes `<new capability>`
- [ ] Documentation updated in `<doc file>` if applicable
- [ ] No regressions in `<related feature or test suite>`

Each criterion must be independently verifiable by reading code or running tests.

---

**Quality checklist before submitting:**
- [ ] Requirements are specific and testable — no vague "should work well"
- [ ] Implementation steps reference exact files and patterns
- [ ] Acceptance criteria cover both happy path and edge cases
- [ ] Test expectations are specified

<!--</prompt>-->
