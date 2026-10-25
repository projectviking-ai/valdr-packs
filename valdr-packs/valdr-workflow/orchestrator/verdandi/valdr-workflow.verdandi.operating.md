<!--<capability id="valdr-workflow.verdandi.operating" pack="valdr-workflow" role="workflow">-->
# Operating Runs

<!--<identity>-->
Proving, saving, starting, watching, re-running, and stopping workflow runs — including the identity and uniqueness rules that decide whether a start is even possible.
<!--</identity>-->

<!--<instructions>-->

## Confirm the connected installation

When a result contradicts the documentation, use `pm_health` to confirm the
connected Valdr version and load scoped action help. Check the installed workflow
and tool versions before changing the definition.

## Validate, Then Prove, Then Save

Three calls, three different claims. Never collapse them.

```
pm_workflow { action: "validate", definitionYaml: "..." }
pm_workflow { action: "test_definition", definitionYaml: "...", taskKey, actorHandle, inputs, clientRequestId }
pm_workflow { action: "save_definition", packKey, capabilityKey, sourceRelpath, definitionYaml }
```

**`validate`** checks shape against registered contracts. It is not evidence that anything runs.

**`test_definition`** is how you get that evidence without publishing anything. It validates strictly, then creates and drives a durable run from the **unsaved** definition, and returns the run, the drive log, and per-step results. This is the answer to your own rule that a validated workflow has not been shown to run — reach for it before `save_definition`, not after.

It creates a real run with real side effects: sessions launch, tasks change, agents cost money. Run it against a disposable subject, and say that you ran it.

**`validate` and `save_definition`** apply strict validation automatically. `start` re-validates the stored definition strictly and refuses a definition that fails.

To overwrite an existing version you must pass `overwrite` and `expectedContentHash` together; neither works alone. Prefer bumping the version to overwriting: callers pin exact versions, and a silently changed definition breaks reproducibility.

## Starting A Run

```
pm_workflow {
  action: "start",
  workflowKey, version,
  taskKey,                 # when task-scoped
  actorHandle: "verdandi",
  clientRequestId: "<ulid>",
  inputs: { ... }
}
```

**`clientRequestId`** is required and must be a fresh ULID — generate one with `pm_generate_ulid`. It is the idempotency key.

**`actorHandle`** is whoever performs the action. When you start a run, that is you: pass `verdandi`. A human asking you to start it does not make them the actor. If an executable step needs an actor and none is supplied, start validates the registered `pm` fallback before creating the run.

**`contextRef` is derived** from the subject; you cannot set it for a task-scoped start.

## One Active Run Per Workflow Per Subject

A workflow may have only one run in `pending`, `running`, `waiting`, or `blocked`
for the same subject:

- A `completed`, `failed`, or `cancelled` run **releases** the context. Just `start` again — no cancel needed.
- A `blocked` run does **not**. It still holds the context, but an eligible blocked step can move the same run back to `running` through `retry_step`.

For a failed or blocked step, inspect the run and retry only after fixing the cause:

```
pm_workflow { action: "get_run", runUlid, includeSteps: true }
pm_workflow { action: "retry_step", runUlid, stepKey, expectedAttempt, clientRequestId, reason }
```

Check the returned retry eligibility and use the latest eligible attempt as
`expectedAttempt`. Retrying without changing the failed input or condition
simply blocks again.

When a fresh whole run is intended, `cancel` releases a blocked or still-active context and `rerun` starts again from the same source. A blocked run must be cancelled before `rerun`; completed, failed, and cancelled runs are already rerun-eligible. Neither action needs elevated identity, unlike deleting a run.

`rerun` replays the *source run's* definition version. When you have since published a newer version, cancel and `start` the new one instead.

## Watching A Run

```
pm_workflow { action: "get_run", runUlid }
pm_workflow { action: "get_run", runUlid, includeSteps: true, includeWaits: true, includeChildren: true }
pm_workflow { action: "events", runUlid, afterSeq, eventTypes }
pm_workflow { action: "list_runs", workflowKey, taskKey, status }
```

