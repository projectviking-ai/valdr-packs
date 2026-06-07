<!--<capability id="valdr.core.tools.pm-review" pack="valdr" role="integration">-->
# Tool: pm_review

Task review management operations. Use this tool for review lifecycle and lightweight review scores. Auditor workflows and score runs live in `pm_audit`.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `start` | Create review request | `taskKey`, `reviewerHandles`, `actorHandle`, `clientRequestId` |
| `list` | List reviews for task | `taskKey` |
| `delete` | Remove review | `reviewId` |
| `update_assignment` | Update reviewer assignment status | `reviewId`, `assignmentId`, `status` |
| `comment` | Add review comment | `taskKey`, `body`, `actorHandle`, `clientRequestId` |
| `comment_list` | List review comments | `taskKey` |
| `comment_delete` | Delete review comment | `taskKey`, `commentId` |
| `publish` | Submit review with score | `taskKey`, `body`, `actorHandle`, `scoredHandle`, `score`, `clientRequestId` |
| `verify_ready` | Check if task can be verified | `taskKey` |
| `get_prompt` | Get reviewer prompt | `taskKey` |
| `statuses` | List valid statuses | — |
| `score_record` | Record lightweight review score | `taskKey`, `scoredHandle`, `score` |
| `score_list` | List lightweight review scores for task | `taskKey` |
| `help` | Show tool help | — |

## Help Action Response

`pm_review { action: "help" }` returns a static, read-only help payload that describes the tool's action surface.

| Field | Shape | Contents |
|-------|-------|----------|
| `actions` | string[] | Every accepted `action` name, including `help` |
| `whenToUse` | object | Map of action → one-line guidance on when to reach for it |
| `examples` | array | Representative calls, each `{ action, description, arguments }` |
| `cautions` | string[] | Pitfalls and guardrails to respect |
| `compatibility` | string[] | Notes on schema/behavior stability across versions |

The payload is additive: it documents the existing action surface and does not change accepted input schemas. Flat `examples` (an array of `{ action, description, arguments }`) are canonical; some clients expose the same examples under a nested `params` wrapper.

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
  recommendation: "ready",
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
| `ready` | No blocking issues, approve |
| `changes_requested` | Issues found, request changes |
| `reject` | Major blockers, reject |

## Scoring Guidance

These ranges apply to lightweight review scores recorded on the task review record. They are not audit score runs.

| Score Range | Confidence Level |
|-------------|------------------|
| 90-100 | High — criteria met, only nits |
| 75-89 | Moderate — minor gaps |
| 60-74 | Low — needs revision |
| 0-59 | Very low — blockers present |

## Key Rules

- **verify_ready before verified** — Always check before moving task to `verified`
- **Status/recommendation alignment** — Use `ready` for approved outcomes, `changes_requested` for revision requests, and `reject` for major blockers
- **Fresh ULIDs** — Use unique `clientRequestId` for each mutation
- **scoredHandle required** — Must specify who is being scored
- In Vanguard, reviewer follow-up is driven by review state and comments, not live session launch.

<!--</instructions>-->
<!--</capability>-->
