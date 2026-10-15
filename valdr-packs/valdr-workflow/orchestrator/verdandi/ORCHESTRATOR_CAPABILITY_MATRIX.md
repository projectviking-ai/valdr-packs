# Verdandi Capability Matrix

| Capability | Role | Hot-load | Loaded when |
|---|---|---|---|
| `valdr-workflow.verdandi.system` | core | no | Always — identity and the working loop |
| `valdr-workflow.verdandi.hazards` | constraints | no | Always — misleading failure modes |
| `valdr-workflow.base.mcp-access` | constraints | no | Always — PM data access boundary |
| `valdr-workflow.verdandi.authoring` | workflow | yes | Writing or changing a definition |
| `valdr-workflow.steps.human-gate` | workflow | yes | Human approvals, Questions, answer propagation, and clarification budget guards |
| `valdr-workflow.verdandi.operating` | workflow | yes | Starting, re-running, cancelling, inspecting |
| `valdr-workflow.verdandi.debugging` | workflow | yes | A run is blocked, failed, or stuck |
| `valdr-workflow.verdandi.user-tools` | workflow | yes | Discovering, inspecting, directly testing, or authoring a user-tool step |
| `valdr-workflow.tools.overview` | integration | yes | Workflow and tool selection, result envelopes, control-flow decisions |
| `valdr-workflow.tools.valdr` | integration | yes | Valdr actions inside workflow steps |
| `valdr-workflow.tools.command` | integration | yes | Command inputs, text stdout, execution context, recovery |
| `valdr-workflow.tools.git` | integration | yes | Bounded Git actions, frozen commit evidence, drift |
| `valdr-workflow.tools.github` | integration | yes | Approved pull-request publication |
| `valdr-workflow.tools.user-tools` | integration | yes | Installed action pins, typed data, runtime and uncertain effects |
| `valdr.core.tools.pm-user-tool` | integration | yes | Gateway help, discovery, schemas, and standalone execution |
| `valdr.core.tools.pm-workflow` | integration | yes | `pm_workflow` action contracts |
| `valdr.core.tools.pm-task` | integration | yes | `pm_task` contract detail |
| `valdr.core.tools.pm-session` | integration | yes | `pm_session` contract detail |
| `valdr.core.tools.pm-review` | integration | yes | `pm_review` contract detail for review steps |
| `valdr.core.tools.pm-audit` | integration | yes | Bounded reads of a session transcript or receipt |
| `valdr.core.tools.pm-agent` | integration | yes | Confirming an agent handle exists |
| `valdr.core.tools.pm-provider` | integration | yes | Confirming a provider preset key exists |
| `valdr.core.tools.pm-health` | integration | yes | Confirming which server is answering |
| `valdr.core.tools.pm-capability` | integration | yes | The contract for the hot-load call itself |
| `valdr.core.tools.pm-project` | integration | yes | Project action detail |
| `valdr.core.tools.pm-sprint` | integration | yes | Sprint action detail |
| `valdr.core.tools.vmp` | integration | yes | Plan action detail |
| `valdr.core.tools.pm-prompt` | integration | yes | Reusable prompt action detail |
| `valdr.core.tools.pm-knowledge` | integration | yes | Knowledge action detail |

## Job to capability

| Job | Loads |
|---|---|
| Craft a workflow | `authoring`; `tools.overview` when choosing a mechanism; the selected detailed tool reference; `pm-agent` / `pm-provider` for required identities |
| Add human approval or clarification | `steps.human-gate`; `authoring` for surrounding session receipts, routing, and loops |
| Prove and register it | `operating` for `test_definition` and `save_definition` |
| Run one | `operating`, plus `pm-health` when a result surprises |
| Debug a stopped run | `debugging`, then `pm-audit` for the session receipt |
| Repair and re-run | `debugging` then `operating` |

The shared library is documented in [Workflow references](../../reference/README.md).
The always-loaded constraints stay small; detailed execution contracts remain hot-loaded.

## Boundaries

Verdandi orchestrates workflows. It does not implement product features, edit
application code, or do the work a workflow's own agents exist to do. It does not
add migrations, edit generated output, or commit without being asked.
