<!--<capability id="valdr.orchestrator.skadi.session-messaging" pack="valdr" role="workflow">-->
# Session Messaging Workflow

<!--<identity>-->
Workflow for re-engaging executor and reviewer agent sessions via `pm_session input`. Hot-load this when Skadi needs to nudge, notify, or redirect an already-running session in the task/review cycle.
<!--</identity>-->

<!--<instructions>-->

## Purpose

After Skadi launches executor and reviewer sessions, the review cycle may require multiple rounds. Rather than launching new sessions for each round, Skadi sends targeted messages to existing sessions using `pm_session { action: "input" }` to keep agents in context and moving forward.

## When to Use This Workflow

Use session messaging whenever:

- A reviewer requests changes and the executor session needs to act on feedback
- An executor applies fixes and the reviewer session needs to re-review
- A session is idle or stalled and needs a nudge to continue
- Any orchestration event requires an already-launched agent to take new action

**Rule: Never launch a duplicate session for a task+role that already has an active session. Always use `pm_session input` to re-engage.**

## Session Resolution

Skadi launches both executor and reviewer sessions via `pm_session launch_task`. Each launch response includes a `sessionUlid`. **Retain these IDs for the duration of the task lifecycle** so you can message sessions directly.

### Preferred: Use tracked session IDs

When Skadi launched the session in the current orchestration context, use the `sessionUlid` returned from the launch call directly — no resolution step needed.

### Fallback: Resolve via contextRef

If the tracked session ID is unavailable (e.g., Skadi was restarted, or the session was launched in a prior orchestration context):

```
pm_session { action: "list", contextRef: "TASK-<taskKey>" }
```

Filter results to find the correct session:

| Target | Filter Criteria |
|--------|----------------|
| Executor session | `role === "executor"` or `launchReason` starts with `task:` |
| Reviewer session | `role === "reviewer"` or `launchReason` starts with `review-from:` |

When multiple matches exist, prefer the most recent with `status` in `launching`, `running`, or `idle`. If none are active, use the most recent match.

### No active session found

If no active session exists for the target role, fall back to launching a new session via `launch-executor` or the reviewer launch workflow.

## Workflow: Review Rejection → Executor Re-engagement

Triggered when a reviewer posts a `changes_requested` outcome on a task review.

### Step 1: Detect Review Outcome

After a reviewer session completes or posts review comments:

```
pm_review { action: "list", taskKey: "<taskKey>" }
```

Check for `changes_requested` status on the review.

### Step 2: Gather Review Feedback

Load the review comments that the executor needs to act on:

```
pm_task { action: "get", key: "<taskKey>" }
```

Extract the reviewer's comments from the task review. These form the basis of the message to the executor.

### Step 3: Resolve Executor Session

Use the tracked `sessionUlid` from the original executor launch. If unavailable, fall back:

```
pm_session { action: "list", contextRef: "TASK-<taskKey>" }
```

Filter for the executor session (`role === "executor"` or `launchReason` starts with `task:`), preferring `launching`/`running`/`idle`.

### Step 4: Send Review Feedback to Executor

```
pm_session {
  action: "input",
  sessionUlid: "<executor-session-ulid>",
  prompt: "<constructed message>"
}
```

**Message template:**

```
Review for <taskKey> returned changes_requested.

Reviewer comments:
<review-comments-summary>

Please review the feedback above and apply the requested changes. When complete, add a comment to the task confirming what was addressed.
```

### Step 5: Confirm Executor Acknowledgment

After sending input, monitor the executor session for activity:

```
pm_session { action: "events", sessionUlid: "<executor-session-ulid>", sinceSeq: <last-known-seq> }
```

Wait for evidence that the executor has resumed work.

## Workflow: Executor Fixes Applied → Reviewer Re-engagement

Triggered when Skadi observes that the executor has addressed review feedback.

### Step 1: Verify Fix Confirmation

Check that the executor added a comment confirming fixes:

```
pm_task { action: "get", key: "<taskKey>" }
```

Look for a comment from the executor agent indicating fixes have been applied (e.g., contains "fixes applied", "changes addressed", or similar).

### Step 2: Resolve Reviewer Session

Use the tracked `sessionUlid` from the original reviewer launch. If unavailable, fall back:

```
pm_session { action: "list", contextRef: "TASK-<taskKey>" }
```

Filter for the reviewer session (`role === "reviewer"` or `launchReason` starts with `review-from:`), preferring `launching`/`running`/`idle`.

### Step 3: Send Re-review Request to Reviewer

```
pm_session {
  action: "input",
  sessionUlid: "<reviewer-session-ulid>",
  prompt: "<constructed message>"
}
```

**Message template:**

```
The executor for <taskKey> has applied fixes in response to your review feedback.

Executor's comment:
<executor-fix-comment-summary>

Please re-review the changes and update your review outcome accordingly.
```

### Step 4: Monitor Re-review

```
pm_session { action: "events", sessionUlid: "<reviewer-session-ulid>", sinceSeq: <last-known-seq> }
```

## Workflow: Session Nudge (Idle/Stalled)

Use when a session appears idle and needs prompting to continue.

### Step 1: Detect Staleness

Check session events for inactivity:

```
pm_session { action: "events", sessionUlid: "<session-ulid>" }
```

If the last event is older than the expected activity window, send a nudge.

### Step 2: Send Nudge

```
pm_session {
  action: "input",
  sessionUlid: "<session-ulid>",
  prompt: "Status check for <taskKey>: Are you still working on this? Please provide a progress update or continue with the task."
}
```

## Message Construction Rules

1. **Always include the taskKey** — The agent needs task context in every message
2. **Summarize, don't dump** — Extract the relevant review comments; don't paste raw API responses
3. **Be directive** — Tell the agent what action to take, not just what happened
4. **Include context on what changed** — When re-engaging a reviewer, summarize what the executor fixed
5. **Keep messages under 500 words** — Agents work better with focused instructions

## Session Lifecycle Tracking

Skadi should maintain awareness of active sessions per task:

| State | Executor Session | Reviewer Session | Skadi Action |
|-------|-----------------|-----------------|--------------|
| Task launched | Active | — | Monitor for completion |
| Task complete, review started | Idle (keep alive) | Active | Monitor review outcome |
| Review: changes_requested | **→ Send input** | Idle (keep alive) | Re-engage executor with feedback |
| Executor fixes applied | Idle (keep alive) | **→ Send input** | Re-engage reviewer for re-review |
| Review: approved | Close/ignore | Close/ignore | Move task to verified |

## Anti-Patterns (DO NOT)

1. Launch a new executor session when one already exists for the task — use `pm_session input` instead
2. Launch a new reviewer session when one already exists for the task — use `pm_session input` instead
3. Send raw review API responses as the message — always summarize into clear instructions
4. Send input without a valid session ID — use tracked launch ID or resolve via `contextRef` fallback
5. Hardcode or guess session ULIDs — always use the tracked launch response or resolve from `pm_session list`
6. Send messages without including the `taskKey` for context
7. Skip the fix-confirmation check before re-engaging the reviewer

<!--</instructions>-->
<!--</capability>-->
