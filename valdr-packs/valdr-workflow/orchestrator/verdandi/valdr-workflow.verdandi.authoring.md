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

Field types are `string`, `number`, `integer`, `boolean`, `object`, `array`. Exact references preserve arrays for downstream list inputs.

Capability keys must be scoped to the pack that owns them. A key from another pack's namespace will not link, and the failure is quiet.

## Step Kinds

| Kind | Use for | Owns |
|---|---|---|
| `tool` | One registered workflow tool action, safe to replay | `tool.id`, `tool.action`, `inputs` |
| `session` | Provisioning an agent session, and driving one turn of it | `session` |
| `review` | Provisioning a reviewer session | `review` |
| `condition` | Routing on a closed check | `checks`, `onFailure` |
| `human_gate` | Stopping for a person's approval | `humanGate`, `waitsFor` |
| `subworkflow` | Calling another workflow by exact version | `workflow` |
| `await_condition` | An outside callback, or a join on detached work | `waitsFor` |

Every step requires `key`, `name`, and `kind`; do not omit `name`. Optional fields include `needs`, `when`, `inputs`, `outputs`, and `onFailure`.

**A `session` step collects its own agent verdict.** Use `await_condition` only for external callbacks or detached joins; `gates` are forbidden. External Await requires **both** `expected` and `authorizedHandles`. An exact detached Await binds `sourceSessionUlid` and `sourceTurnClientRequestId`, derives authority, and forbids authored `authorizedHandles`.

There is no child-run join. The `child_run_terminal`, `child_run_completed`, and `child_runs_settled` wait kinds are non-normative and rejected under strict validation. A `subworkflow` step already blocks on its child, and `forEach` already joins its whole fan-out.

## How A Step Waits

Waiting is a property of the step that causes the wait, not a step of its own. Two steps make a session do work:

1. A one-shot **launch** step starts and waits on its first turn. Put the prompt, completion wait, gate, and outputs on that one card.
2. A **session input** step is only a later turn on a deliberately create-only reusable session; it carries that later turn's prompt, wait, receipt gate, and result outputs.

For substantial artifacts, prompt the session to save useful stages: structure
and requirements first, then task sections and validation fixes. Partial saves
are progress, not acceptance. Reserve the final completion receipt and artifact
hash for finished, validated content. Prefer substantive saved work to empty
heartbeat messages.

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

**The one-shot turn's work goes in `session.prompt` on the launch step.** Use `session.action: input` only for a later turn on a deliberately reusable session. Workflow-owned input is queued; `delivery: steer` is an ad-hoc `pm_session input` option and is not supported in workflow session steps.

**`waitsFor.authorizedHandles` and `waitsFor.sourceSessionUlid` are runtime-owned.** The runtime freezes both from the exact target session. Authoring either on a session input step is an error. Separately, a session-input receipt gate must bind `gates[].source.sessionUlid` to that same `session.sessionUlid`; only a start-and-wait launch can infer the gate source.

**A gate requires `waitsFor.expected`.** Declaring a `session_output` gate without expected outcomes is an error.

**Without a gate, the wait resolves only on exactly one expected outcome.** This is the trap. Two or more expected outcomes and no gate passes strict validation cleanly, then never resolves — the run parks in `waiting` forever. If judgement decides between outcomes, it needs a gate. If the step just has to finish, declare one explicit outcome, normally `[completed]`.

**`extract.path` must name the field the agent emits.** If its receipt calls the decision `verdict`, the path is `$.verdict`, not `$.outcome`. Read the agent's own output contract.

**`includeParsed: true`** makes the whole parsed object available at `$.normalized.input.payload.gate.parsed.<field>` — that is how a reason, a handle, or a list reaches later steps.

**A session-output gate does not accept a JSON Schema.** It parses the receipt and
maps the extracted outcome; `includeParsed` does not require other receipt fields.
Do not add `schema`, `jsonSchema`, `contract`, `receiptSchema`, `validate`, or
`extract.schema`. Validate required fields with supported checks or an explicit
tool step before their values authorize further work.

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

Missing either binding below blocks the run:

- **The `review` launch step must bind `reviewId`, `assignmentId`, and `sourceSessionUlid`** from a preceding `pm_review/start` and the implementation session. Without them the runtime cannot correlate publication evidence.
- **The reviewer publishes using the trusted first-turn correlation the runtime supplies.** Do not author a replacement client request ID in the workflow prompt.

## Human Gates

Hot-load `valdr-workflow.steps.human-gate` before authoring human approval or
clarification. It covers Questions schema, answer selectors and propagation,
preview/feedback bindings, human authority, rejection, and bounded loop resumption.
Approval expects `approved`/`rejected`; Questions requires `answered` and may
offer `rejected`. Human gates author `authorizedHandles` and resolve through the
authorized human UI, without callback tokens. Guard rejected outcomes before
continuing; clarification does not approve later persistence.

