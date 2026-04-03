<!--<capability id="valdr.orchestrator.nikol.agent-assembly" pack="valdr" role="workflow">-->
# Agent Assembly Workflow

<!--<identity>-->
Workflow for wiring capabilities to agents: registration tiers, manifest patterns, and validation.
<!--</identity>-->

<!--<instructions>-->

## Two Registration Tiers

Capabilities split into two tiers based on the `<agent-handle>.agent.yaml` manifest:

1. **Agent-linked** — No `hot-load` flag. Included in the agent's `capabilities` array via `pm_agent create/update`.
2. **Registry-only** — Marked `hot-load: true`. Registered via `pm_capability ensure` but **not** linked to the agent. Fetched at runtime via `pm_capability prompt`.

## Deciding: Inline vs Hot-Load

| Criteria | Inline (agent-linked) | Hot-Load (registry-only) |
|----------|----------------------|--------------------------|
| Needed 80%+ of the time | Yes | — |
| Core identity | Always inline | — |
| Tool documentation | — | Always hot-load |
| Specialized workflows | — | Hot-load |
| Shared reference data | — | Hot-load |
| Critical constraints | Case-by-case | Case-by-case |

**Rule:** Start lean. Only inline what the agent cannot function without. Everything else is hot-loaded.

## Layered Capability Architecture

```
Layer 1: Core Identity (agent-linked)
  └─ <agent>.system (role: core)

Layer 2: Workflows (hot-loaded)
  ├─ <agent>.workflow-1 (role: workflow)
  └─ <agent>.workflow-2 (role: workflow)

Layer 3: Shared References (hot-loaded)
  ├─ valdr.core.registry.taxonomy
  ├─ valdr.core.registry.naming
  └─ valdr.core.specs.agent-yaml

Layer 4: Tool Docs (hot-loaded)
  ├─ valdr.core.tools.pm-agent
  └─ valdr.core.tools.pm-prompt
```

Workflows at Layer 2 hot-load Layer 3/4 as needed. The system prompt routes to Layer 2.

## Manifest Pattern

The `<agent-handle>.agent.yaml` manifest is the source of truth. Hot-load `valdr.core.specs.agent-yaml` for the full field spec.

```yaml
schemaVersion: 1.0
agent:
  handle: <handle>
  name: <name>
  kind: bot
  defaultRole: <role>
  tags: [<tags>]
capabilities:
  - key: <pack>.<domain>.<agent>.system
    role: core                              # ← agent-linked
    order: 10
  - key: <pack>.<domain>.<agent>.workflow-1
    role: workflow
    order: 20
    hot-load: true                          # ← registry-only
  - key: valdr.core.registry.taxonomy
    role: context
    order: 30
    hot-load: true                          # ← shared reference
```

## Registration Workflow

### 1. Register All Prompts

For every capability (both agent-linked and hot-loaded). Prompt keys use **dashes** — derive from the capability key by replacing dots with dashes:

```
pm_prompt { action: "create", key: "<prompt-key>", name: "<prompt-key>", role: "<prompt-role>", content: "...", tags: [...] }
→ { id: "<prompt-id>" }
```

Example: capability `valdr.orchestrator.nikol.system` → prompt key `valdr-orchestrator-nikol-system`. Do not pass `id` — the system generates it.

### 2. Register All Capabilities

For every capability (both agent-linked and hot-loaded):

```
pm_capability { action: "ensure", key: "<key>", category: "<category>", promptId: "<prompt-id>", role: "<role>", pack: "<pack>" }
```

### 3. Register Agent (Non-Hot-Load Only)

Only include capabilities that are **not** `hot-load: true`. Do not link prompts directly — use capabilities instead. The system supports prompt linkage, but Nikol builds with capabilities exclusively because they provide better composition and reuse.

```
pm_agent {
  action: "create",
  name: "<name>",
  handle: "<handle>",
  kind: "bot",
  defaultRole: "<role>",
  tags: ["<tags>"],
  capabilities: [
    {
      key: "<core-capability-key>",
      hotLoad: false,
      position: 10
    }
  ]
}
```

When updating existing agents, preserve binding metadata:

```
pm_agent {
  action: "update",
  handle: "<handle>",
  capabilities: {
    set: [
      { key: "<linked-capability-a>", hotLoad: false, position: 10 },
      { key: "<linked-capability-b>", hotLoad: false, position: 20 }
    ]
  }
}
```

Manifest mapping rule:
- `hot-load` in YAML -> `hotLoad` in `pm_agent` payload
- `order` in YAML -> `position` in `pm_agent` payload

### 4. Verify Hot-Load Access

Confirm every hot-loaded capability is accessible:

```
pm_capability { action: "prompt", key: "<hot-loaded-key>" }
→ { "role": "...", "capability": "..." }
```

## Adding a Capability to an Existing Agent

1. Author the prompt content (hot-load `valdr.core.registry.taxonomy` for role selection)
2. `pm_prompt { action: "create", key: "<prompt-key>", ... }` → capture prompt ID (key uses dashes)
3. `pm_capability { action: "ensure", ... }` → link to prompt
4. If **agent-linked**: `pm_agent { action: "update", handle: "<handle>", capabilities: { set: [{ key: "<key>" }] } }`
5. If **hot-loaded**: Add entry to `<agent-handle>.agent.yaml` with `hot-load: true`. No `pm_agent update` needed.
6. Update capability matrix documentation

## Removing a Capability from an Agent

1. If **agent-linked**: `pm_agent { action: "update", handle: "<handle>", capabilities: { remove: ["<key>"] } }`
2. If **hot-loaded**: Remove entry from `<agent-handle>.agent.yaml`
3. Capability and prompt remain in the registry (other agents may use them)
4. Update capability matrix documentation

## Validation Checklist

Before shipping:

- [ ] `<agent-handle>.agent.yaml` manifest exists at agent root folder
- [ ] Exactly one `role: core` capability (agent-linked)
- [ ] All prompts registered via `pm_prompt create`
- [ ] All capabilities registered via `pm_capability ensure`
- [ ] Agent linked to non-hot-load capabilities only
- [ ] Hot-loaded capabilities verified via `pm_capability prompt`
- [ ] Capability matrix updated
- [ ] README updated

## Capability Matrix Template

```markdown
| Capability Key | Role | Pack | Prompt ID | Hot-Load | File |
|----------------|------|------|-----------|----------|------|
| `<key>` | `<role>` | `<pack>` | `<ulid>` | no | `<file>.md` |
| `<key>` | `<role>` | `<pack>` | `<ulid>` | yes | `<file>.md` |
```

## Anti-Patterns (DO NOT)

1. Link hot-loaded capabilities to the agent in `pm_agent create/update`
2. Inline capabilities that are only needed occasionally
3. Delete shared capabilities from the registry — other agents may depend on them
4. Skip hot-load verification after registration

<!--</instructions>-->
<!--</capability>-->
