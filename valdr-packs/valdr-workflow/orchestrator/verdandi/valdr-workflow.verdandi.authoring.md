<!--<capability id="valdr-workflow.verdandi.authoring" pack="valdr-workflow" role="workflow">-->
# Authoring Workflows

<!--<identity>-->
How to write a definition the runtime can actually execute: the step kinds, how a step waits, how an agent's judgement becomes control flow, what the expression grammar really supports, and which declared fields are not executable.
<!--</identity>-->

<!--<instructions>-->

## The Shape

```yaml
schemaVersion: 1.0
workflow:
  key: <pack>.<area>.<name>        # unique; also the run identity
  name: Human Readable Name
  description: What it does, what it returns, and when to reach for it.
  version: 0.1.0                   # exact; callers pin this
  pack: <pack-key>
  source:
    kind: capability
    capabilityKey: <pack>.workflow.<name>
  start:
    mode: manual
  inputs:    { <name>: { type, required, description } }
  outputs:   { <name>: { type, required, description } }
  outputMappings: { <output>: "${steps.<key>.outputs.<name>}" }
  steps: [ ... ]
```

Field types are `string`, `number`, `integer`, `boolean`, `object`, `array`. **`array` is real and useful** — an exact reference preserves it, so an array produced by one step can be handed straight to a tool input that wants a list.

Capability keys must be scoped to the pack that owns them. A key from another pack's namespace will not link, and the failure is quiet.

## Step Kinds

| Kind | Use for | Owns |
|---|---|---|
| `tool` | One registered, replay-safe PM operation | `tool.id`, `tool.action`, `inputs` |
| `session` | Provisioning an agent session, and driving one turn of it | `session` |
| `review` | Provisioning a reviewer session | `review` |
| `condition` | Routing on a closed check | `checks`, `onFailure` |
| `human_gate` | Stopping for a person's approval | `humanGate`, `waitsFor` |
| `subworkflow` | Calling another workflow by exact version | `workflow` |
| `await_condition` | An outside callback, or a join on detached work | `waitsFor` |

Every step **must** carry `key`, `name`, and `kind`. It may also carry `needs`, `when`, `inputs`, `outputs`, and `onFailure`. Omitting `name` is the most common way a hand-written step fails schema validation.

**`await_condition` is no longer how you collect an agent's verdict.** A `session` step waits for its own turn now — see below. Reach for `await_condition` only in the two cases its row names, and never put `gates` on one: that is an error. An ordinary external Await requires **both** `expected` and `authorizedHandles`; an exact detached Await instead binds `sourceSessionUlid` and `sourceTurnClientRequestId`, derives its authority, and forbids authored `authorizedHandles`.

There is no child-run join. The `child_run_terminal`, `child_run_completed`, and `child_runs_settled` wait kinds are non-normative and rejected under strict validation. A `subworkflow` step already blocks on its child, and `forEach` already joins its whole fan-out.

## How A Step Waits

Waiting is a property of the step that causes the wait, not a step of its own. Two steps make a session do work:

1. A one-shot **launch** step starts and waits on its first turn. Put the prompt, completion wait, gate, and outputs on that one card.
2. A **session input** step is only a later turn on a deliberately create-only reusable session; it carries that later turn's prompt, wait, receipt gate, and result outputs.

```yaml
- key: decide
  name: Launch decider
  kind: session
  session:
    action: launch_task
    taskKey: "${workflow.inputs.taskKey}"
    agentHandle: some-agent
    launcherConfigKey: "${workflow.inputs.presetKey}"
    actor: "${runtime.actor}"
    role: reviewer
    prompt: "Choose and return the required receipt."
  waitsFor:
    kind: workflow_input
    expected: [thing_ok, thing_not_ok, thing_unknown]
  gates:
    - key: verdict
      kind: session_output
      source: { event: final_agent_message }
      extract: { format: json, path: $.verdict }
      outcomes: { ok: thing_ok, bad: thing_not_ok, unsure: thing_unknown }
      onInvalid: { action: block }
      payload: { includeParsed: true, includeSession: false }
  outputs:
    sessionUlid: "$.normalized.session.sessionUlid"
```

### The rules that decide whether it resolves

**The one-shot turn's work goes in `session.prompt` on the launch step.** Use `session.action: input` only for a later turn on a deliberately reusable session.

**`authorizedHandles` and `sourceSessionUlid` are not yours to author.** The runtime freezes both from the exact target session. Authoring either on a session input step is an error.

**A gate requires `waitsFor.expected`.** Declaring a `session_output` gate without expected outcomes is an error.

