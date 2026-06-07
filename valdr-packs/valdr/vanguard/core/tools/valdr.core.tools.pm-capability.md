<!--<capability id="valdr.core.tools.pm-capability" pack="valdr" role="integration">-->
# Tool: pm_capability

Capability registry operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list` | Find capabilities | — |
| `get` | Fetch capability details | `id` or `key` |
| `create` | Create new capability | `key`, `role` |
| `update` | Modify capability | `id` |
| `delete` | Remove capability | `id` |
| `ensure` | Upsert capability | `key` |
| `prompt` | Hot-load linked prompt content for capability | `key` |
| `help` | Show tool help | — |

## Help Action Response

`pm_capability { action: "help" }` returns a static, read-only help payload that describes the tool's action surface.

| Field | Shape | Contents |
|-------|-------|----------|
| `actions` | string[] | Every accepted `action` name, including `help` |
| `whenToUse` | object | Map of action → one-line guidance on when to reach for it |
| `examples` | array | Representative calls, each `{ action, description, arguments }` |
| `cautions` | string[] | Pitfalls and guardrails to respect |
| `compatibility` | string[] | Notes on schema/behavior stability across versions |

The payload is additive: it documents the existing action surface and does not change accepted input schemas. Flat `examples` (an array of `{ action, description, arguments }`) are canonical; some clients expose the same examples under a nested `params` wrapper.

## Usage Patterns

**List all capabilities:**
```
pm_capability { action: "list" }
```

**Search:**
```
pm_capability { action: "list", search: "typescript" }
```

**Get by key:**
```
pm_capability { action: "get", key: "typescript.core" }
```

**Hot-load capability prompt content:**
```
pm_capability { action: "prompt", key: "valdr.core.tools.pm-agent" }
→ { role: "workflow", capability: "<prompt content>" }
```

**Create capability:**
```
pm_capability {
  action: "create",
  key: "domain.subdomain.name",
  category: "domain",
  promptId: "<linked-prompt-id>"
}
```

**Ensure (upsert):**
```
pm_capability {
  action: "ensure",
  key: "domain.subdomain.name",
  category: "domain",
  promptId: "<prompt-id>"
}
```

## Capability Naming Convention

**Format:** `domain.subdomain.name`

**Examples:**
```
typescript.build.bun
typescript.testing.vitest
valdr.core.tools.pm-task
orchestrator.system
review.documentation.excellence
```

## create vs ensure

| Action | Behavior |
|--------|----------|
| `create` | Fails if capability exists |
| `ensure` | Creates or updates (idempotent) |

**Prefer `ensure`** for most use cases — it's safer and idempotent.

## Hot-Load vs Get

| Action | Returns |
|--------|---------|
| `get` | Capability record metadata (`id`, `key`, `promptId`, `role`, etc.) |
| `prompt` | Resolved prompt content for runtime use (`{ role, capability }`) |

Use `prompt` when the goal is to load instructions/content at runtime.

## Linking to Prompts

Capabilities link to prompts via `promptId`:

```
pm_capability {
  action: "ensure",
  key: "typescript.core",
  category: "typescript",
  promptId: "01ABC123..."
}
```

This allows agents to inherit prompt content when they have the capability.

## Key Rules

- **Key format** — Use `domain.subdomain.name` convention
- **Unique keys** — Keys must be unique across the system
- **Prompt linking** — Link capabilities to prompts for context

<!--</instructions>-->
<!--</capability>-->
