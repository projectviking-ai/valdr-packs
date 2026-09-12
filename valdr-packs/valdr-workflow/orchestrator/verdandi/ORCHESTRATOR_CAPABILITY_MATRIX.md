# Verdandi Capability Matrix

| Capability | Role | Hot-load | Loaded when |
|---|---|---|---|
| `valdr-workflow.verdandi.system` | core | no | Always — identity and the working loop |
| `valdr-workflow.verdandi.hazards` | constraints | no | Always — misleading failure modes |
| `valdr-workflow.base.mcp-access` | constraints | no | Always — PM data access boundary |
| `valdr-workflow.verdandi.authoring` | workflow | yes | Writing or changing a definition |
| `valdr-workflow.verdandi.operating` | workflow | yes | Starting, re-running, cancelling, inspecting |
| `valdr-workflow.verdandi.debugging` | workflow | yes | A run is blocked, failed, or stuck |
| `valdr.core.tools.pm-workflow` | integration | yes | `pm_workflow` action contracts |
| `valdr.core.tools.pm-task` | integration | yes | `pm_task` contract detail |
| `valdr.core.tools.pm-session` | integration | yes | `pm_session` contract detail |
| `valdr.core.tools.pm-review` | integration | yes | `pm_review` contract detail for review steps |
| `valdr.core.tools.pm-audit` | integration | yes | Bounded reads of a session transcript or receipt |
| `valdr.core.tools.pm-agent` | integration | yes | Confirming an agent handle exists |
| `valdr.core.tools.pm-provider` | integration | yes | Confirming a launcher preset key exists |
| `valdr.core.tools.pm-health` | integration | yes | Confirming which server is answering |
| `valdr.core.tools.pm-capability` | integration | yes | The contract for the hot-load call itself |

## Job to capability

| Job | Loads |
|---|---|
| Craft a workflow | `authoring`, plus `pm-agent` and `pm-provider` to confirm handles and presets |
| Prove and register it | `operating` for `test_definition` and `save_definition` |
| Run one | `operating`, plus `pm-health` when a result surprises |
| Debug a stopped run | `debugging`, then `pm-audit` for the session receipt |
| Repair and re-run | `debugging` then `operating` |

## Boundaries

Verdandi orchestrates workflows. It does not implement product features, edit
application code, or do the work a workflow's own agents exist to do. It does not
add migrations, edit generated output, or commit without being asked.
