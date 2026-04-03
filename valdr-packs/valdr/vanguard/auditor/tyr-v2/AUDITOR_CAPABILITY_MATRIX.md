# Tyr Auditor (v2) — Capability Matrix

> **Status:** Registered — all capabilities and agent registered in PM MCP.

This is the Score Audit variant of Tyr. The workflow is mandatory: `pm_audit action=context`, then paginated `pm_audit action=events`, then `pm_audit action=score`, with evidence excerpts (no transcript-only scoring).

## Agent Registration

Tyr v2 agent registered with handle `tyr-v2` and ID `01KFRK4V7YM1MYFNRNB7J3Z0W9`.

## Capabilities

| Capability | Prompt ID | Role | Purpose |
| --- | --- | --- | --- |
| `valdr.auditor.tyr.v2.system` | `01KFRK3R8S5TGX73TKYA5KQ6DP` | core | Defines workflow (pm_audit context → events → score) and semantics |
| `valdr.auditor.tyr.v2.payload-contract` | `01KFRK3RD8HDSZBEW3HD8AD63T` | constraints | Pins the canonical pm_score payload shape and required fields |
| `valdr.auditor.tyr.v2.prompt-integrity` | `01KFRK3RF3V9R2H23XXH0381QQ` | validation | Audits declared vs observed prompts/capabilities and drift |
| `valdr.auditor.tyr.v2.tooling` | `01KFRK3RP7X9CT4019V1X77QTK` | validation | Audits tool usage and policy compliance |
| `valdr.auditor.tyr.v2.task-correctness` | `01KFRK3RR5X0RCBGS8R2A3H257` | validation | Audits acceptance criteria verdicts with evidence |
| `valdr.auditor.tyr.v2.execution-quality` | `01KFRK3RWTG21SP32P1AVXZ7QP` | validation | Audits execution process quality (planning, verification, clear reporting) |

## Required tools

The auditor must be granted access to `pm_audit` with these actions:

- `pm_audit action=context` (compact metadata and capability inventory)
- `pm_audit action=events` (paginated evidence retrieval via sinceSeq/limit/textMaxLength)
- `pm_audit action=score` (score ingestion)

Vanguard boundary:
- Standard Tyr v2 execution uses `pm_audit` only.
- Direct `pm_session` inspection is out of scope for the normal Vanguard workflow.

Evidence retention model (v1): store evidence as durable excerpts. Do not store pointers to session/worktree artifacts.

## Payload source of truth

The canonical payload definition lives at `.valdr/drafts/score-audit-payload.md`.

## Required validation evidence (for code-changing tasks)

- `bun run test` output. If it could not be run, provide explicit evidence that it could not be run (with cause and the exact failure message).
- `bun run lint` output. If it could not be run, provide explicit evidence that it could not be run (with cause and the exact failure message).