`get_run` is compact by default. Use it for polling; request detail only when
investigating a change or stop:

1. Read the run's current status and stopping step.
2. Inspect its declared results and any terminal error.
3. Request `includeSteps: true` for step outcomes and recovery information.
4. Request `includeWaits: true` for outstanding decisions or callbacks.
5. Request `includeChildren: true` for child workflow outcomes.
6. Read loop progress when the workflow contains a bounded review corridor.

Request `includeAcceptedInputs: true` only when accepted callback or gate
evidence is relevant. Avoid logging tokens or sensitive agent output.

`includeDefinition: true` returns the definition the run actually froze, resolved by its own content hash. Use it instead of a second `get` call whenever a diagnosis needs the definition.

Pass `includeDependencies: true` to inspect the child-workflow versions selected
for the run. Check them before `rerun`, which reuses those versions.

## Run Statuses

| Status | Meaning |
|---|---|
| `pending` | Created, not yet advanced |
| `running` | Advancing |
| `waiting` | Parked on a wait — a session turn, a gate, a human, or a child run |
| `blocked` | Stopped on a refusal or required fix; an eligible step can be retried in place |
| `failed` | Stopped and treated as an error; an eligible step can be retried in place |
| `completed` | Finished, outputs mapped |
| `cancelled` | Stopped deliberately |

`blocked` does not resume by itself. After fixing the cause, retry an eligible step in place or cancel and re-run when the whole run must restart.

## Driving

Runs normally progress automatically. Poll `get_run` for current status before
advancing manually. A waiting run needs its expected input, not repeated calls
to `advance`.

If a run remains pending or running, inspect step detail and the current action
help. `advance` performs one ready transition. Use it only when manual progress
is intended, and stop when the run waits or reaches a terminal state.

## Waits, Gates, And The Actions You Cannot Take Back

A `waiting` run is parked on a wait record. Waits resolve when their outcome arrives — a session turn finishing, a gated receipt parsing, a human approving, or a child run reaching terminal.

`pm_workflow input` records a supported callback outcome for an open
`await_condition` step using its callback token. Follow the installed input
contract; it cannot supply a human approval or answer.

**You cannot resolve a human gate.** It needs real human or operator identity. When a run parks on one, report the run ULID, the step key, and the gate's prompt, and tell the user to approve it in the Workflows → Runs console. Then keep watching.

Use Valdr UI for operator decisions and workflow retirement or restoration.
Through MCP, `delete_definition { preview: true }` previews retirement blockers;
it does not retire the definition.

`cancel`, `rerun`, `retry_step`, and `delete_run` you *can* call. `delete_run` erases a run tree permanently. Say what you are about to do and why, before you do it.

## Sessions A Workflow Launches

A workflow-launched session belongs to the run. Inspect it like any other:

```
pm_session { action: "get", sessionUlid }
pm_audit  { action: "events", sessionUlid, textMaxLength, includePayloadJson: false }
```

The session's final message is what a `session_output` gate parses. When a gate reports invalid output, read that message — the answer is almost always visible there.

Sessions collide on task context, role, and target agent while an earlier one is open or merely idle. A workflow that launches the same agent twice for one task should close each session as its turn ends — `config: { keepAliveMs: 0, sessionIdleCloseMs: 0 }` on the launch.

## Changing A Live Workflow

Definitions are versioned and callers pin exact versions. So:

- Editing behaviour means a **new version**, plus updating every caller that pins the old one.
- A root run freezes its children's hashes, so a run in flight is unaffected by your edit.
- Retiring a version is a lifecycle operation, not a delete. `delete_definition { preview: true }` shows you the blockers and is the only form you can call; the retirement itself needs a trusted operator. Existing runs keep their frozen revision.

<!--</instructions>-->
<!--</capability>-->
