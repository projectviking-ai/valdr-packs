<!--<capability id="valdr.core.knowledge.search" pack="valdr" role="workflow">-->
# Knowledge: Search

<!--<identity>-->
Reusable mechanics for `pm_knowledge search` — scope, retrieval mode, filters, and result interpretation. Bind on any agent that needs filtered prose retrieval over indexed knowledge: planners researching, executors looking up patterns, reviewers checking precedent, knowledge orchestrators. Sovereign-only (depends on `pm_knowledge`).
<!--</identity>-->

<!--<instructions>-->

## When to Use Search vs Code Map

| Question Shape | Tool |
|----------------|------|
| "Where do we talk about X?" / "Find docs about Y" | `search` |
| Free prose, multi-concept | `search` |
| Filename or path prefix is the focus | `search` with `pathPrefixes` |
| Symbol or FQN given | `code_map` (use `valdr.core.knowledge.code-map`) |
| "Where is X defined?" / "Who calls Y?" / "Imports of Z" / "Tests for W" / "Docs for V" | `code_map` |

If the agent has both shared capabilities bound, use the question shape to pick. If only one is bound and the question doesn't fit, surface the limitation.

## The Search Call

```
pm_knowledge {
  action: "search",
  scope: "all",
  query: "<phrase>",
  retrievalMode: "auto",
  responseProfile: "compact",
  topK: 10,
  trustTiers: ["canonical", "operational"]
}
```

## Pick Scope

| Scope | When |
|-------|------|
| `all` (default) | General "find me something relevant" |
| `project` (+ `projectId`) | Question is bound to one project |
| `projects` (+ non-empty `projectIds`) | Question spans an explicit subset |
| `global` | Workspace-wide knowledge only |

For project scope, resolve `projectKey → projectId` via `pm_project { action: "get", key }`.

## Pick Retrieval Mode

| Mode | When |
|------|------|
| `auto` (default) | General retrieval; inspect the returned mode and availability |
| `lexical` | Exact phrase or unique token must match (combine with `exactToken: true` for whole-token matching) |
| `semantic` | Conceptual / "vibe" search |
| `hybrid` | Lexical and semantic matches when available |

After the call, inspect `retrievalModeRequested` vs `retrievalModeUsed`. If `semantic`/`hybrid` was requested but `lexical` ran, check `semanticUnavailableReasons` (`semantic_backend_unavailable`, `no_embedding_model`). **Surface the fallback** — do not paper over it.

## Pick Filters

Filters compose with AND. Start broad, narrow if results are noisy.

| Filter | When |
|--------|------|
| `knowledgeTypes` | Narrow to `["docs"]`, `["code_intelligence"]`, etc. |
| `trustTiers` | Default `["canonical", "operational"]` to suppress memory-tier scratch; add `"memory"` if notes are wanted |
| `languages` | Code search constrained to a language |
| `pathPrefixes` | Question scoped to a subtree (`["src/services"]`) — accepts `file://`, absolute, or project-relative |
| `attachmentIds` | The user already named the source |
| `enabledOnly: false` | Diagnostic only — search disabled attachments |
| `responseProfile` | Use `compact` by default; use `debug` or `full` only when score diagnostics are needed |

Over-filtering produces zero hits. If you get zero, drop the most restrictive filter first.

## Result Shape

Each hit:

| Field | Use |
|-------|-----|
| `path`, `lineStart`, `lineEnd` | Cite the chunk to the caller |
| `excerpt` | Default surfaceable snippet |
| `title`, `sectionTitle`, `sectionPath` | Navigational context |
| `knowledgeType`, `resourceKind` | What kind of source produced this |
| `language`, `symbolKind`, `symbolName`, `symbolKey` | Code chunks only |
| `tokenEstimate` | Cost hint for follow-up `includeContent` calls |
| `rankingReasons` | Why this hit ranked — present in `debug` / `full` profiles |
| `score` | Relevance score, also present in compact results |
| `scoreBreakdown` | Ranking details in `debug` / `full` profiles |

