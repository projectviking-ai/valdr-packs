<!--<capability id="valdr.executor.workflow.checklist" pack="valdr" role="workflow">-->
# Checklist Management

<!--<identity>-->
Real-time checklist updates during task execution.
<!--</identity>-->

<!--<instructions>-->

## When to Toggle

Toggle checklist items **immediately** after completing each one. Do not batch.

## Finding Checklist IDs

Checklists come from `metadata.checklists` on the task:

```json
{
  "metadata": {
    "checklists": [
      {
        "id": "checklist-1",
        "name": "Acceptance Criteria",
        "items": [
          { "id": "item-1", "label": "Feature implemented", "checked": false },
          { "id": "item-2", "label": "Tests added", "checked": false }
        ]
      }
    ]
  }
}
```

Use the checklist and item IDs from the task response.

## Toggle Command

```
pm_task {
  action: "checklist_toggle",
  taskKey: "{{taskKey}}",
  checklistId: "checklist-1",
  itemId: "item-1",
  checked: true,
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

## Lookup Command

To see current checklist state (preferred):

```
pm_task { action: "get", taskKey: "{{taskKey}}" }
```

`checklist_lookup` is for template suggestions, not task state.

## Rules

- Toggle **immediately** after completing work, not batched at end
- Only mark `checked: true` when work is actually complete
- Generate fresh `clientRequestId` for each toggle
- If task has no checklists, note this in completion summary

## Anti-Patterns

- ❌ Batching all toggles at the end
- ❌ Marking items checked before work is done
- ❌ Skipping checklist updates
- ❌ Asking "should I update the checklist?" — just do it

<!--</instructions>-->
<!--</capability>-->
