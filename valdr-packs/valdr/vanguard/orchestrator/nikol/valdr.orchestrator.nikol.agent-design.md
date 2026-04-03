<!--<capability id="valdr.orchestrator.nikol.agent-design" pack="valdr" role="workflow">-->
# Agent Design Guide

<!--<identity>-->
Workflow for designing new agent identities from scratch.
<!--</identity>-->

<!--<instructions>-->

## Agent Anatomy

Every Valdr agent has:

```
Agent
├── Identity (handle, name, kind)
├── Role (executor, reviewer, planner, orchestrator, auditor)
├── Capabilities (what it can do)
├── Prompts (instructions it follows)
├── Tags (categorization)
└── Notes (metadata)
```

Hot-load `valdr.core.registry.taxonomy` for the full kinds/roles/capability-roles reference.

## Design Workflow

### Step 1: Define Identity

```
Name: <human-readable name>
Handle: <unique-handle>
Kind: bot | human | ci
Role: executor | reviewer | planner | orchestrator | auditor
Purpose: <one sentence>
```

Hot-load `valdr.core.registry.naming` for handle and tag conventions.

### Step 2: Design Capability Set

Decide what capabilities the agent needs:

1. **Core capability** — Agent's identity and system prompt (always exactly one, always agent-linked)
2. **Workflow capabilities** — How the agent operates (typically hot-loaded)
3. **Shared references** — Taxonomy, naming, specs (always hot-loaded)
4. **Tool capabilities** — Tool documentation (always hot-loaded)

Design the system prompt as a **routing layer**: identity, purpose, hot-load tables, core behaviors. Keep it lean — detailed instructions belong in hot-loaded workflows.

### Step 3: Author Prompt Content

For each capability, write a markdown file using the capability template.

Hot-load `valdr.orchestrator.nikol.capability-authoring` for prompt structure, writing patterns, and quality checks.

### Step 4: Assemble and Register

Wire capabilities to the agent and register in Valdr.

Hot-load `valdr.orchestrator.nikol.agent-assembly` for the two-tier registration model, manifest patterns, and validation checklist.

### Step 5: Review and Approve

Before committing:

1. Update README and capability matrix
2. Present agent design for stakeholder review
3. Address feedback
4. Get explicit sign-off before finalizing

Registry changes affect the entire ecosystem. Poorly designed agents waste context and create technical debt.

## System Prompt Design Pattern

The system prompt should be a routing layer, not a knowledge dump:

```
System Prompt (core, always loaded)
├── Identity and purpose (brief)
├── Hot-load tables (what to load when)
├── Core behaviors (brief rules)
├── Response format
└── Anti-patterns
```

**Principles:**
- If content exists in a hot-loadable capability, don't duplicate it in the system prompt
- The system prompt tells the agent WHAT to load and WHEN — not the details
- Target: system prompt should be the minimum needed to route correctly

## Design Validation

When evaluating an existing agent, run both the structural checklist and the content quality checklist.

### Structural Checklist

- [ ] System prompt is a routing layer — no duplicated workflow content
- [ ] Agent uses capabilities only — no direct `prompts` linkage on the agent (the system supports prompts, but Nikol builds with capabilities exclusively)
- [ ] Hot-loaded capabilities are NOT linked to the agent in the registry
- [ ] `<agent-handle>.agent.yaml` matches the registry state (tags, capabilities)
- [ ] Tool documentation capabilities listed in agent.yaml for all referenced tools
- [ ] Documentation examples use correct hot-load pattern (`pm_capability { action: "prompt" }`, not two-step get+get)
- [ ] No content overlap between agent-linked capabilities (if two are always loaded, they must not duplicate content)

### Content Quality Checklist

- [ ] Examples match rules — code/call examples in capabilities follow the rules defined in those same capabilities (no contradictions between "do this" prose and actual examples)
- [ ] Constraints are internally consistent — no overlapping ranges, contradictory conditions, or ambiguous thresholds within or across constraint capabilities
- [ ] Documentation accuracy — README, capability matrix, and inline comments correctly describe capability roles, names, and loading behavior
- [ ] Required vs optional fields — if a field is declared required, every example includes it; if optional, examples clarify when to include it
- [ ] Role labels match manifest — capability roles described in documentation match the roles declared in agent.yaml and the registry

## Remediation Rules

When fixing an agent after evaluation:

1. **Address every finding** — do not skip findings identified during evaluation
2. **Inline transition** — when changing a capability from hot-loaded to agent-linked, strip overlapping content from the system prompt. Both will load on every request — duplication wastes tokens.
3. **Hot-load transition** — when changing a capability from agent-linked to hot-loaded, ensure the system prompt has enough routing context (hot-load table entry, brief description of when to load)
4. **Tool doc gaps** — when tools are referenced in the system prompt, add corresponding `valdr.core.tools.*` capabilities to the agent.yaml with `hot-load: true`
5. **Documentation sync** — update README, capability matrix, and any examples to match the new structure
6. **Example-rule conflicts** — when examples contradict rules in the same capability, fix the examples to match the rules (rules are authoritative unless the rule itself is wrong)
7. **Constraint ambiguity** — when constraint ranges overlap or conditions conflict, resolve by tightening definitions and adding explicit boundary behavior

## Anti-Patterns (DO NOT)

1. Duplicate reference data that exists in shared capabilities
2. Jam detailed instructions into the system prompt
3. Create agents without a clear single-purpose identity
4. Skip the approval step for registry changes
5. Link prompts directly to agents — Nikol uses capabilities exclusively (the system supports prompts, but capabilities provide better composition and reuse)
6. Skip evaluation findings during remediation
7. Inline a capability without removing overlap from the system prompt
8. Ship examples that contradict the rules they demonstrate
9. Leave ambiguous or overlapping constraint ranges unresolved

<!--</instructions>-->
<!--</capability>-->
