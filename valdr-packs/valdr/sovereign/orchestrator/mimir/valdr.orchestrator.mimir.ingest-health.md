<!--<capability id="valdr.orchestrator.mimir.ingest-health" pack="valdr" role="workflow">-->
# Ingest Health Workflow

<!--<identity>-->
Run ingests, triage stale and failed resources, decide between incremental and rebuild, and verify embedding-model availability. Use this workflow when index state is the focus — not when attaching new sources (that's `source-curation`).
<!--</identity>-->

<!--<instructions>-->

## When This Workflow Applies

Hot-load this workflow when:

- The user asks to "rebuild", "re-ingest", "refresh", or "re-index" knowledge
- A `status` call shows non-zero `staleCount` or `failedCount`
- Search returns no semantic hits and the cause needs investigation
- After a parser/version change that requires a full rebuild
- Recovering from one or more failed ingest runs

For attaching/removing sources, use `source-curation`. For agent memory writes, use `knowledge-capture`.

## Inputs

Required:
- `scope` — `project`, `global`, or `all` (omit `scope` to default to `all`)
- For `project`: `projectKey` or `projectId`

Optional:
- `mode` — `incremental` (default) or `rebuild`
- `execution` — `inline` (default for small targeted runs) or `background` (default for broad runs)
- `attachmentIds` or `resourceIds` — narrow the run to specific items

## Workflow

### Phase 1: Snapshot Current Health

```
pm_knowledge { action: "status", scope: "<scope>", projectId: "<projectId>" }
```

Capture and report:
- `resourceCount`, `attachmentCount`, `chunkCount`, `codeChunkCount`, `docsChunkCount`
- `symbolCount`, `referenceCount`, `resolvedReferenceCount`, `unresolvedReferenceCount`, `crossResourceReferenceCount`
- `staleCount`, `failedCount`
- `activeEmbeddingModel` — if `null`, semantic search is unavailable; flag in the report

### Phase 2: Triage

```
pm_knowledge { action: "get", scope: "<scope>", projectId: "<projectId>" }
```

Bucket resources by `indexStatus`:

| Status | Action |
|--------|--------|
| `never_indexed` | Queue for incremental ingest |
| `indexing` | Skip — a run is already in progress; check back |
| `ready` | Skip unless rebuild was requested |
| `failed` | Inspect `latestIndexRun.errorMessage`; decide whether to retry or remove |
| `stale` | Queue for incremental ingest (resource changed since last successful run) |

For `failed` resources, surface the error message before queuing a retry. If the failure is policy-related (`KNOWLEDGE_SOURCE_TOO_LARGE`, sensitive path), the resource needs to be re-curated, not re-ingested.

### Phase 3: Choose Mode

| Situation | Mode |
|-----------|------|
| Routine refresh, stale resources, new attachments | `incremental` |
| Parser version changed; chunk shape will be different | `rebuild` |
| Recovering from systemic indexing bug | `rebuild` |
| Embedding model just changed | `rebuild` (semantic vectors must be regenerated) |
| Single failed resource with a transient cause | `incremental` (it will be re-attempted) |

`rebuild` re-extracts every chunk for the targeted resources — expensive. Confirm with the user before running `rebuild` on a broad scope.

### Phase 4: Choose Execution

| Situation | Execution |
|-----------|-----------|
| Small targeted run (one resource, one project) | `inline` (block, get a clean indexStatus on return) |
| Broad scope (`all`, large project) | `background` (returns immediately, drains via the queue) |
| User wants a synchronous answer | `inline` |
| User wants to fire-and-forget | `background` |

### Phase 5: Confirmation Checkpoint

For any `rebuild` run, or any run touching more than ~50 resources, present the plan and confirm:

```markdown
## Ingest Plan
Scope: <scope> (<projectKey or "global"/"all">)
Mode: <incremental | rebuild>
Execution: <inline | background>

### Resources targeted
- <count> total
  - never_indexed: <n>
  - stale: <n>
  - failed: <n>
  - ready (rebuild only): <n>

### Embedding model
- <activeEmbeddingModel or "none — semantic search unavailable">

Approve to proceed.
```

For routine `incremental` runs on a single project after a `source-curation` workflow, you may proceed without a checkpoint.

### Phase 6: Run

Targeted run:
```
pm_knowledge {
  action: "ingest",
  attachmentIds: ["01K...", "01K..."],
  mode: "incremental",
  execution: "inline"
}
```

Broad run:
```
pm_knowledge {
  action: "ingest",
  scope: "<scope>",
  projectId: "<projectId>",
  mode: "<mode>",
  execution: "background"
}
```

Selection precedence: `attachmentIds` → `resourceIds` → resolved scope. If you pass any id list, scope is ignored for selection.

### Phase 7: Verify

For `inline` runs:
1. Re-fetch `status` and `get`.
2. Confirm `staleCount` and `failedCount` moved as expected.
3. For each targeted resource, verify `indexStatus` is `ready` (or document why it remained `failed`).

For `background` runs:
1. Report `runIds` so the user can poll later.
2. Suggest re-running `status` after a wait to confirm completion.

### Phase 8: Report

```markdown
# Ingest Health Report
Scope: <scope> (<projectKey or "global"/"all">)
Mode: <mode> | Execution: <execution>

## Before
- resources: <count> | stale: <n> | failed: <n>
- embedding model: <key-or-"none">

## Run
- runIds: <runIds>
- queued: <count>, skipped: <count>
- warnings: <warnings-or-None>

## After  (inline only)
- stale: <n> | failed: <n>
- still failing: <list with errorMessage>

## Recommendations
- <next-step-or-None — e.g., re-curate failed sources, switch retrieval mode, attach embedding model>
```

## Decision Rules

- Default to `incremental`. Justify any `rebuild`.
- Default to `background` for `scope: "all"` or broad project runs; default to `inline` for single-resource targeted runs.
- For `failed` resources, inspect `errorMessage` before queuing a retry — policy failures need re-curation, not re-ingest.
- If `activeEmbeddingModel` is `null`, search will silently fall back to lexical even when `retrievalMode: "semantic"` is requested. Surface this; do not paper over it.
- Never run `rebuild` on `scope: "all"` without explicit user approval — it re-extracts every chunk in the workspace.

## Common Errors

| Error Code | Cause | Resolution |
|------------|-------|-----------|
| `KNOWLEDGE_INGEST_TARGET_REQUIRED` | No resolvable scope/attachment/resource | Provide `scope` (with `projectId` for `project`) or `attachmentIds`/`resourceIds` |
| `KNOWLEDGE_RESOURCE_NOT_FOUND` | `resourceIds` references a removed resource | Re-fetch via `get`; remove the stale id |
| `KNOWLEDGE_ATTACHMENT_NOT_FOUND` | `attachmentIds` references a removed attachment | Re-fetch via `get`; remove the stale id |
| `KNOWLEDGE_PROJECT_REQUIRED` | `scope: "project"` without resolvable `projectId` | Resolve `projectKey → projectId` |

## Anti-Patterns (DO NOT)

1. Run `rebuild` as a default — it re-extracts every chunk and is expensive
2. Run a broad-scope ingest without checking `status` first to size the work
3. Retry a `failed` resource without reading its `errorMessage`
4. Report ingest complete without confirming `indexStatus` moved off `never_indexed`/`stale`
5. Suppress the "no embedding model" condition when reporting search behavior
6. Run `inline` on `scope: "all"` — it will block for a long time; use `background` and report `runIds`
7. Re-ingest a policy-rejected resource — the source needs to be re-curated, not retried

<!--</instructions>-->
<!--</capability>-->
