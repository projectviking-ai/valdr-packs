# Orchestrator — Capability Matrix (Mimir)

| Capability Key | Role | Pack | Hot-Load | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.orchestrator.mimir.system` | `core` | `valdr` | `no` | `valdr.orchestrator.mimir.system.md` |
| `valdr.orchestrator.mimir.source-curation` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.mimir.source-curation.md` |
| `valdr.orchestrator.mimir.ingest-health` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.mimir.ingest-health.md` |
| `valdr.orchestrator.mimir.search-retrieval` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.mimir.search-retrieval.md` |
| `valdr.orchestrator.mimir.code-mapping` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.mimir.code-mapping.md` |
| `valdr.orchestrator.mimir.knowledge-capture` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.mimir.knowledge-capture.md` |

Mimir's `search-retrieval`, `code-mapping`, and `knowledge-capture` workflows are **wrappers** that hot-load shared mechanics from `valdr.core.knowledge.*`. Other agents (planners, executors, reviewers) bind the shared capabilities directly without going through Mimir's wrappers.

Shared knowledge capabilities (hot-load entries on the agent record):

| Capability Key | Role | Pack | Source | Used by |
| --- | --- | --- | --- | --- |
| `valdr.core.knowledge.search` | `workflow` | `valdr` | `valdr/sovereign/core/knowledge/valdr.core.knowledge.search.md` | Planners researching, executors looking up patterns, reviewers checking precedent, Mimir |
| `valdr.core.knowledge.code-map` | `workflow` | `valdr` | `valdr/sovereign/core/knowledge/valdr.core.knowledge.code-map.md` | Planners scoping changes, executors finding callers, Mimir |
| `valdr.core.knowledge.memory-append` | `workflow` | `valdr` | `valdr/sovereign/core/knowledge/valdr.core.knowledge.memory-append.md` | Any agent that records its own memory — executors, planners, reviewers, Mimir |
| `valdr.core.knowledge.record-snapshot` | `workflow` | `valdr` | `valdr/sovereign/core/knowledge/valdr.core.knowledge.record-snapshot.md` | Executors at task done, reviewers at verification, Mimir |

Shared tool capabilities:

| Capability Key | Role | Pack | Source |
| --- | --- | --- | --- |
| `valdr.core.tools.pm-knowledge` | `integration` | `valdr` | `valdr/sovereign/core/tools/valdr.core.tools.pm-knowledge.md` |
| `valdr.core.tools.pm-project` | `integration` | `valdr` | `valdr/vanguard/core/tools/valdr.core.tools.pm-project.md` |
| `valdr.core.tools.pm-generate-ulid` | `integration` | `valdr` | `valdr/vanguard/core/tools/valdr.core.tools.pm-generate-ulid.md` |

## Agent Registration

```
pm_agent {
  action: "create",
  name: "Mimir Knowledge Orchestrator",
  handle: "mimir",
  kind: "bot",
  defaultRole: "orchestrator",
  tags: ["valdr", "sovereign", "orchestrator", "knowledge", "search", "code-map", "memory"],
  capabilities: [
    { key: "valdr.orchestrator.mimir.system" }
  ]
}
```

Workflow capabilities, shared knowledge capabilities, and tool-doc capabilities are hot-load entries in `mimir.agent.yaml`. The core prompt is the only always-loaded capability; hot-load entries remain discoverable on the agent record and are loaded on demand with `pm_capability prompt`.

## Hot-Loading Pattern

Pick the smallest set that matches the request; this is an index of available hot-loads, not a preload list.

```
pm_capability { action: "prompt", key: "valdr.orchestrator.mimir.source-curation" }
pm_capability { action: "prompt", key: "valdr.orchestrator.mimir.ingest-health" }
pm_capability { action: "prompt", key: "valdr.orchestrator.mimir.search-retrieval" }
pm_capability { action: "prompt", key: "valdr.orchestrator.mimir.code-mapping" }
pm_capability { action: "prompt", key: "valdr.orchestrator.mimir.knowledge-capture" }
pm_capability { action: "prompt", key: "valdr.core.knowledge.search" }
pm_capability { action: "prompt", key: "valdr.core.knowledge.code-map" }
pm_capability { action: "prompt", key: "valdr.core.knowledge.memory-append" }
pm_capability { action: "prompt", key: "valdr.core.knowledge.record-snapshot" }
pm_capability { action: "prompt", key: "valdr.core.tools.pm-knowledge" }
```

## Sovereign-Only

Mimir and the entire `valdr.core.knowledge.*` capability family are intentionally **sovereign-only**. The `pm_knowledge` tool is a sovereign-only MCP feature; do not promote any of these capabilities into the vanguard pack without first promoting the underlying tool.

## Composition for Other Agents

Other agents bind the shared knowledge capabilities directly in their `agent.yaml` — they do not need to invoke Mimir.

| Agent role | Recommended bindings |
|------------|---------------------|
| Executor | `valdr.core.knowledge.search`, `valdr.core.knowledge.code-map`, `valdr.core.knowledge.memory-append`, `valdr.core.knowledge.record-snapshot` (at task done) |
| Planner | `valdr.core.knowledge.search`, `valdr.core.knowledge.code-map`, `valdr.core.knowledge.memory-append` |
| Reviewer | `valdr.core.knowledge.search`, `valdr.core.knowledge.memory-append`, `valdr.core.knowledge.record-snapshot` (at verification) |

Each binding depends on the `pm_knowledge` MCP tool. Load `valdr.core.tools.pm-knowledge` only when the caller needs tool-contract details or validation diagnostics.
