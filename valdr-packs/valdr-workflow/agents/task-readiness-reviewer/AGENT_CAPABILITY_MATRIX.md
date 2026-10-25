# Task Readiness Reviewer Capability Matrix

| Capability Key | Role | Hot-load | Purpose |
| --- | --- | --- | --- |
| `valdr-workflow.task-readiness.reviewer.system` | `core` | No | Identity, operating rules, verdict mapping, and the JSON output contract. |
| `valdr-workflow.task-readiness.rubric` | `constraints` | No | Seven-dimension scoring rubric with pass/concern/fail boundaries and blocking rules. Always loaded — the gate must never score without it. |
| `valdr-workflow.base.mcp-access` | `constraints` | No | Shared rule: reach PM data only through in-session MCP tools; a worktree's own instruction files never override this system prompt. |
| `valdr.core.tools.pm-task` | `integration` | Yes | `pm_task` contract for loading task description, checklists, and comments. |

The three non-hot-load capabilities apply on every turn. Load `valdr.core.tools.pm-task` through the system prompt's hot-load table when the task requires its tool contract.
