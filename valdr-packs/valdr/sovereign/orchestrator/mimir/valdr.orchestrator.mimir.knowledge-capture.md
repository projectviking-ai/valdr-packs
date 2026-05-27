<!--<capability id="valdr.orchestrator.mimir.knowledge-capture" pack="valdr" role="workflow">-->
# Knowledge Capture Workflow

<!--<identity>-->
Mimir's orchestration of `pm_knowledge record_entry`. Wraps the shared `valdr.core.knowledge.memory-append` and `valdr.core.knowledge.record-snapshot` mechanics with curatorial guidance, multi-entry batches, capture-on-behalf-of routing, and notebook audits specific to Mimir as the knowledge orchestrator. The mechanics live in the shared capabilities — this file covers the orchestration on top.
<!--</identity>-->

<!--<instructions>-->

## On Hot-Load

Hot-load whichever shared capability matches the request:

```
pm_capability { action: "prompt", key: "valdr.core.knowledge.memory-append" }
pm_capability { action: "prompt", key: "valdr.core.knowledge.record-snapshot" }
```

Memory-append is for ongoing agent learnings. Record-snapshot is for `valdr_record_materialized` entries (tasks, sprints, plans, reviews). Hot-load both if the request mixes them.

## When This Workflow Applies

The user (or another agent invoking Mimir) wants to **write** knowledge:

- Append a learning to an agent's notebook
- Snapshot a Valdr record at a version
- Update or delete a previously recorded entry
- Audit an agent's notebook contents
- Bulk-capture a batch of related entries

For attaching docs/code folders, use `source-curation`. For ingest of attached sources, use `ingest-health`.

## Decision: Append vs Create vs Snapshot

| Situation | Tool |
|-----------|------|
| Agent learning that should accumulate over time | Memory-append (`mode: "append"`, `entryType: "agent_knowledge"`) |
| One-off curated reference snippet | Memory-append (`mode: "append"`, `entryType: "agent_knowledge"`) under the appropriate agent handle |
| Snapshotting a Valdr record at a specific version | Record-snapshot (`mode: "create"`, `entryType: "valdr_record_materialized"`) |
| Editing/correcting notebook memory | Append a correction; `mode: "update"` is rejected for `agent_knowledge` |
| Removing a notebook, note, or snapshot entirely | `mode: "delete"` |

## Capture-on-Behalf-Of (Mimir-Specific Routing)

Mimir is often invoked by another agent who wants to record memory. Resolve the right `agentHandle`:

| Caller | `agentHandle` to use |
|--------|---------------------|
| User says "record this for executor `bjorn`" | `bjorn` |
| Caller agent (Skadi, executor, reviewer) is the source of the learning | The caller's handle |
| Mimir is recording its own observation | `mimir` |

Always credit the capturing agent in the body when it differs from `agentHandle`:

```
captured by mimir on behalf of bjorn — 2026-05-02
```

This preserves provenance for future retrieval.

## Curatorial Pre-Check

Before sending an `append`, sanity-check the body for the four self-contained-entry markers (per `valdr.core.knowledge.memory-append`):

1. **Subject** — what the note is about
2. **What** — the fact, decision, or learning
3. **Why** — reason / evidence
4. **References** — task keys, file paths, commit shas, dates

If any are missing, push back: "This note is missing `<X>`. Should I add `<suggested addition>`, or is this intentional?"

For snapshots, sanity-check that `recordType` / `recordId` / `recordVersion` are all present and that `body` is not just an id reference.

## Multi-Entry Batches

When the user wants to record several related learnings in one pass:

1. Confirm the list with the user before sending — show titles and a 1-line summary of each.
2. Send appends sequentially (not batched in a single call — `record_entry` is one entry per call).
3. Include shared context (task key, sprint id, date) in each body — do not assume retrieval will surface them together.
4. Report each `entryId` returned so the user can reference specific entries later.

## Notebook Audit

When the user asks "what's in my notebook?" or "what does `<agentHandle>` know about `<projectKey>`?":

1. Resolve project: `pm_project { action: "get", key: "<projectKey>" }`
2. Inventory: `pm_knowledge { action: "get", scope: "project", projectId: "<id>" }` and find the notebook resource (locator: `valdr-agent-notes://project/{projectId}/<handle>`)
3. Search the notebook's content: `pm_knowledge { action: "search", scope: "project", projectId: "<id>", query: "<topic>", attachmentIds: ["<notebook-attachment-id>"], includeContent: true }`
4. Report entries grouped by topic / date

For workspace-wide notebooks: `scope: "global"`.

## Cleanup / Deletion

Notebook deletion is destructive — accumulated memory is lost. Always confirm explicitly:

- "Deleting `<agentHandle>`'s notebook for `<projectKey>` will remove `<N>` chunks of accumulated memory. This cannot be undone. Confirm?"

For individual notes, use `mode: "delete"` with `entryId` and `noteId` when available. For snapshots, `mode: "delete"` with `entryId` removes one resource. Confirm with one prompt; do not require per-entry confirmation in batches if the user has already approved the batch.

For corrections to a notebook, **append a correction**; do not try to `update` (rejected by validation).

## Snapshot Policy

Mimir's recommended snapshot triggers (suggest these proactively when the user is recording adjacent state):

| When | Snapshot |
|------|----------|
| Task moves to `done` | The task at its `done` version |
| Task moves to `verified` | The task with the review summary in body |
| Sprint closes | The sprint and its task outcomes |
| Plan is finalized | The plan at the version work was committed against |

Do not snapshot every state change. Suggest at meaningful transitions and let the user opt in.

## Result Delivery

```markdown
# Knowledge Capture Complete
Mode: <mode>  EntryType: <entryType>
Scope: <scope> (<projectKey or "global">)
Capturing agent: <handle> (on behalf of <other> if applicable)

## Result
- entryId: <id>
- resource: <resourceId> (<canonicalLocator>)
- attachment: <attachmentId>

## Notebook State  (append only)
- locator: <valdr-agent-notes://...>
- entries appended this pass: <count>
- latestIndexRun: <status / timestamp>

## Notes
- <warnings-or-None>
```

For batches, repeat the result block per entry (or a compact table if >5).

## Anti-Patterns (Mimir-Specific)

These are Mimir-orchestration anti-patterns; the mechanics anti-patterns live in the shared capabilities.

1. Skip the curatorial pre-check and pass through low-quality entries
2. Capture under `agentHandle: "mimir"` when the learning came from a caller agent
3. Confirm a notebook deletion silently — it is destructive; require explicit confirmation
4. Auto-suggest a snapshot for every state change — restrict to meaningful transitions
5. Try to fix a notebook entry with `update` — append a correction; `update` on notebooks is rejected

<!--</instructions>-->
<!--</capability>-->
