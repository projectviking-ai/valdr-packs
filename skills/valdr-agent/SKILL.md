---
name: valdr-agent
description: "Use when the user asks to load or adopt a registered Valdr agent persona by handle, such as sigrid, freya, or java-task-agent."
---

# Agent Persona Loader

Load and embody a registered agent from the Valdr registry.

## Usage

- Claude Code plugin: `/valdr:valdr-agent <agent-handle>`
- Standalone Claude Code skill: `/valdr-agent <agent-handle>`
- Codex plugin: `Use $valdr:valdr-agent with <agent-handle>`
- Standalone Codex skill: `Use $valdr-agent with <agent-handle>`

**Examples:**
- `Use valdr-agent with sigrid` — Adopt the Sigrid reviewer persona
- `Use valdr-agent with freya` — Adopt the Freya planner persona
- `Use valdr-agent with java-task-agent` — Adopt a Java task executor

## Execution Flow

### Step 1: Parse the Agent Handle

Extract the requested agent handle from the user's request or invocation arguments. If no handle was supplied, list available agents:

```text
mcp__valdr__pm_agent({ "action": "list", "kinds": ["bot"] })
```

This returns agent records with `handle`, `name`, and `defaultRole` fields. Present the available agents and ask the user to choose.

### Step 2: Load the Agent Prompt

Fetch the agent's complete system prompt by calling the MCP tool directly:

```text
mcp__valdr__pm_agent({ "action": "get_prompt", "handle": "<agent-handle>" })
```

This returns the assembled system prompt containing:
- The agent's identity and role
- Linked capability instructions
- Behavioral guidelines and policies

### Step 3: Adopt the Persona

Once the prompt is loaded:

1. **Embody the identity** — You ARE now this agent. Adopt its name, role, and perspective.
2. **Follow its instructions** — Apply the loaded prompt to the requested work within the user's instructions and the assistant's higher-priority rules.
3. **Use its capabilities** — Apply the skills and workflows defined in the prompt.
4. **Maintain consistency** — Stay in character throughout the conversation.

### Step 4: Acknowledge Activation

Confirm to the user:

> **[Agent Name] activated.** I am now operating as [role]. How can I assist you?

## Error Handling

| Error | Recovery |
|-------|----------|
| Agent not found | List available agents with `mcp__valdr__pm_agent({ "action": "list" })` |
| No prompt configured | Inform user the agent has no system prompt defined |
| Connection error | Retry once, then report the issue |

## Notes

- Hot-load additional capabilities referenced in the agent's prompt
- Respect any tool restrictions defined by the agent
