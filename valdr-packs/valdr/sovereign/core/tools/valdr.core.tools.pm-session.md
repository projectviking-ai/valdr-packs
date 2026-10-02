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
| `input` | Queue a follow-up (default), or steer an active ad-hoc turn | `sessionUlid`, `prompt`, `clientRequestId` |
| `start` | Create a provider-backed session from explicit prompts/config | `clientRequestId`, `actor`, `contextRef`, `role`, `provider`, `systemPrompt` |
| `run` | Dispatch a turn for a started session | `sessionUlid` |
| `abort` | Abort an active session's running turn | `sessionUlid` |
| `restart` | Resume a closed session from prior thread/worktree metadata | `clientRequestId`, `actor` |
| `purge` | Delete session records and optionally transcript/worktree files | `sessionUlid` |
| `launch_task` | Launch task session | `taskKey`, `agentHandle` or `agentId` |
| `help` | Show tool help | — |

## Help Action Response

`pm_session { action: "help" }` returns a static, read-only help payload that describes the tool's action surface.

| Field | Shape | Contents |
|-------|-------|----------|
| `actions` | string[] | Every accepted `action` name, including `help` |
| `whenToUse` | object | Map of action → one-line guidance on when to reach for it |
| `examples` | array | Representative calls, each `{ action, description, arguments }` |
| `cautions` | string[] | Pitfalls and guardrails to respect |
| `compatibility` | string[] | Notes on schema/behavior stability across versions |


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
  run: true,
  worktree: {
    requireLinked: true,
    branchName: "feature/proj-123-rate-limiting"
  }
}
```

`worktree.branchName` requests a full Git branch name for a new linked task worktree. It requires `requireLinked: true`. If a local branch with that name exists, Valdr appends `-1`, `-2`, and so on; use the returned `branchName`. **Omitting `branchName` keeps the existing automatic branch-naming behavior**; linked worktrees default to `valdr-task/<taskKey>`.

The task's project must have an available registered Git repository, and the preset must allow worktree creation. Use `worktree.repoId` if repository selection is ambiguous. Do not combine linked mode with `branchPrefix` or `disabled`, or use it when reusing a source worktree. Branch naming applies to `launch_task` creating a new worktree, rather than `start`, `launch_prompt`, or session continuation.

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

**Queue a follow-up for the next turn:**
```
pm_session {
  action: "input",
  delivery: "queue",
  clientRequestId: "<fresh-ulid>",
  sessionUlid: "<session-id>",
  prompt: "Continue with the implementation"
}
```

`delivery` is optional and defaults to `queue`. Queued input waits for the current turn to finish; idle or closed sessions can resume when the provider supports it. Generate a fresh `clientRequestId` with `pm_generate_ulid` for each new message. Repeating the same ID with the same prompt, target, and delivery replays its durable result.

**Steer an active turn:**
```
pm_session {
  action: "input",
  delivery: "steer",
  clientRequestId: "<fresh-ulid>",
  sessionUlid: "<session-id>",
  prompt: "Focus on the failing test before making further changes"
}
```

Steering requires an active ad-hoc Codex or Claude turn with runtime support. OpenCode, Ollama, idle/closed sessions, and workflow-owned turns do not support steering. Workflow session input remains queued.

Both modes return durable request identity and `baselineSeq`. A queued receipt confirms acceptance for a later turn. For steering, `phase: completed` confirms provider acknowledgement, not completion of the agent's work. A rejected request returns `failed`; uncertain delivery returns `ambiguous`. Do not automatically resend an uncertain steering message with a new ID or switch it to queue: it may already have reached the active turn.

**Start a session (explicit prompts/config — no task-prompt building):**
```
pm_session {
  action: "start",
  contextRef: "TASK-PROJ-123",
  role: "executor",
  provider: "claude",
  systemPrompt: "You are ...",
  actor: "requester-handle",
  clientRequestId: "<ulid>"
}
```

**Dispatch a turn for a started session:**
```
pm_session { action: "run", sessionUlid: "<session-id>" }
```

**Restart (resume) a closed session:**
```
pm_session {
  action: "restart",
  sessionUlid: "<session-id>",
  actor: "requester-handle",
  clientRequestId: "<ulid>",
  run: true
}
```

**Abort an active session's running turn:**
```
pm_session { action: "abort", sessionUlid: "<session-id>" }
```

**Purge a session (preview scope first, then delete artifacts):**
```
pm_session { action: "purge", sessionUlid: "<session-id>", dryRun: true }
pm_session { action: "purge", sessionUlid: "<session-id>", deleteFiles: true }
```

`dryRun: true` previews the deletion scope without removing anything; `deleteFiles: true` also deletes the session's transcript and worktree artifacts. Omitting `deleteFiles` removes only the session records.

> **`run` action vs `run` parameter — not the same thing.** The `run` *action* (`{ action: "run", sessionUlid }`) dispatches a single turn on an already-started session. The boolean `run` *parameter* on `launch_task` and `restart` (`run: true`) auto-starts the session immediately on creation/resume. One is an action name; the other is an auto-start flag.

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
| `launcherConfigKey` | string | **yes** | Registered preset key from `pm_provider list_presets` (Claude, Codex, OpenCode, or Ollama) |
| `clientRequestId` | string | **yes** | Idempotency key |
| `actor` | string | **yes** | Requester handle |
| `prompt` | string | optional | Custom user prompt — when set, skips auto-built system/turn prompts |
| `run` | boolean | optional | Start immediately (default: `true`) |
| `role` | string | optional | Session role (default: `executor`) |
| `additionalInstructions` | string | optional | Extra instructions appended to built prompt (standard mode only) |
| `maxRuntimeSeconds` | number | optional | Timeout (1–86400) |
| `capabilityKeys` | string[] | optional | Override capability keys for prompt building |
| `worktree` | object | optional | Worktree config |
| `worktree.repoId` | string | optional | Registered project repository to use |
| `worktree.requireLinked` | boolean | optional | Create a linked Git worktree for the task |
| `worktree.branchName` | string | optional | Full name for a new linked task branch; requires `requireLinked: true` |
| `worktree.disabled` | boolean | optional | Skip worktree provisioning |
| `worktree.baseRef` | string | optional | Git base ref |
| `worktree.branchPrefix` | string | optional | Branch prefix |
| `config` | object | optional | Provider config overrides |

## Key Rules

- **contextRef format** — Use `TASK-<taskKey>` to link sessions to tasks
- **Worktree selection** — Only use sessions with `role === "executor"` for file access
- **Event streaming** — Use `sinceSeq` for incremental updates
- **Ad-hoc vs standard** — Pass `prompt` to skip capability prompts; omit for full auto-built prompts
- **Skill-based agents** — When agents use skills like `valdr-executor`, prefer ad-hoc mode to avoid duplicate context
- **`run` action vs `run` flag** — `action: "run"` dispatches a turn on a started session; `run: true` on `launch_task`/`restart` auto-starts the session on creation/resume
- **Delivery mode** — Queue is the default and supports resume; steer only active supported ad-hoc turns. Preserve uncertain delivery evidence before any retry.
- **Resume over relaunch** — Closed or idle sessions are still valid queued `input` targets when the provider supports resume; wake them instead of launching duplicates
- **Purge safety** — Preview deletion scope with `dryRun: true`; pass `deleteFiles: true` to also remove transcript/worktree artifacts

<!--</instructions>-->
<!--</capability>-->
