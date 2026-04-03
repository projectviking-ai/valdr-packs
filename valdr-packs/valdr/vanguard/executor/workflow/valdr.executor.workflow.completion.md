<!--<capability id="valdr.executor.workflow.completion" pack="valdr" role="workflow">-->
# Completion Summary

<!--<identity>-->
Structured summary format for task completion.
<!--</identity>-->

<!--<instructions>-->

## When to Post

After self-review passes, before moving to `in_review`.

## Command

```
pm_task {
  action: "comment_create",
  taskKey: "{{taskKey}}",
  body: "<summary-markdown>",
  actorHandle: "{{actorHandle}}",
  clientRequestId: "<pm_generate_ulid>"
}
```

## Summary Format

```markdown
## Completion Summary

**Date:** YYYY-MM-DD

### Work Completed
- <Brief description of what was implemented>

### Files Modified
- `path/to/file1.ts` — <what changed>
- `path/to/file2.ts` — <what changed>

### Files Created
- `path/to/new-file.ts` — <purpose>

### Validation
- Tests: <passed/failed/not applicable>
- Lint: <passed/failed/not applicable>
- Build: <passed/failed/not applicable>

### Notes
<Any additional context for reviewer>
```

## Guidelines

- Keep it concise but complete
- List all files touched
- Include validation results
- Note anything unusual for reviewer attention
- Don't include implementation details reviewer can see in code

## Examples

### Good
```markdown
## Completion Summary

**Date:** 2024-01-15

### Work Completed
- Added case-insensitive task key lookups

### Files Modified
- `tools/pm-mcp/src/services/task-service.ts` — normalize keys in lookup functions

### Validation
- Tests: passed (47 tests)
- Lint: passed

### Notes
Also affects `pm_review` lookups via shared service layer.
```

### Too Verbose
```markdown
## Completion Summary

**Date:** 2024-01-15

### Work Completed
- I implemented case-insensitive lookups by adding toLowerCase() calls to the getTaskByKey function on line 145 and also to getTaskRowWithParentByKey on line 203...
```

<!--</instructions>-->
<!--</capability>-->
