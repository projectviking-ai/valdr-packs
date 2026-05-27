<!--<capability id="valdr.core.tools.pm-knowledge" pack="valdr" role="integration">-->
# Tool: pm_knowledge

Knowledge attachment, ingestion, search, and code-graph navigation. Single MCP tool with an `action` discriminator covering source management, indexing, and retrieval.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params | Mutates |
|--------|---------|-----------------|---------|
| `get` | List attachments and resources for a scope | `scope` (+ `projectId` when `project`) | No |
| `update_sources` | Add/remove/enable/disable/update attachments | `scope`, `operations` | Yes |
| `record_entry` | Append/delete `agent_knowledge` notebooks and create/update/delete `valdr_record_materialized` entries | `mode`, `entryType`, `scope` | Yes |
| `ingest` | Queue resources for incremental or rebuild ingestion | — (selection inferred) | Yes |
| `search` | Filtered keyword/prose retrieval | `query` | No |
| `code_map` | Symbol-oriented graph navigation | `query` | No |
| `status` | Counters and embedding-model state for a scope | `scope` | No |
| `help` | Static help payload (no DB access) | — | No |

## Scopes

| Scope | Meaning | Notes |
|-------|---------|-------|
| `project` | Single project's attachments | Requires `projectId` |
| `projects` | Union of an explicit project list | Requires non-empty `projectIds` |
| `global` | Workspace-wide attachments | No project binding |
| `all` | Every attachment (all projects + global) | Default for `search` and `code_map` |

`update_sources` accepts only `project` or `global` — attachments must belong to exactly one scope.

## Trust Tiers

| Tier | Weight | Typical source |
|------|--------|----------------|
| `canonical` | 1.0 | First-party docs, primary spec |
| `operational` | 0.7 | Operator notes, runbooks |
| `memory` | 0.4 | Agent memory, scratch, drafts |

Trust tier multiplies the ranking score. Pick `canonical` only for authoritative material.

## Knowledge Types and Resource Kinds

Only these pairs are valid for `update_sources` `add`:

| Knowledge type | Valid resource kinds | Origin |
|----------------|---------------------|--------|
| `docs` | `folder` | `doc_folder` |
| `code_intelligence` | `folder` | `source_code` |

Managed/searchable entries are written through `record_entry`, not `update_sources`:

| Entry type | Search knowledge type | Resource kind | Supported modes |
|------------|-----------------------|---------------|-----------------|
| `valdr_record_materialized` | `valdr_record` | `record` | `create`, `update`, `delete` |
| `agent_knowledge` | `agent_knowledge` | `note` | `append`, `delete` |

`attachment:file`, `url:url`, and `code_intelligence:file` are compatibility values for older persisted rows. They are not current public attach modes.

## Usage Patterns

**Inspect what's attached to a project:**
```
pm_knowledge { action: "get", scope: "project", projectId: "01J..." }
pm_knowledge { action: "get", scope: "global" }
```

**Attach a docs folder to a project:**
```
pm_knowledge {
  action: "update_sources",
  scope: "project",
  projectId: "01J...",
  operations: [
    {
      op: "add",
      knowledgeType: "docs",
      resourceKind: "folder",
      locator: "file:///Users/me/dev/repo/docs",
      label: "Project docs",
      trustTier: "canonical"
    }
  ]
}
```

**Attach a code source:**
```
pm_knowledge {
  action: "update_sources",
  scope: "project",
  projectId: "01J...",
  operations: [
    {
      op: "add",
      knowledgeType: "code_intelligence",
      resourceKind: "folder",
      locator: "file:///Users/me/dev/repo/src",
      trustTier: "operational"
    }
  ]
}
```

**Re-weight or disable an attachment:**
```
pm_knowledge {
  action: "update_sources",
  scope: "project",
  projectId: "01J...",
  operations: [
    { op: "update", attachmentId: "01K...", rankingWeight: 1.4 },
    { op: "disable", attachmentId: "01K..." },
    { op: "remove", attachmentId: "01K..." }
  ]
}
```

**Append to an agent's project notebook (preferred for agent memory):**
```
pm_knowledge {
  action: "record_entry",
  mode: "append",
  entryType: "agent_knowledge",
  scope: "project",
  projectId: "01J...",
  agentHandle: "gunnar",
  title: "Planner memory",
  body: "Keep launch notes scoped to this project."
}
```

Append mode writes to **one notebook resource per agent per scope/project** instead of creating a fresh resource on every save. The locator is derived from the scope and agent: `valdr-agent-notes://project/{projectId}/<handle>` for project scope, `valdr-agent-notes://global/<handle>` for global. `agentHandle` is lowercased. Each call adds chunks to the existing notebook.

