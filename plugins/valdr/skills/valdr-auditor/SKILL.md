---
name: valdr-auditor
description: "Use when auditing a Valdr session, evaluating agent work, recording an audit score run, or reviewing task execution quality."
metadata:
  version: 1.1.0
compatibility: Requires Valdr MCP server with PM MCP tools enabled.
license: MIT
allowed-tools: mcp__valdr__pm_health mcp__valdr__pm_generate_ulid mcp__valdr__pm_task mcp__valdr__pm_audit mcp__valdr__pm_session mcp__valdr__pm_agent mcp__valdr__pm_capability
---

# Auditor Guide

You are an AI agent auditing Valdr sessions. This skill is a thin wrapper that resolves an auditor agent,
loads that agent's prompt/persona, and defers all audit workflow details to the loaded auditor prompt.

**Tool naming:** Code blocks use fully-qualified MCP tool names (`mcp__valdr__pm_*`). Short names may appear in prose for readability.

---

## Step 1: Resolve Auditor Agent

Before auditing, determine which auditor agent should handle the session.

### 1a) If the user specifies an auditor handle

Use that handle directly, then load its prompt.

Example:
```
"audit this session with tyr-v2"
→ Use handle: tyr-v2
```

### 1b) If the user does not specify an auditor handle

List available auditor agents:

```
mcp__valdr__pm_agent → { action: "list", defaultRoles: ["auditor"] }
```

Resolve the auditor with these rules:

| Result | Action |
|--------|--------|
| 1 or more auditors found | Present the available handles to the user and ask which auditor should handle the session |
| No auditors found | STOP: "No auditor agents registered. Use valdr-orchestrator to route registry setup or repair." |

### 1c) Capture the resolved auditor handle from the user's selection

---

## Step 2: Load Auditor Prompt / Persona

Load the selected auditor agent's prompt by handle:

```
mcp__valdr__pm_agent → { action: "get_prompt", handle: "<auditor handle>" }
```

Example after selection:
```
mcp__valdr__pm_agent → { action: "get_prompt", handle: "tyr-v2" }
```

If the prompt cannot be loaded, STOP and ask the user for direction.

---

## Step 3: Execute the Audit

Follow the loaded auditor prompt as the single source of truth.
Hot-load any workflows or references it calls for, and do not prefer stale wrapper text over the loaded prompt.

---

## Related Skills

| Task Type | Skill | Description |
|-----------|-------|-------------|
| Orchestrator routing | valdr-orchestrator | Navigation, registry operations, and sprint routing |
| Code reviews | valdr-reviewer | Review workflow, lightweight review scores, verification |
| Task execution | valdr-executor | Running, implementing, or completing tasks |
