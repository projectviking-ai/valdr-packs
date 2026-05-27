<!--<capability id="valdr.core.knowledge.memory-append" pack="valdr" role="workflow">-->
# Knowledge: Memory Append

<!--<identity>-->
Reusable mechanics for appending agent learnings to a per-agent notebook via `pm_knowledge record_entry { mode: "append" }`. Hot-load this on demand for agents that occasionally record memory; bind it only when memory capture is part of the agent's normal flow. Sovereign-only (depends on `pm_knowledge`).
<!--</identity>-->

<!--<instructions>-->

## When to Use This

Hot-load when the agent needs to **persist a learning** that should be retrievable later:

- An executor recording why an implementation took a non-obvious path
- A planner recording assumptions that informed a plan
- A reviewer recording a recurring quality issue
- A knowledge orchestrator recording on behalf of itself or another agent

Keep this as the routine notebook capability. Load `valdr.core.tools.pm-knowledge` only when the tool contract, validation error, or non-notebook `pm_knowledge` action is unclear.

Do **not** use for:
- Attaching docs / code folders → use `update_sources` (knowledge orchestrator's source-curation workflow)
- Snapshotting Valdr records → use `valdr.core.knowledge.record-snapshot`
- One-off curated reference snippets → append them to the appropriate agent notebook, or snapshot a Valdr record if the snippet represents record state

## The Append Call

```
pm_knowledge {
  action: "record_entry",
  mode: "append",
  entryType: "agent_knowledge",
  scope: "project",
  projectId: "<projectId>",
  agentHandle: "<your-handle>",
  title: "<short title>",
  body: "<self-contained note>"
}
```

For workspace-wide memory:

```
pm_knowledge {
  action: "record_entry",
  mode: "append",
  entryType: "agent_knowledge",
  scope: "global",
  agentHandle: "<your-handle>",
  title: "<short title>",
  body: "<self-contained note>"
}
```

## How Notebooks Work

- One notebook resource per `(scope, projectId, agentHandle)` triple. Project memory and global memory are separate notebooks.
- Locator: `valdr-agent-notes://project/{projectId}/<handle>` or `valdr-agent-notes://global/<handle>`.
- `agentHandle` is lowercased before locator derivation.
- Each `append` adds chunks to the existing notebook — the notebook is never replaced.
- The notebook is created on first append for a given triple.

## What to Write

A good notebook entry stands alone when retrieved cold. Bad entries are noise.

### Self-contained body

The body must make sense without the conversation that produced it. Include:

- **Subject** — what the note is about (a feature, file, decision, incident)
- **What** — the fact, decision, finding, or learning
- **Why** — the reason or evidence behind it
- **References** — task keys, sprint ids, file paths, commit shas, or URLs that anchor the note
- **Date** — absolute date (`2026-05-02`), never relative ("yesterday", "last sprint")

### Title is a search hook

The `title` is what shows up first when the chunk is retrieved. Make it specific:

- Bad: `Memory note`, `Update`, `Learning`
- Good: `LIGHTNING-123: switched LRU cache to ARC after benchmark`, `Sigrid rejects PRs over 800 LOC by default`

### Append per learning, not per session

One entry per discrete learning. Do not pack a session log into one append — that creates one giant chunk that retrieves poorly. If you have three distinct learnings, send three appends.

### Tag with context

When relevant, include in the body:

- Task key (`TASK-123`) so retrieval surfaces the note when working that task again
- Sprint id when the note is sprint-bound
- File paths when the note is code-specific (`tools/pm-mcp/src/services/knowledge.ts`)
- Other agent handles when the note is about an interaction

## Capture-on-Behalf-Of

When one agent records memory **for** another (typically a knowledge orchestrator capturing on behalf of an executor):

- `agentHandle` is the **target agent's** handle, not the caller's
- The notebook locator therefore points at the target's notebook
- Mention the capturing agent in the body (`captured by <handle>`) for provenance

## Constraints

- **Empty `body` is rejected.** Confirm content before sending.
- **`mode: "create"` and `mode: "update"` are rejected for `agent_knowledge`.** Append a correction instead, or `delete` the whole notebook/note.
- **`projectId` is required for `scope: "project"`** — without it, notes go to the global notebook (or fail).
- Source-policy errors do not apply — notebooks live at synthetic `valdr-agent-notes://` locators.

## Verifying

After an append, verify by reading back:

```
pm_knowledge { action: "get", scope: "<scope>", projectId: "<projectId>" }
```

Confirm the notebook resource exists with the expected locator. Chunk counts update when ingest runs over the resource (typically automatic; for inline confirmation, request `execution: "inline"` in a follow-up `ingest` call).

## Common Errors

| Error Code | Cause | Resolution |
|------------|-------|-----------|
| `KNOWLEDGE_RECORD_ENTRY_MODE_REQUIRED` | Missing `mode` | Supply `mode: "append"` |
| `KNOWLEDGE_PROJECT_REQUIRED` | `scope: "project"` without `projectId` | Resolve `projectKey → projectId` via `pm_project get` |
| (validation: empty body) | `body` was empty | Provide non-empty content |
| (validation: notebook update) | Tried `update` on a notebook resource | Use `append` to add or `delete` to discard |

## Anti-Patterns (DO NOT)

1. Use `mode: "create"` for agent memory — it is rejected; use `append`
2. Omit `agentHandle` or `projectId` on `append` — the notebook locator depends on both
3. Send empty `body` — rejected by validation
4. Try to `update` a notebook resource — rejected; the locator and accumulated notes would be wiped
5. Pack a session log into one append — split into one append per discrete learning
6. Use relative dates (`yesterday`, `last week`) — convert to absolute dates so the note remains interpretable
7. Write notes that only make sense in the current conversation — make them self-contained
8. Capture another agent's memory under your own `agentHandle` — use the target agent's handle and credit yourself in the body

<!--</instructions>-->
<!--</capability>-->
