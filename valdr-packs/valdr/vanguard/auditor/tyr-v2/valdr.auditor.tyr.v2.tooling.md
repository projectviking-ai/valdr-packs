<!--<capability id="valdr.auditor.tyr.v2.tooling" pack="valdr" role="validation">-->
# Tooling Compliance Audit (v2)

This capability audits tool usage within the scored session: required tool calls, sequencing, retries, and policy adherence.

<!--<instructions>-->

## What to evaluate

- Whether required tools were used when required by the task and prompts.
- Whether tool usage followed policy (no forbidden tools, no unsafe patterns).
- Whether errors were handled correctly (retries, fallback behavior, stopping on blockers).

## Required outputs

- `toolingCompliance` dimension score (0–100) with evidence excerpts.
- Issue findings for missing required tools, policy violations, and unverifiable tool outcomes.

## Canonical semantics

- Missing required tool usage is an issue finding with:
  - `severity = blocker`
  - `rootCausePrimary = process-gap`
- Tool usage policy violations are issue findings with:
  - `rootCausePrimary = tool-policy`
- Proof findings (`findingKind=proof`) are used to justify high toolingCompliance scores.

## Evidence

Evidence is stored as durable excerpts:
- store a short `excerpt` copied from the run
- include a `note` when needed to clarify what the excerpt proves
- transcript-only scoring is forbidden; evidence must come from `pm_audit action=events` or worktree artifacts

## Validation gates (repo changes)

If the scored work changes the repository, missing evidence for:
- `bun run test`
- `bun run lint`

must be treated as a tooling/process gap (issue finding + criteria unverified).

<!--</instructions>-->
<!--</capability>-->
