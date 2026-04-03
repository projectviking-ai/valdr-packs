# Rust Task Agent — Capability Matrix

> **Agent:** `rust-task-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `executor`

## Core Capability

| Capability Key | Role | Prompt ID | File |
|----------------|------|-----------|------|
| `valdr.agents.rust.rust-task-agent.system` | `core` | `TBD` | `valdr.agents.rust.rust-task-agent.system.md` |

## Linked Capabilities (Always Loaded)

| Capability Key | Role | Prompt ID | File |
|----------------|------|-----------|------|
| `valdr.agents.rust.build` | `constraints` | `TBD` | `valdr.agents.rust.build.md` |
| `valdr.agents.rust.code.rules` | `constraints` | `TBD` | `valdr.agents.rust.code.rules.md` |
| `valdr.agents.rust.design.solid` | `workflow` | `TBD` | `valdr.agents.rust.design.solid.md` |
| `valdr.agents.rust.testing` | `workflow` | `TBD` | `valdr.agents.rust.testing.md` |

## Hot-Loadable Capabilities (On Demand)

This agent can hot-load additional capabilities at runtime:

```
pm_capability { action: "prompt", key: "<capability-key>" }
```

| Capability Key | When to Load |
|----------------|--------------|
| `valdr.agents.rust.design.solid` | Complex refactoring or architecture changes |
| `valdr.agents.rust.testing` | Writing or debugging tests |
| `valdr.agents.rust.build` | Build or workspace feature issues |
| `valdr.agents.rust.code.rules` | Detailed type/ownership decisions |
