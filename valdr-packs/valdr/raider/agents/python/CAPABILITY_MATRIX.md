# Python Task Agent — Capability Matrix

> **Agent:** `python-task-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `executor`

## Core Capability

| Capability Key | Role | Prompt ID | File |
|----------------|------|-----------|------|
| `valdr.agents.python.python-task-agent.system` | `core` | `TBD` | `valdr.agents.python.python-task-agent.system.md` |

## Linked Capabilities (Always Loaded)

| Capability Key | Role | Prompt ID | File |
|----------------|------|-----------|------|
| `valdr.agents.python.build` | `constraints` | `TBD` | `valdr.agents.python.build.md` |
| `valdr.agents.python.code.rules` | `constraints` | `TBD` | `valdr.agents.python.code.rules.md` |
| `valdr.agents.python.design.solid` | `workflow` | `TBD` | `valdr.agents.python.design.solid.md` |
| `valdr.agents.python.testing` | `workflow` | `TBD` | `valdr.agents.python.testing.md` |

## Additional Capabilities

| Capability Key | When to Load |
|----------------|--------------|
| `valdr.agents.python.design.solid` | Complex refactoring or architecture changes |
| `valdr.agents.python.testing` | Writing or debugging tests |
| `valdr.agents.python.build` | Packaging/env/toolchain issues |
| `valdr.agents.python.code.rules` | Detailed typing or exception decisions |
