<!--<capability id="valdr-workflow.task-readiness.rubric" pack="valdr-workflow" role="constraints">-->
# Task Readiness Rubric

<!--<identity>-->
Seven-dimension scoring rubric for pre-implementation task review, with pass/concern/fail boundaries and blocking rules.
<!--</identity>-->

<!--<instructions>-->

## Standard

The quality bar is: **an agent reading only this task can execute it without asking a question.**

Score every dimension `pass`, `concern`, or `fail`.

- `pass` — no action needed.
- `concern` — real weakness that will slow an implementer but will not misdirect them. Non-blocking.
- `fail` — an implementer would be blocked, or would confidently build the wrong thing.

## Dimensions

### 1. `intent`

Is the problem and the desired end state unambiguous?

- `pass` — Two competent agents reading this would build materially the same thing.
- `concern` — The goal is clear but the reason is missing, so trade-off calls are guesswork.
- `fail` — The description states a topic rather than an outcome, or two plausible readings lead to different implementations.

### 2. `scope`

Are the boundaries explicit?

- `pass` — What is included is stated, and anything a reasonable implementer might over-reach into is explicitly excluded.
- `concern` — Boundaries are inferable from context but never stated.
- `fail` — The task invites unbounded refactoring, or touches areas it never names.

### 3. `grounding`

Do the task's claims about the codebase match the codebase?

Open every referenced file. Verify referenced functions and symbols still exist at the named location. Verify any description of current behavior against the actual code.

- `pass` — Every path, symbol, and behavioral claim checks out.
- `concern` — References are directionally right but imprecise (a directory rather than a file, a renamed symbol still findable).
- `fail` — A referenced path does not exist, a symbol has moved or been deleted, or the described current behavior is wrong. A task built on a false premise about the code is `reject`, not `needs_changes`.

When no worktree is attached, score `concern` and state that code grounding could not be verified.

### 4. `actionability`

Could an implementer start immediately?

List every question an implementer would be forced to ask. That list is the evidence for this score.

- `pass` — Zero forced questions.
- `concern` — One or two questions an implementer could resolve alone by reading code.
- `fail` — Any question that requires a product, design, or approval decision the implementer cannot make.

### 5. `acceptance`

Is each checklist item independently verifiable?

Test each item against three failure modes:

| Failure mode | Example |
|---|---|
| Vague | "works correctly", "is performant", "handles errors" |
| Compound | Two assertions joined by "and" that could pass separately |
| Untestable | No code to read or command to run that would settle it |

- `pass` — Every item is a single assertion verifiable by reading a named file or running a named command.
- `concern` — Items are verifiable but compound, or the set is thin relative to the described scope.
- `fail` — Any item is vague or untestable, or there are no acceptance criteria at all.

### 6. `sizing`

Does the stated effort match the real surface area you found in the code?

- `pass` — Points are consistent with the files and call sites the change actually touches.
- `concern` — Understated by roughly one Fibonacci step, or points are absent.
- `fail` — The task contains two or more independently shippable changes and should be split. Name the split.

### 7. `risk`

Does the task imply anything that requires explicit approval, and does it say so?

Flag when the work implies any of:

- A database migration or schema change
- A cross-workspace contract change (`packages/pm-protocol`, MCP tool names or schemas, shared types)
- A destructive or irreversible operation
- Credential or secret access
- Sending data to an external provider

- `pass` — No such implication, or it is present and explicitly named in the task.
- `concern` — Implied and unnamed, but low blast radius.
- `fail` — Implied, unnamed, and would be discovered mid-implementation. Undeclared migrations and schema changes are always `fail`.

## Blocking Rules

A finding is blocking when any of these hold:

1. `intent`, `actionability`, or `acceptance` scored `fail`.
2. `risk` scored `fail`.
3. `grounding` scored `fail` because a referenced path or symbol does not exist.

## Verdict Derivation

| Condition | Verdict |
|---|---|
| No blocking findings | `ready` |
| Blocking findings, all fixable by rewriting the task text | `needs_changes` |
| Task is built on a false premise, duplicates existing work, or is unsafe as specified | `reject` |

`concern` scores never block. They belong in `nonBlockingFindings`.

<!--</instructions>-->
<!--</capability>-->