- Empty appends are rejected.
- `mode: "update"` is rejected for notebook resources — it would replace the locator and wipe accumulated notes. Use `append` to add, or `delete` to discard the entire notebook.
- For project-scoped memory, always pass `projectId` so notes do not leak across projects.

**Snapshot a Valdr record:**
```
pm_knowledge {
  action: "record_entry",
  mode: "create",
  entryType: "valdr_record_materialized",
  scope: "project",
  projectId: "01J...",
  recordType: "task",
  recordId: "01K...",
  recordVersion: 4,
  title: "TASK-123 v4 snapshot",
  body: "..."
}
```

`agent_knowledge` uses `append` to add memory and `delete` to remove a notebook or note. `mode: "create"` and `mode: "update"` are rejected for `agent_knowledge`. `mode: "update"` requires `entryId` and at least one mutable field for materialized Valdr records. `mode: "delete"` removes the resource and its attachments.

**Run an ingest:**
```
pm_knowledge {
  action: "ingest",
  scope: "project",
  projectId: "01J...",
  mode: "incremental",
  execution: "background"
}
```

| Field | Default | Effect |
|-------|---------|--------|
| `mode` | `incremental` | `incremental` skips unchanged resources; `rebuild` re-extracts every chunk |
| `execution` | `inline` | `inline` blocks until done; `background` returns immediately and drains via the queue |

Selection precedence: `attachmentIds` → `resourceIds` → resolved scope. Omitting `scope` and the id arrays defaults to `all` (every project plus global).

**Search:**
```
pm_knowledge {
  action: "search",
  scope: "all",
  query: "sanitize FTS",
  retrievalMode: "hybrid",
  responseProfile: "compact",
  topK: 10,
  knowledgeTypes: ["docs", "code_intelligence"],
  trustTiers: ["canonical", "operational"]
}
```

| Field | Range | Notes |
|-------|-------|-------|
| `topK` | 1–50, default 10 | Maximum hits returned |
| `offset` | ≥ 0, default 0 | Pagination offset |
| `retrievalMode` | `auto` (default), `lexical`, `semantic`, `hybrid` | `auto` picks semantic when available, else lexical |
| `responseProfile` | `compact` (default), `debug`, `full` | `compact` omits ranking diagnostics and de-duplicates attachment metadata; `debug` / `full` include score diagnostics |
| `exactToken` | default `false` | Require every term as a whole token |
| `enabledOnly` | default `true` | Skip disabled attachments |
| `includeContent` | default `false` | Add chunk text to hits, bounded by content budgets |
| `contentBudgetTokens` | default `6000` when `includeContent` | Approximate total content budget |
| `contentMaxTokensPerHit` | default `600` when `includeContent` | Approximate per-hit content cap |

Inspect `retrievalModeRequested` vs `retrievalModeUsed` and `semanticUnavailableReasons` if semantic was requested but a lexical fallback ran. Use `responseProfile: "debug"` when you need ranking reasons or score diagnostics; keep `compact` for normal agent navigation.

In compact search output, each hit references attachments by `effectiveAttachmentId` / `attachmentIds`, and the full attachment summaries are hoisted once into top-level `attachments`. Do not request debug/full just to get source labels; compact keeps the source fields agents normally need.

**Code map (symbol navigation):**
```
pm_knowledge {
  action: "code_map",
  scope: "all",
  query: "definition of searchKnowledge"
}
```

Recognized query templates:

| Pattern | Intent |
|---------|--------|
| `definition of <symbol\|FQN>` | `definition` |
| `references to <symbol\|FQN>` | `reference` |
| `callers of <symbol\|FQN>` | `caller` |
| `imports of <symbol\|FQN>` | `import` |
| `tests for <symbol>` | `test` |
| `docs for <symbol>` | `doc` |

Anything else falls back to retrieval grouping (search organized by role). Use `responseProfile`:

| Profile | Includes |
|---------|----------|
| `compact` (default) | Grouped hits, intent target, group order, group counts |
| `debug` | Adds ranking reasons and attachment diagnostics |
| `full` | Preserves requested content and raw retrieval diagnostics |

`responseProfile: "full"` does not by itself turn on content. To read code, pass `includeContent: true` with `contentBudgetTokens` / `contentMaxTokensPerHit`; to inspect raw retrieval, pass `includeRawRetrieval: true`.

`code_map` does **not** accept `retrievalMode`, `exactToken`, `offset`, `trustTiers`, `attachmentIds`, or `includeScoreBreakdown` — use `search` for those.

**Status counters:**
```
pm_knowledge { action: "status", scope: "all" }
pm_knowledge { action: "status", scope: "project", projectId: "01J..." }
```

Returns resource/attachment/chunk/symbol/reference counters, `staleCount`, `failedCount`, the active embedding model key, and indexed languages.

