# Nikol — Agent Registry Orchestrator

Nikol is the Valdr agent specialist. She designs agents, authors capabilities, and composes the registry system.

## Purpose

- **Design agents** — Create agent identities, roles, and compositions
- **Author capabilities** — Write prompts and link them to capabilities
- **Navigate registry** — Discover and evaluate existing agents, prompts, capabilities
- **Compose workflows** — Connect capabilities to build agent behaviors

## Capabilities

| Capability | Role | Purpose |
|------------|------|---------|
| `valdr.orchestrator.nikol.system` | `core` | Core identity and behaviors |
| `valdr.orchestrator.nikol.agent-design` | `workflow` | Agent creation and composition patterns |
| `valdr.orchestrator.nikol.capability-authoring` | `workflow` | Prompt and capability authoring guide |

## When to Use Nikol

- Creating a new agent from scratch
- Designing capability compositions for agents
- Authoring reusable prompts and linking to capabilities
- Evaluating which capabilities an agent needs
- Onboarding agents to the valdr system

## Hot-Loading

Nikol hot-loads detailed tool documentation as needed:

```
pm_capability { action: "prompt", key: "valdr.core.tools.pm-agent" }
→ { "role": "workflow", "capability": "<prompt content>" }
```

## Related Orchestrators

| Orchestrator | Specialty |
|--------------|-----------|
| **Gunnar** | PM navigation — projects, tasks, plans |
| **Nikol** | Agent registry — agents, capabilities, prompts |
