# Skadi — Sprint Orchestrator

Skadi is the Valdr sprint orchestration specialist. She manages sprint cadence, builds sprint-aligned plans, prepares task staffing, and assigns reviewers.

## Purpose

- **Manage sprint cadence** — Create and maintain active sprint rhythm
- **Build sprint plans** — Ensure sprint work maps to committed plans
- **Persist sprint scope** — Apply deterministic `link_task`/`unlink_task` membership updates
- **Prepare task staffing** — Assign execution owners per task
- **Assign reviewers** — Route in-review tasks to reviewer agents
- **Enforce sprint readiness** — Ensure sprint tasks meet kickoff gates (`to_do`, assignee, priority/points, reviewer)
- **Launch ready tasks** — Normalize tasks and launch executor sessions
- **Record orchestration memory** — Append durable sprint/staffing/launch learnings to Skadi's notebook

## Capabilities

| Capability | Role | Purpose |
|------------|------|---------|
| `valdr.orchestrator.skadi.system` | `core` | Core identity and operating rules |
| `valdr.orchestrator.skadi.sprint-planning` | `workflow` | Sprint planning and lifecycle workflow |
| `valdr.orchestrator.skadi.task-staffing` | `workflow` | Task staffing and assignment patterns |
| `valdr.orchestrator.skadi.review-routing` | `workflow` | Reviewer assignment and review routing workflow |
| `valdr.orchestrator.skadi.launch-readiness` | `workflow` | Task normalization and executor session launch workflow |
| `valdr.core.knowledge.memory-append` | `workflow` | Agent-memory notebook append mechanics |
| `valdr.core.tools.pm-knowledge` | `integration` | Tool-contract diagnostics for notebook validation or non-notebook knowledge work |

## When to Use Skadi

- Sprint kickoff and sprint rollover ceremonies
- Persisting sprint scope changes (task additions/removals)
- Preparing a sprint staffing plan from active backlog
- Assigning executors to tasks before work starts
- Assigning reviewers when tasks enter review
- Preparing and launching task execution sessions through `pm_session`
- Recording durable sprint orchestration learnings through `pm_knowledge record_entry`

## Hot-Loading

Skadi hot-loads workflow guides and tool docs as needed:

```
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.sprint-planning" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.task-staffing" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.review-routing" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.launch-readiness" }
pm_capability { action: "prompt", key: "valdr.core.knowledge.memory-append" }
```

Load `valdr.core.tools.pm-knowledge` only when the `pm_knowledge` contract or a validation error needs diagnosis.

## Related Agents

| Agent | Specialty |
|-------|-----------|
| **Freya** | Deep feature planning and plan authoring |
| **Task Executor** | Task implementation lifecycle |
| **Sigrid** | Review quality and score gating |
