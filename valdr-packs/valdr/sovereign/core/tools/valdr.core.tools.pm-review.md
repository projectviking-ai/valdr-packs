<!--<capability id="valdr.core.tools.pm-review" pack="valdr" role="integration">-->
# Tool: pm_review

Task review management operations. Auditor workflows live in `pm_audit`.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `start` | Create review request | `taskKey`, `reviewerHandles`, `actorHandle`, `clientRequestId` |
| `list` | List reviews for task | `taskKey` |
| `delete` | Remove review | `reviewId` |
| `comment` | Add review comment | `taskKey`, `body`, `actorHandle`, `clientRequestId` |
| `comment_list` | List review comments | `taskKey` |
| `publish` | Submit review with score | `taskKey`, `body`, `actorHandle`, `scoredHandle`, `score`, `clientRequestId` |
| `verify_ready` | Check if task can be verified | `taskKey` |
| `get_prompt` | Get reviewer prompt | `taskKey` |
| `launch_reviewer` | Launch AI reviewer attached to executor worktree | `taskKey`, `sourceSessionUlid`, `clientRequestId` |
| `statuses` | List valid statuses | — |

## Usage Patterns

**Start a review:**
```
pm_review {
  action: "start",
  taskKey: "PROJ-123",
  reviewerHandles: ["reviewer-1", "reviewer-2"],
  actorHandle: "requester-handle",
  summary: "Please review the implementation",
  requestedByHandle: "requester-handle",
  clientRequestId: "<ulid>"
}
```

**List reviews:**
```
pm_review { action: "list", taskKey: "PROJ-123" }
```

**Add comment:**
```
pm_review {
  action: "comment",
  taskKey: "PROJ-123",
  body: "Feedback here...",
  actorHandle: "reviewer-handle",
  clientRequestId: "<ulid>",
  reviewId: "<review-id>",
  assignmentId: "<assignment-id>"
}
```

**Publish review (complete):**
```
pm_review {
  action: "publish",
  taskKey: "PROJ-123",
  body: "Review complete. Implementation looks good.",
  actorHandle: "reviewer-handle",
  scoredHandle: "implementer-handle",
  score: 85,
  status: "approved",
  recommendation: "ready_for_sign_off",
  clientRequestId: "<ulid>"
}
```

**Check verification readiness:**
```
pm_review { action: "verify_ready", taskKey: "PROJ-123" }
→ { canVerify: true, pendingStatuses: [] }
```

**Launch reviewer (default mode):**
```
pm_review {
  action: "launch_reviewer",
  taskKey: "PROJ-123",
  sourceSessionUlid: "<executor-session-ulid>",
  clientRequestId: "<ulid>",
  agentHandle: "reviewer-handle",
  actor: "@skadi",
  run: true
}
```

**Launch reviewer (skill/custom mode):**
```
pm_review {
  action: "launch_reviewer",
  taskKey: "PROJ-123",
  sourceSessionUlid: "<executor-session-ulid>",
  clientRequestId: "<ulid>",
  agentHandle: "reviewer-handle",
  actor: "@skadi",
  launcherConfigKey: "coder-codex",
  prompt: "Review this patch and report blockers only.",
  systemPrompt: "You are a strict reviewer. Keep output under 8 bullets.",
  config: { temperature: 0.1 },
  run: true
}
```

`launch_reviewer` precedence:
- `prompt` overrides the first turn user message.
- `systemPrompt` overrides the generated review system prompt.
- If `prompt` is provided without `systemPrompt`, a minimal launch system prompt is used.
- `launcherConfigKey` is resolved and enforced; provider mismatches return an explicit error.

## Review Assignment Statuses

```
pending → in_progress → approved | changes_requested
```

| Status | Meaning |
|--------|---------|
| `pending` | Reviewer not started |
| `in_progress` | Review underway |
| `approved` | Review passed |
| `changes_requested` | Needs revision |

## Recommendations

| Value | When to Use |
|-------|-------------|
| `ready_for_sign_off` | No blocking issues, approve |
| `needs_revision` | Issues found, request changes |
| `reject` | Major blockers, reject |

## Scoring Guidance

| Score Range | Confidence Level |
|-------------|------------------|
| 90-100 | High — criteria met, only nits |
| 75-89 | Moderate — minor gaps |
| 60-74 | Low — needs revision |
| 0-59 | Very low — blockers present |

## Key Rules

- **verify_ready before verified** — Always check before moving task to `verified`
- **Status/recommendation alignment** — `approved` requires `ready_for_sign_off`
- **Fresh ULIDs** — Use unique `clientRequestId` for each mutation
- **scoredHandle required** — Must specify who is being scored

<!--</instructions>-->
<!--</capability>-->
