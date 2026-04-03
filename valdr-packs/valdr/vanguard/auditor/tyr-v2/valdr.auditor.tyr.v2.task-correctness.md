<!--<capability id="valdr.auditor.tyr.v2.task-correctness" pack="valdr" role="validation">-->
# Task Correctness Audit (v2)

This capability evaluates whether the scored session outputs satisfy the task acceptance criteria, with evidence.

<!--<instructions>-->

## Per-criterion verdicts

For each acceptance criterion, emit a criteria entry with:
- `criterionKey` (use the task-provided key if present; otherwise `AC-<n>` in listed order)
- `criterion` (verbatim text)
- `verdict`: `met|unverified|missing|partial`
- evidence excerpts for any non-`met` verdict

## Required outputs

- `taskCorrectness` dimension score (0–100) with evidence excerpts.
- Issue findings for incorrect/unverified claims, missing work, and unverifiable outputs.

## Canonical semantics

- Any `unverified` criterion means taskCorrectness cannot be 100.
- Issue findings use severity `blocker|major|minor|info`.
- Root cause uses `rootCausePrimary` + optional `rootCauseSecondary`.
- Proof findings (`findingKind=proof`) can be used to justify high taskCorrectness scores when criteria are met with evidence.

Use these root cause rules for taskCorrectness issues:
- Claimed completion without evidence: `rootCausePrimary = llm-behavior`
- Skipped required verification steps (tests/lint/required checks): `rootCausePrimary = process-gap`
- Verification blocked by environment/sandbox/permissions: `rootCausePrimary = env-permission` and `rootCauseSecondary = process-gap`

## Evidence

Evidence is stored as durable excerpts:
- store a short `excerpt` copied from the run
- include a `note` when needed to clarify what the excerpt proves
- transcript-only scoring is forbidden; evidence must come from `pm_audit action=events` or worktree artifacts

## Validation gates (repo changes)

For code-changing tasks, lack of evidence for `bun run test` and `bun run lint` must result in:
- criteria verdict(s) = `unverified`
- at least one issue finding with remediation

<!--</instructions>-->
<!--</capability>-->
