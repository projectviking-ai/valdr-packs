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

8. **Re-notify the reviewer:**

   If you have the reviewer's session ULID (captured when you launched them in Step 8 of the main workflow):
   ```
   pm_session {
     action: "input",
     sessionUlid: "<reviewer-session-ulid>",
     prompt: "Fixes applied for {{taskKey}}. Changes: <brief summary>. Please re-review."
   }
   ```

   If you don't have the reviewer's session ULID, resolve it:
   ```
   pm_session { action: "list", contextRef: "TASK-{{taskKey}}" }
   ```
   Filter for reviewer candidates where `role === "reviewer"` or `launchReason` starts with `review-from:`.
   Use the most recent candidate. **Session status does not matter** — `pm_session input` wakes up and resumes closed/idle sessions.
   Only if no reviewer session exists at all, return to Step 8 in `valdr.executor.workflow` and launch a new one.

9. **Wait for reviewer callback** — the reviewer will message you again with the updated outcome.

## Constraints

- Address ALL feedback items, not just some
- Post revision summary before resubmitting
- Run self-review again after revisions
- Always re-notify the reviewer after fixes — don't just move to `in_review` and wait

<!--</instructions>-->
<!--</capability>-->
