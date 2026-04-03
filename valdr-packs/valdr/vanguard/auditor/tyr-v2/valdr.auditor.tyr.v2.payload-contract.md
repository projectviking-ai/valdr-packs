<!--<capability id="valdr.auditor.tyr.v2.payload-contract" pack="valdr" role="constraints">-->
# pm_audit Score Payload Contract (v2 auditor)

This capability exists to keep the auditor's output stable and compatible with the Score Audit system.

<!--<instructions>-->

## Workflow requirement

- Always call `pm_audit action=context` before preparing the payload.
- Always submit the payload via `pm_audit action=score` (chat output is receipt-only).
- Treat `scoreTemplate` from `pm_audit action=context` as the canonical scaffold. Fill it in; do not rebuild the envelope from scratch unless necessary.
- `pm_audit`, `pm_capability`, and `pm_agent` are already available in the auditor session. Use them directly; do not call `ToolSearch` for them.
- Pass `scorePayload` to `pm_audit action=score` as a native object. Never JSON-stringify the payload.
- If event pagination is rejected or ambiguous, refresh context if needed and restart pagination from `sinceSeq=-1` before finalizing the payload.

## Required payload fields

At minimum, the auditor must provide:
- `clientRequestId`
- `taskKey`
- `scoredSessionUlid`
- `auditorSessionUlid`
- `scoredAgentHandle` — handle of the agent whose session is being audited (from `session.agentHandle`)
- `auditorAgentHandle` — handle of the auditor agent (always `"tyr-v2"` for this auditor)
- `scoringVersion` (must be `score-audit/v1`)
- `scoringAlgorithm`
- `scoreComputation`
- `verdict` and `overallScore`
- all seven `dimensions[]`
- `findings[]` (issue findings for gaps; proof findings for affirmative compliance)
- `criteria[]` with evidence for any non-met verdicts
- `capabilities` — capability inventory (see below)

## Common construction rules

- `findings[].dimension` must be one of the seven canonical score dimensions.
- `findings[].issue` is the required narrative field.
- `findings[]` must not use legacy aliases like `title` or `detail`.
- `findings[].evidence` must be an array of evidence objects, even when there is only one.
- `criteria[].verdict` must use `met|unverified|missing|partial`.
- `criteria[]` must not use legacy verdicts like `pass` or `fail`.
- `criteria[].evidence` must be an array of evidence objects, even when there is only one.
- Every evidence object `subject` must be one of `scored|auditor|external`.
- Use `external` for worktree, file, git, or other repository artifacts; never use `worktree` as a `subject` value.
- Proof findings may use `remediation = "No action needed"`.
- If `pm_audit action=context` returned `scoreTemplate`, prefer copying its pre-filled dimensions, computation settings, and capability inventory.

### Canonical finding example

```json
{
  "findingKind": "issue",
  "severity": "major",
  "dimension": "executionQuality",
  "issue": "Initial implementation missed a boundary condition",
  "rootCausePrimary": "llm-behavior",
  "remediation": "Add the missing boundary probe before first submission",
  "evidence": [
    {
      "subject": "scored",
      "excerpt": "seq 123: reviewer flagged the missing boundary case"
    }
  ]
}
```

### Canonical criterion example

```json
{
  "criterion": "Validation completed",
  "verdict": "met",
  "evidence": [
    {
      "subject": "scored",
      "excerpt": "typecheck/lint/test passed"
    }
  ]
}
```

### Before submit checklist

- `scoreTemplate` is still the structural envelope
- `auditorAgentHandle` is `"tyr-v2"`
- `scorePayload` will be submitted as an object, not a string
- `findings[]` uses `dimension` + `issue`, not `title/detail`
- `criteria[].verdict` uses canonical values only
- all finding and criterion evidence values are arrays
- all evidence `subject` values use `scored`, `auditor`, or `external`

## Capability inventory (required)

You must include the `capabilities` field with the scored agent's attached capabilities. This enables traceability of which capabilities were evaluated and what versions were active.

### Building the inventory from pm_audit context

1. `pm_audit action=context` returns `capabilitiesDeclared[]` — the authoritative declared capability inventory for the scored agent/session binding.
2. It may also return `capabilitiesAttached[]` for lower-level binding metadata such as `hotLoad`, `promptId`, and source paths.
3. It may also return `promptCapabilitiesParsed[]` — prompt-parse diagnostics from rendered wrapper tags when available.
4. Copy each declared entry directly into the score payload:

```json
{
  "capabilities": {
    "subject": "scored",
    "declared": [
      {
        "capabilityKey": "<key from capabilitiesDeclared>",
        "pack": "<pack from capabilitiesDeclared>",
        "capabilityRole": "<role from capabilitiesDeclared>",
        "resolvedHash": "<resolvedHash from capabilitiesDeclared when present>"
      }
    ]
  }
}
```

5. Use `promptCapabilitiesParsed[]` only as optional diagnostics. Do not treat a missing parsed-prompt entry as proof that the capability was absent.

### Linking findings to capabilities

When a finding relates to a specific capability:
- Set `capabilityKey` to the declared capability's `capabilityKey`
- Set `capabilityResolvedHash` to the declared capability's `resolvedHash` when available

Example:
```json
{
  "findingKind": "issue",
  "severity": "major",
  "dimension": "instructionsAdherence",
  "issue": "Agent skipped required verification step",
  "capabilityKey": "valdr.task-runner.workflow",
  "capabilityResolvedHash": "sha256:abc123...",
  "rootCausePrimary": "prompt-gap",
  "remediation": "Add explicit verification step to workflow"
}
```

### Why this matters

- **Traceability**: Score runs link to the exact capability versions that were evaluated
- **Regression analysis**: Compare scores across capability version changes
- **Root cause attribution**: Findings identify which capability (if any) contributed to the issue

## Evidence (v1 retention model)

Evidence is stored as durable excerpts:
- `excerpt` (required; short snippet copied from the run)
- `note` (optional; explain what the excerpt proves)

Subject mapping rules:
- `scored` = evidence excerpted from the scored session events
- `auditor` = evidence about the auditor run itself
- `external` = worktree, file, git, task, or repository artifacts outside the scored session event log
- never use `worktree` as a `subject`

Excerpt rules (v1):
- Keep `excerpt` <= 4000 characters.
- Include only the minimum necessary text.
- Redact secrets and sensitive values before storing.
- Transcript-only scoring is forbidden; evidence must come from `pm_audit action=events` or worktree artifacts.

## Canonical semantics

- Severity: `blocker|major|minor|info` (issue findings only)
- Proof findings: `findingKind = proof` and do not set `severity`
- Root causes:
  - `rootCausePrimary` is required for issue findings
  - include `rootCauseSecondary` only when there is a distinct secondary cause
  - include `rootCauseDetail` only when needed to disambiguate

<!--</instructions>-->
<!--</capability>-->
