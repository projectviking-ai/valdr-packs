<!--<capability id="valdr.core.registry.taxonomy" pack="valdr" role="context">-->
# Registry Taxonomy

Canonical classifications for the Valdr agent registry.

<!--<identity>-->
Shared reference for all role and kind enumerations in the Valdr registry.
<!--</identity>-->

<!--<instructions>-->

## Agent Kinds

| Kind | Description | Examples |
|------|-------------|----------|
| `bot` | AI agents | Claude, Codex, Gemini agents |
| `human` | Human users | Developers, PMs |
| `ci` | CI/CD pipelines | GitHub Actions, Jenkins |

## Agent Roles

| Role | Purpose | Typical Capabilities |
|------|---------|---------------------|
| `executor` | Executes tasks | Task tools, session management |
| `reviewer` | Reviews work | Review tools, scoring |
| `planner` | Creates plans | VMP, project tools |
| `orchestrator` | Coordinates work | Navigation tools, agent routing |
| `auditor` | Audits sessions | Session tools, scoring |

## Capability Roles

| Role | Purpose | Example |
|------|---------|---------|
| `core` | Identity, mission, non-negotiable | Agent system prompts |
| `workflow` | How to operate, execution patterns | Tool guides, workflows |
| `constraints` | Rules, do-nots, safety rails | Severity guides, policies |
| `context` | Domain knowledge, background | Reference docs, specs |
| `validation` | Checks, scoring criteria | Quality checklists |
| `integration` | Tools, MCP, IO contracts | Tool documentation |

## Prompt Roles

| Prompt Role | Typical Capability Role | Notes |
|-------------|------------------------|-------|
| `system` | `core` | Agent identity |
| `guide` | `workflow` | How-to instructions |
| `policy` | `constraints` | Rules and limits |
| `checklist` | `validation` | Quality checks |
| `context` | `context` | Background info |

## Role Selection Decision Tree

```
Is it the agent's core identity?
  YES → core

Does it describe how to do something?
  YES → workflow

Does it define rules or limits?
  YES → constraints

Is it background knowledge or reference data?
  YES → context

Does it define quality checks or scoring?
  YES → validation

Does it describe tool specs or IO contracts?
  YES → integration
```

<!--</instructions>-->
<!--</capability>-->
