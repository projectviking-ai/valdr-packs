---
name: valdr-orchestrator
description: "Use when navigating Valdr state or routing work through orchestrator agents, including general PM discovery, registry operations, and sprint orchestration."
metadata:
  version: 1.0.0
compatibility: Requires Valdr MCP server with PM MCP tools enabled.
license: MIT
allowed-tools: mcp__valdr__pm_health mcp__valdr__pm_generate_ulid mcp__valdr__pm_project mcp__valdr__pm_sprint mcp__valdr__pm_task mcp__valdr__pm_review mcp__valdr__pm_agent mcp__valdr__pm_prompt mcp__valdr__pm_capability mcp__valdr__pm_session mcp__valdr__vmp
---

# Orchestrator Guide

You are an AI agent routing Valdr work through orchestrator agents. This skill is a thin wrapper that loads the
resolved orchestrator agent prompt and defers all orchestration details to it.

**Tool naming:** Code blocks use fully-qualified MCP tool names (`mcp__valdr__pm_*`). Short names may appear in prose for readability.

---

## Step 1: Resolve Orchestrator

Before loading prompt content, determine which orchestrator should handle the request.

### 1a) If the user specifies an orchestrator handle

Validate the requested handle directly:

```
mcp__valdr__pm_agent → { action: "get", handle: "<orchestrator handle>" }
```

If the handle exists, use it. If it does not exist, STOP and ask the user for direction.

### 1b) If the user does not specify an orchestrator handle

List the available orchestrators first:

```
mcp__valdr__pm_agent → { action: "list", defaultRoles: ["orchestrator"] }
```

| Result | Action |
|--------|--------|
| 1 or more orchestrators found | Present the available handles to the user and ask which orchestrator should handle the request |
| No orchestrators found | STOP: "No orchestrator agents found. Ask the user to register one in the registry." |

### 1c) Capture the resolved orchestrator handle from the user's selection

---

## Step 2: Load Orchestrator Prompt

Load the resolved orchestrator agent prompt by handle:

```
mcp__valdr__pm_agent → { action: "get_prompt", handle: "<orchestrator handle>" }
```

Example after selection:

```
mcp__valdr__pm_agent → { action: "get_prompt", handle: "gunnar" }
```

If the prompt cannot be loaded, STOP and ask the user for direction.

---

## Step 3: Execute Orchestration Flow

Follow the loaded orchestrator prompt as the single source of truth.
Hot-load any workflows or tool docs it references as needed.

---

## Related Skills

| Task Type | Skill | Description |
|-----------|-------|-------------|
| Task execution | valdr-executor | Running, implementing, or completing tasks |
| Feature planning | valdr-planner | VMP markdown plans, specs, requirements |
| Code reviews | valdr-reviewer | Review workflow, scoring, verification |
| Session auditing | valdr-auditor | Audit workflow, scoring, and execution quality |