**Without a gate, the wait resolves only on exactly one expected outcome.** This is the trap. Two or more expected outcomes and no gate passes strict validation cleanly, then never resolves — the run parks in `waiting` forever. If judgement decides between outcomes, it needs a gate. If the step just has to finish, declare one explicit outcome, normally `[completed]`.

**`extract.path` must name the field the agent emits.** If its receipt calls the decision `verdict`, the path is `$.verdict`, not `$.outcome`. Read the agent's own output contract.

**`includeParsed: true`** makes the whole parsed object available at `$.normalized.input.payload.gate.parsed.<field>` — that is how a reason, a handle, or a list reaches later steps.

**`onInvalid: block`** means malformed output stops the run instead of being guessed at. Keep it.

**Give every agent an `unknown` outcome.** An agent forced to always choose invents a justification. A first-class "I could not decide" lets the workflow handle indecision deliberately.

### The four completion shapes

| Shape | Behaviour |
|---|---|
| `waitsFor: { expected: [completed] }`, no gate | Canonical start-and-wait completion; omission is legacy action-specific behavior, not new authoring |
| `waitsFor` with **one** expected outcome, no gate | Waits for the turn; completes with that outcome |
| `waitsFor` with expected outcomes **and** a `session_output` gate | Parses the receipt and maps it to one of them |
| `detached: true` | Dispatches the turn and completes immediately; creates no wait |

`detached` is the fire-and-forget shape: dispatch the launch's first turn now, then join it later with an exact `sourceSessionUlid` plus `sourceTurnClientRequestId` await. It is not iteration — for that, see Fan-Out.

### Reviewers

A one-shot reviewer is one Review card with `reviewId`, `assignmentId`, its initial prompt, and review publication outcomes. A detached Review also needs those bindings before it dispatches.

A review-backed wait does not read the agent's final message — it follows the **durable PM review verdict**. So:

- Expected outcomes must be drawn from `review_approved` and `review_changes_requested`. Any other value blocks the run as `review_outcome_invalid`.
- Both may be declared without a gate; this is the one exception to the one-outcome rule.
- The reviewer must publish a durable review. If it ends its turn without one, the run blocks with missing review evidence.

Two bindings are mandatory and easy to miss, and a run that omits either blocks:

- **The `review` launch step must bind `reviewId`, `assignmentId`, and `sourceSessionUlid`** from a preceding `pm_review/start` and the implementation session. Without them the runtime cannot correlate publication evidence.
- **The reviewer publishes using the trusted first-turn correlation the runtime supplies.** Do not author a replacement client request ID in the workflow prompt.

Bind `reviewId`, `assignmentId`, and `sourceSessionUlid` from a preceding `pm_review/start` and the implementation session; the runtime appends the trusted publication correlation to the first-turn prompt.

## Human Gates

The only way to stop for a person.

```yaml
- key: approve_spec
  name: Approve specification
  kind: human_gate
  needs: [create_spec]
  humanGate:
    prompt: "Approve the reviewed specification for ${workflow.inputs.taskKey}?"
    approvalText: Approve spec
    rejectionText: Reject
    references:                    # up to 8, kept in authored order
      - kind: task
        target: "${workflow.inputs.taskKey}"
        label: Open task
      - kind: session
        target: "${steps.create_spec.outputs.writerSessionUlid}"
        label: Open writer session
    preview:                       # up to 5 documents, unique keys
      documents:
        - key: spec
          label: Spec
          path: "${steps.create_spec.outputs.path}"
          sourceSessionUlid: "${steps.create_spec.outputs.writerSessionUlid}"
    feedback:                      # where a rejection's notes land
      sourceSessionUlid: "${steps.create_spec.outputs.writerSessionUlid}"
      taskKey: "${workflow.inputs.taskKey}"
      reviewId: "${steps.create_spec.outputs.reviewId}"
  waitsFor:
    kind: workflow_input
    expected: [approved, rejected]
    authorizedHandles: ["${runtime.actorHandle}"]
  onFailure: { action: block }
```

A human gate presents approval content; it does not create comments, reviews, or sessions. Put any durable question or comment in an explicit replay-safe tool step before the gate.

References may be `task`, `session`, `run`, or `url`. Bind their targets from the records that produced the approval material; URL targets must be absolute `http:` or `https:` URLs. Authored labels and order are presentation data and must be preserved.

Feedback is valid only when at least one preview document exists. Each preview document needs the session that produced it, or the reviewer has nothing to open. Feedback reuses the existing source session, task, and review; it does not launch another agent or create a review.

