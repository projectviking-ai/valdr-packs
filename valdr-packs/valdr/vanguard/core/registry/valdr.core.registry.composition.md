<!--<capability id="valdr.core.registry.composition" pack="valdr" role="context">-->
# Capability Composition Principles

How to build efficient agents from reusable capabilities.

<!--<identity>-->
Design guide for composing agents that are fast, lean, and reusable. Every token in context should earn its place.
<!--</identity>-->

<!--<instructions>-->

## Core Philosophy

A capability is a **small, focused unit** — instructions, context, or reference data — that exists independently in the registry. An agent is a **composition** of capabilities wired together for a specific purpose.

**Principles:**
1. **Small and focused** — Each capability does one thing well
2. **Reuse over duplication** — If it exists, hot-load it. Don't copy it.
3. **Progressive loading** — Load only what the current task requires
4. **Shared base, specific overlay** — Agents reuse common capabilities and add purpose-specific ones

## Capability Layers

When designing an agent, think about where each capability belongs. Every capability falls into one of three layers:

| Layer | Scope | Characteristics | Examples |
|-------|-------|-----------------|----------|
| **1. Shared References** | Reusable across any agent, any domain | Stable, universal, rarely changes | Role/kind definitions, naming rules, manifest specs, tool docs |
| **2. Shared Workflows** | Reusable across agents within a domain or purpose | Common patterns multiple agents need | Registration workflows, authoring guides, review processes |
| **3. Agent-Specific** | Unique to one agent | Identity, specialized behavior | System prompt, domain conventions, niche workflows |

**Before creating a new capability, search each layer:**

1. Does a Layer 1 shared reference already cover this? → Hot-load it.
2. Does a Layer 2 shared workflow cover this? → Hot-load it.
3. Is this new content useful beyond this one agent? → Create it at Layer 1 or 2.
4. Is this truly unique to this agent? → Create it at Layer 3.

The goal is to **maximize Layer 1 and 2 coverage** so new agents require minimal Layer 3 work. A well-designed ecosystem means building a new agent is mostly wiring existing capabilities together with a thin agent-specific system prompt on top.

## System Prompt as Router

The system prompt (core capability) should be a **routing layer**, not a knowledge store:

- **Identity** — Who the agent is and what it does (brief)
- **Intent routing table** — Maps user intent to which capabilities to hot-load
- **Core behaviors** — Minimal rules that always apply
- **Response format** — Output structure
- **Anti-patterns** — What never to do

Everything else lives in hot-loaded capabilities. If the agent doesn't need it for every single request, it doesn't belong in the system prompt.

## Two Hot-Loading Mechanisms

The registry supports two ways to load content at runtime:

| Mechanism | Command | Returns | Best For |
|-----------|---------|---------|----------|
| **Capability hot-loading** | `pm_capability { action: "prompt", key }` | Content + role/pack metadata | Workflows, tool docs, agent capabilities |
| **Prompt hot-loading** | `pm_prompt { action: "get", key }` | Raw prompt content | Context, reference docs, standalone content |

### When to Use Each

```
Does the content need role/pack/category metadata for composition?
  YES → Register as capability, hot-load via pm_capability prompt.

Is it pure context, documentation, or reference material?
  YES → Register as standalone prompt, hot-load via pm_prompt get by key.

Will multiple capabilities reference this content?
  YES → Standalone prompt. Capabilities can reference or hot-load it independently.

Does it need to appear in capability matrices and agent manifests?
  YES → Capability-backed.
```

### Prompt Hot-Loading in System Prompts

Agents can declare standalone prompts to hot-load alongside their capability tables:

```markdown
## Capability Hot-Loading
| Capability Key | When to Hot-Load |
|----------------|------------------|
| `valdr.orchestrator.agent.workflow-x` | When doing X |

## Prompt Hot-Loading
| Prompt Key | When to Hot-Load |
|------------|------------------|
| `valdr-docs-api-reference` | When answering API questions |
| `valdr-context-domain-glossary` | When unfamiliar terms appear |
```

This keeps the routing explicit and discoverable. The agent knows both what capabilities and what prompts are available to load.

## Token Efficiency

### Evaluate Per Flow

For each user intent the agent handles, map out the capabilities it needs:

```
Flow cost = system prompt tokens + sum(hot-loaded capability tokens)
```

**Targets:**
- Discovery/navigation flows: system prompt only (~500–1000 tokens)
- Single-task operations: system + 1–2 capabilities (~1500–2500 tokens)
- Complex multi-step flows: system + 3–4 capabilities (~3000–5000 tokens)