## Expressions

Two forms, and the difference matters:

| Form | Behaviour |
|---|---|
| `"${steps.a.outputs.list}"` — exact reference | **Preserves the type.** An array stays an array. |
| `"Sprint for ${steps.a.outputs.name}"` — interpolation | Produces text. |

Use an exact reference whenever a tool input wants a non-string.

**Object interpolation produces YAML text, not JSON.** Even a leading space in
`" ${steps.a.outputs.receipt}"` selects interpolation; feeding that result to
`JSON.parse` or `json.loads` fails. Preserve objects with exact references when
the input accepts them. For string-only command environment values, bind scalar
fields or a string already serialized as JSON by its producer. If a command
must consume interpolated structured text, use an available safe YAML parser;
do not invent an expression serialization function.

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

`value_in` requires `value` and `allowed: [...]`; `values` is ignored on condition steps. See Workflow Hazards for exact check fields.

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

The source check's `equals` and every `domain` entry must be **literal values**;
`equals` must belong to that domain. An expression remains invalid if hidden
behind another step output. Express a data-dependent decision with supported
operations and a finite outcome before comparing it to the literal loop target.

`previous.outputs` contains the **loop-back source condition's** declared outputs
from the preceding pass. It is not a step map: no `steps.<key>` belongs in the
path. Pass 1 has no previous receipt. Guard each reader before resolving its
inputs, checks, or outputs; for a three-pass corridor:

```yaml
when:
  - kind: value_in
    value: "${runtime.loop.currentPass}"
    allowed: [2, 3]
outputs:
  priorReason: "${runtime.loop.previous.outputs.reason}"
```

Match the allowed later passes to the corridor's bound. Reading `previous`
cannot itself be the first-pass guard.

Before asking a human to enable another pass, guard that a pass remains;
clarification must not reset the revision budget. Hot-load
`valdr-workflow.steps.human-gate` for the bounded clarification example and
answer propagation contract.

## Tool Steps

Hot-load `valdr-workflow.tools.overview` to choose a mechanism, then the matching
`valdr-workflow.tools.command`, `valdr-workflow.tools.git`,
`valdr-workflow.tools.github`, `valdr-workflow.tools.valdr`, or
`valdr-workflow.tools.user-tools` capability for exact actions, required inputs,
result selectors, and recovery.
Prefer dedicated `session`, `review`, and `subworkflow` steps for their lifecycle.

Put action arguments in `inputs` and the action name in `tool.action`. Built-in
`command/run` needs no imported tool or capability named `command`; capability
search is not the executable catalog. Imported tools use their actual installed
ID and full pin, never `pm_user_tool` as the workflow tool ID.

Map results from the selected action's actual normalized envelope. Command's
`$.normalized.stdout` is a **string**, even if it contains JSON or a number.
User-tool structured data is under `$.normalized.data`; Valdr actions expose
action-specific fields. Preserve types with exact references, not interpolation.

Strict validation checks the graph and action inputs; it cannot prove host
prerequisites, handler authority, or business success. Guard on the actual result
before permitting downstream effects and respect the user's execution scope.

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

**Bind every required child input.** Validation names missing bindings. Under `forEach`, `itemName` supplies one input; explicitly bind the others. A root run freezes each child's content hash for reproducibility. Changing a child requires bumping its version and updating every caller's pin.

A blocked child blocks its parent; the caller cannot proceed on an unfinished result.

**A child returning a judgement must expose its source session**, e.g. `reviewerSessionUlid`, so parent-gate diagnosis can find the receipt.

## Fan-Out

A `subworkflow` with `forEach` runs once per item. The shipped `valdr-workflow.task.review-all` runs one review workflow per staffed assignment this way.

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

Each constraint below is a validation error:

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

## Before You Call It Done

- Strict validation passes with no errors, and you have read the warnings.
- Every session input step either has a gate, or declares zero or one expected outcome. Two without a gate is a hang that validation will not catch.
- Every one-shot turn's real instructions are in `session.prompt` on its launch; an input step carries only a later reusable-session turn.
- Every agent handle, preset key, tool action, and child workflow version exists.
- Every gate's `extract.path` matches the agent's real output contract.
- Every stopping gate carries a `reason` stating **what it required**, not merely echoing the upstream summary. Example: `"Readiness outcome was ${steps.check.outputs.outcome}; preparation requires task_ready."`
- The workflow has been driven at least once through `test_definition`, or you have said that it has not.

## Local user tools (Valdr 0.3.3+)

A step that calls an imported `<pack>.user.<name>` tool: hot-load `valdr-workflow.verdandi.user-tools` before writing it.

<!--</instructions>-->
<!--</capability>-->
