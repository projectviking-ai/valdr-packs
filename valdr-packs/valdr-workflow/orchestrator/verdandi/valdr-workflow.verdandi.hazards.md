<!--<capability id="valdr-workflow.verdandi.hazards" pack="valdr-workflow" role="constraints">-->
# Workflow Hazards

<!--<identity>-->
The failure modes that mislead rather than announce themselves. Each one has cost real debugging time. Check for these before believing a result.
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

## 3. The Server You Are Talking To May Be Stale

A stdio MCP server is spawned once and never reloads. If workflow source changed after it started, it is running old code — and several servers can be alive at once, each a different age.

The symptoms are contradictory and point away from the cause:
- a tool action reports "contract is not registered" although it is registered
- a runtime field reports "unsupported" although it is in the allowlist
- validation returns errors that are simply false
- a run validates in one place and fails to execute in another

**Rule:** when a workflow result contradicts what you can read in the source, check the server before you change the definition. `pm_health.startTs` gives you the server's age; compare it against `run.startedAt`, and against the workflow source's modification time **if you have filesystem access** — no MCP tool returns a file mtime. If the server is older than the source, say so and ask for a restart rather than editing a correct definition to satisfy a stale process. If you cannot check the source at all, say you could not rule staleness out; do not imply you did.

## 4. The Schema May Accept What The Runtime Ignores

A field can be declared, pass strict validation, and do nothing.

The live instance: `additionalInstructions` used instead of the first-turn `session.prompt` on a one-shot launch. The complete agent instruction belongs in that prompt; `additionalInstructions` stays additive.

Fields that are declared but **not executable** carry an explicit non-normative diagnostic. Treat that diagnostic as load-bearing, never as noise to suppress. But note that the worst cases carry no diagnostic at all — the field is valid where you put it, it is simply never read.

**Rule:** before relying on a field, confirm the runtime consumes it. If you cannot confirm it, do not build behaviour on it, and tell the user it is unproven rather than assuming. The converse also bites: do not assume a field is dead because a document says so. `forEach` was documented as non-executable while a shipped workflow used it successfully.

## 5. Agent Verdicts Are Not Deterministic

A gate backed by an agent session can return a different outcome for the same unchanged subject on two runs. A borderline judgement — "is this claim precise enough?" — is exactly where this happens.

**Rule:** never build a fixture or a test that depends on an agent reaching a borderline verdict. When you need a run to take a particular branch reliably, make the subject violate a rule the agent's own policy states absolutely. Never conclude "the gate is broken" from a single differing verdict.

## 6. A Write Step Must Be Safe To Replay

A run can re-execute a step after a crash, a stale claim, or a retry. A tool action is only safe as a step if repeating it converges: it returns the same result, or refuses, rather than producing a second effect.

Note that "give the step no `retry`" is **not** a sufficient guard on its own — a stale operation claim can grant a recovery attempt regardless of the authored retry policy.

**Rule:** do not treat an action as replay-safe because its name sounds harmless. Idempotency has to come from the handler's behaviour — a claim it replays, a uniqueness it enforces, or a merge that converges.

## 7. Sessions Collide On Identity

A session is identified by its task context, its role, and its target agent. While an earlier session with that identity is still open — including merely *idle* — a new launch for the same triple is rejected.

Finished sessions do not close immediately: a preset's keep-alive can leave one idle for minutes.

**Rule:** when one workflow launches the same agent twice for the same task, make each session close as its turn ends rather than lingering — `config: { keepAliveMs: 0, sessionIdleCloseMs: 0 }` on the launch. When a launch is rejected for conflict, look for the earlier session before assuming the launch itself is wrong.

## 8. A Workflow Runs Once Per Subject

A run's context is derived from its subject, and a workflow may hold only one **active** run per context. The uniqueness constraint is partial: it covers `pending`, `running`, `waiting`, and `blocked` only. A `completed`, `failed`, or `cancelled` run releases the context, so a second start just works.

`blocked` is the trap. It still holds the context, so a second start is refused, but an eligible blocked step can be retried in the same run after its cause is fixed.

**Rule:** inspect `get_run` with `includeSteps: true` and use `retryEligibilityByStepKey` before recovery. Retry an eligible failed or blocked step in place after fixing its cause. Cancel and re-run only when a fresh whole run is intended, and do not create a near-duplicate subject to dodge the constraint.

## 9. Passing Tests Can Mean Nothing Was Exercised

A change can typecheck and leave a whole suite green while the code it added is unreachable — because a gate keeps it off, because no test drives it, or because a constraint rejects it before it runs.

**Rule:** when you add a behaviour, name the test that exercises it. If there is none, you have not shown the behaviour works, however green the suite is.

## 10. Some Fields Read As Signal And Are Not

`retryEligibilityByStepKey` is the clearest example. On a condition that blocked because its check did not match, it reports `reasonCode: "eligible"` — the run stopped on a deliberate refusal, and the field cheerfully says you may retry it. Retrying changes nothing; the upstream value will be the same. On a step that completed successfully it reports `step_not_retryable`, which reads like a constraint that bit and is a statement about a step that never needed retrying. The field is describing arithmetic, not a diagnosis.

**Rule:** before treating a field as evidence, ask what it would say in the healthy case. A field that reads the same whether something went wrong or went exactly to plan is telling you nothing.

## 11. Identity Belongs To Whoever Acted

Every write carries an actor, and the actor is whoever **performed** the action, not whoever asked for it.

When you make the call, you are the actor: pass `verdandi`. Pass a human's handle only when you are recording something a human actually did — approving a human gate, for instance. A user asking you to start a run does not make them the actor on every write that run performs.

Never invent an identity, and never register a placeholder to satisfy a required field. If a required actor is missing, that absence is the signal that something was started without one.

<!--</instructions>-->
<!--</capability>-->
