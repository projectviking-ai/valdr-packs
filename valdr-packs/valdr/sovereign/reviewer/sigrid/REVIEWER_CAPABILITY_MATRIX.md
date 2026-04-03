# Reviewer — Capability Matrix

> **Status:** Registered — all capabilities and agent registered in PM MCP.

| Capability Key | Role | Pack | Prompt ID (ULID) | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.reviewer.sigrid.system` | `core` | `valdr` | `01KF13VAAGMC8NP4DXZ52100S2` | `valdr.reviewer.sigrid.system.md` |
| `valdr.reviewer.sigrid.workflow` | `workflow` | `valdr` | `01KF13VACVH9F7491NCKPR6YBA` | `valdr.reviewer.sigrid.workflow.md` |
| `valdr.reviewer.sigrid.severity` | `constraints` | `valdr` | `01KF13VAG0PEV4K38S8803GET9` | `valdr.reviewer.sigrid.severity.md` |
| `valdr.reviewer.sigrid.scoring` | `constraints` | `valdr` | `01KF13VAKC8MGM16M358SKYPND` | `valdr.reviewer.sigrid.scoring.md` |

## Agent Registration

Sigrid agent registered with handle `sigrid` and ID `01KF13WRV1XQP7PZZB8P0CN0EM`.

```
pm_agent {
  action: "create",
  name: "Sigrid Reviewer",
  handle: "sigrid",
  kind: "bot",
  defaultRole: "reviewer",
  tags: ["valdr", "reviewer", "code-review", "quality", "gatekeeper"],
  capabilities: [
    { key: "valdr.reviewer.sigrid.system" },
    { key: "valdr.reviewer.sigrid.workflow" }
  ]
}
```

> **Note:** Only non-hot-loaded capabilities are linked to the agent. Hot-loaded capabilities (severity, scoring) exist in the registry but are loaded on-demand via `pm_capability { action: "prompt" }`.

## Hot-Loading Pattern

To hot-load a capability at runtime:

```
pm_capability { action: "prompt", key: "valdr.reviewer.sigrid.severity" }
→ { "role": "constraints", "capability": "# Severity Classification Guide\n..." }
```

## Capability Roles

| Capability | Role | Purpose |
|------------|------|---------|
| `system` | `core` | Core identity and behaviors |
| `workflow` | `workflow` | How-to for CLI review workflow |
| `severity` | `constraints` | Rules for severity classification |
| `scoring` | `constraints` | Rules for scoring and alignment |

## Composition Examples

**Standard reviewer (agent-linked):**
- `valdr.reviewer.sigrid.system` (core)
- `valdr.reviewer.sigrid.workflow` (workflow)

**Full context (after hot-loading severity + scoring):**
- `valdr.reviewer.sigrid.system` (inlined)
- `valdr.reviewer.sigrid.workflow` (inlined)
- `valdr.reviewer.sigrid.severity` (hot-loaded before classifying findings)
- `valdr.reviewer.sigrid.scoring` (hot-loaded before publishing)
