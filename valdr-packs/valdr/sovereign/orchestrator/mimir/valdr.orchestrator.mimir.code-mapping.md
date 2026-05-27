<!--<capability id="valdr.orchestrator.mimir.code-mapping" pack="valdr" role="workflow">-->
# Code Mapping Workflow

<!--<identity>-->
Mimir's orchestration of `pm_knowledge code_map`. Wraps the shared `valdr.core.knowledge.code-map` mechanics with intake, compound-investigation, and response-shape patterns specific to Mimir as a user-facing knowledge orchestrator. The mechanics live in the shared capability — this file covers the orchestration on top.
<!--</identity>-->

<!--<instructions>-->

## On Hot-Load

Hot-load the shared mechanics first:

```
pm_capability { action: "prompt", key: "valdr.core.knowledge.code-map" }
```

This loads the templates, FQN preference, profile selection, filter rules, refinement loop, and decision rules. Everything below adds Mimir's orchestration layer on top.

## When This Workflow Applies

The user (or another agent invoking Mimir) has a symbol or FQN. Hot-load this workflow when:

- The user names a function, class, method, or FQN
- The question is "where is X defined", "who calls Y", "imports of Z", "tests for W", "docs for V"
- A previous `search` returned the right area but the user wants symbol-level precision
- A caller agent wants Mimir to trace symbol relationships

For prose / multi-concept queries, redirect to `valdr.orchestrator.mimir.search-retrieval`.

## Intake Loop

Clarify before querying. A good code-map question has:

- **Symbol** — name or FQN; FQN preferred when collisions are likely
- **Intent** — definition / references / callers / imports / tests / docs
- **Boundary** — `all` is usually right; narrow to `pathPrefixes` if results need scoping
- **Depth** — does the user want one answer or a compound investigation?

If the user supplied a plain name and the codebase likely has collisions, ask:

- "Did you mean `<FQN1>` or `<FQN2>`?"

If the user said "where is X" without specifying intent, default to `definition of X` and offer "I can also pull references / callers / imports / tests / docs after."

## Compound Investigations

Most real code-mapping questions are compound. Recognize and chain:

| User asks | Mimir runs |
|-----------|-----------|
| "Show me X and where it's used" | `definition of X` → `references to X` |
| "Is X tested?" | `tests for X`; if empty, `references to X` filtered to a test path prefix |
| "What does X depend on, and who depends on X?" | `imports of <X's deps>` (if known) → `references to X` |
| "Where is the bug in X coming from?" | `callers of X` → narrow each caller's scope; consider follow-up `search` on error text |

Run sequentially; do not encode multiple intents in one query. Combine in the response.

## Refinement (Mimir-Specific Decisions)

Per the shared workflow's refinement table, with Mimir's judgment on top:

| Situation | Mimir's choice |
|-----------|----------------|
| `target: null` and a plain name was used | Ask the user for the FQN rather than guessing |
| `usingPersistedSymbols: false` for the whole scope | Surface this — the user is getting retrieval-derived results, not graph traversal; offer to scope down to a project where the graph is populated |
| Cross-language collision (e.g., same name in TS and Python) | Add `languages` filter; do not silently pick one |
| User wants to read the code | Promote to `responseProfile: "full"` with `includeContent: true` and a budget; do not return raw chunks unbounded |
| Many references and the user is exploring impact | Offer to group by `pathPrefixes` (UI / API / tests) in the response |

## Result Delivery

Match the response shape to the caller:

### To a human user

```markdown
# Code Map Result
Query: "<query>"
Intent: <inferredIntent>  Target: <target or "(unresolved)">
Scope: <scope>  Profile: <responseProfile>
Graph: symbols=<usingPersistedSymbols> references=<usingPersistedReferences>

## <Group>  (<returned>/<total>, <omitted> omitted)
1. <path>:<lineStart>-<lineEnd> [<symbolKind>] <symbolName>
   > <excerpt>

## Notes
- <retrieval-fallback-callout-if-target-unresolved>
- <suggested-follow-up-template-or-FQN-promotion>
```

### To a caller agent

Default to compact group structure — preserve `groupOrder` so the caller knows which group the orchestrator considered primary. Do not pre-format for human reading. For full chunk text, re-run with `responseProfile: "full"`, `includeContent: true`, and small budgets.

### For compound investigations

Stitch results across calls into a single narrative response, with a section per template you ran. Include the queries you ran so the user can reproduce.

## Anti-Patterns (Mimir-Specific)

These are Mimir-orchestration anti-patterns; the mechanics anti-patterns live in `valdr.core.knowledge.code-map`.

1. Skip intake when intent is ambiguous (e.g., "where is X" — defaults to `definition` but offer to follow up)
2. Guess an FQN when the user gave a plain name with likely collisions — ask
3. Run multiple intents in one query — chain templates instead
4. Hide retrieval-derived results behind compact formatting — surface when graph wasn't used
5. Pre-format compact agent-to-agent results for human reading

<!--</instructions>-->
<!--</capability>-->
