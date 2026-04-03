# Freya Planner — Capability Matrix

> **Status:** Registered — all capabilities and agent registered in PM MCP.

| Capability Key | Role | Pack | Prompt ID (ULID) | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.planner.freya.system` | `core` | `valdr` | `01KFRZ03XK0C0797GMFQYS6JQQ` | `valdr.planner.freya.system.md` |
| `valdr.planner.freya.schema` | `workflow` | `valdr` | `01KFRZ041T98NM92HW83V9ZRJG` | `valdr.planner.freya.schema.md` |
| `valdr.planner.freya.tasks` | `workflow` | `valdr` | `01KFRZ043DYHSAV6WQCYY5CMYV` | `valdr.planner.freya.tasks.md` |
| `valdr.planner.freya.research` | `workflow` | `valdr` | `01KFRZ045ASPGG4KWFZWMF6FNP` | `valdr.planner.freya.research.md` |

## Agent Registration

Freya agent registered with handle `freya` and ID `01KFRZ0NAGHBCBQF01XYN620TC`.

```
pm_agent {
  action: "create",
  name: "Freya VMP Planner",
  handle: "freya",
  kind: "bot",
  defaultRole: "planner",
  tags: ["valdr", "planner", "vmp", "pm"],
  capabilities: [
    { key: "valdr.planner.freya.system" }
  ],
  prompts: [
    { promptId: "01KFRZ03XK0C0797GMFQYS6JQQ", useFor: ["system"] }
  ]
}
```

## Hot-Loading Pattern

To hot-load a capability at runtime:

```
// Step 1: Get capability → returns promptId
pm_capability { action: "get", key: "valdr.planner.freya.schema" }
→ { promptId: "01KF46TSDRJ5TH0ACYTJA3169X", ... }

// Step 2: Get prompt content
pm_prompt { action: "get", id: "01KF46TSDRJ5TH0ACYTJA3169X" }
→ { content: "# VMP Plan Schema\n...", ... }
```

## Composition Examples

**Minimal planner:**
- `valdr.planner.freya.system`

**Full planner with workflow guides:**
- `valdr.planner.freya.system`
- `valdr.planner.freya.schema`
- `valdr.planner.freya.tasks`
- `valdr.planner.freya.research`

## Related Packs

- `executor/task/` — Task execution capabilities
- `orchestrator/gunnar/` — Navigation and discovery
- `reviewer/sigrid/` — Code review capabilities
- `orchestrator/nikol/` — Registry orchestration
