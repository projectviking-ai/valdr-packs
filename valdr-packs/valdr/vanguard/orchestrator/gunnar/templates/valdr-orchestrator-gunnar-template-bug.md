<!--<prompt key="valdr-orchestrator-gunnar-template-bug" role="guide">-->
# Task Template: Bug Fix

Use this template when creating bug fix tasks. Fill every section with specific, verifiable details.

---

## Problem

<What is broken — observable symptoms, error messages, affected users/flows>

- Describe the incorrect behavior precisely
- Include exact error messages or stack traces if available
- Identify which users, flows, or features are affected
- Note the frequency and conditions under which the bug occurs

## Root Cause

<Why it is broken — specific code path, function, logic error>

- Identify the exact file(s) and function(s) where the defect lives
- Explain the logic error, race condition, missing check, or incorrect assumption
- Reference the specific lines or code patterns involved

## Proposed Fix

<Numbered steps — what to change and where>

1. Step 1: In `<file path>`, change `<what>` to `<what>`
2. Step 2: ...
3. Step 3: ...

Each step must reference a specific file and describe the exact change.

## Files to Modify

- `path/to/file.ts` — Description of change
- `path/to/test.ts` — Add/update tests for the fix

List every file that needs modification. Include test files.

## Acceptance Criteria

- [ ] `<file:function>` handles `<edge case>` without error
- [ ] Test in `<test file>` covers the regression scenario
- [ ] `<specific observable behavior>` works as expected
- [ ] No regressions in `<related feature or test suite>`

Each criterion must be independently verifiable by reading code or running tests.

---

**Quality checklist before submitting:**
- [ ] Root cause identified with specific file paths and line references
- [ ] Fix steps are explicit — no "figure out the best approach"
- [ ] Acceptance criteria reference specific files and behaviors
- [ ] Test coverage is specified

<!--</prompt>-->
