<!--<capability id="valdr.orchestrator.skadi.launch-executor" pack="valdr" role="workflow">-->
# Launch Executor Workflow

<!--<identity>-->
Workflow for dispatching an executor session via `pm_session.launch_task`. Hot-load this after task readiness is confirmed via `valdr.orchestrator.skadi.launch-readiness`.
<!--</identity>-->

<!--<instructions>-->

## Purpose

Use this workflow to launch an **executor** session for a launch-ready task. Supports two launch modes: **standard** and **skill**.

**This workflow is for executor sessions only.** Do not use `pm_session launch_task` to launch reviewer sessions — reviewers must be launched via `pm_review launch_reviewer` (see `valdr.orchestrator.skadi.review-routing`). Using the wrong launch path gives reviewers separate worktrees instead of attaching to the executor's worktree.

## Required Inputs

- `taskKey` (from readiness check)
- `agentHandle` (the agent's registered handle — resolved during readiness as `assigneeHandle`)

Optional:
- preferred `provider`
- explicit `launcherConfigKey`
- launch mode (`standard` or `skill`)
- run mode (`run: true|false`)
- additional launch instructions

### Why `agentHandle` Is Required

The `agentHandle` field on `launch_task` is **critical for token tracking**. When a session is launched:

1. `agentHandle` is stored as `launch.targetAgentHandle` in the session spec config
2. Token usage (input, output, cached) is attributed to this handle in `agent_run_facts`
3. Time-based rollups aggregate costs per agent handle

**If `agentHandle` is omitted, all tokens for that session are attributed to `UNKNOWN_AGENT_HANDLE`** and cannot be traced to the correct agent. This breaks cost visibility per agent (see token tracking dashboards).

**Always pass the agent's registered handle** — not a display name, not a user handle. Use the `handle` field from the agent registry (`pm_agent { action: "get" }`).

## Step 1: Resolve Launcher Preset

`pm_session.launch_task` requires `launcherConfigKey`.

Resolve in this order:
1. User-provided `launcherConfigKey`
2. Map provider -> preset key:
   - `codex` -> `coder-codex`
   - `claude` -> `coder-claude`
   - `anthropic` -> `coder-anthropic`
   - `gemini` -> `coder-gemini`
   - `openai` -> `coder-openai`
   - `ollama` -> `coder-ollama`
3. Default fallback: `coder-codex`

Provider rule:
- If `provider` is supplied, it must match the resolved preset provider or launch fails.

## Step 2: Determine Launch Mode

There are two launch modes: **standard** and **skill**. If the user does not specify which mode to use, **ask them before launching**.

### Standard Mode

The system builds a full system prompt from the agent's registered capabilities and a turn prompt from the task description. The launched session receives everything it needs in the initial prompt.

**Use when:** The agent does **not** have CLI skills (e.g. `valdr-executor`) to load task context at runtime.

**Trigger phrases:** "launch", "standard launch"

### Skill Mode

The system sends only a minimal system prompt and a short instruction as the user message. The agent's CLI skills (e.g. `valdr-executor`, `valdr-reviewer`) handle loading task context, capabilities, and execution workflow at runtime. This avoids duplicate context and produces better results for skill-aware agents.

**Use when:** The agent **has CLI skills** that handle task context loading. This is the preferred mode for `valdr-*` skill-aware launchers.

**Trigger phrases:** "skill launch", "ad-hoc", "use skills", or any mention of a specific skill name

### Mode Recognition

| User Says | Mode |
|-----------|------|
| "launch with skill" / "skill launch" / "ad-hoc" | **Skill** |
| "launch valdr-executor adhoc with preset X" | **Skill** (with explicit preset) |
| "standard launch" / "prompt-built" | **Standard** |
| "launch" (no qualifier) | **Ask** |

### Decision Prompt

If the user requests a launch without specifying the mode:

> How should I launch `<taskKey>`?
>
> **Standard** — Build full prompts from task description and agent capabilities
> **Skill** — Minimal prompt, agent uses its skills (e.g. valdr-executor) to load context at runtime *(recommended for valdr-* agents)*

## Step 3: Launch Executor Session

1. `pm_generate_ulid` -> `clientRequestId`

### Standard Mode

```
pm_session {
  action: "launch_task",
  clientRequestId: "<ulid>",
  actor: "@skadi",
  taskKey: "<taskKey>",
  agentHandle: "<assigneeHandle>",
  launcherConfigKey: "<resolvedLauncherConfigKey>",
  role: "executor",
  run: <true|false>,
  additionalInstructions: "<optional>"
}
```

- System prompt is built from the agent's registered capabilities.
- Turn prompt is built from the task description and acceptance criteria.
- No `prompt` field — the system constructs everything.

### Skill Mode

```
pm_session {
  action: "launch_task",
  clientRequestId: "<ulid>",
  actor: "@skadi",
  taskKey: "<taskKey>",
  agentHandle: "<assigneeHandle>",
  launcherConfigKey: "<resolvedLauncherConfigKey>",
  role: "executor",
  prompt: "Execute valdr task <taskKey> using skill valdr-executor"
}
```

**How skill mode works:**
- The `prompt` field triggers skill mode. When present, the system sends a minimal system prompt (`"Agent session for <taskKey> (executor)."`) instead of the full capability dump.
- The `prompt` value becomes the first user message. The agent's skills (e.g. `valdr-executor`) load task context, capabilities, and workflow at runtime.
- This is the **preferred mode for valdr-* agents** because skills provide richer, more up-to-date context than pre-built prompts.

**Composing the `prompt` value:**
- The canonical prompt format is: `"Execute valdr task <taskKey> using skill valdr-executor"`
- If the user provided additional instructions, append them:
  ```
  "Execute valdr task <taskKey> using skill valdr-executor. Additional context: <user instructions>"
  ```

If `run` is omitted, default is `true`.

Worktree default:
- Omit `worktree` to use launcher preset defaults (workspace worktree creation is enabled for `coder-*` presets).
- Use `worktree` overrides only when explicitly requested.

## Step 4: Verify Launch

Confirm result includes:
- `sessionUlid`
- `contextRef` equal to `TASK-<taskKey>`
- `providerType`
- `targetAgentHandle` — **must match the `agentHandle` sent in the launch call**. If missing or `UNKNOWN`, the launch succeeded but token tracking is broken. Report this as a warning.
- `worktreePath` and `branchName` when worktree is enabled

Optionally validate:
`pm_session { action: "get", sessionUlid: "<sessionUlid>" }`

## Output Contract

```markdown
# Launch Result
Task: <taskKey>

## Session
- agentHandle: <handle>
- launcherConfigKey: <key>
- provider: <providerType>
- sessionUlid: <sessionUlid>
- worktree: <path or disabled>
- mode: <standard or skill-based>

## Notes
- <risks or follow-ups>
```

## Anti-Patterns (DO NOT)

1. Call `pm_session.launch_task` without `launcherConfigKey`
2. Launch without `agentHandle` — tokens will be attributed to `UNKNOWN_AGENT_HANDLE` and cost tracking breaks
3. Use a display name or user handle instead of the agent's registered `handle` from the registry
4. Use standard mode for skill-aware agents — it wastes context with duplicate prompts
5. Use skill mode for agents without skills — they need the built prompts for context
6. Assume a launch mode without asking the user when not specified
7. Omit the `prompt` field in skill mode — without it the system falls back to standard mode silently
8. Launch without completing readiness checks first

<!--</instructions>-->
<!--</capability>-->
