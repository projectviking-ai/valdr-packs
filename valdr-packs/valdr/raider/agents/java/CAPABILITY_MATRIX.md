# Java Task Agent — Capability Matrix

> **Agent:** `java-task-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `executor`

## Core Capability

| Capability Key | Role | Prompt ID | File |
|----------------|------|-----------|------|
| `valdr.agents.java.java-task-agent.system` | `core` | `TBD` | `valdr.agents.java.java-task-agent.system.md` |

## Linked Capabilities (Always Loaded)

| Capability Key | Role | Prompt ID | File |
|----------------|------|-----------|------|
| `valdr.agents.java.build` | `constraints` | `TBD` | `valdr.agents.java.build.md` |
| `valdr.agents.java.code.rules` | `constraints` | `TBD` | `valdr.agents.java.code.rules.md` |
| `valdr.agents.java.design.solid` | `workflow` | `TBD` | `valdr.agents.java.design.solid.md` |
| `valdr.agents.java.testing` | `workflow` | `TBD` | `valdr.agents.java.testing.md` |

## Additional Capabilities

| Capability Key | When to Load |
|----------------|--------------|
| `valdr.agents.java.design.solid` | Complex refactoring or architecture changes |
| `valdr.agents.java.testing` | Writing or debugging tests |
| `valdr.agents.java.build` | Build/dependency/multi-module issues |
| `valdr.agents.java.code.rules` | Detailed API/style design decisions |
