# Infrastructure-as-Code Agent — Capability Matrix

> **Agent:** `infra-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `executor`

## Capabilities

| Capability Key | Role | Category | Hot-Load | File |
|---|---|---|---|---|
| `valdr.agents.infra.infra-agent.system` | `core` | system | No | `valdr.agents.infra.infra-agent.system.md` |
| `valdr.agents.infra.terraform` | `context` | tooling | Yes | `valdr.agents.infra.terraform.md` |
| `valdr.agents.infra.containers` | `context` | tooling | Yes | `valdr.agents.infra.containers.md` |
| `valdr.agents.infra.cloud-patterns` | `context` | architecture | Yes | `valdr.agents.infra.cloud-patterns.md` |
| `valdr.agents.infra.networking` | `context` | architecture | Yes | `valdr.agents.infra.networking.md` |
| `valdr.agents.infra.observability` | `context` | operations | Yes | `valdr.agents.infra.observability.md` |
| `valdr.agents.infra.diagrams` | `context` | architecture | Yes | `valdr.agents.infra.diagrams.md` |
| `valdr.agents.infra.incident-triage` | `workflow` | operations | Yes | `valdr.agents.infra.incident-triage.md` |

## Prompts

| Prompt Key | Role | Hot-Load | File |
|---|---|---|---|
| `valdr-agents-infra-gcloud-cheatsheet` | `context` | Yes | `cloud/gcloud-cheatsheet.md` |
| `valdr-agents-infra-aws-cheatsheet` | `context` | Yes | `cloud/aws-cheatsheet.md` |
| `valdr-agents-infra-cloudflare-cheatsheet` | `context` | Yes | `cloud/cloudflare-cheatsheet.md` |
| `valdr-agents-infra-azure-cheatsheet` | `context` | Yes | `cloud/azure-cheatsheet.md` |
| `valdr-agents-infra-vercel-cheatsheet` | `context` | Yes | `cloud/vercel-cheatsheet.md` |
| `valdr-agents-infra-flyio-cheatsheet` | `context` | Yes | `cloud/flyio-cheatsheet.md` |
| `valdr-agents-infra-digitalocean-cheatsheet` | `context` | Yes | `cloud/digitalocean-cheatsheet.md` |

## Notes

- Exactly one core capability: `valdr.agents.infra.infra-agent.system`.
- System prompt defines four operating modes (Build, Modify, Troubleshoot, Review) with a mandatory discovery-before-mutation workflow.
- Blast radius classification (read-only → additive → mutative → destructive) governs agent behavior per change.
- Hard constraints are embedded in the system prompt and enforced on every task.
- Cloud cheatsheets and incident triage are standalone prompts (not capability-backed) for lightweight hot-loading.
