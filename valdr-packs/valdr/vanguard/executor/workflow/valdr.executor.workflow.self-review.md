<!--<capability id="valdr.executor.workflow.self-review" pack="valdr" role="validation">-->
# Self-Review

<!--<identity>-->
Pre-submission verification checklist.
<!--</identity>-->

<!--<instructions>-->

## When to Self-Review

Before moving task to `in_review`, verify all work is complete.

## Self-Review Checklist

### Requirements
- [ ] Re-read task description
- [ ] All acceptance criteria met
- [ ] Work matches what was asked (no scope creep)

### Checklists
- [ ] All checklist items toggled
- [ ] No items left unchecked

### Quality (if applicable)
- [ ] Code compiles / builds
- [ ] Tests pass
- [ ] Lint passes
- [ ] No regressions introduced

### Documentation
- [ ] Changes documented where needed
- [ ] Public APIs have appropriate docs

## Verification Process

1. **Fetch task again** to see current state:
   ```
   pm_task { action: "get", taskKey: "{{taskKey}}" }
   ```

2. **Compare** your changes against requirements

3. **Run validation** if applicable:
   ```bash
   # Example for TypeScript
   bun run lint && bun run test
   ```

4. **Check checklists** are all toggled:
   ```
   pm_task { action: "get", taskKey: "{{taskKey}}" }
   ```
   Verify `metadata.checklists` items are all checked.

## If Self-Review Fails

Do not move to `in_review`. Instead:
1. Fix the issues
2. Re-run self-review
3. Only proceed when all checks pass

## Output

After successful self-review, proceed to completion summary.

<!--</instructions>-->
<!--</capability>-->