Top-level:
- `totalHitCount` — if very large, narrow filters; if 0, broaden
- `truncated: true` — more hits exist beyond `topK`; page with `offset`
- `embeddingModelKeyUsed` — which model produced semantic scores
- `attachments` — compact profile hoists repeated attachment summaries here; hits reference them by `effectiveAttachmentId` / `attachmentIds`

## Refinement Loop

| Symptom | Adjustment |
|---------|-----------|
| Zero hits | Drop a filter; switch `lexical` ↔ `semantic`; widen scope |
| Too many irrelevant hits | Add `knowledgeTypes` / `pathPrefixes` / `trustTiers`; tighten with `exactToken: true` |
| Right area, wrong chunks | Add `pathPrefixes`; raise `topK`; switch to `hybrid` |
| Unsure why a chunk ranks | Re-run with `responseProfile: "debug"` |
| Need full chunk text for a few hits | Re-run with smaller `topK` and `includeContent: true` |
| Symbol-shaped question, not prose | Stop — switch to `code_map` |

For pagination, use `offset` (not larger `topK`):
```
pm_knowledge { action: "search", ..., topK: 10, offset: 10 }
```

## Score Diagnostics (when needed)

With `responseProfile: "debug"` or `"full"`, hits include ranking diagnostics such as `rankingReasons` and `scoreBreakdown`:

Lexical and semantic matches help explain relevance. Trust tiers also influence
ranking; the returned `trust` diagnostic helps explain that influence.

| Trust tier | Typical source |
|------------|----------------|
| `canonical` | First-party docs, primary specs, official project guidance |
| `operational` | Runbooks, operator notes, project references |
| `memory` | Agent notes, draft observations, lower-confidence context |

Memory ranks below trusted project documentation unless the source is
deliberately promoted. Source curation can change `trustTier` and
`rankingWeight`; inspect the returned attachment metadata when a source's
ranking is surprising. Explain the returned reasons alongside the source's
content and provenance, without assuming fixed weights or reconstructing a
score formula.

## Result Delivery

When returning results to a caller (user or another agent):

| Caller wants | Surface |
|--------------|---------|
| Navigation hint | `path:lineStart-lineEnd` + `excerpt` |
| Quotable code | Re-run with small `topK` and `includeContent: true`, then cite |
| Relevance explanation | Re-run with `responseProfile: "debug"`, summarize |
| Many results to scan | Compact list of `path:line` + 1-line excerpt; offer to deepen on a specific hit |

Default to the navigation-hint shape. Inflate to `includeContent` only when asked or when the caller will quote the chunk.

## Decision Rules

- Default scope is `all` for read queries; narrow only when the request did.
- Default trust filter is `["canonical", "operational"]` — add `"memory"` only when notes/scratch are wanted.
- Never silently fall back from semantic to lexical — surface the reason.
- Default `responseProfile` is `compact`; use `debug` / `full` only when the caller needs ranking diagnostics. Compact avoids replaying full attachment metadata on every hit.
- Use `includeContent` only for small `topK` (≤5) — full-chunk payloads are large.
- For symbol-shaped questions, switch to `code_map`. `search` will work but is less precise.

## Common Errors

| Error Code | Cause | Resolution |
|------------|-------|-----------|
| `KNOWLEDGE_PROJECT_REQUIRED` | `scope: "project"` without resolvable `projectId` | Resolve via `pm_project get` |
| `KNOWLEDGE_INVALID_LOCATOR` | `pathPrefixes` had an unsupported value | Use `file://`, absolute, or project-relative |

Most search errors are validation-time; runtime returns empty hits rather than errors.

## Anti-Patterns (DO NOT)

1. Use `search` for symbol-shaped questions when `code_map` applies
2. Over-filter on the first attempt — start broad, narrow on the next call
3. Silently fall back from `semantic` to `lexical` without telling the caller
4. Set `topK: 50` as a default — that's a max, not a target
5. Pass `includeContent: true` with large `topK` — payloads explode
6. Drop `trustTiers` filtering and serve memory-tier scratch as a top hit
7. Treat `truncated: true` as "no more results" — page with `offset`

<!--</instructions>-->
<!--</capability>-->
