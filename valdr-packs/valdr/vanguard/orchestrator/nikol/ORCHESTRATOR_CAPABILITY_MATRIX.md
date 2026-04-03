# Orchestrator — Capability Matrix (Nikol)

> **Status:** Registered — all capabilities and agent registered in PM MCP.

| Capability Key | Role | Pack | Prompt ID (ULID) | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.orchestrator.nikol.system` | `core` | `valdr` | `01KFRHKCZP449RJ2R3YRKCQGD5` | `valdr.orchestrator.nikol.system.md` |
| `valdr.orchestrator.nikol.agent-design` | `workflow` | `valdr` | `01KFRHKD2QCP325VTN95WMNPFZ` | `valdr.orchestrator.nikol.agent-design.md` |
| `valdr.orchestrator.nikol.capability-authoring` | `workflow` | `valdr` | `01KFRHKD5HJ7CX6Q1R8KFBH1DW` | `valdr.orchestrator.nikol.capability-authoring.md` |
| `valdr.orchestrator.nikol.pack-authoring` | `workflow` | `valdr` | *pending registration* | `valdr.orchestrator.nikol.pack-authoring.md` |
| `valdr.orchestrator.nikol.tag-map` | `context` | `valdr` | `01KFRHKD6YY7588SZ2EMCGQC4C` | `valdr.orchestrator.nikol.tag-map.md` |

## Agent Registration

Nikol agent registered with handle `nikol` and ID `01KFW9QKBZMX5RK7WMK7VYNP8S`.

```
pm_agent {
  action: "create",
  name: "Nikol Registry Orchestrator",
  handle: "nikol",
  kind: "bot",
  defaultRole: "orchestrator",
  tags: ["valdr", "orchestrator", "registry", "agent-design", "capability-authoring"],
  capabilities: [
    { key: "valdr.orchestrator.nikol.system" }
  ]
}
```

Workflow guides (`valdr.orchestrator.nikol.agent-design`, `valdr.orchestrator.nikol.capability-authoring`, `valdr.orchestrator.nikol.tag-map`) are hot-loaded and should not be linked on the base agent.

## Hot-Loading Pattern

To hot-load a capability at runtime:

```
pm_capability { action: "prompt", key: "valdr.orchestrator.nikol.agent-design" }
→ { role: "workflow", capability: "# Agent Design Guide\n..." }
```

## Composition Examples

**Minimal registry orchestrator:**
- `valdr.orchestrator.nikol.system`

**Full registry orchestrator with guides:**
- `valdr.orchestrator.nikol.system`
- `valdr.orchestrator.nikol.agent-design`
- `valdr.orchestrator.nikol.capability-authoring`

**Registry orchestrator with tool capabilities:**
- `valdr.orchestrator.nikol.system`
- `valdr.core.tools.pm-agent`
- `valdr.core.tools.pm-prompt`
- `valdr.core.tools.pm-capability`
