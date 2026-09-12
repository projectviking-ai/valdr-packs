<!--<capability id="valdr-workflow.verdandi.operating" pack="valdr-workflow" role="workflow">-->
# Operating Runs

<!--<identity>-->
Proving, saving, starting, watching, re-running, and stopping workflow runs — including the identity and uniqueness rules that decide whether a start is even possible.
<!--</identity>-->

<!--<instructions>-->

## Before Anything Else: Which Server?

`pm_health` tells you which process you are talking to and when it started. If workflow source changed after that, the server is stale and its answers about contracts, runtime fields, and validation are unreliable — in both directions.

Do this first when a result surprises you. It is cheap, and it prevents the entire class of "the code says X but the tool says Y" investigations.

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

The uniqueness constraint is a **partial** index covering `pending`, `running`, `waiting`, and `blocked`. So:

- A `completed`, `failed`, or `cancelled` run **releases** the context. Just `start` again — no cancel needed.
- A `blocked` run does **not**. It still holds the context, but an eligible blocked step can move the same run back to `running` through `retry_step`.

For a failed or blocked step, inspect the run and retry only after fixing the cause:

```
pm_workflow { action: "get_run", runUlid, includeSteps: true }
pm_workflow { action: "retry_step", runUlid, stepKey, expectedAttempt, clientRequestId, reason }
```

Use `retryEligibilityByStepKey[stepKey]` from the first call; it records whether retry is allowed and the latest attempt to pass as `expectedAttempt`. Retrying without changing the failed input or condition simply blocks again.

When a fresh whole run is intended, `cancel` releases a blocked or still-active context and `rerun` starts again from the same source. A blocked run must be cancelled before `rerun`; completed, failed, and cancelled runs are already rerun-eligible. Neither action needs elevated identity, unlike deleting a run.

`rerun` replays the *source run's* definition version. When you have since published a newer version, cancel and `start` the new one instead.

## Watching A Run

```
pm_workflow { action: "get_run", runUlid }
pm_workflow { action: "get_run", runUlid, includeSteps: true, includeWaits: true, includeChildren: true }
pm_workflow { action: "events", runUlid, afterSeq, eventTypes }
pm_workflow { action: "list_runs", workflowKey, taskKey, status }
```

`includeSteps`, `includeWaits`, and `includeChildren` all default to **false**. The flagless call is the cheap status poll — just `run` and `loopProgress[]`, enough to know whether anything moved. Pass the flags for deep inspection, when you actually need step detail, wait records, or child runs.

`get_run` is the primary instrument. Read in this order:

1. `run.status` and `run.currentStepKey` — where it is.
2. `run.outputJson` — on a terminal run, the envelope with status, partial evidence, and error.
3. `steps[]` — each with `status`, `outputJson`, `errorJson`, and `gateEvidenceJson`.
4. `waits[]` — what it is waiting for and whether that wait resolved.
5. `children` — an object, not an array: `children.runs[]` for the child records, `children.byStatus` for the counts.
6. `loopProgress[]` — returned on every call, one entry per loop corridor: `currentPass`, `maxPasses`, `completedLoopBacks`, `lastRoute`. The only place that answers "how many times has this gone round".

Passing `includeSteps: true` explicitly also returns `attempts` — the full per-attempt history rather than the latest attempt per step. Reach for it when a step has been retried or has looped.

`includeDefinition: true` returns the definition the run actually froze, resolved by its own content hash. Use it instead of a second `get` call whenever a diagnosis needs the definition.

`run.dependencyRevisionsJson` records the exact content hash of every child workflow the run froze at start. That is what makes a run reproducible — but it is another opt-in field: pass `includeDependencies: true` to get it. Fetch it before you `rerun`, so you know which frozen revisions the new run will replay.

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

A workflow driver advances runs on its own — a run typically moves from `pending` through its steps without you calling `advance`. If a driver is active, do **not** also drive it manually: the same step can execute twice, leaving duplicate sessions.

No tool reports driver state. When nothing seems to be happening, poll `get_run` twice about thirty seconds apart and compare `run.updatedAt` and `run.status`. The flagless poll is enough for this — no include flags needed, so the check stays cheap even repeated. Reach for `includeSteps: true` only once you need to see which step statuses moved. If nothing moved and the run is `pending` or `running` — not `waiting` — then nothing is advancing it. Say so, and ask before calling `advance` yourself.

## Waits, Gates, And The Actions You Cannot Take Back

A `waiting` run is parked on a wait record. Waits resolve when their outcome arrives — a session turn finishing, a gated receipt parsing, a human approving, or a child run reaching terminal.

`pm_workflow input` publishes an outcome into a wait. Public input rejects `actor` and `actorHandle` and requires a callback token or trusted identity; it is not a way to bypass a gate.

**You cannot resolve a human gate.** It needs real human or operator identity. When a run parks on one, report the run ULID, the step key, and the gate's prompt, and tell the user to approve it in the Workflows → Runs console. Then keep watching.

**Three actions need a trusted operator and will refuse you outright**, whatever arguments you pass: `override_wait`, `restore_definition`, and `delete_definition` except in its `preview: true` form. They return `… requires trusted operator identity.` Do not retry them with more parameters — ask a human operator.

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
