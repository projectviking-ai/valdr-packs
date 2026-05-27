<!--<capability id="valdr.orchestrator.mimir.source-curation" pack="valdr" role="workflow">-->
# Source Curation Workflow

<!--<identity>-->
Attach, re-weight, enable/disable, and remove knowledge sources with correct trust tier, scope, and source-policy compliance. Use this workflow whenever a source attachment changes — the inventory, policy, and verification steps are non-negotiable.
<!--</identity>-->

<!--<instructions>-->

## When This Workflow Applies

Hot-load this workflow when the user (or another agent) wants to:

- Attach a docs folder or code folder to a project or globally
- Remove or disable an existing source
- Re-weight an attachment via `rankingWeight`
- Change a label or trust tier on an existing attachment
- Audit attached sources for redundancy, stale provenance, or trust-tier inflation

For ingest health and triage of stale/failed resources, hot-load `ingest-health` instead.

## Inputs

Required:
- `scope` — `project` or `global`
- For `project` scope: `projectKey` or `projectId`
- The intended operation(s) — add / remove / enable / disable / update

Helpful but inferable:
- `knowledgeType` and `resourceKind` (must be a valid pair)
- `trustTier` (default `operational` for code; `canonical` only when authoritative)
- `rankingWeight` (default `1.0`, range `0.1`–`2.0`)
- `label` (display name)

## Workflow

### Phase 1: Resolve and Inventory

1. If a `projectKey` was supplied, resolve to id:
   ```
   pm_project { action: "get", key: "<projectKey>" }
   ```
2. List current attachments and resources for the scope:
   ```
   pm_knowledge { action: "get", scope: "<scope>", projectId: "<projectId>", includeDisabled: true }
   ```
3. Note redundancy candidates: same locator attached twice, near-duplicate folders, sources where `indexStatus` is `failed` (call out for `ingest-health`).

### Phase 2: Validate the Plan

For each intended operation, validate **before** sending the mutation:

#### `add`
- **Pair check.** `knowledgeType` and `resourceKind` must be a valid combination:

  | knowledgeType | valid resourceKind |
  |---------------|-------------------|
  | `docs` | `folder` |
  | `code_intelligence` | `folder` |

  `valdr_record` and `agent_knowledge` are **not** added through `update_sources` — those use `record_entry` (hot-load `knowledge-capture`).

- **Locator check.** Must be an absolute local folder path or a `file://` folder URL. Relative paths and web URLs are rejected with `KNOWLEDGE_INVALID_LOCATOR`.
- **Project-scope path check.** For `scope: "project"`, the path must live inside one of the project's repo roots. If the user supplies a path outside, ask whether they want `global` scope instead.
- **Global-scope breadth check.** Reject system roots (`/`, `$HOME`, `/tmp`, …) and known sensitive directories (`.ssh`, `.aws`, credential filenames).
- **Folder size.** Very large folders may exceed `VALDR_KNOWLEDGE_MAX_SOURCE_FILES`; ask the user to narrow the path before sending the mutation.
- **Trust tier sanity.** Default `operational`. Use `canonical` only for first-party docs / primary spec / official guides. Use `memory` for scratch/notes (typically only set automatically by `record_entry`).

#### `update`
- Requires `attachmentId` and at least one of `label`, `trustTier`, `rankingWeight`, `enabled`.
- Use `update` to retune ranking or re-tier an existing attachment — do **not** remove and re-add.

#### `remove`
- Removes the attachment; the underlying resource may persist if other attachments reference it.
- Prefer `disable` when the user might want to re-enable later (no re-ingest cost on enable).

#### `enable` / `disable`
- Just `attachmentId`. Disabled attachments are skipped by `search` unless `enabledOnly: false` is passed.

### Phase 3: Confirmation Checkpoint

For destructive ops (`remove`) or multi-op batches, present the plan and confirm:

```markdown
## Source Curation Plan
Scope: <scope> (<projectKey or "global">)

| Op | Target | Type / Tier / Weight |
|----|--------|----------------------|
| add | <locator> | <knowledgeType>/<resourceKind>, <trustTier>, weight <rankingWeight> |
| update | <attachmentId> (<label>) | trustTier <old>→<new>, weight <old>→<new> |
| remove | <attachmentId> (<label>) | <knowledgeType> — chunks will be unlinked; resource persists if other attachments reference it |
| disable | <attachmentId> | hidden from search until re-enabled |

Approve to proceed.
```

For pure `add` / `enable` / `disable` with no destructive effects, you may proceed without a checkpoint but still surface what you did in the response.