Unlike a session wait, a human gate **does** author its `authorizedHandles` — the approval must come from a real human or operator identity. Human approval outcomes are `approved` and `rejected`; do not substitute the durable review outcomes `review_approved` and `review_changes_requested`.

## Expressions

Two forms, and the difference matters:

| Form | Behaviour |
|---|---|
| `"${steps.a.outputs.list}"` — exact reference | **Preserves the type.** An array stays an array. |
| `"Sprint for ${steps.a.outputs.name}"` — interpolation | Produces text. |

Use an exact reference whenever a tool input wants a non-string.

**The path grammar supports dotted identifiers and numeric indices only** — `a.b.c` and `a[0]`. There are no wildcards, filters, counts, or arithmetic. You cannot compute "start plus seven days", and you cannot ask "did all of these succeed". If you need a derived value, take it as an input or have a step produce it.

Roots available:
- `${workflow.inputs.<name>}`
- `${steps.<key>.outputs.<name>}` — upstream steps only
- `${runtime.<field>}` — `runUlid`, `rootRunUlid`, `taskKey`, `projectKey`, `contextRef`, `stepKey`, `attempt`, `startedAt`, `clientRequestId`, `actor`, `actorHandle`, `loop`

`runtime.startedAt` is the run's start, deliberately not a live clock: a wall-clock value would differ across attempts and turn a safe retry into a claim mismatch.

Selectors on step outputs read the result: `$.raw` is exactly what the handler returned, `$.normalized` is the contract-validated shape, and `$.outputs` reads the step's own declared outputs.

## Conditions And Routing

A `condition` has no success branch. On a match it completes. On a non-match it does whatever `onFailure` says — and with no `onFailure` at all it also completes, making the condition a no-op. The match flag is recorded in `gateEvidenceJson` but is never exposed as an output, so author the observed value yourself if a later step needs it.

```yaml
- key: gate_thing
  name: Gate thing
  kind: condition
  needs: [check]
  checks:
    - kind: value_equals
      value: "${steps.check.outputs.outcome}"
      equals: thing_ok
  outputs:
    outcome: "${steps.check.outputs.outcome}"
    reason: "Check outcome was ${steps.check.outputs.outcome}; this step requires thing_ok."
  onFailure: { action: block }
```

Check kinds are `value_equals`, `value_in`, `array_unique_nonempty_strings`, and `array_permutation_equals`. The same set is what a `when` guard on any step accepts — `when` takes a list of these checks, not a boolean expression.

`onFailure` supports `block`, `fail`, and `loop_back`. `block` and `fail` both stop the run **and persist the step's declared outputs alongside the error**, which is precisely why the `reason` output above is worth writing.

### Loop corridors

```yaml
onFailure:
  action: loop_back
  to: <strict ancestor step key>
  max: 3            # total passes, 1-10
  exhausted: block  # or fail
```

The source needs exactly one `value_equals` check with a closed `domain` listing every possible outcome. A match continues forward; a non-match repeats the corridor. Corridors may not overlap and may not contain automatic retry. A `subworkflow` step inside a corridor may not carry `forEach` or `detached`. Inside one, `${runtime.loop}` gives `targetStepKey`, `sourceStepKey`, `currentPass`, `maxPasses`, and `previous`.

## Tool Steps

Only actions exposed by the live tool catalog are executable. Use the catalog and strict validation as the authority; these are examples of shipping workflow actions:

| Tool | Executable actions |
|---|---|
| `pm_task` | `get`, `get_prompt`, `change_status`, `update`, `comment_create` |
| `pm_review` | `list`, `start`, and `launch_reviewer` as a `review` step |
| `pm_session` | `launch_task`, `launch_prompt`, and `input` as `session` steps |
| `pm_sprint` | `create`, `link_task`, `close_checked` |
| `vmp` | `get_plan`, `commit_markdown_from_worktree` |
| `pm_workflow` | Registered actions from the live aggregate Valdr catalog |
| `git` | `status`, `diff`, `log`, `remote_status`, `branch_create`, `commit`, `merge`, `push` |
| `github` | `create_pull_request` |

The aggregate Valdr adapter exposes its registered actions as executable. Discover the live catalog and validate the definition; a catalog entry does not remove handler validation, human-gate authority, or replay constraints.

The runtime fills only known-safe required fields: `taskKey`, `projectKey`, `contextRef`, `runUlid`, `actor`, `actorHandle`, `clientRequestId`. **Everything else you must author.**

