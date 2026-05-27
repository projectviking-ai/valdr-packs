<!--<capability id="valdr.orchestrator.mimir.search-retrieval" pack="valdr" role="workflow">-->
# Search Retrieval Workflow

<!--<identity>-->
Mimir's orchestration of `pm_knowledge search`. Wraps the shared `valdr.core.knowledge.search` mechanics with intake, refinement, and response-shape patterns specific to Mimir as a user-facing knowledge orchestrator. The mechanics live in the shared capability — this file covers the orchestration on top.
<!--</identity>-->

<!--<instructions>-->

## On Hot-Load

Hot-load the shared mechanics first:

```
pm_capability { action: "prompt", key: "valdr.core.knowledge.search" }
```

This loads the search call shape, scope/mode/filter selection, refinement loop, response profiles, score diagnostics, and decision rules. Everything below adds Mimir's orchestration layer on top.

## When This Workflow Applies

The user (or another agent invoking Mimir) wants prose retrieval over the index. Hot-load this workflow when:

- The user asks "find docs about X", "where do we talk about Y", "search for Z"
- A previous `search` returned irrelevant results and needs filter tuning
- The user wants ranking transparency or to compare retrieval modes
- A caller agent wants Mimir to run a search and return shaped results

For symbol questions (`definition of`, `references to`, `callers of`, `imports of`, `tests for`, `docs for`), redirect to `valdr.orchestrator.mimir.code-mapping`.

## Intake Loop

Clarify before querying. A good search question has:

- **Subject** — what the user wants to find
- **Boundary** — `all` / a project / a path subtree
- **Shape** — docs, code, both
- **Quality bar** — `canonical` only? include operational?

If any of these are unclear and the cost of asking is low, ask one targeted question:

- "Should I search across all projects, or just `<projectKey>`?"
- "Are you looking for docs, code, or both?"
- "Is there a path I should restrict to (e.g., `tools/pm-mcp/src`)?"

If the user is impatient or the question is already specific, run the first query with sensible defaults (scope `all`, retrieval `auto`, `responseProfile: "compact"`, trust `["canonical", "operational"]`, `topK: 10`) and refine.

Keep first-pass searches compact. Compact output keeps path, line, excerpt, source label, ids, and the top-level attachment dictionary, while avoiding repeated full attachment objects per hit.

## First Query

Apply the shared mechanics. Always include the explicit field list rather than relying on defaults — agents that read the call should see the choices.

## Refinement (Mimir-Specific Decisions)

When applying the shared refinement loop, Mimir-specific judgment calls:

| Situation | Mimir's choice |
|-----------|----------------|
| Zero hits and the user is exploratory | Broaden one filter at a time and announce what you dropped — do not silently widen everything |
| Too many hits and the user is researching | Offer to narrow by `pathPrefixes` or `knowledgeTypes` rather than just adding filters unilaterally |
| Semantic fell back to lexical | Surface `semanticUnavailableReasons` and offer to attach an embedding model (route to `ingest-health` for the model swap) |
| Memory-tier results dominate | Suggest the user wanted higher-tier sources; do not silently filter them out unless asked |
| User asks "why did this rank?" | Re-run with `responseProfile: "debug"` and explain in plain language |

Run at most 3 refinement passes before pausing to ask the user if the question itself needs reshaping.

## Result Delivery

Match the response shape to the caller:

### To a human user

```markdown
# Search Result
Query: "<query>"
Scope: <scope>  Mode: <retrievalModeUsed> (requested: <retrievalModeRequested>)
Hits: <returned>/<totalHitCount>  <truncated indicator>

## Top Hits
1. <path>:<lineStart>-<lineEnd> [<knowledgeType>] [<symbolName-if-any>]
   > <excerpt>
2. ...

## Filters Applied
- <filter>: <value>

## Notes
- <retrieval-fallback-or-availability-callout-or-None>
- <suggested-next-query-if-results-thin>
```

### To a caller agent

Default to a structured-but-compact list — paths, line ranges, excerpts, attachment ids, and a brief note on retrieval mode. The caller agent will likely re-cite or re-quote, so do not pre-format for human reading. If the caller asked for chunk content, re-run with `includeContent: true` and small `topK`.

## Compound Questions

If the user's question reveals a graph-shaped follow-up (e.g., "find docs about X" then "and who calls X"), redirect the second part to `code-mapping` rather than fighting it with `search` filters.

## Anti-Patterns (Mimir-Specific)

These are Mimir-orchestration anti-patterns; the mechanics anti-patterns live in `valdr.core.knowledge.search`.

1. Skip intake clarification when scope and shape are obviously unclear and the user is patient
2. Silently broaden filters during refinement — announce what you dropped and why
3. Force a search to answer a symbol question — redirect to `code-mapping`
4. Pre-format compact agent-to-agent results for human reading
5. Run more than ~3 refinement passes without pausing to reshape the question

<!--</instructions>-->
<!--</capability>-->