## Locators

Locators are normalized at attach time:

- Absolute paths (`/Users/me/...`) → rewritten as `file://` URLs
- `file://` URLs → round-tripped for stable form
- Anything else → rejected with `KNOWLEDGE_INVALID_LOCATOR`

Filters that accept `pathPrefixes` understand `file://` URLs, absolute paths, or project-relative paths.

## Source Policy

`update_sources` `add` enforces:

- **Project scope:** locator must live inside one of the project's repo roots, or `KNOWLEDGE_SOURCE_OUTSIDE_PROJECT` is returned.
- **Global scope:** no system roots (`/`, `$HOME`, `/tmp`, …) — `KNOWLEDGE_SOURCE_TOO_BROAD`.
- **Sensitive paths:** directories like `.ssh`, `.aws` and credential filenames are rejected with `KNOWLEDGE_SENSITIVE_SOURCE`.
- **Folder size:** exceeding `VALDR_KNOWLEDGE_MAX_SOURCE_FILES` returns `KNOWLEDGE_SOURCE_TOO_LARGE`.

Choose `code_intelligence` for local source-tree folders and `docs` for local documentation folders. Individual files and URLs are not current public attach modes.

## Common Error Codes

| Code | Meaning |
|------|---------|
| `KNOWLEDGE_INVALID_LOCATOR` | Locator could not be normalized to a local folder path / `file://` folder URL |
| `KNOWLEDGE_PROJECT_REQUIRED` | Project scope used without (or with an unknown) `projectId` |
| `KNOWLEDGE_SOURCE_OUTSIDE_PROJECT` | Project source not inside any repo root |
| `KNOWLEDGE_SOURCE_TOO_BROAD` | Global folder was a system root |
| `KNOWLEDGE_SOURCE_TOO_LARGE` | Folder exceeded the max-files limit |
| `KNOWLEDGE_SENSITIVE_SOURCE` | Folder matched the sensitive-name policy |
| `KNOWLEDGE_RESOURCE_NOT_FOUND` | Targeted `resourceId` does not exist |
| `KNOWLEDGE_ATTACHMENT_NOT_FOUND` | Targeted `attachmentId` does not exist |
| `KNOWLEDGE_INGEST_TARGET_REQUIRED` | `ingest` had no resolvable scope/attachment/resource |
| `KNOWLEDGE_RECORD_ENTRY_MODE_REQUIRED` | `record_entry` missing `mode` |
| `KNOWLEDGE_UNKNOWN_ACTION` | `action` not one of the eight valid values |

## When to Use Which Action

| Need | Action |
|------|--------|
| "What's attached here?" | `get` |
| Add/remove a local docs or code folder | `update_sources` |
| Append to an agent's running notebook | `record_entry` (`mode: "append"`) |
| Snapshot a Valdr record | `record_entry` (`mode: "create"`, `entryType: "valdr_record_materialized"`) |
| Re-index after content changed | `ingest` (incremental) or `ingest` with `mode: "rebuild"` |
| Free-text search across docs/code | `search` |
| "Where is X defined / who calls Y?" | `code_map` |
| Health/KPI counters | `status` |

## Key Rules

- **Choose the right scope** — `project` requires `projectId`; `update_sources` cannot use `all`/`projects`.
- **Pair knowledge type with resource kind correctly** — invalid pairs reject at `update_sources`.
- **Use `record_entry` for notes and Valdr records** — never `update_sources`.
- **Use `append` for agent memory** — `create` and `update` are rejected for `agent_knowledge`; append accumulates into one notebook per agent per scope/project.
- **Always pass `agentHandle` and `projectId` on `append`** — the locator (`valdr-agent-notes://project/{projectId}/<handle>`) is derived from them; without `projectId` notes go to the global notebook.
- **Never `update` a notebook resource** — it is rejected by design. Use `append` to add or `delete` to discard the whole notebook.
- **Locators must be local folders** — supply absolute folder paths or `file://` folder URLs; relative paths fail.
- **Project sources stay inside repo roots** — switch to `global` for cross-project knowledge.
- **Prefer `code_map` over `search` for symbol questions** — use the recognized query templates so it walks the persisted graph.
- **Check `retrievalModeUsed`** — if you requested semantic and got lexical, `semanticUnavailableReasons` explains why.
- **Run `ingest` after `update_sources`** — new attachments start at `never_indexed` until a run completes.
- **Use `incremental` ingest by default** — `rebuild` is for parser/version changes or recovering from failed runs.
- **Mind the source-policy errors** — sensitive paths and overly broad globals are rejected by design; pick a narrower path rather than working around the policy.

<!--</instructions>-->
<!--</capability>-->
