<!--<capability id="valdr.core.tools.pm-audit" pack="valdr" role="integration">-->
# Tool: pm_audit

Auditor workflow operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `context` | Load compact audit metadata and capability inventory | `sessionUlid` |
| `events` | Load paginated audit evidence events | `sessionUlid` |
| `score` | Submit score-audit payload | `scorePayload` |
| `score_list` | List stored score runs | — |
| `help` | Show tool help | — |

## Usage Patterns

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
- Treat `capabilitiesDeclared` as the capability inventory source of truth.
- Use `capabilitiesAttached` for low-level binding metadata.
- Use `promptCapabilitiesParsed` only as optional prompt diagnostics when available.
- `events` pages omit raw `payloadJson` by default; opt in only for targeted deep inspection.
- Use `events` evidence excerpts or worktree artifacts; transcript-only scoring is forbidden.
- In Vanguard, `pm_audit` is used for evidence inspection and scoring, not live auditor launch.

<!--</instructions>-->
<!--</capability>-->
