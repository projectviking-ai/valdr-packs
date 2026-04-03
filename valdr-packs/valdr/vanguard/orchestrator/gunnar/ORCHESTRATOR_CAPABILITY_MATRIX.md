# Orchestrator — Capability Matrix

> **Status:** Partially registered — core + navigation + registry in system. Task-creation and templates pending sync.

## Capabilities

| Capability Key | Role | Pack | Hot-Load | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.orchestrator.gunnar.system` | `core` | `valdr` | No | `valdr.orchestrator.gunnar.system.md` |
| `valdr.orchestrator.gunnar.navigation` | `workflow` | `valdr` | Yes | `valdr.orchestrator.gunnar.navigation.md` |
| `valdr.orchestrator.gunnar.registry` | `workflow` | `valdr` | Yes | `valdr.orchestrator.gunnar.registry.md` |
| `valdr.orchestrator.gunnar.task-creation` | `workflow` | `valdr` | Yes | `valdr.orchestrator.gunnar.task-creation.md` |

### Task Template Prompts (standalone, hot-loaded by key)

| Prompt Key | Role | Pack | Fragment |
| --- | --- | --- | --- |
| `valdr-orchestrator-gunnar-template-bug` | `guide` | `valdr` | `templates/valdr-orchestrator-gunnar-template-bug.md` |
| `valdr-orchestrator-gunnar-template-feature` | `guide` | `valdr` | `templates/valdr-orchestrator-gunnar-template-feature.md` |
| `valdr-orchestrator-gunnar-template-spike` | `guide` | `valdr` | `templates/valdr-orchestrator-gunnar-template-spike.md` |
| `valdr-orchestrator-gunnar-template-refactor` | `guide` | `valdr` | `templates/valdr-orchestrator-gunnar-template-refactor.md` |

## Agent Registration (Correct Pattern)

Per the hot-load registration rule, only the core capability is linked to the agent. Hot-load capabilities exist in the registry but are **not** in the agent's `capabilities` array.

```
pm_agent {
  action: "create",
  name: "Gunnar Orchestrator",
  handle: "gunnar",
  kind: "bot",
  defaultRole: "orchestrator",
  tags: ["valdr", "orchestrator", "navigation", "pm", "discovery", "task-creation"],
  capabilities: [
    { key: "valdr.orchestrator.gunnar.system" }
  ]
}
```

Hot-load capabilities are registered separately via `pm_capability { action: "ensure" }` and fetched at runtime via `pm_capability { action: "prompt", key: "<key>" }`.

## Hot-Loading Pattern

```
// Capability hot-load — returns prompt content with role/pack metadata
pm_capability { action: "prompt", key: "valdr.orchestrator.gunnar.navigation" }

// Prompt hot-load — returns raw prompt content (lighter weight)
pm_prompt { action: "get", key: "valdr-orchestrator-gunnar-template-bug" }
```

## Composition Examples

**Minimal orchestrator (startup):**
- `valdr.orchestrator.gunnar.system` (linked)

**Full orchestrator (all workflows hot-loaded):**
- `valdr.orchestrator.gunnar.system` (linked)
- `valdr.orchestrator.gunnar.navigation` (hot-load)
- `valdr.orchestrator.gunnar.registry` (hot-load)
- `valdr.orchestrator.gunnar.task-creation` (hot-load)

## Sync Checklist

When syncing hard files to the Valdr system:

- [ ] Agent updated — only core capability linked, hot-load caps removed from agent
- [ ] `valdr.orchestrator.gunnar.system` category corrected to `valdr.orchestrator.gunnar`
- [ ] `valdr.orchestrator.gunnar.task-creation` capability registered
- [ ] 4 template prompts registered
- [ ] Navigation and registry capabilities unlinked from agent
