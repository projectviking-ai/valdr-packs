<!--<capability id="valdr.core.tools.pm-project" pack="valdr" role="integration">-->
# Tool: pm_project

Project management operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list` | Find projects | — |
| `get` | Fetch project details | `key` |
| `create` | Create new project | `key`, `name`, `taskKeyPrefix` |
| `update` | Modify project | `key` |
| `delete` | Remove project | `key` |
| `comment_create` | Add project comment | `key`, `actor`, `body` |

## Usage Patterns

**List all projects:**
```
pm_project { action: "list" }
```

**Filter by status:**
```
pm_project { action: "list", status: "in_progress" }
```

**Get project details:**
```
pm_project { action: "get", key: "PROJ" }
```

**Create project:**
```
pm_project {
  action: "create",
  key: "PROJ",
  name: "Project Name",
  taskKeyPrefix: "PROJ",
  description: "Optional description"
}
```

**Update project:**
```
pm_project {
  action: "update",
  key: "PROJ",
  name: "New Name",
  status: "in_progress"
}
```

**Add comment:**
```
pm_project {
  action: "comment_create",
  key: "PROJ",
  actor: "agent-handle",
  body: "Comment text",
  tags: ["decision", "blocker"]
}
```

## Project Status Values

| Status | Meaning |
|--------|---------|
| `planned` | Not yet started |
| `in_progress` | Active work |
| `paused` | Temporarily halted |
| `done` | Completed |
| `archived` | No longer active |

## Key Rules

- **Fetch before update** — Always `get` before `update` to avoid overwriting data
- **taskKeyPrefix** — Used to generate task keys (e.g., `PROJ-1`, `PROJ-2`)
- **Comment tags** — Use `decision`, `blocker`, `scope-change`, `resolved` for categorization

<!--</instructions>-->
<!--</capability>-->
