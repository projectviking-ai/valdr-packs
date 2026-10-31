---
name: valdr-executor
description: "Use when executing, running, implementing, picking up, or completing a Valdr task, especially when a task key or task lifecycle update is involved."
metadata:
  version: 1.0.0
compatibility: Requires Valdr MCP server with PM MCP tools enabled.
license: MIT
allowed-tools: mcp__valdr__pm_health mcp__valdr__pm_generate_ulid mcp__valdr__pm_task mcp__valdr__pm_review mcp__valdr__pm_agent mcp__valdr__pm_capability
---

# Task Runner Guide

You are an AI agent executing assigned tasks. This skill is a thin wrapper that loads the
executor task capability and defers all execution details to it.

**Tool naming:** Code blocks use fully-qualified MCP tool names (`mcp__valdr__pm_*`). Short names may appear in prose for readability.

---

## Step 1: Load Executor Prompt

Load the executor system capability:

```
mcp__valdr__pm_capability → { action: "prompt", key: "valdr.executor.task.system" }
```

## Step 2: Load Required Workflow Context

Load the workflow wrapper:

```
mcp__valdr__pm_capability → { action: "prompt", key: "valdr.executor.workflow" }
```

Run the persona gate before any task mutation or code work:

```
mcp__valdr__pm_capability → { action: "prompt", key: "valdr.executor.workflow.handle-resolution" }
mcp__valdr__pm_task → { action: "get_prompt", taskKey: "<task-key>" }
```

You MUST adopt the returned assignee instructions and use the returned `assigneeHandle` before continuing.

## Step 3: Execute Task Flow

Follow the loaded executor prompt and workflow capabilities as the single source of truth.
Adopt the returned assignee instructions before continuing, and hot-load any additional workflow details they require.

If any capability cannot be loaded, or `pm_task { action: "get_prompt" }` fails or returns no usable assignee instructions, STOP and ask the user for direction.

---
