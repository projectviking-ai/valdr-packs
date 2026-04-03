<!--<capability id="valdr.orchestrator.nikol.capability-authoring" pack="valdr" role="workflow">-->
# Capability Authoring Guide

<!--<identity>-->
Workflow for writing prompts and registering capabilities.
<!--</identity>-->

<!--<instructions>-->

## Capability Structure

Every capability has:

```
Capability
├── key (unique identifier)
├── category (grouping)
├── role (hot-load valdr.core.registry.taxonomy for allowed roles)
├── pack (ownership: valdr, typescript, etc.)
└── promptId (linked prompt content)
```

## Prompt Template

```markdown
<!--<capability id="<key>" pack="<pack>" role="<role>">-->
# <Title>

<One-line description>

<!--<identity>-->
<Brief identity/purpose statement — 1-3 sentences max>
<!--</identity>-->

<!--<instructions>-->

## Section 1: <Topic>

<Content>

## Section 2: <Topic>

<Content>

## Anti-Patterns (DO NOT)

1. <What not to do>

<!--</instructions>-->
<!--</capability>-->
```

## Writing Effective Prompts

### Identity Sections

Keep brief and focused:

**Good:**
```markdown
<!--<identity>-->
You are the last line of defense against bugs. When in doubt, block.
<!--</identity>-->
```

**Bad:**
```markdown
<!--<identity>-->
You are an AI assistant that helps with code review. You should be thorough
and helpful. You care about code quality...
[200 more words]
<!--</identity>-->
```

### Instructions

- Use **tables** for quick reference (actions, roles, mappings)
- Use **code blocks** for tool call examples
- Use **lists** for sequential steps
- Always include an **Anti-Patterns** section

### Hot-Load References, Don't Duplicate

If content exists in a shared capability, reference it:

```markdown
Hot-load `valdr.core.registry.taxonomy` for role selection.
```

Do NOT copy the roles table into your prompt. This prevents drift and keeps prompts lean.

## Two Registration Paths

### Path A: Capability-Backed Prompt (Full Registration)

Use when the content is a workflow, tool doc, or agent capability that needs role/pack/category metadata and participates in the capability composition system.

### Path B: Standalone Prompt (Prompt-Only Registration)

Use when the content is context, documentation, or reference material that agents hot-load directly via `pm_prompt get` by key. No capability wrapper needed.

### Decision Guide

| Content Type | Path | Hot-Load Via |
|-------------|------|-------------|
| Agent workflows (how to operate) | A — Capability | `pm_capability { action: "prompt", key }` |
| Tool documentation | A — Capability | `pm_capability { action: "prompt", key }` |
| Agent identity (system prompt) | A — Capability | Always loaded with agent |
| Context / reference docs | B — Prompt only | `pm_prompt { action: "get", key }` |
| Shared docs (API specs, style guides) | B — Prompt only | `pm_prompt { action: "get", key }` |
| Reusable snippets / templates | B — Prompt only | `pm_prompt { action: "get", key }` |
| Quality checklists | Either | Depends on whether it participates in capability composition |

**Rule:** If the content needs `role`, `pack`, or `category` metadata for composition, use Path A. If it's just content to be loaded on demand, use Path B.

## Registration Workflow — Path A (Capability-Backed)

### 1. Author the Prompt

Write the markdown file at the agent's directory:
```
valdr-packs/<pack>/<path>/<capability-key>.md
```

### 2. Register Prompt

Derive the prompt key from the capability key by replacing dots with dashes:

```
pm_prompt {
  action: "create",
  key: "<prompt-key>",          # dashes: valdr-orchestrator-skadi-sprint-prep
  name: "<prompt-key>",
  role: "system" | "guide" | "policy" | "checklist" | "context",
  content: "<markdown content>",
  tags: ["<pack>", "<domain>"]
}
→ { id: "<prompt-id>" }
```

`key` is required on create. Prompt keys use **dashes** (not dots) — derived from the capability key by replacing dots with dashes. Example: capability `valdr.orchestrator.skadi.sprint-prep` → prompt key `valdr-orchestrator-skadi-sprint-prep`. Do not pass `id` on create — the system generates it.

### 3. Register Capability

```
pm_capability {
  action: "ensure",
  key: "<key>",
  category: "<category>",
  promptId: "<prompt-id>",
  role: "<role>",
  pack: "<pack>"
}
```

Hot-load `valdr.core.registry.taxonomy` for role selection.
Hot-load `valdr.core.registry.naming` for key format conventions.

### 4. Link to Agent (If Applicable)

Hot-load `valdr.orchestrator.nikol.agent-assembly` for linking rules (agent-linked vs hot-loaded).

## Registration Workflow — Path B (Standalone Prompt)

### 1. Author the Prompt

Write the markdown file:
```
valdr-packs/<pack>/<path>/<prompt-key>.md
```

### 2. Register Prompt

Prompt keys always use dashes:

```
pm_prompt {
  action: "create",
  key: "<prompt-key>",          # dashes: valdr-docs-api-reference
  name: "<prompt-key>",
  role: "context" | "guide" | "policy" | "checklist",
  content: "<markdown content>",
  tags: ["<pack>", "<domain>"]
}
```

No capability registration needed. The prompt is immediately hot-loadable by key:

```
pm_prompt { action: "get", key: "<prompt-key>" }
```

### 3. Reference in Agent System Prompt

Add the prompt to the agent's hot-load table:

```markdown
## Prompt Hot-Loading

| Prompt Key | When to Hot-Load |
|------------|------------------|
| `<key>` | <when to load this prompt> |
```

Agents load standalone prompts via `pm_prompt { action: "get", key: "<key>" }` — the content field contains the full prompt text.

### When to Upgrade Path B → Path A

Convert a standalone prompt to a capability-backed prompt when:
- Multiple agents need to discover it via `pm_capability list`
- It needs role/pack metadata for composition decisions
- It should appear in capability matrices

## Quality Checklist

Before registering:

- [ ] Prompt follows the template structure
- [ ] Identity section is brief (< 50 words)
- [ ] Instructions are scannable (tables, lists, code blocks)
- [ ] Anti-patterns section included
- [ ] References shared capabilities instead of duplicating content
- [ ] Key follows naming convention (hot-load `valdr.core.registry.naming`)
- [ ] Role matches content type (hot-load `valdr.core.registry.taxonomy`)
- [ ] Pack is correct

## Anti-Patterns (DO NOT)

1. Duplicate reference data — hot-load shared capabilities instead
2. Write identity sections longer than 50 words
3. Create capabilities without linking a prompt
4. Skip the quality checklist
5. Use vague capability keys

<!--</instructions>-->
<!--</capability>-->
