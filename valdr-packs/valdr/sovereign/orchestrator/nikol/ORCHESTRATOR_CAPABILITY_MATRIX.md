# Orchestrator - Capability Matrix (Nikol, Sovereign)

> **Status:** Sovereign override. Base Nikol registry behavior is inherited from vanguard; this layer adds agent-memory notebook access through `pm_knowledge`.

## Capability Bindings

| Capability Key | Role | Pack | Hot-Load | Source |
| --- | --- | --- | --- | --- |
| `valdr.orchestrator.nikol.system` | `core` | `valdr` | `no` | `valdr/sovereign/orchestrator/nikol/valdr.orchestrator.nikol.system.md` |
| `valdr.orchestrator.nikol.agent-design` | `workflow` | `valdr` | `yes` | `valdr/vanguard/orchestrator/nikol/valdr.orchestrator.nikol.agent-design.md` |
| `valdr.orchestrator.nikol.agent-assembly` | `workflow` | `valdr` | `yes` | `valdr/vanguard/orchestrator/nikol/valdr.orchestrator.nikol.agent-assembly.md` |
| `valdr.orchestrator.nikol.capability-authoring` | `workflow` | `valdr` | `yes` | `valdr/vanguard/orchestrator/nikol/valdr.orchestrator.nikol.capability-authoring.md` |
| `valdr.orchestrator.nikol.pack-authoring` | `workflow` | `valdr` | `yes` | `valdr/vanguard/orchestrator/nikol/valdr.orchestrator.nikol.pack-authoring.md` |
| `valdr.orchestrator.nikol.tag-map` | `context` | `valdr` | `yes` | `valdr/vanguard/orchestrator/nikol/valdr.orchestrator.nikol.tag-map.md` |
| `valdr.core.registry.composition` | `context` | `valdr` | `yes` | `valdr/vanguard/core/registry/valdr.core.registry.composition.md` |
| `valdr.core.registry.taxonomy` | `context` | `valdr` | `yes` | `valdr/vanguard/core/registry/valdr.core.registry.taxonomy.md` |
| `valdr.core.registry.naming` | `context` | `valdr` | `yes` | `valdr/vanguard/core/registry/valdr.core.registry.naming.md` |
| `valdr.core.specs.agent-yaml` | `context` | `valdr` | `yes` | `valdr/vanguard/core/specs/valdr.core.specs.agent-yaml.md` |
| `valdr.core.specs.pack-yaml` | `context` | `valdr` | `yes` | `valdr/vanguard/core/specs/valdr.core.specs.pack-yaml.md` |
| `valdr.core.specs.prompt-markdown` | `context` | `valdr` | `yes` | `valdr/vanguard/core/specs/valdr.core.specs.prompt-markdown.md` |
| `valdr.core.knowledge.memory-append` | `workflow` | `valdr` | `yes` | `valdr/sovereign/core/knowledge/valdr.core.knowledge.memory-append.md` |
| `valdr.core.tools.pm-agent` | `integration` | `valdr` | `yes` | `valdr/vanguard/core/tools/valdr.core.tools.pm-agent.md` |
| `valdr.core.tools.pm-prompt` | `integration` | `valdr` | `yes` | `valdr/vanguard/core/tools/valdr.core.tools.pm-prompt.md` |
| `valdr.core.tools.pm-capability` | `integration` | `valdr` | `yes` | `valdr/vanguard/core/tools/valdr.core.tools.pm-capability.md` |
| `valdr.core.tools.pm-knowledge` | `integration` | `valdr` | `yes` | `valdr/sovereign/core/tools/valdr.core.tools.pm-knowledge.md` |

## Agent Registration

The agent manifest includes the core capability plus hot-load bindings. The core prompt is the only always-loaded capability; hot-load bindings are discoverable on the agent record and loaded on demand with `pm_capability prompt`.

```
capabilities:
  - key: valdr.orchestrator.nikol.system
    role: core
  - key: valdr.core.knowledge.memory-append
    role: workflow
    hot-load: true
  - key: valdr.core.tools.pm-knowledge
    role: integration
    hot-load: true
```

## Sovereign Memory Hot-Loading

For routine notebook memory work, hot-load the shared mechanics:

```
pm_capability { action: "prompt", key: "valdr.core.knowledge.memory-append" }
```

Load the full tool contract only for validation or parameter diagnostics:

```
pm_capability { action: "prompt", key: "valdr.core.tools.pm-knowledge" }
```

Use `agentHandle: "nikol"` for Nikol's own memory. Use `scope: "global"` only when the note is a cross-project registry convention.

## Tier Boundary

This override intentionally lives in `valdr/sovereign/orchestrator/nikol`. Vanguard does not include `pm_knowledge`, so do not move these bindings into the vanguard Nikol manifest unless the underlying tool is promoted to vanguard too.
