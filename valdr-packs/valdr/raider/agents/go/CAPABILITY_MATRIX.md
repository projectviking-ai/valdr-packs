# Go Task Agent — Capability Matrix

> **Agent:** `go-task-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `executor`

## Core Capability

| Capability Key | Role | Prompt ID | File |
|----------------|------|-----------|------|
| `valdr.agents.go.go-task-agent.system` | `core` | `TBD` | `valdr.agents.go.go-task-agent.system.md` |

## Linked Capabilities (Always Loaded)

| Capability Key | Role | Prompt ID | File |
|----------------|------|-----------|------|
| `valdr.agents.go.build` | `constraints` | `TBD` | `valdr.agents.go.build.md` |
| `valdr.agents.go.code.rules` | `constraints` | `TBD` | `valdr.agents.go.code.rules.md` |
| `valdr.agents.go.design.solid` | `workflow` | `TBD` | `valdr.agents.go.design.solid.md` |
| `valdr.agents.go.testing` | `workflow` | `TBD` | `valdr.agents.go.testing.md` |

## Additional Capabilities

| Capability Key | When to Load |
|----------------|--------------|
| `valdr.agents.go.design.solid` | Complex refactoring or architecture changes |
| `valdr.agents.go.testing` | Writing or debugging tests |
| `valdr.agents.go.build` | Build or module-resolution issues |
| `valdr.agents.go.code.rules` | Detailed style or API decisions |
