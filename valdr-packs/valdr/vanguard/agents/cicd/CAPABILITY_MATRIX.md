# CI/CD Pipeline Agent — Capability Matrix

> **Agent:** `cicd-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `executor`

| Capability Key | Role | Category | Hot-Load | File |
|---|---|---|---|---|
| `valdr.agents.cicd.cicd-agent.system` | `core` | system | No | `valdr.agents.cicd.cicd-agent.system.md` |
| `valdr.agents.cicd.github-actions` | `context` | tooling | No | `valdr.agents.cicd.github-actions.md` |
| `valdr.agents.cicd.pipeline-patterns` | `context` | architecture | No | `valdr.agents.cicd.pipeline-patterns.md` |
| `valdr.agents.cicd.deployment-strategies` | `workflow` | orchestration | Yes | `valdr.agents.cicd.deployment-strategies.md` |
| `valdr.agents.cicd.quality-gates` | `validation` | policy | No | `valdr.agents.cicd.quality-gates.md` |

## Notes
- Exactly one core capability: `valdr.agents.cicd.cicd-agent.system`.
- Secure defaults include pinned actions, least-privilege permissions, and secret-store integration.
