# Task Sizer Capability Matrix

| Capability Key | Role | Hot-load | Purpose |
| --- | --- | --- | --- |
| `valdr-workflow.task-sizing.sizer.system` | `core` | No | Identity, JSON output contract, and the never-re-size rule. |
| `valdr.core.sizing.ai-story-points` | `context` | No | Shared sizing guide — dimensions and Fibonacci scale. Reused from the core pack rather than restated. |
| `valdr-workflow.base.mcp-access` | `constraints` | No | Reach PM data only through in-session MCP tools. |
| `valdr.core.tools.pm-task` | `integration` | Yes | `pm_task` contract for reading and updating a task. |

The sizer writes `points` and `priority` itself, because `pm_task/update` is not exposed as a workflow tool step. The workflow only gates the outcome.
