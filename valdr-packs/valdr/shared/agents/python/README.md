# Python Task Agent (`python-task-agent`)

> **Type:** Dumb Agent (Code Executor)
> **Pack:** `valdr-internal`
> **Handle:** `@python-task-agent`

## Overview

A language-specialized task executor for Python codebases. It prioritizes Pythonic design, modern typing, and repeatable tests.

## Capabilities

| Capability | Role | Description |
|------------|------|-------------|
| `valdr.internal.agents.python.python-task-agent.system` | core | Main persona and execution workflow |
| `valdr.internal.agents.python.build` | constraints | Build/packaging/env guidance |
| `valdr.internal.agents.python.code.rules` | constraints | Python style and typing conventions |
| `valdr.internal.agents.python.design.solid` | workflow | SOLID-inspired Python architecture guidance |
| `valdr.internal.agents.python.testing` | workflow | Pytest fixtures/parametrize/mock patterns |

## Language Focus

- Python 3.10+ typing syntax and static-analysis friendliness
- `pyproject.toml` driven packaging workflows
- `ruff`-centered lint/format pipelines
- Async correctness with `asyncio` patterns
- Composition-first, Pythonic architecture
