<!--<capability id="valdr.executor.workflow.handle-resolution" pack="valdr" role="workflow">-->
# Handle Resolution

<!--<identity>-->
Resolve the actor handle and load the assignee persona for CLI/manual launches.
<!--</identity>-->

<!--<instructions>-->

## When to Use

CLI/manual launches that need to resolve `actorHandle` from the task assignee.

## Resolution Order

| Priority | Scenario | Action |
|----------|----------|--------|
| 1st | Always | Call `pm_task { action: "get_prompt" }` to load assignee persona and resolve handle |
| 2nd | `get_prompt` returns usable `assigneeHandle` + instructions | Adopt instructions and use that handle for all mutations |
| 3rd | `assigneeHandle` is empty/null after `get_prompt` | Look up `*-cli` handle via `pm_agent { action: "list" }` |
| 4th | No usable handle or persona could be loaded | STOP and ask user which handle/persona to use |

## Loading Persona

```
pm_task { action: "get_prompt", taskKey: "<task-key>" }
```

Adopt the returned instructions for this task and use `assigneeHandle` for all mutations.

## Fail-Closed Rules

- Do not perform task mutations or code changes before persona loading succeeds.
- If `get_prompt` fails, STOP.
- If a task is assigned but returned instructions are empty, STOP.
- If no usable handle can be resolved, STOP.

<!--</instructions>-->
<!--</capability>-->