### Phase 4: Apply Mutations

Send a single `update_sources` call with all approved operations:

```
pm_knowledge {
  action: "update_sources",
  scope: "<scope>",
  projectId: "<projectId>",
  operations: [ ... ]
}
```

Notes:
- `update_sources` is batched per scope — separate `project` and `global` operations into two calls.
- The response includes `applied` count, the updated `attachments` list, and `warnings`. Surface every warning.

### Phase 5: Verify and Trigger Ingest

For each `add`:

1. Re-fetch `get` to confirm the attachment exists and the resource has the expected `knowledgeType`, `resourceKind`, and `canonicalLocator`.
2. Trigger an ingest so the new source is searchable:
   ```
   pm_knowledge {
     action: "ingest",
     scope: "<scope>",
     projectId: "<projectId>",
     mode: "incremental",
     execution: "background"
   }
   ```
3. If the user needs the source to be searchable before you report completion, run `execution: "inline"` and re-check `indexStatus` — it should move from `never_indexed` → `ready`. If it lands in `failed`, hand off to `ingest-health`.
4. If you used `execution: "background"`, report the source as attached and ingest as queued/pending until a later status check confirms `ready`.

For `update`/`enable`/`disable`/`remove`, verify the attachment row reflects the change in the `get` response — no ingest needed unless `update` changed something the indexer cares about (it does not; indexing is per-resource).

### Phase 6: Report

```markdown
# Source Curation Complete
Scope: <scope> (<projectKey or "global">)

## Applied
- add: <locator> → attachment <id> (<knowledgeType>/<resourceKind>, <trustTier>, weight <rankingWeight>)
- update: <id> (<label>) — <fields-changed>
- remove / disable / enable: <id> (<label>)

## Ingest
- runIds: <runIds>
- queued: <count>, skipped: <count>

## Verification
- <attachment>: <indexStatus or "ingest pending"> (chunks: <count or pending>)

## Warnings
- <warnings-from-update_sources-or-None>

## Next Steps
- If a source landed in failed: hot-load `valdr.orchestrator.mimir.ingest-health`
- If you also want to capture project memory: hot-load `valdr.orchestrator.mimir.knowledge-capture`
```

## Decision Rules

- Never declare a source searchable/ready without an ingest run and an `indexStatus` check. Background ingest means "attached; ingest pending" until status confirms `ready`.
- Never use `update_sources` for `agent_knowledge` or `valdr_record` types — those go through `record_entry`.
- Default trust tier is `operational`. Justify any `canonical` attachment in the response.
- Prefer `disable` over `remove` when the source might be re-enabled later.
- Resolve `projectKey → projectId` once per workflow run; cache locally for the rest of the workflow.

## Common Errors

| Error Code | Cause | Resolution |
|------------|-------|-----------|
| `KNOWLEDGE_INVALID_LOCATOR` | Relative path, unsupported scheme, or non-folder locator | Use an absolute folder path or `file://` folder URL |
| `KNOWLEDGE_PROJECT_REQUIRED` | `scope: "project"` without resolvable `projectId` | Resolve `projectKey → projectId` via `pm_project get` |
| `KNOWLEDGE_SOURCE_OUTSIDE_PROJECT` | Project source not inside any repo root | Ask user to switch to `global`, or pick a path inside the project repo |
| `KNOWLEDGE_SOURCE_TOO_BROAD` | Global folder is a system root | Pick a narrower folder |
| `KNOWLEDGE_SOURCE_TOO_LARGE` | Folder exceeded the max-files limit | Narrow the folder |
| `KNOWLEDGE_SENSITIVE_SOURCE` | Folder matched the sensitive-name policy | Pick a different path; do not work around |
| `KNOWLEDGE_ATTACHMENT_NOT_FOUND` | `update`/`remove` targeted a non-existent attachment | Re-run `get` to refresh attachment ids |

## Anti-Patterns (DO NOT)

1. Attach a source and report success without running an ingest and verifying `indexStatus`
2. Mark operational notes as `canonical` to push them higher in ranking
3. Use `remove` + `add` instead of `update` to retune trust tier or ranking weight
4. Promote a project-specific source to `global` scope to dodge the repo-root check
5. Use `update_sources` for `agent_knowledge` or `valdr_record` — those are `record_entry` types
6. Suppress warnings from `update_sources` — surface every one
7. Send a single `update_sources` call mixing `project` and `global` operations — split into two

<!--</instructions>-->
<!--</capability>-->
