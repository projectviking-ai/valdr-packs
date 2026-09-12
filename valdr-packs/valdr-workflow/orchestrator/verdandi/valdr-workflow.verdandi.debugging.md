<!--<capability id="valdr-workflow.verdandi.debugging" pack="valdr-workflow" role="workflow">-->
# Debugging Runs

<!--<identity>-->
Taking a stopped or stuck run back to its cause with evidence. A symptom table for the failures that actually occur, and the order to check things in.
<!--</identity>-->

<!--<instructions>-->

## The Procedure

1. **Check the server — only when it can change your answer.** A terminal run's record is stored data; no server can re-execute it, so its age cannot affect what you read. Skip `pm_health` and say nothing about staleness. Check it when the run is **live**, before you **start or retry** anything, or before you fetch a definition **by key and version** — those come from the current process. In that case compare `startTs` against the run's `startedAt`; if you also have filesystem access, compare it against the workflow source's mtime, and **if you do not, say you could not rule out a stale server** rather than implying you did. No MCP tool returns a file mtime.

   A caveat you would recite on every diagnosis is noise, not rigour. Raise staleness when it is load-bearing.
2. **Fetch the run.** `get_run` with `includeSteps: true`, `includeWaits: true`, `includeChildren: true` — all three default off, so a diagnosis needs them named explicitly, not assumed. Add `includeDefinition: true` when you already suspect the answer needs the definition — it returns the revision the run froze, so it costs you nothing and saves a second call. Never diagnose from the definition *instead of* the run.
3. **Find the stopping step** — `run.currentStepKey`, and the step whose status is `blocked` or `failed`. "Not completed" is too loose once several steps sit in different non-terminal states.
4. **Read its `errorJson` and its `outputJson`.** The error says what the engine did. The outputs often say *why*, because a well-authored gate puts its reason there.
5. **Follow the evidence down.** A blocked child? Open the child run. A gate? Read the session's receipt — see below.
6. **State the cause with the evidence** — the run, the step, the error category, and the quoted reason.

Only then propose a fix.

## Reading A Session Receipt

The receipt is the last agent message of the turn. A real transcript will exceed the tool output limit if you ask for all of it, because any window containing a `command_execution` or `command_completed` event carries that command's full `aggregated_output` — a single `rg --files` can be well over ten kilobytes.

Use `pm_audit events`, which is built for exactly this and bounds both problems:

```
pm_audit { action: "events", sessionUlid, includePayloadJson: false, textMaxLength: 4000 }
```

`includePayloadJson: false` drops the raw payloads that carry command output. `textMaxLength` truncates every event's text. Together they let you read a whole transcript in one call without probing for a safe offset. Raise `textMaxLength` when the receipt itself is long; keep payloads off unless you specifically need one event's internals, and then fetch that narrow window with `sinceSeq`.

`pm_audit context` gives session and spec metadata when you need to know what the session was launched to do.

`pm_session events` takes only `sessionUlid`, `sinceSeq`, and `limit` — no type filter, no truncation, and `limit` windows *forward*, so there is no way to ask for the tail. Do not use it to hunt a receipt.

## Symptom Table

