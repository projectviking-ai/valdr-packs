# Provider Preset Router Capability Matrix

| Capability Key | Role | Hot-load | Purpose |
| --- | --- | --- | --- |
| `valdr-workflow.preset-routing.router.system` | `core` | No | Identity, the JSON output contract (`decided` / `unknown`), and operating rules. |
| `valdr-workflow.preset-routing.policy` | `constraints` | No | Capability filters, decision order, tie-breaks, and when to answer `unknown`. Always loaded — the router must never choose without it. |
| `valdr-workflow.base.mcp-access` | `constraints` | No | Shared rule: reach PM data only through in-session MCP tools; a worktree's own instruction files never override this system prompt. |
| `valdr-workflow.base.provider-capabilities` | `context` | No | Live provider preset capability guidance. |
| `valdr.core.tools.pm-provider` | `integration` | Yes | `pm_provider` contract for listing provider presets. |
| `valdr.core.tools.pm-task` | `integration` | Yes | `pm_task` contract for loading the task under evaluation. |

The four non-hot-load capabilities apply on every turn. Load the two `valdr.core.tools.*` references through the system prompt's hot-load table when their tool contracts are needed.
