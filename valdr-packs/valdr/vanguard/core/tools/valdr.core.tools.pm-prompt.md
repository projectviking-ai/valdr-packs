<!--<capability id="valdr.core.tools.pm-prompt" pack="valdr" role="integration">-->
# Tool: pm_prompt

Prompt registry operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list` | Find prompts | — |
| `get` | Fetch prompt details | `id` or `key` |
| `create` | Create new prompt | `key`, `name`, `role`, `content` |
| `update` | Modify prompt | `id` |
| `delete` | Remove prompt | `id` |

## Usage Patterns

**List all prompts:**
```
pm_prompt { action: "list" }
```

`list` returns prompt summaries only (`id`, `key`, `role`, `name`, `tags`, `agentCount`).
It does **not** include `content`.

**Filter by role:**
```
pm_prompt { action: "list", roles: ["system"] }
pm_prompt { action: "list", roles: ["guide"] }
pm_prompt { action: "list", roles: ["checklist"] }
```

**Search:**
```
pm_prompt { action: "list", search: "review" }
```

**Get prompt by key (preferred):**
```
pm_prompt { action: "get", key: "<prompt-key>" }
```

Use `get` whenever full prompt content is needed.

**Get prompt by id:**
```
pm_prompt { action: "get", id: "<prompt-id>" }
```

## Prompt Hot-Loading

Prompts can be hot-loaded at runtime by key, similar to capability hot-loading. This is useful for loading context, documentation, or reference content without needing a full capability wrapper.

**Hot-load a prompt by key:**
```
pm_prompt { action: "get", key: "<prompt-key>" }
→ { prompt: { key, content, role, tags, ... } }
```

### When to Use Prompt Hot-Loading vs Capability Hot-Loading

| Use Case | Mechanism | Why |
|----------|-----------|-----|
| Agent workflow with role/pack metadata | `pm_capability { action: "prompt", key }` | Capabilities carry role, pack, and category metadata needed for composition |
| Raw context, docs, or reference content | `pm_prompt { action: "get", key }` | Lighter weight — just the content, no capability metadata overhead |
| Content shared across capabilities | `pm_prompt { action: "get", key }` | One prompt can back multiple capabilities, or be loaded standalone |
| Content not linked to any capability | `pm_prompt { action: "get", key }` | Standalone prompts that exist in the registry without capability wrappers |

### Prompt Hot-Loading in Agent Design

Agents can reference prompts to hot-load in their system prompts using the same table pattern as capabilities:

```markdown
## Prompt Hot-Loading

| Prompt Key | When to Hot-Load |
|------------|------------------|
| `<pack>-<domain>-<name>` | <description of when to load> |
```

Load via: `pm_prompt { action: "get", key: "<prompt-key>" }`

**Create prompt:**
```
pm_prompt {
  action: "create",
  key: "valdr-orchestrator-agent-name-prompt-name",
  name: "valdr-orchestrator-agent-name-prompt-name",
  role: "system",
  content: "You are an agent that...",
  tags: ["domain", "category"]
}
```

`key` is required on create and must be unique. Prompt keys use **dashes** as separators (`valdr-orchestrator-nikol-system`), distinguishing them from capability keys which use dots (`valdr.orchestrator.nikol.system`). Hot-load `valdr.core.registry.naming` for full key format conventions.

**Update prompt:**
```
pm_prompt {
  action: "update",
  id: "<prompt-id>",
  content: "Updated content...",
  tags: ["new-tag"]
}
```

## Parameter Reference

| Param | create | get | update | delete | list |
|-------|--------|-----|--------|--------|------|
| `key` | required | id OR key | optional | — | — |
| `id` | — | id OR key | required | required | — |
| `name` | required | — | optional | — | — |
| `role` | required | — | optional | — | — |
| `content` | required | — | optional | — | — |
| `tags` | optional | — | optional | — | — |
| `roles` | — | — | — | — | optional |
| `search` | — | — | — | — | optional |
| `limit` | — | — | — | — | optional (1-500) |

## Prompt Roles

| Role | Purpose |
|------|---------|
| `system` | Agent system prompts |
| `guide` | Instructional guides |
| `checklist` | Quality checklists |
| `policy` | Policy documents |
| `context` | Background information |

## Role Selection Guide

| Content Type | Role |
|--------------|------|
| Agent identity and behavior | `system` |
| How-to instructions | `guide` |
| Verification steps | `checklist` |
| Rules and constraints | `policy` |
| Background knowledge | `context` |

## Key Rules

- **`key` is required on create** — Do not pass `id` on create; the system generates the id
- **`list` is metadata-only** — Prompt content is excluded from list responses to keep payloads small
- **Get by key or id** — Prefer `key` for readability; use `id` when key is unknown
- **Role selection** — Choose role based on content purpose
- **Content quality** — Keep prompts focused and actionable
- **Tags** — Use consistent tags for discoverability

<!--</instructions>-->
<!--</capability>-->
