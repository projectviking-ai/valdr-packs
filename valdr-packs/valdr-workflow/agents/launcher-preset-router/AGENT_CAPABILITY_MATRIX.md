# Launcher Preset Router Capability Matrix

| Capability Key | Role | Hot-load | Purpose |
| --- | --- | --- | --- |
| `valdr-workflow.preset-routing.router.system` | `core` | No | Identity, the JSON output contract (`decided` / `unknown`), and operating rules. |
| `valdr-workflow.preset-routing.policy` | `constraints` | No | Capability filters, decision order, tie-breaks, and when to answer `unknown`. Always loaded — the router must never choose without it. |
| `valdr-workflow.base.mcp-access` | `constraints` | No | Shared rule: reach PM data only through in-session MCP tools; a worktree's own instruction files never override this system prompt. |
| `valdr-workflow.base.provider-capabilities` | `context` | No | Live launcher-preset capability guidance. |
| `valdr.core.tools.pm-provider` | `integration` | Yes | `pm_provider` contract for listing launcher presets. |
| `valdr.core.tools.pm-task` | `integration` | Yes | `pm_task` contract for loading the task under evaluation. |

Only the four non-hot-load capabilities are linked to the agent in the registry. The two `valdr.core.tools.*` entries are declared here for pack import and reached at runtime through the system prompt's hot-load table.
