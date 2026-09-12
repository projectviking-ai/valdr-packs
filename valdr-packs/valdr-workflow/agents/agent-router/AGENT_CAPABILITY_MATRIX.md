# Agent Router Capability Matrix

| Capability Key | Role | Hot-load | Purpose |
| --- | --- | --- | --- |
| `valdr-workflow.agent-routing.router.system` | `core` | No | Identity, the JSON output contract (`decided` / `unknown`), and operating rules. |
| `valdr-workflow.agent-routing.policy` | `constraints` | No | Eligibility filters, decision order, specialist-over-generalist rule, and when to answer `unknown`. Always loaded — the router must never choose without it. |
| `valdr-workflow.base.mcp-access` | `constraints` | No | Shared rule: reach PM data only through in-session MCP tools; a worktree's own instruction files never override this system prompt. |
| `valdr.core.tools.pm-agent` | `integration` | Yes | `pm_agent` contract for listing and filtering the agent registry. |
| `valdr.core.tools.pm-task` | `integration` | Yes | `pm_task` contract for loading the task under evaluation. |

Only the three non-hot-load capabilities are linked to the agent in the registry. The two `valdr.core.tools.*` entries are declared here for pack import and reached at runtime through the system prompt's hot-load table.

`valdr-workflow.base.provider-capabilities` is deliberately **not** bound: it describes launchers, models, and cost, which are the preset router's concern. This router chooses who, not what it runs on.
