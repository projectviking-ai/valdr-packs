<!--<prompt key="valdr-orchestrator-gunnar-template-refactor" role="guide">-->
# Task Template: Refactor

Use this template when creating refactor tasks. Fill every section with specific, verifiable details. Refactors must not change external behavior.

---

## Current State

<What exists today — architecture, patterns, technical debt>

- Describe the current structure and its problems
- Reference specific files, modules, or patterns that need improvement
- Explain why the current state is problematic — maintenance burden, performance, readability

## Target State

<What it should look like after — new patterns, removed debt, improved structure>

- Describe the desired architecture or pattern
- Reference existing code in the repo that exemplifies the target pattern (if any)
- Be specific: "Extract `<logic>` from `<file>` into `<new module>`" not "improve structure"

## Migration Strategy

<Numbered steps — how to get from current to target without breaking things>

1. Step 1: `<specific change in specific file>`
2. Step 2: ...
3. Step 3: ...

Order steps to maintain a working system at each stage. Note any steps that require updating call sites or imports.

## Files to Modify

- `path/to/file.ts` — Description of change
- `path/to/moved-file.ts` — Moved from `<old path>`, updated exports
- `path/to/test.ts` — Update tests to reflect new structure

List every file that needs modification. Include files where imports or references change.

## Acceptance Criteria

- [ ] `<module>` extracted to `<new location>` with `<public API>`
- [ ] All call sites in `<files>` updated to use new import path
- [ ] Existing tests in `<test files>` pass without modification (or with import-only changes)
- [ ] No behavior changes — `<specific feature>` works identically before and after
- [ ] No dead code left behind in `<original files>`

Each criterion must be independently verifiable by reading code or running tests.

---

**Quality checklist before submitting:**
- [ ] Current state describes specific problems, not just "it's messy"
- [ ] Target state is concrete — not "cleaner" or "better"
- [ ] Migration steps maintain working system at each stage
- [ ] "No regressions" criteria are specific about what to verify

<!--</prompt>-->
