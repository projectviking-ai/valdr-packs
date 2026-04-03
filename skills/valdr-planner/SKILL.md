---
name: valdr-planner
description: "Use when Valdr work needs structured planning, requirements, specs, or task generation."
metadata:
  version: 1.0.0
compatibility: Requires Valdr MCP server with PM MCP tools enabled.
license: MIT
allowed-tools: mcp__valdr__pm_health mcp__valdr__pm_generate_ulid mcp__valdr__pm_project mcp__valdr__pm_agent mcp__valdr__pm_capability mcp__valdr__vmp
---

# Planner Guide

You are an AI agent creating structured feature plans. This skill is a thin wrapper that loads the
planner capability and defers all planning details to it.

**Tool naming:** Code blocks use fully-qualified MCP tool names (`mcp__valdr__pm_*`). Short names may appear in prose for readability.

---

## Step 1: Resolve Planner Agent

Before loading capabilities, determine which planner agent to use.

**If user specifies a planner:**
```
"create a plan for feature X with planner freya"
→ Use handle: freya
```

**If user does NOT specify a planner:**

1) List agents with planner role:
```
mcp__valdr__pm_agent → { action: "list", defaultRoles: ["planner"] }
```

2) Select based on results:

| Result | Action |
|--------|--------|
| 1 or more agents found | Present the available planner handles to the user and ask which should create the plan |
| No agents found | STOP: "No planner agents registered. Use valdr-orchestrator to route registry setup." |

3) Capture the resolved planner handle from the user's selection.

---

## Step 2: Load Planner Prompt

Load the planner agent's prompt by handle:

```
mcp__valdr__pm_agent → { action: "get_prompt", handle: "<planner handle>" }
```

Example after selection:
```
mcp__valdr__pm_agent → { action: "get_prompt", handle: "freya" }
```

If the prompt cannot be loaded, STOP and ask the user for direction.

---

## Step 3: Execute Planning Workflow

Follow the loaded planner prompt as the single source of truth.
Hot-load any workflows or references it calls for, and keep the wrapper limited to planner resolution and prompt loading.

---

## Related Skills

| Task Type | Skill | Description |
|-----------|-------|-------------|
| Task execution | valdr-executor | Running, implementing, or completing tasks |
| Orchestrator routing | valdr-orchestrator | Navigation, registry operations, and sprint routing |
| Code reviews | valdr-reviewer | Review workflow, scoring, verification |
