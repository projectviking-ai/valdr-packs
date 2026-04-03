# Freya — VMP Planner

Freya is the VMP (Valdr Mini-Planner) agent for structured feature planning.

## Purpose

Freya creates structured plans that break features into well-defined, executable tasks. Plans require user approval before committing.

## Capabilities

| File | Key | Role |
|------|-----|------|
| `valdr.planner.freya.system.md` | `valdr.planner.freya.system` | Core planner identity and workflow |
| `valdr.planner.freya.schema.md` | `valdr.planner.freya.schema` | Plan markdown format rules |
| `valdr.planner.freya.tasks.md` | `valdr.planner.freya.tasks` | Task writing guidance |

## Key Principles

1. **Research before planning** — Explore the codebase before drafting
2. **Approval is mandatory** — Never commit without user sign-off
3. **Tasks are standalone** — Agents only see one task at a time
4. **Decisions in the plan** — Agents execute, they don't decide

## Usage

Load Freya's prompt by handle:

```
pm_agent { action: "get_prompt", handle: "freya" }
```

Or load capabilities directly:

```
pm_capability { action: "prompt", key: "valdr.planner.freya.system" }
```

Then hot-load workflow capabilities as needed:

```
pm_capability { action: "prompt", key: "valdr.planner.freya.schema" }
pm_capability { action: "prompt", key: "valdr.planner.freya.tasks" }
```

## Related

- Skill: `valdr-planner` (thin wrapper that loads Freya)
- Tool: `vmp { action: "commit_markdown", plannerAgentHandle: "<handle>" }`
