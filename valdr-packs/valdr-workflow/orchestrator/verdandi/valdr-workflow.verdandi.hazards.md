<!--<capability id="valdr-workflow.verdandi.hazards" pack="valdr-workflow" role="constraints">-->
# Workflow Hazards

<!--<identity>-->
Common workflow authoring and recovery mistakes. Check these before interpreting a result or repeating an action.
<!--</identity>-->

<!--<instructions>-->

These are not style rules. Each is a way the system can tell you something true-sounding and wrong.

## 1. Validation Is Not Execution

Strict validation checks the definition's shape against registered contracts. It does not prove that a step will run.

It cannot see: whether an agent handle exists, whether a preset can reach a repository, whether an agent will honour a gate's JSON contract, whether a session will conflict with another, or whether a runtime field is actually consumed.

**Rule:** state validation and execution as separate claims. "Validated strictly, not yet run" is a complete and honest report. When you can, close the gap instead of narrating it — `test_definition` drives an unsaved definition through a real run and is the cheapest evidence available.

## 2. A Wait That Can Never Resolve Validates Clean

The sharpest instance of the rule above, and the one that costs a whole run to find.

A start-and-wait launch without a `session_output` gate auto-resolves **only when exactly one outcome is declared** in `waitsFor.expected`. Declare two, omit the gate, and the turn can finish without an accepted outcome.

The one exception is a review-backed wait, which follows the durable PM verdict and may declare both `review_approved` and `review_changes_requested`.

**Rule:** if judgement decides between outcomes, it needs a gate. If the step only has to finish, declare one outcome or none. Check this on every session input step you author, because validation will not.

## 3. Confirm the Installed Version

A workflow or action available in one installation may differ in another.

**Rule:** if a result contradicts the documentation, use `pm_health` to confirm
the connected Valdr version, inspect the installed catalog, and load scoped
action help. Do not change the definition based on an assumed version.

## 4. The Schema May Accept What The Runtime Ignores

A field can be declared, pass strict validation, and do nothing.

The live instance: `additionalInstructions` used instead of the first-turn `session.prompt` on a one-shot launch. The complete agent instruction belongs in that prompt; `additionalInstructions` stays additive.

Treat unsupported-field diagnostics as a reason to revise the definition.

**Rule:** use documented fields and exercise the behavior before relying on it.
If behavior remains untested, say so. Use the installed action help and shipped
workflow examples to resolve differences between versions.

## 5. Agent Verdicts Are Not Deterministic

A gate backed by an agent session can return a different outcome for the same unchanged subject on two runs. A borderline judgement — "is this claim precise enough?" — is exactly where this happens.

**Rule:** never build a fixture or a test that depends on an agent reaching a borderline verdict. When you need a run to take a particular branch reliably, make the subject violate a rule the agent's own policy states absolutely. Never conclude "the gate is broken" from a single differing verdict.

## 6. A Write Step Must Be Safe To Replay

A retry or recovery attempt can repeat a step. A write must either return the
existing result, refuse safely, or otherwise avoid producing a duplicate effect.
Omitting an authored retry policy is not proof that a write will run only once.

**Rule:** use the action's documented request identity and recovery contract.
Before repeating an interrupted write, check whether it already took effect.
Do not infer replay safety from an action's name.

## 7. Sessions Collide On Identity

A session is identified by its task context, its role, and its target agent. While an earlier session with that identity is still open — including merely *idle* — a new launch for the same triple is rejected.

Finished sessions do not close immediately: a preset's keep-alive can leave one idle for minutes.

**Rule:** when one workflow launches the same agent twice for the same task, make each session close as its turn ends rather than lingering — `config: { keepAliveMs: 0, sessionIdleCloseMs: 0 }` on the launch. When a launch is rejected for conflict, look for the earlier session before assuming the launch itself is wrong.

## 8. A Workflow Runs Once Per Subject

A workflow permits one active run per subject. `pending`, `running`, `waiting`,
and `blocked` runs prevent another start for that subject. A completed, failed,
or cancelled run permits a new start.

`blocked` is the trap. It still holds the context, so a second start is refused, but an eligible blocked step can be retried in the same run after its cause is fixed.

**Rule:** inspect `get_run` with `includeSteps: true` and check the returned retry eligibility before recovery. Retry an eligible failed or blocked step in place after fixing its cause. Cancel and re-run only when a fresh whole run is intended, and do not create a near-duplicate subject to dodge the constraint.

## 9. Passing Tests Can Mean Nothing Was Exercised

A change can typecheck and leave a whole suite green while the code it added is unreachable — because a gate keeps it off, because no test drives it, or because a constraint rejects it before it runs.

**Rule:** when you add a behaviour, name the test that exercises it. If there is none, you have not shown the behaviour works, however green the suite is.

## 10. Retry Eligibility Does Not Explain the Failure

A blocked step can be eligible for retry even when its condition correctly
refused the input. Repeating the same input would produce the same refusal.

**Rule:** use retry eligibility to choose an allowed recovery action, and use
the step's errors, outputs, and subject evidence to diagnose the cause. Correct
the cause before retrying.

## 11. Identity Belongs To Whoever Acted

Every write carries an actor, and the actor is whoever **performed** the action, not whoever asked for it.

When you make the call, you are the actor: pass `verdandi`. Pass a human's handle only when you are recording something a human actually did — approving a human gate, for instance. A user asking you to start a run does not make them the actor on every write that run performs.

Never invent an identity, and never register a placeholder to satisfy a required field. If a required actor is missing, that absence is the signal that something was started without one.

## 12. Condition Check Fields Can Validate And Still Do Nothing

Use the exact fields consumed by each check:

| Kind | Required fields | Example |
|---|---|---|
| `value_equals` | `value`, `equals` | `{ kind: value_equals, value: "${workflow.inputs.enabled}", equals: true }` |
| `value_in` | `value`, `allowed` array | `{ kind: value_in, value: "${workflow.inputs.mode}", allowed: [fast, thorough] }` |
| `array_unique_nonempty_strings` | `value` | `{ kind: array_unique_nonempty_strings, value: "${workflow.inputs.taskKeys}" }` |
| `array_permutation_equals` | `value`, `expected` | `{ kind: array_permutation_equals, value: "${steps.choose.outputs.order}", expected: "${workflow.inputs.taskKeys}" }` |

For `value_in`, the field is **`allowed`**, never `values`, `options`, or `equals`.
When a check unexpectedly refuses an allowed value, compare the authored
operands with the run inputs and upstream outputs. Verify the exact field names
before changing the graph. Exercise one permitted and one rejected input; a
validation result alone does not prove either branch.

<!--</instructions>-->
<!--</capability>-->
