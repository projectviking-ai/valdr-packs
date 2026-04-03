# Valdr PM MCP Skills

Skills for operating the Valdr PM MCP server. Each skill is a focused instruction set for a specific domain.

## Available Skills

| Skill | Description | Entrypoint |
|-------|-------------|------------|
| `valdr-auditor` | Session auditing: evaluate agent work, score submissions | `valdr-auditor/SKILL.md` |
| `valdr-executor` | Task execution: fetch tasks, execute work, update checklists | `valdr-executor/SKILL.md` |
| `valdr-orchestrator` | Unified orchestrator routing across PM navigation, registry, and sprint workflows | `valdr-orchestrator/SKILL.md` |
| `valdr-planner` | VMP structured planning: plans, specs, requirements, tasks | `valdr-planner/SKILL.md` |
| `valdr-reviewer` | Code review workflow: reviews, scoring, verification gate | `valdr-reviewer/SKILL.md` |

## Skill Selection Guide

| Task | Skill |
|------|-------|
| Audit agent sessions | valdr-auditor |
| Evaluate execution quality | valdr-auditor |
| Submit score payloads | valdr-auditor |
| Execute assigned task | valdr-executor |
| Update task checklists | valdr-executor |
| Change task status | valdr-executor |
| Navigate Valdr entities | valdr-orchestrator |
| Discover projects/tasks | valdr-orchestrator |
| Register agents | valdr-orchestrator |
| Author prompts | valdr-orchestrator |
| Link capabilities | valdr-orchestrator |
| Manage sprint cadence | valdr-orchestrator |
| Staff sprint tasks | valdr-orchestrator |
| Route sprint reviews | valdr-orchestrator |
| Prepare task launch readiness | valdr-orchestrator |
| Launch executor sessions | valdr-orchestrator |
| Create structured plans | valdr-planner |
| Define requirements | valdr-planner |
| Generate tasks from plans | valdr-planner |
| Start/manage reviews | valdr-reviewer |
| Record review scores | valdr-reviewer |
| Verify task completion | valdr-reviewer |

## Skill Structure

Each skill follows a consistent structure:

```
skills/<skill-name>/
  SKILL.md              # Entrypoint (required) - load this file
  agents/               # Optional product-specific UI metadata
    openai.yaml
  assets/               # Optional icons or other bundled assets
```

## Tool Naming Convention

The wrapper skills use fully-qualified MCP names in examples, such as `mcp__valdr__pm_project` and `mcp__valdr__pm_task`, so the handoff to the loaded prompt is explicit.

## Critical Protocol (All Skills)

Every skill follows this non-negotiable sequence:

```
STEP 1: Fetch before mutate
        → ALWAYS get current state before updating
        → NEVER update blind

STEP 2: Include audit metadata
        → actorHandle: your handle
        → clientRequestId: fresh ULID per mutation
        → reason: dated explanation (when applicable)
```

Actor handle resolution (CLI, use this order):
1) If the user explicitly provides a handle, use it.
2) If `VALDR_ACTOR_HANDLE` is set, use it.
3) Otherwise call `pm_agent { action: "list" }` and pick a `*-cli` handle that matches the current provider (e.g., `codex-cli`, `claude-cli`).
4) If multiple matches exist, ask the user to choose.
5) If no match exists, ask the user to provide a handle or register one.

Normalize handles: trim, strip leading `@`, lowercase. Never guess a handle.

Launch examples:
- `VALDR_ACTOR_HANDLE=codex-cli codex`
- `VALDR_ACTOR_HANDLE=claude-cli claude`

Verification: in the same shell you launch from, run `printenv VALDR_ACTOR_HANDLE` to confirm the value is set.

## Failure Modes

| Condition | Action |
|-----------|--------|
| Required tool unavailable | STOP. Escalate to user. |
| Update without fetch | STOP. Fetch first. |
| Stale clientRequestId | Generate fresh ULID. |
| Validation error | Read error message. Fix input. Retry. |

## Installation

Use the Makefile targets to install skills for your AI coding assistant:

### Claude Code

```bash
make sync-skills-claude   # Install to ~/.claude/skills/
```

### Codex

```bash
make sync-skills-codex    # Install to ~/.agents/skills/
```

### Project-Level Installation

For project-level installation, use `make sync-skills` which populates:
- `.claude/skills/`
- `.agents/skills/`
- `.gemini/skills/`

## Compatibility

Requires Valdr MCP server with PM MCP tools enabled.
