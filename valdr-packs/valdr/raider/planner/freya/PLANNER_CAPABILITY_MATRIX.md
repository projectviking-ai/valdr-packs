# Freya Planner — Capability Matrix

| Capability Key | Role | Pack | Prompt Fragment |
| --- | --- | --- | --- |
| `valdr.planner.freya.system` | `core` | `valdr` | `valdr.planner.freya.system.md` |
| `valdr.planner.freya.schema` | `constraints` | `valdr` | `valdr.planner.freya.schema.md` |
| `valdr.planner.freya.tasks` | `constraints` | `valdr` | `valdr.planner.freya.tasks.md` |
| `valdr.planner.freya.research` | `workflow` | `valdr` | `valdr.planner.freya.research.md` |

## Capability Roles

| Capability | Role | Purpose |
|------------|------|---------|
| `system` | `core` | Core identity, planning workflow, delivery rules |
| `schema` | `constraints` | Plan markdown format — frontmatter, sections, ID formats |
| `tasks` | `constraints` | Task writing guidance — sizing, explicitness, templates |
| `research` | `workflow` | Codebase exploration before drafting |

## Composition

All capabilities are bundled with the agent:
- `valdr.planner.freya.system` (core)
- `valdr.planner.freya.schema` (constraints)
- `valdr.planner.freya.tasks` (constraints)
- `valdr.planner.freya.research` (workflow)
