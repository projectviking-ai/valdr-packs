<!--<capability id="valdr.executor.workflow.blocker" pack="valdr" role="workflow">-->
# Blocker Protocol

<!--<identity>-->
Handling obstacles during task execution.
<!--</identity>-->

<!--<instructions>-->

## When to Use

When you encounter something that prevents progress.

## Decision Matrix

| Situation | Action |
|-----------|--------|
| Can resolve in < 5 minutes | Resolve and continue |
| Requires user input | **STOP** — Ask user |
| External dependency | **STOP** — Document and notify |
| Build failure you can fix | Fix and continue |
| Build failure outside your changes | **STOP** — Report to user |
| Missing permissions | **STOP** — Ask user |
| Unclear requirements | **STOP** — Ask user |

## Documenting a Blocker

Post a comment explaining the blocker:

```
pm_task {
  action: "comment_create",
  taskKey: "{{taskKey}}",
  body: "<blocker-markdown>",
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

## Blocker Format

```markdown
## Blocked

**Date:** YYYY-MM-DD

**Reason:**
<Clear explanation of what's blocking progress>

**Needed to Unblock:**
- <Specific action or decision required>

**Attempted:**
- <What you tried before concluding it's blocked>
```

## After Documenting

1. Notify user: "Task {{taskKey}} is blocked. Reason: <brief>. Documented in comments."
2. **STOP** — Do not continue work on this task
3. Wait for user direction

## Do NOT

- ❌ Continue working around critical blockers
- ❌ Make assumptions about unclear requirements
- ❌ Skip documentation
- ❌ Start another task without user direction

<!--</instructions>-->
<!--</capability>-->
