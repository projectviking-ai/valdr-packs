<!--<capability id="valdr.core.tools.pm-agent" pack="valdr" role="integration">-->
# Tool: pm_agent

Agent registry operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list` | Find agents | — |
| `get` | Fetch agent details | `id` or `handle` |
| `create` | Register new agent | `name`, `handle` |
| `update` | Modify agent | `id` or `handle` |
| `delete` | Remove agent | `id` |
| `get_prompt` | Build composed runtime system prompt | `id` or `handle` |

## Usage Patterns

**List all agents:**
```
pm_agent { action: "list" }
```

**Filter by kind:**
```
pm_agent { action: "list", kinds: ["bot"] }
pm_agent { action: "list", kinds: ["human"] }
pm_agent { action: "list", kinds: ["ci"] }
```

**Filter by capability:**
```
pm_agent { action: "list", capabilityKeys: ["typescript.core"] }
```

**Filter by role:**
```
pm_agent { action: "list", defaultRoles: ["executor"] }
pm_agent { action: "list", defaultRoles: ["reviewer"] }
```

**Search:**
```
pm_agent { action: "list", search: "typescript" }
```

**Get agent by handle:**
```
pm_agent { action: "get", handle: "claude-cli" }
```

**Create agent:**
```
pm_agent {
  action: "create",
  name: "Agent Name",
  handle: "agent-handle",
  kind: "bot",
  defaultRole: "executor",
  tags: ["typescript", "task-agent"],
  capabilities: [
    { key: "typescript.core" }
  ]
}
```

**Update agent:**
```
pm_agent {
  action: "update",
  handle: "agent-handle",
  tags: { add: ["new-tag"], remove: ["old-tag"] },
  capabilities: {
    set: [
      { key: "new-capability", position: 10, hotLoad: false }
    ]
  },
  notes: { add: [{ noteType: "summary", body: "Agent description" }] }
}
```

`update` accepts either `handle` or `id`. Prefer `handle` for day-to-day workflows; use `id` when you need immutable targeting.

## Agent Kinds

| Kind | Purpose |
|------|---------|
| `bot` | AI agents |
| `human` | Human users |
| `ci` | CI/CD pipelines |

## Agent Roles

| Role | Purpose |
|------|---------|
| `executor` | Executes tasks |
| `reviewer` | Reviews work |
| `planner` | Creates plans |
| `auditor` | Audits sessions |
| `orchestrator` | Coordinates work |

## Update Patterns

**Tags:**
```
tags: { add: ["a"], remove: ["b"], set: ["c", "d"] }
```

**Capabilities:**
```
capabilities: {
  set: [
    {
      key: "cap-key",
      role: "workflow",
      promptId: "<prompt-id>",
      hotLoad: false,
      position: 20,
      sourceRelpath: "valdr-packs/valdr/..."
    }
  ],
  remove: ["old-key"]
}
```

**Notes:**
```
notes: { add: [{ noteType: "summary", body: "..." }], remove: ["noteId"] }
```

**Prompts:**
```
prompts: {
  set: [
    {
      promptId: "id",
      useFor: ["system"],
      role: "system",
      hotLoad: false,
      position: 1010,
      sourceRelpath: "valdr-packs/valdr/..."
    }
  ],
  remove: ["id"]
}
```

## Binding Metadata

`pm_agent` supports per-binding metadata on both capabilities and prompts:

- `hotLoad` (boolean): marks binding as runtime hot-loadable.
- `position` (non-negative integer): deterministic binding order.
- `sourceRelpath` (string, optional): source traceability path for import/export workflows.

For deterministic ordering, use explicit positions (`10`, `20`, `30`, ...).

## Note Types

| Type | Purpose |
|------|---------|
| `summary` | Description |
| `status` | Current state |
| `preference` | Settings |
| `alert` | Warnings |
| `coordination` | Cross-agent notes |
| `general` | Other notes |

## Key Rules

- **Fetch before update** — Always `get` before `update`
- **Handle uniqueness** — Handles must be unique
- **Capability linking** — Link capabilities to prompts for full context
- **Preserve binding metadata** — When updating `capabilities.set` or `prompts.set`, include existing `hotLoad`/`position` values unless intentionally changing them

<!--</instructions>-->
<!--</capability>-->
