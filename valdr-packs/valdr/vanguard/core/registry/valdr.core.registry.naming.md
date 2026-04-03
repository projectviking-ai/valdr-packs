<!--<capability id="valdr.core.registry.naming" pack="valdr" role="context">-->
# Registry Naming Conventions

Canonical naming rules for capability keys, agent handles, and tags.

<!--<identity>-->
Shared reference for all naming conventions in the Valdr registry.
<!--</identity>-->

<!--<instructions>-->

## Key Format Overview

Capability keys use **dots** as separators. Prompt keys use **dashes**. This makes them visually distinguishable at a glance.

| Type | Separator | Example |
|------|-----------|---------|
| Capability key | dots | `valdr.orchestrator.skadi.system` |
| Prompt key | dashes | `valdr-orchestrator-skadi-system` |

**Conversion rule:** Replace dots with dashes to derive a prompt key from a capability key.

## Capability Key Format

```
<pack>.<domain>.<name>
<pack>.<domain>.<agent>.<name>
```

### Examples by Type

**Core tool capabilities:**
```
valdr.core.tools.pm-task
valdr.core.tools.pm-agent
valdr.core.tools.vmp
```

**Shared reference capabilities:**
```
valdr.core.registry.taxonomy
valdr.core.registry.naming
valdr.core.specs.agent-yaml
```

**Agent-specific capabilities:**
```
valdr.orchestrator.nikol.system
valdr.orchestrator.nikol.agent-design
valdr.reviewer.sigrid.scoring
```

**Domain capabilities:**
```
typescript.core.best-practices
typescript.testing.vitest
marketing.content.brand-voice
```

### Naming Rules

1. **Lowercase** — All keys are lowercase
2. **Dots** — Use dots as level separators
3. **Hyphens** — Use hyphens within segments (`pm-task`, not `pmtask`)
4. **Specific** — Be specific (`pm-agent` not `agent`)
5. **Pack prefix** — Always include pack (`valdr.`, `typescript.`)

## Agent Handle Format

```
<name>                    # Simple: gunnar, sigrid, nikol
<name>-<variant>          # Variant: claude-cli, claude-task
<org>-<name>              # Org-scoped: acme-reviewer
```

Handles must be unique across the registry.

## Tag Conventions

```
# Pack tags
valdr, typescript, marketing

# Role tags
orchestrator, reviewer, executor, planner, auditor

# Domain tags
pm, registry, code-review, planning, sprint
```

Tags are lowercase, hyphen-separated for multi-word (`code-review`).

## Prompt Key Format

```
<pack>-<domain>-<name>
<pack>-<domain>-<agent>-<name>
```

### Examples

**From capability keys:**
```
valdr.orchestrator.nikol.system       → valdr-orchestrator-nikol-system
valdr.core.tools.pm-prompt            → valdr-core-tools-pm-prompt
valdr.orchestrator.skadi.sprint-prep  → valdr-orchestrator-skadi-sprint-prep
typescript.core.best-practices        → typescript-core-best-practices
```

**Standalone prompts (no capability):**
```
valdr-docs-api-reference
valdr-context-domain-glossary
```

### Prompt Key Rules

1. **Dashes only** — Use dashes as all separators (no dots)
2. **Derived from capability key** — When a prompt backs a capability, replace dots with dashes
3. **Lowercase** — All prompt keys are lowercase
4. **Distinguishable** — The dash format ensures prompt keys never collide with capability keys visually or in search

<!--</instructions>-->
<!--</capability>-->
