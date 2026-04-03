<!--<capability id="valdr.core.tools.pm-session" pack="valdr" role="integration">-->
# Tool: pm_session

Agent session operations.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list` | Find sessions | — |
| `get` | Fetch session details | `sessionUlid` |
| `events` | Get session events | `sessionUlid` |
| `prompt` | Get session prompt | `sessionUlid` |
| `config` | Get session config | `sessionUlid` |
| `spec` | Get session spec | `sessionUlid` |
| `live_deltas` | Stream session updates | `sessionUlid` |
| `input` | Send input to session | `sessionUlid`, `prompt` |
| `launch_task` | Launch task session | `taskKey`, `agentHandle` or `agentId` |

## Usage Patterns

**List sessions:**
```
pm_session { action: "list" }
```

**Filter by context:**
```
pm_session { action: "list", contextRef: "TASK-PROJ-123" }
```

**Get session details:**
```
pm_session { action: "get", sessionUlid: "<session-id>" }
```

**Get session events:**
```
pm_session { action: "events", sessionUlid: "<session-id>" }
pm_session { action: "events", sessionUlid: "<session-id>", sinceSeq: 10 }
```

**Launch task session (standard — builds prompts from task + agent capabilities):**
```
pm_session {
  action: "launch_task",
  taskKey: "PROJ-123",
  agentHandle: "ts-task-agent",
  launcherConfigKey: "coder-claude",
  actor: "requester-handle",
  clientRequestId: "<ulid>",
  run: true
}
```

**Launch task session (ad-hoc — custom prompt, no capability system prompt):**

When `prompt` is provided, the auto-built system prompt and turn prompt are skipped. The agent receives only your prompt as the user message and a minimal system prompt identifying the task. Use this when the agent uses skills (e.g. `valdr-executor`) that load task context and capabilities at runtime.

```
pm_session {
  action: "launch_task",
  taskKey: "PROJ-123",
  agentHandle: "ts-task-agent",
  launcherConfigKey: "coder-claude",
  actor: "requester-handle",
  clientRequestId: "<ulid>",
  prompt: "Execute task PROJ-123 using the valdr-executor skill"
}
```

**Send input to session:**
```
pm_session {
  action: "input",
  sessionUlid: "<session-id>",
  prompt: "Continue with the implementation"
}
```

## Session Context Reference

Sessions are linked to tasks via `contextRef`:

```
contextRef: "TASK-<taskKey>"
```

Example: `"TASK-PROJ-123"`

## Worktree Resolution

When reviewing, find the worktree from sessions:

1. List sessions: `pm_session { action: "list", contextRef: "TASK-<key>" }`
2. Filter for `role === "executor"` with `worktreePath` set
3. Use the most recent (list is newest-first)

## Launch Options

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `taskKey` | string | **yes** | Task to execute |
| `agentHandle` or `agentId` | string | **one required** | Agent identity |
| `launcherConfigKey` | string | **yes** | Provider preset (e.g. `coder-claude`, `coder-codex`) |
| `clientRequestId` | string | **yes** | Idempotency key |
| `actor` | string | **yes** | Requester handle |
| `prompt` | string | optional | Custom user prompt — when set, skips auto-built system/turn prompts |
| `run` | boolean | optional | Start immediately (default: `true`) |
| `role` | string | optional | Session role (default: `executor`) |
| `additionalInstructions` | string | optional | Extra instructions appended to built prompt (standard mode only) |
| `maxRuntimeSeconds` | number | optional | Timeout (1–86400) |
| `capabilityKeys` | string[] | optional | Override capability keys for prompt building |
| `worktree` | object | optional | Worktree config (see below) |
| `worktree.disabled` | boolean | optional | Skip worktree provisioning |
| `worktree.baseRef` | string | optional | Git base ref |
| `worktree.branchPrefix` | string | optional | Branch prefix |
| `config` | object | optional | Launcher config overrides |

## Key Rules

- **contextRef format** — Use `TASK-<taskKey>` to link sessions to tasks
- **Worktree selection** — Only use sessions with `role === "executor"` for file access
- **Event streaming** — Use `sinceSeq` for incremental updates
- **Ad-hoc vs standard** — Pass `prompt` to skip capability prompts; omit for full auto-built prompts
- **Skill-based agents** — When agents use skills like `valdr-executor`, prefer ad-hoc mode to avoid duplicate context

<!--</instructions>-->
<!--</capability>-->