## Subworkflows

```yaml
- key: do_part
  name: Do part
  kind: subworkflow
  workflow: { key: other.workflow.key, version: 0.2.0 }
  inputs:  { ... }
  outputs:
    outcome: "$.normalized.child.outputs.outcome"
```

A subworkflow step needs no wait — it blocks on its child inherently. The version is exact.

**Bind every input the child declares required.** Validation checks the binding against the child's own declared inputs and names the missing one: `Subworkflow 'x' must bind required input 'y'.` Under `forEach`, `itemName` satisfies one of them — each item arrives under that name — so a step that fans out binds one fewer input than the same child called directly. A root run freezes the content hash of every child it uses, so a run stays reproducible even if you edit the child later — and changing a child means bumping its version and every caller that pins it.

A child that blocks blocks its parent. That is usually what you want: it stops the caller from proceeding on an unfinished result.

**A subworkflow that returns a judgement must surface the session that produced it** — e.g. a `reviewerSessionUlid` output. Without it, every future diagnosis of a parent gate has to hunt through the child's own steps to find the receipt.

## Fan-Out

A `subworkflow` step with `forEach` runs its child once per item instead of once. This is the only iteration primitive, and it is real — the shipped `valdr-workflow.task.review-all` uses it to run one review workflow per staffed assignment.

```yaml
- key: review_assignments
  name: Run every staffed reviewer
  kind: subworkflow
  workflow: { key: valdr-workflow.task.code-review, version: 0.4.0 }
  forEach:
    items: "${workflow.inputs.assignments}"   # exact reference, never interpolation
    itemName: assignment                      # each item arrives as this child input
    maxConcurrent: 1
  inputs:
    taskKey: "${workflow.inputs.taskKey}"
  outputs:
    children: "$.normalized.children"
```

The constraints are narrow, and each one is an error rather than a warning:

- **`forEach` belongs on a `subworkflow` step.** Nowhere else.
- **`items` must be an exact reference** to a workflow input or a prior step's output. Interpolation is rejected. If it points at a workflow input, that input must be declared `type: array`.
- **`itemName` is required**, must be a safe identifier, and must not collide with a key you also author in `inputs` — each item is passed to the child under that name.
- **`maxConcurrent` must be `1` or omitted.** Any other value fails validation, and the runtime treats the step as an ordinary subworkflow rather than a fan-out. Execution is sequential today; do not author a definition that depends on parallelism.
- **Not inside a loop corridor.** A `subworkflow` step within a `loop_back` corridor may carry neither `forEach` nor `detached`.

Fan-out joins on its own: the step completes when every child has, and `$.normalized.children` carries them. You do not need an `await_condition`.

For repetition that is *not* over a known list — retrying a judgement until it passes — use a bounded `loop_back` corridor instead, where each pass re-derives what is next from durable state, so the workflow holds no cursor and an interrupted run resumes correctly.

## Declared But Not Executable

These validate under permissive authoring and are rejected as non-normative under strict validation, because the production executor does not run them:

`onChildFailure` · `resolveExisting` · the `child_run_terminal` / `child_run_completed` / `child_runs_settled` wait kinds · the `comment` and `group` step kinds · inline `retry.backoff` and `retry.retryOn`

**Do not build behaviour on them.**

`onFailure: { action: continue }` is different and stricter: it is a hard error in **every** mode, and `allowAdvancedKinds` does not admit it. The supported set is `block`, `fail`, `loop_back`, and nothing else.

Two fields no longer sit on this list. `detached` is executable on a launch or Review step. `forEach` is executable on a subworkflow step — see Fan-Out above.

## Before You Call It Done

- Strict validation passes with no errors, and you have read the warnings.
- Every session input step either has a gate, or declares zero or one expected outcome. Two without a gate is a hang that validation will not catch.
- Every one-shot turn's real instructions are in `session.prompt` on its launch; an input step carries only a later reusable-session turn.
- Every agent handle, preset key, tool action, and child workflow version exists.
- Every gate's `extract.path` matches the agent's real output contract.
- Every gate that can stop the run carries a `reason` output that states **what the gate required**, not only what it got. `"${steps.check.outputs.summary}"` alone echoes the upstream verdict and leaves the expectation recoverable only from the definition — every future diagnosis then pays for a definition fetch. Write `"Readiness outcome was ${steps.check.outputs.outcome}; preparation requires task_ready."`
- The workflow has been driven at least once through `test_definition`, or you have said that it has not.

<!--</instructions>-->
<!--</capability>-->
