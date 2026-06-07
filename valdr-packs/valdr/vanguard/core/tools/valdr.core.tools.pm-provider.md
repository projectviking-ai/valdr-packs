<!--<capability id="valdr.core.tools.pm-provider" pack="valdr" role="integration">-->
# Tool: pm_provider

Provider and launcher preset management operations. Use this tool to discover launcher presets and registered provider defaults, and to create presets that point sessions at a provider type with optional env refs and worktree settings.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list_presets` | List launcher presets, optionally including registered provider defaults | — |
| `create_preset` | Create a launcher preset bound to a registered provider type | `key`, `displayName`, `providerType` |
| `help` | Show structured tool help | — |

## Help Action Response

`pm_provider { action: "help" }` returns a static, read-only help payload that describes the tool's action surface.

| Field | Shape | Contents |
|-------|-------|----------|
| `actions` | string[] | Every accepted `action` name, including `help` |
| `whenToUse` | object | Map of action → one-line guidance on when to reach for it |
| `examples` | array | Representative calls, each `{ action, description, arguments }` |
| `cautions` | string[] | Pitfalls and guardrails to respect |
| `compatibility` | string[] | Notes on schema/behavior stability across versions |

The payload is additive: it documents the existing action surface and does not change accepted input schemas. Flat `examples` (an array of `{ action, description, arguments }`) are canonical; some clients expose the same examples under a nested `params` wrapper.

## Usage Patterns

**List launcher presets with provider defaults (default):**
```
pm_provider { action: "list_presets" }
```
`includeProviderDefaults` defaults to `true`, so the response includes registered provider defaults alongside saved presets.

**List only saved presets, without provider defaults:**
```
pm_provider { action: "list_presets", includeProviderDefaults: false }
```

**Create a preset with provider config and an env ref:**
```
pm_provider {
  action: "create_preset",
  key: "coder-codex",
  displayName: "Coder Codex",
  providerType: "codex",
  config: { model: "gpt-5" },
  env: [{ name: "OPENAI_API_KEY", valueRef: "OPENAI_API_KEY" }]
}
```

**Create a preset with worktree settings and audit metadata:**
```
pm_provider {
  action: "create_preset",
  key: "coder-claude",
  displayName: "Coder Claude",
  providerType: "claude",
  config: { model: "claude-opus-4-8" },
  env: [{ name: "ANTHROPIC_API_KEY", valueRef: "ANTHROPIC_API_KEY" }],
  worktree: { shouldCreateWorktree: true, allowReuseExistingWorktree: false },
  description: "Claude executor preset with isolated worktree",
  tags: ["executor", "claude"],
  actor: "@skadi"
}
```

## create_preset Parameter Reference

| Param | Required | Purpose |
|-------|----------|---------|
| `key` | yes | Stable preset key (e.g. `coder-codex`) |
| `displayName` | yes | Human-friendly preset name |
| `providerType` | yes | Registered provider type the preset launches (e.g. `codex`, `claude`) |
| `config` | no | Provider config object (e.g. `{ model }`); avoid inline secrets |
| `env` | no | Named environment references `[{ name, valueRef }]` — keep secrets here |
| `worktree` | no | `{ shouldCreateWorktree, allowReuseExistingWorktree }` |
| `allowAdhocOverrides` | no | Allow runtime config overrides (default `true`) |
| `description` | no | Optional preset description |
| `tags` | no | Optional tags for discovery |
| `actor` | no | Actor handle for audit metadata |

## Env References

`env` entries are `{ name, valueRef }` pairs. `name` is the environment variable the provider receives; `valueRef` points at the secret source (e.g. an environment variable name) that is resolved at launch. The raw secret value is never stored in the preset — only the reference is persisted.

## Cautions

- Keep secrets in env refs (`valueRef`) rather than inline `config` values whenever possible.
- Rely on existing provider config redaction for config-emitting responses; do not disable or bypass it.
- Never place raw provider secrets in prompts, comments, or persisted presets.

## Key Rules

- **Provider defaults by default** — `list_presets` includes registered provider defaults unless you pass `includeProviderDefaults: false`.
- **Registered provider types** — `providerType` must name a provider type the server already knows.
- **Secrets via env refs** — Persist references, not values; the secret is resolved at launch and stays out of the preset record.
- **Stable keys** — `key` identifies the preset for launcher workflows; choose a durable, descriptive value.

<!--</instructions>-->
<!--</capability>-->
