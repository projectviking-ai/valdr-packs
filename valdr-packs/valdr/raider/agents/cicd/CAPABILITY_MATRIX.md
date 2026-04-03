# CI/CD Pipeline Agent — Capability Matrix

> **Agent:** `cicd-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `executor`

| Capability Key | Role | Category | File |
|---|---|---|---|
| `valdr.agents.cicd.cicd-agent.system` | `core` | system | `valdr.agents.cicd.cicd-agent.system.md` |
| `valdr.agents.cicd.github-actions` | `context` | tooling | `valdr.agents.cicd.github-actions.md` |
| `valdr.agents.cicd.pipeline-patterns` | `context` | architecture | `valdr.agents.cicd.pipeline-patterns.md` |
| `valdr.agents.cicd.deployment-strategies` | `workflow` | orchestration | `valdr.agents.cicd.deployment-strategies.md` |
| `valdr.agents.cicd.quality-gates` | `validation` | policy | `valdr.agents.cicd.quality-gates.md` |

## Notes
- Exactly one core capability: `valdr.agents.cicd.cicd-agent.system`.
- Secure defaults include pinned actions, least-privilege permissions, and secret-store integration.
