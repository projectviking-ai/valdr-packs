<!--<capability id="valdr.core.knowledge.code-map" pack="valdr" role="workflow">-->
# Knowledge: Code Map

<!--<identity>-->
Reusable mechanics for `pm_knowledge code_map` — symbol-oriented graph navigation. Bind on any agent that needs to answer symbol-shaped questions: planners scoping changes, executors finding callers, knowledge orchestrators. Sovereign-only (depends on `pm_knowledge`).
<!--</identity>-->

<!--<instructions>-->

## When to Use Code Map vs Search

| Question Shape | Tool |
|----------------|------|
| Symbol or FQN given | `code_map` |
| `definition of`, `references to`, `callers of`, `imports of`, `tests for`, `docs for` | `code_map` |
| Free prose, multi-concept | `search` (use `valdr.core.knowledge.search`) |
| Filename or path prefix is the focus | `search` with `pathPrefixes` |

If the question doesn't match a `code_map` template, rephrase as a template — fallback to retrieval grouping is lower precision than running `search` directly.

## Query Templates

```
pm_knowledge {
  action: "code_map",
  scope: "all",
  query: "definition of <symbol>"
}
```

| Pattern | Intent | Returns |
|---------|--------|---------|
| `definition of <symbol\|FQN>` | `definition` | Definition sites for the resolved symbol |
| `references to <symbol\|FQN>` | `reference` | Chunks that reference the symbol |
| `callers of <symbol\|FQN>` | `caller` | Chunks whose references are calls/invocations |
| `imports of <symbol\|FQN>` | `import` | Chunks that import or re-export the symbol |
| `tests for <symbol>` | `test` | Test chunks classified as exercising the symbol |
| `docs for <symbol>` | `doc` | Doc chunks classified as describing the symbol |

## Symbol Form

| Form | Example | When |
|------|---------|------|
| FQN (qualified) | `KnowledgeIngestService.run` | **Preferred** — bypasses simple-name collisions |
| Plain name | `searchKnowledge` | Works when context disambiguates; rely more on filters |
| Module + symbol | (use `pathPrefixes` filter, not in query) | Constrain the namespace via path |

If a plain name has likely collisions, prefer the FQN.

## Pick Profile

| Profile | Use For |
|---------|---------|
| `compact` (default) | Agent navigation; minimum payload; grouped hits, intent target, group counts |
| `debug` | Relevance/role debugging — adds ranking reasons and attachment diagnostics |
| `full` | Reading/diagnosing code-map output — preserves requested content and raw retrieval diagnostics |

If `responseProfile` is omitted: `includeRawRetrieval` → `full`, else `includeDiagnostics` → `debug`, else `compact`. Be explicit; don't rely on inference.

## Pick Filters

`code_map` filters narrow returned hits but do **not** block FQN target-symbol resolution from crossing into matching dependencies.

| Filter | Effect |
|--------|--------|
| `pathPrefixes` | Limit returned hits to one tree without losing cross-file resolution; accepts `file://`, absolute, or project-relative |
| `languages` | Exclude same-name symbols in other languages |
| `symbolKinds` | For `references`/`imports`, filters the **referencing** chunk (not the target) |
| `knowledgeTypes` | Default `["code_intelligence"]`; switch to `["docs"]` for `docs for` template |
| `resourceKinds` | Same scope as `knowledgeTypes` |

**Not accepted by `code_map`:** `retrievalMode`, `exactToken`, `offset`, `trustTiers`, `attachmentIds`, or `includeScoreBreakdown`. Those are `search`-only.

## Result Shape

Top-level:

| Field | Use |
|-------|-----|
| `inferredIntent` | Confirms the template parsed correctly |
| `target` | Resolved symbol target. `null` = no target resolved; result is retrieval-derived |
| `usingPersistedSymbols`, `usingPersistedReferences` | `true` = graph traversal; `false` = retrieval-derived (lower precision for cross-file) |
| `groupOrder` | Role priority for the inferred intent |
| `groupCounts` | total / returned / omitted per role; explains what was budget-trimmed |

Hits are bucketed into `groups`: `definitions`, `references`, `imports`, `exports`, `tests`, `docs`, `related`. Each hit has the same fields as a search hit (`path`, line range, `symbolName`, `excerpt`, etc.).

## Refinement Loop

| Symptom | Adjustment |
|---------|-----------|
| `target: null` | Move from plain name to FQN; or add `pathPrefixes` containing the definition |
| `usingPersistedSymbols: false` | Persisted graph isn't populated for this scope — narrow scope, or accept retrieval-derived results |
| Too many cross-file hits | Add `pathPrefixes`; reduce `maxTotalHits`/`maxHitsPerGroup` |
| Wrong language match | Add `languages: ["<lang>"]` |
| Want to read the code | Re-run with `responseProfile: "full"`, `includeContent: true`, `contentBudgetTokens: 4000`, `contentMaxTokensPerHit: 800` |
| Want to understand role classification | Re-run with `responseProfile: "debug"` |

`code_map` does **not paginate**. To shape result size, use `maxTotalHits` and `maxHitsPerGroup`, not `offset`.

## Compound Investigations

Many real questions need more than one template. Common chains:

- **"Show me X and who uses it":** `definition of X`, then `references to X`. Combine in the response.
- **"Is X tested? what tests?":** `tests for X` first; if empty, `references to X` filtered to `pathPrefixes` containing your test root.
- **"What does X import, and how is it itself used?":** `imports of <something X depends on>` to find X's neighbors, then `references to X`.

Run sequentially; do not try to encode multiple intents in one query.

## Decision Rules

- Always identify the template before sending. If the user's phrasing doesn't match, rephrase.
- Prefer FQNs over plain names when collisions are likely.
- Default scope is `all`. Narrow only when the persisted graph is missing or noise dominates.
- Default profile is `compact`. Use `debug` for relevance questions, `full` only when reading code is the point.
- `responseProfile: "full"` does not request chunk text by itself; include `includeContent: true` and a content budget when the caller needs code.
- If `target: null` and `usingPersistedSymbols: false`, the result is retrieval-derived — flag this; do not present it as authoritative graph navigation.
- Never request `retrievalMode`, `exactToken`, `offset`, `trustTiers`, `attachmentIds`, or `includeScoreBreakdown` — `code_map` rejects them.

## Common Errors

| Error Code | Cause | Resolution |
|------------|-------|-----------|
| `KNOWLEDGE_PROJECT_REQUIRED` | `scope: "project"` without resolvable `projectId` | Resolve via `pm_project get` |
| (validation rejection) | Passed a search-only field | Drop the field; those are not accepted by `code_map` |

## Anti-Patterns (DO NOT)

1. Send free-prose queries and hope retrieval-grouping fallback returns graph-quality results
2. Use plain symbol names when an FQN is available
3. Pass search-only fields (`retrievalMode`, `offset`, `exactToken`, `trustTiers`, `attachmentIds`, `includeScoreBreakdown`) — `code_map` rejects them
4. Add `pathPrefixes` to "improve target resolution" — filters narrow returned hits, not target lookup
5. Treat `target: null` as success — it means the symbol wasn't resolved
6. Run with `responseProfile: "full"` by default — content payloads are large; use `compact` until reading is the point
7. Try to paginate — use `maxTotalHits`/`maxHitsPerGroup` to shape size

<!--</instructions>-->
<!--</capability>-->
