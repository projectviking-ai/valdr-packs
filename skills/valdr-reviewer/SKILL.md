---
name: valdr-reviewer
description: "Use when reviewing a Valdr task, starting or managing reviews, assigning reviewers, scoring work, verifying completion, or moving work through the review gate."
metadata:
  version: 1.0.0
compatibility: Requires Valdr MCP server with PM MCP tools enabled.
license: MIT
allowed-tools: mcp__valdr__pm_health mcp__valdr__pm_generate_ulid mcp__valdr__pm_task mcp__valdr__pm_review mcp__valdr__pm_session mcp__valdr__pm_agent mcp__valdr__pm_capability
---

# Reviewer Guide

You are an AI agent conducting task reviews. This skill is a thin wrapper that loads the
reviewer capability and defers all review details to it.

**Tool naming:** Code blocks use fully-qualified MCP tool names (`mcp__valdr__pm_*`). Short names may appear in prose for readability.

---

## Step 1: Resolve Reviewer Agent

Before loading capabilities, determine which reviewer agent to use.

### 1a) Fetch the task

```
mcp__valdr__pm_task → { action: "get", taskKey: "<task key>" }
```

Check the task's review assignments in the response.

### 1b) Resolution logic

**Route A: Task has assigned reviewer(s)**

| Scenario | Action |
|----------|--------|
| 1 or more reviewers assigned | Present the assigned reviewer handles to the user and ask which one should review the task |
| User specified handle not in assignments | STOP with error: "Reviewer X is not assigned to this task" |

**Route B: No reviewers assigned to task**

| Scenario | Action |
|----------|--------|
| User specified a reviewer | Start new review with that handle via `pm_review { action: "start", taskKey, reviewerHandle }` |
| User did NOT specify | List available reviewers and ask the user to choose one |

To list available reviewers:
```
mcp__valdr__pm_agent → { action: "list", defaultRoles: ["reviewer"] }
```

| Result | Action |
|--------|--------|
| 1 or more agents found | Present the available reviewer handles to the user and ask which should review the task |
| No agents found | STOP: "No reviewer agents registered. Use valdr-orchestrator to route registry setup." |

### 1c) Capture the resolved reviewer handle from the user's selection

---

## Step 2: Load Reviewer Prompt

Load the reviewer agent's prompt by handle:

```
mcp__valdr__pm_agent → { action: "get_prompt", handle: "<reviewer handle>" }
```

Example after selection:
```
mcp__valdr__pm_agent → { action: "get_prompt", handle: "sigrid" }
```

If the prompt cannot be loaded, STOP and ask the user for direction.

---

## Step 3: Execute Review

Follow the loaded reviewer prompt as the single source of truth.
Hot-load any workflows or references it calls for, and keep the wrapper limited to reviewer resolution and prompt loading.

---

## Related Skills

| Task Type | Skill | Description |
|-----------|-------|-------------|
| Task execution | valdr-executor | Running, implementing, or completing tasks |
| Orchestrator routing | valdr-orchestrator | Navigation, registry operations, and sprint routing |
| Feature planning | valdr-planner | VMP markdown plans, specs, requirements |
