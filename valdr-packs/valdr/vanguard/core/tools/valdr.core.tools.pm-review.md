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
- In Vanguard, reviewer follow-up is driven by review state and comments, not live session launch.

<!--</instructions>-->
<!--</capability>-->
