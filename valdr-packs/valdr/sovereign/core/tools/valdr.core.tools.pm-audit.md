<!--<capability id="valdr.core.tools.pm-audit" pack="valdr" role="integration">-->
# Tool: pm_audit

Auditor workflow operations. Use this tool for audit evidence retrieval and persisted audit score runs.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `launch` | Launch auditor attached to scored session worktree | `taskKey`, `sourceSessionUlid`, `clientRequestId` |
| `context` | Load compact audit metadata and capability inventory | `sessionUlid` |
| `events` | Load paginated audit evidence events | `sessionUlid` |
| `score` | Submit score-run payload | `scorePayload` |
| `score_list` | List stored audit score runs | — |
| `help` | Show tool help | — |

## Usage Patterns

**Launch auditor:**
````
pm_audit {
  action: "launch",
  taskKey: "PROJ-123",
  sourceSessionUlid: "<executor-session-ulid>",
  clientRequestId: "<ulid>",
  agentHandle: "tyr-v2",
  actor: "@skadi",
  run: true
}
````

**Load compact context first:**
````
pm_audit {
  action: "context",
  sessionUlid: "<scored-session-ulid>"
}
````

**Paginate events separately:**
````
pm_audit {
  action: "events",
  sessionUlid: "<scored-session-ulid>",
  sinceSeq: -1,
  limit: 25,
  textMaxLength: 250
}
````

**Request raw payloads only when you need them:**
````
pm_audit {
  action: "events",
  sessionUlid: "<scored-session-ulid>",
  sinceSeq: 100,
  limit: 5,
  includePayloadJson: true
}
````

**Submit score:**
````
pm_audit {
  action: "score",
  scorePayload: { ... }
}
````

## Key Rules

- Use `context` before `events` so auditors do not pull oversized payloads by default.
- Use `scoreTemplate` from `context` as the starting scaffold for `score`.
- `score` persists an audit score run; it does not update task review scores.
- Treat `capabilitiesDeclared` as the capability inventory source of truth.
- Use `capabilitiesAttached` for low-level binding metadata.
- Use `promptCapabilitiesParsed` only as optional prompt diagnostics when available.
- `events` pages omit raw `payloadJson` by default; opt in only for targeted deep inspection.
- Use `events` evidence excerpts or worktree artifacts; transcript-only scoring is forbidden.

<!--</instructions>-->
<!--</capability>-->
