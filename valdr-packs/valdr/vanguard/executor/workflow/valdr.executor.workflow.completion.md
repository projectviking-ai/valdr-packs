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
- Added case-insensitive customer code lookups

### Files Modified
- `src/services/customer-service.ts` — normalize customer codes in lookup functions

### Validation
- Tests: passed (47 tests)
- Lint: passed

### Notes
Verified existing customer records remain accessible by their original codes.
```

### Too Verbose
```markdown
## Completion Summary

**Date:** 2024-01-15

### Work Completed
- I implemented case-insensitive lookups by adding toLowerCase() calls to the findCustomerByCode function on line 145 and also to listCustomersByCode on line 203...
```

<!--</instructions>-->
<!--</capability>-->
