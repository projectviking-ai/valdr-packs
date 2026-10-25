<!--<capability id="valdr-workflow.verdandi.debugging" pack="valdr-workflow" role="workflow">-->
# Debugging Runs

<!--<identity>-->
Diagnose a stopped or stuck workflow from its recorded status, outputs, definition, and session evidence. Separate an execution failure from an intended refusal before choosing a recovery action.
<!--</identity>-->

<!--<instructions>-->

## Read the run first

1. Fetch the run with `includeSteps: true`, `includeWaits: true`, and
   `includeChildren: true`. Add `includeDefinition: true` when you need to compare
   the executed checks or output mappings. These detail collections are opt-in.
2. Find the blocked or failed step. Read its error, declared outputs, and reason.
   A resolved wait from an earlier step does not explain a stopped condition.
3. Follow the relevant evidence: open a blocked child, inspect the session
   receipt, or compare a condition's input with the value its check requires.
4. Confirm the subject has the reported problem. Read the task, artifact, or diff
   before treating an agent's verdict as an established fact.
5. Report the run, step, observed outcome, required outcome, and evidence for the
   difference. Only then propose a fix.

```text
pm_workflow { action: "get_run", runUlid, includeSteps: true, includeWaits: true, includeChildren: true, includeDefinition: true }
```

Use the definition returned for the run, not a newer saved version. If behavior
contradicts the installed documentation, check the connected Valdr version with
`pm_health` and load scoped action help. Report any version mismatch before
changing an otherwise valid definition.

## Read a session receipt

A session-output gate reads the final agent message for its turn. Request bounded
transcript text instead of a large payload dump:

```text
pm_audit { action: "events", sessionUlid, includePayloadJson: false, textMaxLength: 4000 }
```

Raise the text limit when the receipt is longer. Request a narrow event window
with payloads only when that detail is needed. Use `pm_audit context` for the
session's task and specification context. Follow the installed action help for
pagination; do not assume one bounded response contains the full transcript.

Compare the receipt field with `gates[].extract.path` and its allowed outcomes.
If the gate uses `includeParsed: true`, declared step outputs can select fields
from `$.normalized.input.payload.gate.parsed`. Without that setting, read the
receipt from the session transcript.

To inspect accepted callback or gate evidence, request
`get_run { includeAcceptedInputs: true }`. Keep the output focused on the
relevant decision and do not expose callback tokens or sensitive agent output.

## Inactivity is not a diagnosis

When a provider stops producing events, inspect the last visible tool result,
agent message, and provider error with their timestamps. Silence alone does not
identify a workflow defect. Report what is known and what remains unconfirmed.
If a repeat run is authorized, compare the same inputs and settings before
attributing a changed result to a prompt or workflow edit.

## Common symptoms

| What you see | What to check |
|---|---|
| A condition blocks | Compare its required value with the upstream output; read the condition's reason |
| A session turn finishes but its workflow wait remains open | Multiple expected outcomes require a receipt gate; check `waitsFor.expected` and `gates` |
| An agent acts on missing or wrong instructions | Put a one-shot turn's instructions in the launch step's `session.prompt` |
| An action is unavailable or a field is unsupported | Inspect the installed action catalog and scoped help; confirm the connected Valdr version |
| An agent handle is rejected | Confirm the actual registered handle; do not register a placeholder to satisfy the field |
| A session launch conflicts with an existing session | Inspect that session and deliberately reuse or close it before another launch |
| A gate rejects the agent output | Compare the final receipt with `extract.path` and the expected outcome values |
| A review wait does not accept the verdict | Check review/assignment/source-session bindings and use `review_approved` or `review_changes_requested` |
| A child workflow or input is missing | Confirm the installed exact version and bind every required child input |
| Starting another run for the subject is refused | Find the existing active or blocked run; choose in-place recovery or a deliberate restart |
| A run remains pending or running | Poll status again, then inspect ready work and use the supported `advance` action when appropriate |
| A downstream step is skipped | Inspect its `when` checks and the upstream values they read |
| A run completes with empty outputs | Check the action's documented result selectors and the workflow's output mappings |

## A child failure and a rejected child result differ

A blocked or failed child can stop its parent. Inspect that child and repeat the
diagnosis at the step where it stopped.

A completed child can also return an outcome that the parent rejects. For
example, a readiness workflow may correctly return `task_needs_changes` while
the parent's condition requires `task_ready`. The child completed its job; the
parent is refusing to continue until the task changes.

Compare three things:

- The child's declared outcome and reason.
- The session receipt or subject evidence behind that outcome.
- The parent condition's required value in the definition used by this run.

A child that returns a judgment should expose the source session as a declared
output. A stopping condition should state both the observed and required outcome
in its reason. These outputs let the operator understand the stop directly.

## Inspect a specific event

Read a compact timeline first, then request payload detail only around the event
that matters:

```text
pm_workflow { action: "events", runUlid, eventTypes: ["workflow_blocked"] }
pm_workflow { action: "events", runUlid, afterSeq: <seq - 1>, includePayload: true, limit: 1 }
```

If the run summary and step evidence disagree, report both observations with the
run and step identifiers. Diagnose the requested workflow from the direct
step evidence; report the discrepancy separately without guessing its cause.

## Recover deliberately

- **Definition error:** correct and validate the definition, test within the
  user's authorized scope, publish a new version, and start that version.
- **Subject or environment error:** correct the cause, fetch current step detail,
  and retry the latest eligible failed or blocked attempt. Check the installed
  `retry_step` help for required attempt and request identifiers.
- **A fresh whole run is intended:** cancel an active or blocked source run
  before `rerun`. Rerun uses the source workflow versions; use `start` to select
  changed behavior.
- **Correct refusal:** report the unmet requirement and the work needed to meet
  it. Do not weaken the condition or repeat an unchanged attempt.

Retry eligibility says whether an action is allowed; it does not prove that a
retry will help. Change the cause first. Cancellation does not undo completed
external effects, and a missing reply does not prove that an action had no
result. Inspect uncertain effects before repeating a write.

When cancelling, retrying, or starting again, state the action and its reason.

Public reference: [Workflow MCP actions](https://valdr.ai/valdr/docs/valdr-mcp/workflows/).

<!--</instructions>-->
<!--</capability>-->
