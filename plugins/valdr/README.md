# Valdr PM MCP Skills

Skills for operating the Valdr PM MCP server. Each skill is a focused instruction set for a specific domain.

## Available Skills

| Skill | Description | Entrypoint |
|-------|-------------|------------|
| `valdr-agent` | Load and adopt a registered agent persona by handle | `valdr-agent/SKILL.md` |
| `valdr-auditor` | Session auditing: evaluate agent work and persist audit score runs | `valdr-auditor/SKILL.md` |
| `valdr-executor` | Task execution: fetch tasks, execute work, update checklists | `valdr-executor/SKILL.md` |
| `valdr-orchestrator` | Unified orchestrator routing across PM navigation, registry, and sprint workflows | `valdr-orchestrator/SKILL.md` |
| `valdr-planner` | VMP structured planning: plans, specs, requirements, tasks | `valdr-planner/SKILL.md` |
| `valdr-workflow-tools` | Author portable local code and CLI tools, inventories, contracts and pack updates | `valdr-workflow-tools/SKILL.md` |
| `valdr-reviewer` | Code review workflow: reviews, lightweight review scoring, verification gate | `valdr-reviewer/SKILL.md` |

## Skill Selection Guide

| Task | Skill |
|------|-------|
| Load or adopt an agent persona | valdr-agent |
| Author or update a workflow tool / discover CLI commands | valdr-workflow-tools |
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
| Record lightweight review scores | valdr-reviewer |
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

## Critical Protocol (PM Record Mutations)

Skills that mutate PM records follow this sequence; local tool authoring and pack validation do not require actor metadata:

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

Install the `valdr` plugin from the `valdr-packs` marketplace to add all seven public skills: agent persona loading, orchestrator, planner, executor, reviewer, auditor, and workflow-tool authoring. Both plugins bundle these seven skills with their references, scripts, and assets.

### Claude Code

Run in Claude Code:

```text
/plugin marketplace add projectviking-ai/valdr-packs
/plugin install valdr@valdr-packs
```

Start a new session, then invoke a skill such as `/valdr:valdr-orchestrator` or `/valdr:valdr-executor WEB-142`.

### Codex

Run in your terminal:

```bash
codex plugin marketplace add projectviking-ai/valdr-packs
codex plugin add valdr@valdr-packs
```

Start a new chat, then ask Codex to use `$valdr:valdr-orchestrator` or `$valdr:valdr-executor` for a task. In the Codex desktop app, you can also install **Valdr** from the **Valdr Packs** marketplace in the plugin browser after adding the marketplace.

### Prerequisites and existing installations

The plugin installs assistant skills. It does not configure an MCP connection, import Valdr packs, install runtimes, or authenticate tools. Connect your assistant to your existing Valdr MCP server before using the PM operator skills. See the [MCP setup guide](https://valdr.ai/valdr/docs/valdr-mcp/).

Use either plugin installation or standalone copies for a given assistant. Confirm `valdr@valdr-packs` is installed and enabled with `claude plugin list --json` or `codex plugin list --marketplace valdr-packs --json` before archiving standalone copies.

Archive only these exact folders when present: `valdr-agent`, `valdr-auditor`, `valdr-executor`, `valdr-orchestrator`, `valdr-planner`, `valdr-reviewer`, and `valdr-workflow-tools`. Check `~/.claude/skills/` and project-local `.claude/skills/` for Claude Code, or `~/.agents/skills/` and project-local `.agents/skills/` for Codex. Move archived copies outside those directories, preserve local edits, and keep unrelated skills. Do not remove a `valdr-*` pattern. If you manually installed the former Claude Code `valdr-agent` command, archive only `~/.claude/commands/valdr-agent.md` or project-local `.claude/commands/valdr-agent.md` when present, after verifying the plugin is available.

### Standalone skills

If you cannot use the plugin, follow the [source installation instructions](https://github.com/projectviking-ai/valdr-packs#source-checkout-skills) for Claude Code, Codex, or Gemini CLI.

## Compatibility

PM operator skills require the Valdr MCP server with PM MCP tools enabled. Workflow-tool authoring uses the Valdr 0.3.3+ pack CLI; execution additionally requires the host runtimes, dependencies, and authentication used by the selected action.
