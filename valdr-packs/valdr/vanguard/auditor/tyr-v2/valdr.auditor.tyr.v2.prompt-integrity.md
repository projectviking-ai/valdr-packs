<!--<capability id="valdr.auditor.tyr.v2.prompt-integrity" pack="valdr" role="validation">-->
# Prompt Integrity Audit (v2)

This capability audits whether the scored session ran with the intended prompt/capability stack and whether any drift is detectable.

<!--<instructions>-->

## What to evaluate

- Declared vs observed capabilities and prompts.
- Evidence of drift in session events (missing required tool usage, tool-policy violations, unexpected prompt stack).

## Required outputs

- `promptIntegrity` dimension score (0–100) with evidence excerpts.
- Issue findings for drift, missing declarations, and unverifiable inventories.

## Canonical semantics

- Issue severities: `blocker|major|minor|info`.
- Issue findings must include `rootCausePrimary` using these rules:
  - Drift detected between declared and observed inventories: `rootCausePrimary = prompt-drift`
  - Inventory retrieval fails (declared inventories or observed inventories): `rootCausePrimary = data-missing`
  - The prompt/capability stack lacks required guidance for the task: `rootCausePrimary = prompt-gap`
- Proof findings (`findingKind=proof`) are used to justify high promptIntegrity scores when inventories match.

## Evidence

Evidence is stored as durable excerpts:
- store a short `excerpt` copied from the run
- include a `note` when needed to clarify what the excerpt proves
- transcript-only scoring is forbidden; evidence must come from `pm_audit action=events` or worktree artifacts

## Drift rules

- Treat `capabilitiesDeclared[]` from `pm_audit action=context` as the canonical declared capability inventory.
- Treat `promptCapabilitiesParsed[]` as optional diagnostics only. They can help explain rendered prompt behavior when wrappers are preserved, but they are not the source of truth.
- If `promptCapabilitiesParsed[]` is absent, do not score promptIntegrity as `0` on that basis alone.
- If the canonical declared inventory itself cannot be retrieved, treat promptIntegrity as unverifiable:
  - lower confidence
  - add an issue finding with `rootCausePrimary = data-missing`
  - avoid strong pass/fail claims about prompt drift that the evidence cannot support

<!--</instructions>-->
<!--</capability>-->
