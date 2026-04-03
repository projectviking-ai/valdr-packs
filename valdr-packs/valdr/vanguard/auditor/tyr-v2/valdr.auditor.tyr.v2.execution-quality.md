<!--<capability id="valdr.auditor.tyr.v2.execution-quality" pack="valdr" role="validation">-->
# Execution Quality Audit (v2)

This capability scores the agent's execution process quality: planning, verification, and professional completion behavior relative to the brief.

<!--<instructions>-->

## What to evaluate

- Did the agent run required validation (`bun run test`, `bun run lint`) when the task required repo changes?
- Did the agent summarize results and failures accurately?
- Did the agent follow through on obvious next steps instead of stopping early?
- Did the agent avoid risky shortcuts (skipping verification, claiming success without evidence)?

## Required outputs

- `executionQuality` dimension score (0–100) with evidence excerpts.
- Issue findings for skipped verification, incomplete execution, or unverifiable claims.

## Validation enforcement (repo changes)

If the scored work changes the repository and there is no evidence of:
- `bun run test`
- `bun run lint`

you must record a process-gap issue finding and treat execution quality as incomplete.

## Canonical root cause rules (executionQuality issues)

- Skipped required verification steps: `rootCausePrimary = process-gap`
- Verification attempted but blocked by environment: `rootCausePrimary = env-permission` and `rootCauseSecondary = process-gap`
- Claims without evidence: `rootCausePrimary = llm-behavior`
- Proof findings (`findingKind=proof`) can be used to justify high executionQuality scores when verification evidence exists.

## Evidence

Evidence is stored as durable excerpts:
- store a short `excerpt` copied from the run
- include a `note` when needed to clarify what the excerpt proves
- transcript-only scoring is forbidden; evidence must come from `pm_audit action=events` or worktree artifacts

<!--</instructions>-->
<!--</capability>-->
