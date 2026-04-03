# Gunnar — Valdr PM Orchestrator

> **Status:** Partially registered — core + navigation + registry in system. Task-creation and templates pending sync.

## Overview

**Gunnar** is a general-purpose Valdr project management orchestrator agent. It serves as the central navigation and discovery assistant for the Valdr PM system, designed to help users and other agents efficiently locate and understand:

- Projects and their current state
- Tasks, sprints, and their relationships
- Plans and specifications
- Agents, prompts, and capabilities in the registry
- Task creation via structured templates

## Use Cases

| Context | Description |
|---------|-------------|
| **CLI Assistant** | Interactive help for users navigating Valdr via any MCP-enabled agent |
| **Internal Router** | Used by other agents to discover context, resolve dependencies, or locate relevant resources |
| **Onboarding Guide** | Helps new users understand the Valdr PM structure and available tools |
| **System Navigator** | Expert in MCP tool usage patterns and data relationships |
| **Task Author** | Creates structured, standalone tasks using type-specific templates |

## Capabilities

| Capability Key | Role | Hot-Load | Description |
|----------------|------|----------|-------------|
| `valdr.orchestrator.gunnar.system` | `core` | No | Identity, purpose, tool index, core behaviors |
| `valdr.orchestrator.gunnar.navigation` | `workflow` | Yes | Entity relationships, discovery strategies, cross-entity navigation |
| `valdr.orchestrator.gunnar.registry` | `workflow` | Yes | Agent/prompt/capability discovery and evaluation |
| `valdr.orchestrator.gunnar.task-creation` | `workflow` | Yes | Research-driven task composition using templates |

## Task Templates (Standalone Prompts)

| Prompt Key | Role | Hot-Load | Description |
|------------|------|----------|-------------|
| `valdr-orchestrator-gunnar-template-bug` | `guide` | Yes | Bug fix task template |
| `valdr-orchestrator-gunnar-template-feature` | `guide` | Yes | Feature/enhancement task template |
| `valdr-orchestrator-gunnar-template-spike` | `guide` | Yes | Spike/research task template |
| `valdr-orchestrator-gunnar-template-refactor` | `guide` | Yes | Refactor task template |

## Design Principles

1. **Read-first, act-second** — Always fetch context before suggesting actions
2. **MCP-native** — All operations route through Valdr MCP tools
3. **Confirm before mutating** — Verify user intent before write operations
4. **Hot-load, don't bloat** — Only core capability loaded at startup; workflows loaded on demand
5. **Platform-agnostic** — Works with any MCP-enabled agent (Claude, Gemini, etc.)

## Files

| File | Purpose |
|------|---------|
| `gunnar.agent.yaml` | Agent manifest — defines capabilities and hot-load rules |
| `valdr.orchestrator.gunnar.system.md` | Core system prompt (capability: `valdr.orchestrator.gunnar.system`) |
| `valdr.orchestrator.gunnar.navigation.md` | Navigation workflow (hot-loaded) |
| `valdr.orchestrator.gunnar.registry.md` | Registry workflow (hot-loaded) |
| `valdr.orchestrator.gunnar.task-creation.md` | Task creation workflow (hot-loaded) |
| `templates/valdr-orchestrator-gunnar-template-bug.md` | Bug fix template (hot-loaded prompt) |
| `templates/valdr-orchestrator-gunnar-template-feature.md` | Feature template (hot-loaded prompt) |
| `templates/valdr-orchestrator-gunnar-template-spike.md` | Spike template (hot-loaded prompt) |
| `templates/valdr-orchestrator-gunnar-template-refactor.md` | Refactor template (hot-loaded prompt) |
| `ORCHESTRATOR_CAPABILITY_MATRIX.md` | Capability-to-prompt mapping reference |