### Optimization Rules

1. **If a capability is loaded in <20% of flows, it must be hot-loaded** — never inline
2. **If two capabilities always load together, consider merging them** — reduce round-trips
3. **If a capability exceeds ~1500 tokens, consider splitting it** — smaller units = more precise loading
4. **Shared references should be small** (~300–500 tokens) — they load as sub-dependencies of workflows

## Building Domain Variants

A common pattern: you have an agent that works well in one domain, and you want a variant for another domain (different language, different industry, different team).

### What is typically reusable

These categories of capabilities tend to be universal:

| Category | Why It's Reusable |
|----------|-------------------|
| Role and kind definitions | Classifications don't change across domains |
| Naming conventions | Key format rules are universal |
| Manifest specs | Structure definitions are the same everywhere |
| Registration mechanics | How to wire capabilities to agents doesn't change |
| Authoring patterns | How to write good prompts is domain-agnostic |
| Tool documentation | MCP tools work the same way regardless of domain |

### What is typically new

| Category | Why It's New |
|----------|-------------|
| System prompt | Different identity, purpose, and intent routing |
| Domain conventions | Language/framework/industry-specific patterns |
| Specialized workflows | Processes unique to the domain |

### The Result

A well-composed domain variant typically needs **2–3 new capabilities** for its specific purpose, reusing everything else from the shared layers. The new agent's system prompt routes to its domain-specific capabilities AND the shared ones — same hot-load pattern, no duplication.

## Scenario: E-Commerce Team

An e-commerce team wants three agents: a product catalog reviewer, an order flow executor, and a pricing orchestrator.

**Shared (built once, used by all three):**
- Reference: role definitions, naming rules, review scoring criteria
- Workflow: code review patterns, test validation, deployment checklist

**Domain (built once for e-commerce, shared across the three):**
- Context: e-commerce data model, API conventions, compliance rules

**Agent-specific (built per agent):**
- Product reviewer: catalog validation rules, image quality checks
- Order executor: payment flow patterns, inventory checks
- Pricing orchestrator: margin rules, discount policy, A/B test routing

Each agent's system prompt is a thin router. Most of the knowledge lives in shared and domain layers.

## Scenario: Multi-Language SDK Team

A team maintains SDKs in Python, TypeScript, and Go. They want language-specific executor agents.

**Shared:** testing patterns, CI/CD workflow, API spec validation, review scoring
**Domain per language:** idioms, package conventions, linter configs
**Agent-specific:** each executor's system prompt routes to its language domain + shared workflows

Adding a fourth language (Rust) means: 1 new system prompt + 1 domain conventions capability. Everything else is reused.

## Decision Framework

When adding new functionality to an agent:

```
Does a capability or prompt already exist that covers this?
  YES → Hot-load it. Done.

Is this pure context, docs, or reference material?
  YES → Register as standalone prompt (Path B). Hot-load via pm_prompt get.
  NO  → Continue below.

Is this useful to agents beyond this one?
  YES → Create it as a shared capability (Layer 1 or 2).
  NO  → Create it as agent-specific (Layer 3).

Is this needed on every request this agent handles?
  YES → Consider inlining in the system prompt (keep it brief).
  NO  → Hot-load it.
```

## Inline vs Hot-Load Transitions

When changing a capability's loading tier:

**Hot-loaded → Inlined (agent-linked):**
- The capability will now load on every request alongside the system prompt
- Strip any content from the system prompt that overlaps with the inlined capability
- Both are always in context — duplication wastes tokens and risks drift

**Inlined → Hot-loaded:**
- The system prompt must still route to it — add a hot-load table entry
- Include a brief description of WHEN to load it
- The system prompt should be self-sufficient without it for non-related flows

## Anti-Patterns (DO NOT)

1. **Copy shared content into agent-specific capabilities** — Hot-load the shared version
2. **Create a monolithic system prompt** — Route to capabilities, don't embed them
3. **Load all capabilities upfront** — Only load what the current task needs
4. **Create agent-specific capabilities for universal concepts** — If it applies across domains, it belongs in a shared layer
5. **Over-engineer before you have two agents** — Build the shared layer when the second consumer appears, not before
6. **Inline a capability without deduplicating the system prompt** — Both load together, overlap wastes tokens
7. **Wrap pure context/docs in a capability** — Use standalone prompts (Path B) for content that doesn't need role/pack/category metadata

<!--</instructions>-->
<!--</capability>-->
