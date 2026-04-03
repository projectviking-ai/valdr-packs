<!--<capability id="valdr.executor.workflow.review" pack="valdr" role="workflow">-->
# Review Handling

<!--<identity>-->
Checking review status and handling feedback.
<!--</identity>-->

<!--<instructions>-->

## When to Use

When task is in `in_review` status and you need to check for feedback.

## Check Review Status

```
pm_review { action: "list", taskKey: "{{taskKey}}" }
```

## Status Interpretation

| Review Status | Action |
|---------------|--------|
| No reviews exist | **STOP** — "Waiting for reviewer" |
| `pending` | **STOP** — "Review pending, waiting for reviewer" |
| `in_progress` | **STOP** — "Review in progress" |
| `approved` | **STOP** — "Approved, waiting for verification gate" |
| `changes_requested` | Handle feedback (see below) |

## Handling Changes Requested

1. **Get review details:**
   ```
   pm_review { action: "list", taskKey: "{{taskKey}}" }
   ```

2. **Read feedback comments:**
   ```
   pm_review { action: "comment_list", taskKey: "{{taskKey}}", reviewId: "<review-id>" }
   ```

3. **Transition back to in_progress:**
   ```
   pm_task {
     action: "change_status",
     taskKey: "{{taskKey}}",
     to: "in_progress",
     reason: "Addressing review feedback - YYYY-MM-DD",
     actorHandle: "{{actorHandle}}",
     clientRequestId: "<pm_generate_ulid>"
   }
   ```

4. **Address each feedback item**

5. **Post revision comment:**
   ```
   pm_task {
     action: "comment_create",
     taskKey: "{{taskKey}}",
     reviewId: "<review-id>",
     body: "## Revision Summary\n\n- <addressed item 1>\n- <addressed item 2>",
     actorHandle: "{{actorHandle}}",
     clientRequestId: "<pm_generate_ulid>"
   }
   ```

6. **Self-review again** — hot-load `valdr.executor.workflow.self-review`

7. **Move back to in_review:**
   ```
   pm_task {
     action: "change_status",
     taskKey: "{{taskKey}}",
     to: "in_review",
     reason: "Revisions complete, resubmitting for review - YYYY-MM-DD",
     actorHandle: "{{actorHandle}}",
     clientRequestId: "<pm_generate_ulid>"
   }
   ```

8. **Stop after resubmission**

   Once the task is back in `in_review`, stop and wait for the reviewer or orchestrator to pick it up through `pm_review` state. Vanguard does not re-notify reviewer sessions directly.

## Constraints

- Address ALL feedback items, not just some
- Post revision summary before resubmitting
- Run self-review again after revisions
- Do not rely on live reviewer-session messaging in Vanguard

<!--</instructions>-->
<!--</capability>-->