| What you see | Most likely cause | Check |
|---|---|---|
| `condition_not_matched` on a gate | Working as designed — an upstream outcome was not the expected one | The step's `outputJson.reason`; then the upstream step that produced the outcome |
| Run `waiting` on a start-and-wait launch, turn finished, nothing moves | The step declares two or more expected outcomes and **no gate**. That wait can never resolve | The launch step's `waitsFor.expected` length and whether `gates` is present. Fix the definition; the run cannot be rescued |
| Agent did the wrong job, or acted on no instructions at all | The one-shot prompt was not authored on the launch or Review card | The launch/Review `prompt` and its persisted initial-turn operation |
| "contract is not registered for `<tool>/<action>`" | Stale server, or the action genuinely is not executable | `pm_health.startTs` vs `run.startedAt`, and source mtime if you have filesystem access; then whether the action is in the executable set |
| "unsupported runtime field" for a field you can see in the allowlist | Stale server | `pm_health.startTs` |
| "Actor agent not found for handle …" | `start` was called with an actor handle that is not registered | There is no run to read — this is returned before the run is created. Check the handle you passed. Fix by passing a registered one, not by registering the placeholder |
| "session … is still idle. Close or mark it failed" | Session identity collision — same task, role, and agent as an open or idle session | `pm_session get` on the named session. Close each session at turn end |
| Gate reports invalid output, run blocked | The agent emitted prose, or a different field name than `extract.path` | The session receipt; compare to the agent's output contract |
| `session_input_authorization_missing` | The target session has no trusted agent handle — usually the wrong `sessionUlid` reached the input step | The launch step's `sessionUlid` output and what the input step bound to |
| `review_publication_binding_invalid` | The `review` launch step did not author its own `sourceSessionUlid`, so the publication cannot be correlated | The launch step's `review` block |
| `review_outcome_invalid` / `review_outcome_unexpected` | A review-backed wait declared an outcome outside `review_approved` / `review_changes_requested`, or the published verdict was not among the expected ones | The step's `waitsFor.expected`, then the durable review |
| `subworkflow_target_missing` | The child version is not present in this PM home | Whether you are pointed at the right PM home; then that the child version is saved |
| `Subworkflow 'x' must bind required input 'y'` | The step does not bind an input the child declares required | The child's declared inputs. Under `forEach`, `itemName` supplies one of them |
| `UNIQUE constraint failed: workflow_runs.workflow_key, workflow_runs.context_ref` | An **active or blocked** run already exists for this workflow and subject | `list_runs` for that workflow and task; cancel the old one, then rerun. A completed or cancelled run would not have caused this |
| Run `waiting` and not moving | No driver is advancing it, or its wait has not been satisfied | Whether anything is advancing it (poll `run.updatedAt` twice); then `waits[]` |
| A resolved wait, but the run is blocked | The wait belongs to a different, completed step — conditions create no waits | The stopping step's kind before reading `waits[]` at all |
| Two sessions where you expected one | A driver and a manual `advance` both executed the step | Whether you called `advance` while a driver was active |
| Step "completed" but downstream skipped | A `when` guard evaluated false | The guard's referenced value in the upstream step's outputs |
| `run.outputJson.error.category` contradicts the step's `errorJson.category` | Engine defect — the run envelope miscategorises | Trust the step. Report the mismatch separately. Observed: `child_workflow_blocked` on a condition block whose only child completed |
| Outputs empty though the run completed | An output selector points at a field the contract does not produce | `$.raw` versus `$.normalized` for that step; the action's normalized shape |

## Reading Gate Evidence

`gateEvidenceJson: { matched: false }` on a condition means the check did not pass. That alone is not a diagnosis — it is the *start* of one. The interesting question is why the upstream value was what it was, which is why gates should carry a `reason` output.

For a `session_output` gate, know which record holds what:

- **`gateEvidenceJson`** carries `gateKey`, `gateKind`, `outcome`, `invalid`, `sourceSessionUlid`, the review identifiers (`reviewId`, `assignmentId`, `scoreId`, `commentId`, `publicationEventId`, `reviewStatus`), and `references`. The parsed receipt is **never** here. `invalid: false` means the receipt parsed, not that you can read it from this field. Note `sourceSessionUlid` — when you need to know which session produced a verdict, this is the cheapest place to find it.
- **The resolved workflow input's payload** carries the parsed object at `payload.gate.parsed` when the gate declared `includeParsed: true` — the same place `$.normalized.input.payload.gate.parsed` selects from. Look here first for the content.
- **The session transcript** is the fallback when `includeParsed` was off, and the only place the full receipt ever exists in that case.

### When the gate is a condition on a child's outcome

