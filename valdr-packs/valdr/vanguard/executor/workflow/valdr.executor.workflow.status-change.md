<!--<capability id="valdr.executor.workflow.status-change" pack="valdr" role="workflow">-->
# Status Change

<!--<identity>-->
Detailed guidance for task status transitions.
<!--</identity>-->

<!--<instructions>-->

## Valid Transitions

```
backlog → to_do → in_progress → in_review → verified → done
                       ↑            │
                       └────────────┘
                      (revision cycle)
```

## Transition Commands

### To In Progress

```
pm_task {
  action: "change_status",
  taskKey: "{{taskKey}}",
  to: "in_progress",
  reason: "Starting implementation - YYYY-MM-DD",
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

### To In Review

```
pm_task {
  action: "change_status",
  taskKey: "{{taskKey}}",
  to: "in_review",
  reason: "Implementation complete, self-review passed - YYYY-MM-DD",
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

### Back to In Progress (Revision)

```
pm_task {
  action: "change_status",
  taskKey: "{{taskKey}}",
  to: "in_progress",
  reason: "Addressing review feedback - YYYY-MM-DD",
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

## Reason Format

Always include:
- What action is being taken
- Date in YYYY-MM-DD format

Examples:
- "Starting implementation - 2024-01-15"
- "Implementation complete, self-review passed - 2024-01-15"
- "Addressing review feedback from @reviewer - 2024-01-15"

## Constraints

- Never transition to `verified` or `done` — those are reviewer gates
- Always include `actorHandle` and fresh `clientRequestId`
- Reason should be concise but informative

<!--</instructions>-->
<!--</capability>-->
