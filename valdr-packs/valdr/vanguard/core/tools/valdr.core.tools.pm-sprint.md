<!--<capability id="valdr.core.tools.pm-sprint" pack="valdr" role="integration">-->
# Tool: pm_sprint

Sprint management operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list` | Find sprints | `projectKey` |
| `query` | Read-only sprint search across one or more projects | none |
| `get` | Fetch sprint details | `sprintId` |
| `create` | Create new sprint | `projectKey`, `name`, `startTs`, `endTs` |
| `set_parent` | Set/clear parent sprint | `sprintId` |
| `update` | Update sprint fields | `sprintId` |
| `delete` | Delete sprint | `sprintId` |
| `link_task` | Link task membership | `sprintId`, `taskId` |
| `unlink_task` | Remove task membership | `sprintId`, `taskId` |

## Usage Patterns

**List sprints for project:**
```
pm_sprint { action: "list", projectKey: "PROJ", status: "active", limit: 20, offset: 0 }
```

**Query sprints across projects:**
```
pm_sprint { action: "query", status: "active" }
```

**Query a project subset with text search:**
```
pm_sprint {
  action: "query",
  projectKeys: ["PROJ", "OPS"],
  query: "release",
  status: "active"
}
```

**Get sprint details:**
```
pm_sprint { action: "get", sprintId: "<sprint-id>" }
```

**Create sprint:**
```
pm_sprint {
  action: "create",
  projectKey: "PROJ",
  name: "Sprint 1",
  startTs: 1704067200000,
  endTs: 1705276800000,
  goal: "Complete feature X",
  status: "planned",
  velocityTarget: 20
}
```

**Set parent sprint (for hierarchy):**
```
pm_sprint {
  action: "set_parent",
  sprintId: "<child-sprint-id>",
  parentSprintId: "<parent-sprint-id>"
}
```

**Clear parent sprint:**
```
pm_sprint {
  action: "set_parent",
  sprintId: "<child-sprint-id>",
  parentSprintId: null
}
```

**Update sprint lifecycle/details:**
```
pm_sprint {
  action: "update",
  sprintId: "<sprint-id>",
  status: "active",
  goal: "Ship task link migration"
}
```

**Link/unlink task membership:**
```
pm_sprint {
  action: "link_task",
  sprintId: "<sprint-id>",
  taskId: "<task-id>",
  actorHandle: "@pm"
}

pm_sprint {
  action: "unlink_task",
  sprintId: "<sprint-id>",
  taskId: "<task-id>",
  actorHandle: "@pm"
}
```

**Delete sprint:**
```
pm_sprint { action: "delete", sprintId: "<sprint-id>" }
```

## Sprint Status Values

| Status | Meaning |
|--------|---------|
| `planned` | Upcoming sprint |
| `active` | Current sprint |
| `review` | Sprint review phase |
| `closed` | Completed |

## Sprint Metadata

Sprints support optional metadata:

```
metadata: {
  owners: [
    { handle: "pm", role: "lead" }
  ],
  links: [
    { kind: "rfc", uri: "...", label: "RFC-123" }
  ],
  notes: ["Sprint planning notes..."]
}
```

## Key Rules

- **Timestamps** — `startTs` and `endTs` are Unix milliseconds
- **Project-scoped list** — `list` requires a single `projectKey`
- **Cross-project discovery** — Use `query` for read-only multi-project sprint search
- **Hierarchy** — Use `set_parent` for sprint rollups
- **Task membership** — Use `link_task` / `unlink_task` (not `pm_task update sprintId`)
- **velocityTarget** — Optional points target for the sprint

<!--</instructions>-->
<!--</capability>-->