Everything above describes a `session_output` gate. A `condition` gate reading a child run's outcome has none of it — its `gateEvidenceJson` is just `{matched: false}`, and the session that produced the value lives one level down, inside the child.

Step 2 already passed `includeChildren`, and that returns each child's **complete** record, `outputJson` included. **Do not re-fetch the child to read its outcome or its session ULID — you already have both.** Open the child separately only when you need its steps or its waits. The one exception is `dependencyRevisionsJson`: child rows omit it unless the parent call also passed `includeDependencies: true`, so if the diagnosis turns on a frozen child revision, re-fetch with that flag rather than assuming it is already in hand.

Three values, and the diagnosis needs all three:

| Value | Where it is |
|---|---|
| What the child returned | `children.runs[].outputJson.outcome` — already in hand |
| Which session produced it | `children.runs[].outputJson.<role>SessionUlid`, or the stopping step's `gateEvidenceJson.sourceSessionUlid` — if both absent, the child's own steps |
| **What the gate required** | **Nowhere in the run record.** `gateEvidenceJson` is `{matched: false}` and carries no expectation; the step's `errorJson` names the failure, not the requirement |

The third forces you into the definition — the parent's, not the child's. Get the revision that actually executed, never the current head at that key and version, which may have been re-saved since. Two ways, and the first is free:

```
pm_workflow { action: "get_run", runUlid, includeDefinition: true }   # resolved by the run's own contentHash
pm_workflow { action: "get", contentHash: run.workflowContentHash }   # the same bytes, as a separate call
```

Prefer the first: you were fetching the run anyway. Either way you are addressing an exact revision by content, which is also why no staleness check applies here.

Read `steps[key == <stopping step>].checks[].equals`. That is the expected outcome. Compare it to the child's.

This is the one place the definition is required. "Never diagnose from the definition" means never diagnose from it *instead of* the run — not that the run is always sufficient. Here it is not.

Two authoring defects to report while you are in there:

- **An absent session ULID on the child's outputs.** A subworkflow that returns a judgement should surface the session that produced it, or every future diagnosis pays for the omission.
- **A gate `reason` that only echoes the child.** If the reason interpolates the child's summary without stating what the gate itself required, the expected outcome is unrecoverable from the run — which is exactly why you had to fetch the definition. A gate that writes `"Sizing outcome was X; preparation requires task_sized"` costs the next diagnosis nothing.

## Terminal Envelopes

A terminal run carries `outputJson` with `status`, `partial`, and `error { category, message }`. The `partial` block preserves whatever evidence existed at the stop — including a stopped gate's declared outputs.

Take the category from the **step's** `errorJson` or the `workflow_blocked` event, never from the run envelope. The run-level `error.category` can be not merely coarser but **wrong**: a condition block has been observed reporting `child_workflow_blocked` when no child blocked — both when no child existed at all, and when the one child had **completed successfully**. A reader trusting it would go hunting a child failure that never happened.

If the two disagree about what *kind* of failure occurred, that is an engine defect in its own right — report it separately from the run you were asked about.

To find the `workflow_blocked` event itself, fetch `pm_workflow events` the same way you fetch a session receipt: skeleton first, payload only where you need it.

```
pm_workflow { action: "events", runUlid, eventTypes: ["workflow_blocked"] }
pm_workflow { action: "events", runUlid, afterSeq: <seq - 1>, includePayload: true, limit: 1 }
```

`includePayload` defaults off — the first call gets you the event's `seq` and type for free. Take that `seq`, narrow to it with `afterSeq`, and only then pass `includePayload: true` for the category and message. Do not fetch the whole run's event history with payloads attached just to read one event.

### Two words that mean three things

`blocked` names the run status, a step status, and part of an error category, and they are independent. A run can be `blocked` because one step is `blocked`; a step can be `blocked` while its child `completed`. Always say which one you mean.

### A condition creates no wait

