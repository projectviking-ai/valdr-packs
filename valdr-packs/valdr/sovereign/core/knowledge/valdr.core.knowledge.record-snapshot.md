<!--<capability id="valdr.core.knowledge.record-snapshot" pack="valdr" role="workflow">-->
# Knowledge: Record Snapshot

<!--<identity>-->
Reusable mechanics for snapshotting a Valdr record into the knowledge index via `pm_knowledge record_entry { entryType: "valdr_record_materialized" }`. Bind on agents that complete record state transitions worth preserving — executors at task `done`, reviewers at verification, knowledge orchestrators. Sovereign-only (depends on `pm_knowledge`).
<!--</identity>-->

<!--<instructions>-->

## When to Use This

Use `record-snapshot` when a Valdr record reaches a state worth preserving for future retrieval:

- Executor finishes a task → snapshot the task at `done` so the implementation context is searchable later
- Reviewer verifies a task → snapshot the verified state with the review summary
- A sprint closes → snapshot the sprint and its outcomes
- A plan is finalized → snapshot the plan
- Mimir or another knowledge orchestrator captures a record on demand

Do **not** use for:
- Agent learnings (use `valdr.core.knowledge.memory-append`)
- Free-form notes (use `valdr.core.knowledge.memory-append`)
- Attaching docs / code folders (use `update_sources`)

## The Snapshot Call

```
pm_knowledge {
  action: "record_entry",
  mode: "create",
  entryType: "valdr_record_materialized",
  scope: "project",
  projectId: "<projectId>",
  recordType: "<task | sprint | plan | review | ...>",
  recordId: "<ulid>",
  recordVersion: <version-number>,
  title: "<recordKey> v<version> snapshot",
  body: "<serialized record content>"
}
```

For workspace-level records (rare):

```
pm_knowledge {
  action: "record_entry",
  mode: "create",
  entryType: "valdr_record_materialized",
  scope: "global",
  recordType: "<type>",
  recordId: "<ulid>",
  recordVersion: <version-number>,
  title: "<title>",
  body: "<content>"
}
```

## Required Identity Fields

A snapshot is identified by the triple `(recordType, recordId, recordVersion)`. All three are required:

| Field | Notes |
|-------|-------|
| `recordType` | The Valdr record kind: `task`, `sprint`, `plan`, `review`, `project`, etc. |
| `recordId` | The ULID of the record |
| `recordVersion` | Numeric version at the time of snapshot — never omit; pin the snapshot to a specific point in the record's history |

If you do not have a `recordVersion`, fetch the record first (e.g., `pm_task get`) and use the version it returns. Snapshots without a version are ambiguous.

## What to Put in `body`

The body is what becomes searchable. Make it self-contained and information-dense:

- **Identity:** record key, type, version, status at snapshot time
- **Subject:** the record's title and summary
- **Substance:** the fields that make this record meaningful — for a task, that's description, checklist state, comments, status history; for a sprint, the linked tasks and outcomes
- **Provenance:** capturing agent handle, absolute date (`2026-05-02`)
- **References:** related record keys (sprint id, plan key, review ids) so future retrieval surfaces this snapshot when working those records

Bad body: just the record id. Good body: a self-contained narrative of the record at that version.

## Title Convention

Use a search-friendly title that distinguishes versions:

- Bad: `Task snapshot`, `TASK-123`, `done`
- Good: `TASK-123 v4 done snapshot — auth middleware refactor`

## When to Snapshot

Match the snapshot point to the question you want it to answer later:

| Trigger | Why |
|---------|-----|
| Task moves to `done` | "How was this task implemented?" — capture description + checklist + key comments |
| Task moves to `verified` | "What did the review find?" — include review summary in body |
| Sprint closes | "What got done in sprint X?" — capture linked tasks and outcomes |
| Plan is finalized | "What was the original plan?" — preserve the version that work was committed against |
| Major version bump on any record | Capture the prior version before it's overwritten |

Do not snapshot every state change — too noisy. Snapshot at meaningful transitions.

## Update / Delete

Snapshots support `mode: "update"` (with `entryId` and a mutable field — typically only useful to fix a body before any retrieval has happened) and `mode: "delete"` (with `entryId`). Prefer creating a **new snapshot** for a new version rather than mutating an existing one — version history is the point.

## Verifying

After a snapshot, re-fetch the scope to confirm the entry exists:

```
pm_knowledge { action: "get", scope: "<scope>", projectId: "<projectId>" }
```

Look for the new resource with `knowledgeType: "valdr_record"`, the expected `canonicalLocator`, and the auto-created attachment.

## Capture-on-Behalf-Of

When one agent snapshots a record produced by another (e.g., Mimir snapshots an executor's task at done):

- The `recordType`/`recordId`/`recordVersion` identify the record itself, not who captured it
- Mention the capturing agent in the body (`captured by <handle> at <date>`) for provenance
- The snapshot belongs to the project, not the capturing agent — there is no per-agent notebook for snapshots

## Common Errors

| Error Code | Cause | Resolution |
|------------|-------|-----------|
| `KNOWLEDGE_RECORD_ENTRY_MODE_REQUIRED` | Missing `mode` | Supply `mode: "create"` |
| `KNOWLEDGE_PROJECT_REQUIRED` | `scope: "project"` without `projectId` | Resolve via `pm_project get` |
| (validation: missing record fields) | One of `recordType`/`recordId`/`recordVersion` missing | Fetch the record and supply all three |

## Anti-Patterns (DO NOT)

1. Snapshot without a `recordVersion` — the snapshot becomes ambiguous
2. Stuff a record id into `body` and call it done — body must be self-contained for retrieval
3. Snapshot every state change — too noisy; pick meaningful transitions
4. Mutate an existing snapshot to reflect a new version — create a new snapshot for the new version
5. Use `entryType: "agent_knowledge"` for record snapshots — use `valdr_record_materialized`
6. Use `update_sources` to attach a record — record snapshots only flow through `record_entry`
7. Capture another agent's record under `entryType: "agent_knowledge"` — that's a memory note, not a record snapshot

<!--</instructions>-->
<!--</capability>-->
