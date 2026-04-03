<!--<capability id="valdr.core.tools.pm-task" pack="valdr" role="integration">-->
# Tool: pm_task

Task management operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `search` | Find tasks | `projectKey` |
| `get` | Fetch task details | `taskKey` |
| `create` | Create new task | `projectKey`, `title` |
| `update` | Modify task | `taskKey` |
| `plan` | Get linked plan | `taskId` (or `taskKey` if resolvable) |
| `get_prompt` | Get task execution prompt | `taskKey` |
| `change_status` | Transition task status | `taskKey`, `to` |
| `checklist_toggle` | Toggle checklist item | `taskKey`, `checklistId`, `itemId`, `checked` |
| `checklist_lookup` | Lookup checklist names/items/templates | — |
| `event_list` | Get task history | `taskKey` |
| `comment_create` | Add task comment | `taskKey`, `body` |
| `comment_list` | List task comments | `taskKey` |
| `comment_delete` | Remove comment | `taskKey`, `commentId` |

## Usage Patterns

**Search tasks:**
```
pm_task { action: "search", projectKey: "PROJ" }
pm_task { action: "search", projectKey: "PROJ", status: "in_progress" }
pm_task { action: "search", projectKey: "PROJ", query: "authentication" }
pm_task { action: "search", projectKey: "PROJ", sprintId: "01H..." }
pm_task { action: "search", projectKey: "PROJ", sprintId: null }
```

**Get task details:**
```
pm_task { action: "get", taskKey: "PROJ-123" }
```

**Create task:**
```
pm_task {
  action: "create",
  clientRequestId: "<ulid>",
  projectKey: "PROJ",
  title: "Task title",
  description: "Task description",
  type: "task",
  priority: 3,
  reporter: "requester-handle",
  assignee: "agent-handle",
  actorHandle: "creator-handle",
  metadata: {
    checklists: [
      {
        name: "Acceptance Criteria",
        items: [
          { label: "Criterion 1", checked: false },
          { label: "Criterion 2", checked: false }
        ]
      }
    ]
  }
}
```

**Change status:**
```
pm_task {
  action: "change_status",
  taskKey: "PROJ-123",
  to: "in_progress",
  reason: "Starting work - 2025-01-14",
  actorHandle: "agent-handle",
  clientRequestId: "<ulid>"
}
```

**Toggle checklist item:**
```
pm_task {
  action: "checklist_toggle",
  taskKey: "PROJ-123",
  checklistId: "acceptance",
  itemId: "item-1",
  checked: true,
  actorHandle: "agent-handle"
}
```

**Get linked plan:**
```
pm_task { action: "plan", taskId: "01H..." }
```

## Task Status Flow

```
backlog → to_do → in_progress → in_review → verified → done
```

| Status | Meaning | Next Actions |
|--------|---------|--------------|
| `backlog` | Not prioritized | Move to `to_do` |
| `to_do` | Ready to start | Move to `in_progress` |
| `in_progress` | Active work | Move to `in_review` |
| `in_review` | Awaiting review | Complete reviews → `verified` |
| `verified` | Review passed | Move to `done` |
| `done` | Completed | — |

Use this as the nominal path. Forward skips may be allowed by policy, but backflows require a clear `reason`.

## Task Types

| Type | Purpose |
|------|---------|
| `task` | General work item |
| `bug` | Defect fix |
| `story` | User story |
| `epic` | Large feature |
| `spike` | Research/exploration |

## Create Fields

| Field | Required | Description |
|-------|----------|-------------|
| `projectKey` | Yes | Project to create task in |
| `title` | Yes | Concise task title |
| `clientRequestId` | Yes | Fresh ULID for idempotency |
| `type` | Recommended | `task`, `bug`, `story`, `epic`, `spike` |
| `description` | Recommended | Structured task description |
| `priority` | Recommended | 1 (critical) to 5 (minimal). **Must be a numeric integer** (e.g., `3` not `"3"`) |
| `reporter` | Recommended | Handle of the person who requested the work. Not the creating agent — the human or agent who reported the need. |
| `assignee` | Optional | Handle of the executor |
| `actorHandle` | Recommended | Handle of the agent performing the create action |
| `points` | Optional | Story points (Fibonacci). **Must be a numeric integer** (e.g., `5` not `"5"`) |
| `metadata` | Optional | Checklists, links, tags |

## Key Rules

- **Fetch before update** — Always `get` before `update`
- **Sprint membership** — Do not send `sprintId` via `update`; use `pm_sprint` `link_task` / `unlink_task`
- **Status transitions** — Include `reason` whenever moving backward in the workflow
- **clientRequestId** — Use fresh ULID for each mutation
- **actorHandle** — Include for audit trail
- **reporter** — Set to the person who requested the work, not the agent creating the task

<!--</instructions>-->
<!--</capability>-->