The procedure has you fetch `waits[]`, and on a condition-blocked run that list is about **something else**. A `condition` step never creates a wait record. What you will find is a resolved wait belonging to some *other, completed* step. Reading it as "what the run is waiting on" answers a question about the wrong step. If the stopping step is a condition, `waits[]` is not part of this diagnosis.

Nor does a detached launch or Review. It dispatches its first turn and completes; if a run is waiting on that work, the wait belongs to an exact-turn `await_condition` join.

### `retryEligibilityByStepKey` is arithmetic, not diagnosis

`get_run { includeSteps: true }` returns a `reasonCode` per step — this is part of what `includeSteps` adds, not something the flagless poll carries. There are four reasonCodes: `eligible`, `step_not_retryable`, `step_unknown`, and `run_closed`. Two of them read as findings when neither is one:

- **`eligible` on a condition that blocked.** A condition stopped by `condition_not_matched` is retryable as far as this field is concerned, because the category is neither a tool-contract nor a replay failure. It is telling you the arithmetic permits a retry, not that one would help — the upstream value has not changed, so it would refuse again.
- **`step_not_retryable` on a step that completed successfully.** "Not retryable" reads as a constraint that bit. It is a statement about a step that never needed retrying.

Neither tells you anything about why the run stopped.

## When A Child Stops The Parent

Two different shapes, and confusing them wastes the most time.

**The child failed.** A blocked or failed child blocks its parent, and the parent's error names the child run. Open the child and repeat the procedure there. Work down to the deepest run whose error is *not* about a child — that one is the cause.

**The child succeeded and the parent refused its answer.** A subworkflow whose contract is to *return a verdict* completes successfully while returning an outcome the parent's gate rejects. `task_needs_changes` is a correct, successful result; the parent gate simply required `task_ready`.

In this shape the deepest run has `errorJson: null` and no error at all, so the "work down" algorithm terminates on a run with nothing to read. **Do not read `children.byStatus: {completed: N}` as "the child is fine, look elsewhere."** Compare the child's `outputJson.outcome` against the outcome the parent's gate expected. When they differ and the child completed, the cause is the parent refusing a legitimately produced value — which is usually the workflow working, not a defect.

## Distinguishing "Broken" From "Working As Designed"

Ask what the workflow was supposed to do when this condition arose.

A gate that blocks a task that genuinely is not ready is **the system working**. A blocked run is not automatically a defect — it is often the correct outcome, and the fix belongs to the subject, not the definition. Say which of the two you are looking at, because they lead to opposite actions.

**Read the subject.** A refusal is only verifiably correct if the subject really has the defect the reason names. Fetch the task, the diff, or the artifact and check — do not take the agent's word for it. That is the difference between "an agent said it was unready" and "the task has no acceptance checklist, so it is."

## Before You Change Anything

- Can you name the run, the step, and the error category?
- Can you quote the reason, rather than paraphrasing your theory?
- If staleness could affect the answer, have you ruled it out or said plainly that you could not?
- Is this a defect, or the workflow correctly refusing?

If any answer is no, keep reading the run.

## Recovering

- **Definition was wrong:** fix it, prove the fix with `test_definition`, bump the version, save, cancel the old run, start the new version.
- **Subject or environment was wrong:** fix it, fetch `get_run` with `includeSteps: true`, then use `retryEligibilityByStepKey` to retry an eligible failed or blocked step in place with its latest attempt.
- **A fresh whole run is intended:** cancel and `rerun`. A blocked run must be cancelled first because it still holds the context.
- **Correct refusal:** do not "fix" it. Report it, with the reason.
- **The run is fine but the engine misreported something:** you found a defect incidentally. Nothing about this run needs changing. Report the defect separately — what you saw, what it should have said, and where — and do not let it contaminate the diagnosis you were asked for.

An unchanged condition still produces the same refusal. Retry only after the value or cause that blocked the step has changed.

Whenever you cancel or re-run, say so plainly, with the reason you gave the engine.

<!--</instructions>-->
<!--</capability>-->
