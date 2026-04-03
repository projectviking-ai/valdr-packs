<!--<capability id="valdr.executor.workflow.prior-work" pack="valdr" role="workflow">-->
# Prior Work Check

<!--<identity>-->
Inspect prior activity when a task is already in progress.
<!--</identity>-->

<!--<instructions>-->

## When to Use

If the task status is `in_progress` before you start work.

## Required Checks

```
pm_task { action: "comment_list", taskKey: "<task-key>" }
pm_task { action: "event_list", taskKey: "<task-key>", limit: 10 }
pm_review { action: "list", taskKey: "<task-key>" }
```

## Decision Table

| Scenario | Action |
|----------|--------|
| No comments/events/reviews | Fresh start — proceed normally |
| Prior work from others | **STOP** — Summarize to user, ask how to proceed |
| Partial checklist completion | Review what's done, continue from there |

<!--</instructions>-->
<!--</capability>-->
