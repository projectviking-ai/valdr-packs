# Refactor Scout — Capability Matrix

| Capability Key | Role | Pack | Prompt Fragment |
| --- | --- | --- | --- |
| `valdr.agents.refactor-agent.refactor-scout.system` | `core` | `valdr` | `valdr.agents.refactor-agent.refactor-scout.system.md` |
| `valdr.agents.refactor-agent.scan-workflow` | `workflow` | `valdr` | `valdr.agents.refactor-agent.scan-workflow.md` |
| `valdr.agents.refactor-agent.reporting` | `validation` | `valdr` | `valdr.agents.refactor-agent.reporting.md` |
| `valdr.agents.refactor-agent.task-conversion` | `integration` | `valdr` | `valdr.agents.refactor-agent.task-conversion.md` |
| `valdr.agents.refactor-agent.language-selection` | `context` | `valdr` | `valdr.agents.refactor-agent.language-selection.md` |
| `valdr.agents.refactor-agent.typescript-guidance` | `constraints` | `valdr` | `valdr.agents.refactor-agent.typescript-guidance.md` |
| `valdr.agents.refactor-agent.java-guidance` | `constraints` | `valdr` | `valdr.agents.refactor-agent.java-guidance.md` |
| `valdr.agents.refactor-agent.rust-guidance` | `constraints` | `valdr` | `valdr.agents.refactor-agent.rust-guidance.md` |

All capabilities are bundled with the agent pack.

## Composition

Minimal load:
- `valdr.agents.refactor-agent.refactor-scout.system`

Typical scan:
- `valdr.agents.refactor-agent.refactor-scout.system`
- `valdr.agents.refactor-agent.scan-workflow`
- `valdr.agents.refactor-agent.language-selection`
- one or more language guidance capabilities
- `valdr.agents.refactor-agent.reporting`

Task conversion mode:
- `valdr.agents.refactor-agent.refactor-scout.system`
- `valdr.agents.refactor-agent.task-conversion`
- `valdr.agents.refactor-agent.reporting`
