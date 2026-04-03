# Infrastructure-as-Code Agent — Capability Matrix

> **Agent:** `infra-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `executor`

## Capabilities

| Capability Key | Role | Category | File |
|---|---|---|---|
| `valdr.agents.infra.infra-agent.system` | `core` | system | `valdr.agents.infra.infra-agent.system.md` |
| `valdr.agents.infra.terraform` | `context` | tooling | `valdr.agents.infra.terraform.md` |
| `valdr.agents.infra.containers` | `context` | tooling | `valdr.agents.infra.containers.md` |
| `valdr.agents.infra.cloud-patterns` | `context` | architecture | `valdr.agents.infra.cloud-patterns.md` |
| `valdr.agents.infra.networking` | `context` | architecture | `valdr.agents.infra.networking.md` |
| `valdr.agents.infra.observability` | `context` | operations | `valdr.agents.infra.observability.md` |
| `valdr.agents.infra.diagrams` | `context` | architecture | `valdr.agents.infra.diagrams.md` |
| `valdr.agents.infra.incident-triage` | `workflow` | operations | `valdr.agents.infra.incident-triage.md` |

## Prompts

| Prompt Key | Role | File |
|---|---|---|
| `valdr-agents-infra-gcloud-cheatsheet` | `context` | `cloud/gcloud-cheatsheet.md` |
| `valdr-agents-infra-aws-cheatsheet` | `context` | `cloud/aws-cheatsheet.md` |
| `valdr-agents-infra-cloudflare-cheatsheet` | `context` | `cloud/cloudflare-cheatsheet.md` |
| `valdr-agents-infra-azure-cheatsheet` | `context` | `cloud/azure-cheatsheet.md` |
| `valdr-agents-infra-vercel-cheatsheet` | `context` | `cloud/vercel-cheatsheet.md` |
| `valdr-agents-infra-flyio-cheatsheet` | `context` | `cloud/flyio-cheatsheet.md` |
| `valdr-agents-infra-digitalocean-cheatsheet` | `context` | `cloud/digitalocean-cheatsheet.md` |

## Notes

- Exactly one core capability: `valdr.agents.infra.infra-agent.system`.
- System prompt defines four operating modes (Build, Modify, Troubleshoot, Review) with a mandatory discovery-before-mutation workflow.
- Blast radius classification (read-only → additive → mutative → destructive) governs agent behavior per change.
- Hard constraints are embedded in the system prompt and enforced on every task.
- Cloud cheatsheets and incident triage are standalone prompts (not capability-backed).
