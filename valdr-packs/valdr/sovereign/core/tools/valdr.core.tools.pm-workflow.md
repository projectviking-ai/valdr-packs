<!--<capability id="valdr.core.tools.pm-workflow" pack="valdr" role="integration">-->
# Tool: pm_workflow

Workflow definition and run operations. Use this tool to find, read, validate, prove, and register workflow definitions, and to start, watch, unblock, and stop the runs they produce.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|--------|---------|-----------------|
| `list` | Find registered workflows; `detail: 'summary'` (default) omits inputs/outputs/sourceRelpath, `'full'` includes them; `latestOnly: true` returns one head row per workflowKey | — |
| `get` | Fetch one definition | one of `workflowKey`, `capabilityKey`, `contentHash` |
| `validate` | Check a definition's shape | one of `definitionYaml`, `definitionJson`, `capabilityKey` |
| `test_definition` | Create and drive a run from an **unsaved** definition | `clientRequestId` + `definitionYaml` or `definitionJson` |
| `save_definition` | Register a definition under its pack | `definitionYaml` or `definitionJson` |
| `delete_definition` | Retire an exact version (**trusted operator only**) | `workflowKey`, `version`, `expectedContentHash`; a real retirement also needs `actorHandle`, `reason`, `clientRequestId` |
| `restore_definition` | Restore a retired version (**trusted operator only**) | `workflowKey`, `version`, `expectedContentHash`, `actorHandle`, `reason`, `clientRequestId` |
| `start` | Create a run from a registered definition | `workflowKey`, `clientRequestId` + `version` or `contentHash` |
| `rerun` | Start a fresh run from a terminal one | `sourceRunUlid`, `clientRequestId` |
| `get_run` | Inspect a run; compact by default, pass include flags for detail | `runUlid` |
| `list_runs` | Search runs | — |
| `events` | Read replayable run events | `runUlid` |
| `advance` | Advance a ready or waiting run | `runUlid` |
| `input` | Record approval or callback input into a wait | `runUlid`, `stepKey`, `kind`, `outcome`, `clientRequestId` |
| `override_wait` | Audited override of a stuck wait (**trusted operator only**) | `runUlid`, `stepKey`, `outcome`, `actorHandle`, `reason`, `clientRequestId` |
| `retry_step` | Retry a failed step | `runUlid`, `stepKey`, `clientRequestId` |
| `cancel` | Cancel a run | `runUlid`, `clientRequestId` |
| `delete_run` | Permanently delete a run tree | `runUlid`, `actorHandle`, `reason`, `clientRequestId` |
| `help` | Show tool help; supports `topic` (an action name, or `'all'`) to filter actions/whenToUse/examples to one action | — |

## Usage Patterns

**Look up one action instead of reading everything:**
```
pm_workflow { action: "help", topic: "get_run" }
```
`topic` accepts an action name or `'all'`. A single-action `topic` filters `actions`, `whenToUse`, and `examples` down to that one action; omitting `topic` (or passing `'all'`) returns the full help payload.

**Validate before anything else:**
```
pm_workflow {
  action: "validate",
  definitionYaml: "<yaml>",
}
```
`validate` applies strict validation automatically; no `strict` option is accepted. `allowAdvancedKinds: true` accepts non-normative composition for authoring only — never for something you intend to run.

**Prove it runs, without registering it:**
```
pm_workflow {
  action: "test_definition",
  definitionYaml: "<yaml>",
  taskKey: "PROJ-123",
  actorHandle: "<initiator>",
  inputs: { ... },
  clientRequestId: "<ulid>",
}
```
Validates strictly, then creates and drives a **durable run** from the unsaved definition and returns `run`, `drive`, `stepResults`, and `validation`. Side effects are real — sessions launch, tasks change. Use a disposable subject.

**Register it:**
```
pm_workflow {
  action: "save_definition",
  packKey: "<pack>",
  capabilityKey: "<pack>.workflow.<name>",
  sourceRelpath: "workflows/<area>/<key>.workflow.yaml",
  definitionYaml: "<yaml>",
}
```
Saving validates strictly. `start` also re-validates strictly and refuses a definition that fails. Overwriting an existing version requires `overwrite: true` **and** `expectedContentHash` together; prefer bumping the version.

**Start a run:**
```
pm_workflow {
  action: "start",
  workflowKey: "<pack>.<area>.<name>",
  version: "0.1.0",
  taskKey: "PROJ-123",
  actorHandle: "<who is acting>",
  inputs: { ... },
  clientRequestId: "<ulid>",
}
```
`clientRequestId` must be a fresh ULID from `pm_generate_ulid` and is the idempotency key. `contextRef` is derived from the subject for task-scoped starts — do not set it. A workflow holds only one **active** run per context: the partial unique index covers `pending`, `running`, `waiting`, and `blocked`. A `completed`, `failed`, or `cancelled` run releases the context and a fresh start just works; a `blocked` one does not, even though it is terminal.

**Inspect a run:**
```
pm_workflow {
  action: "get_run",
  runUlid: "<ulid>",
  includeSteps: true,
  includeWaits: true,
  includeChildren: true,
  includeDefinition: true,
}
```
`includeSteps`, `includeWaits`, and `includeChildren` all default to **false**. With no include flags, `get_run` returns only `run` and `loopProgress[]` — a cheap status poll. Each collection appears only when its flag is set: `includeSteps: true` adds `steps[]`, plus `attempts` (full per-attempt history) and `retryEligibilityByStepKey`; `includeWaits: true` adds `waits[]`; `includeChildren: true` adds `children` (an object: `byStatus`, `runs[]`, `page`). `includeDefinition: true` returns the exact revision the run froze, resolved by its own content hash — the correct way to read what a run actually executed. `includeDependencies: true` adds the frozen `dependencyRevisionsJson` pin map to the run (and to child rows, if `includeChildren` is also set) — fetch it before `rerun`.

**Read a definition by the bytes that ran:**
```
pm_workflow { action: "get", contentHash: "sha256:..." }
```
The head at a key and version may have been re-saved since a run started. `contentHash` pins the exact revision.

**Repeat a run:**
```
pm_workflow { action: "cancel", runUlid, clientRequestId, reason }
pm_workflow { action: "rerun", sourceRunUlid, clientRequestId, actorHandle }
```
Only `completed`, `failed`, and `cancelled` runs are rerun-eligible; a `blocked` run must be cancelled first. `rerun` replays the source run's frozen definition revision — to run a newer version, cancel and `start` it.

## Notes

- **Definitions are immutable per version.** Callers pin exact versions and a root run freezes the content hash of every child workflow it uses, so editing a child does not disturb a run in flight. Changing behaviour means a new version plus every caller that pins the old one.
- **`input` is not a gate bypass.** Public `input` rejects `actor` and `actorHandle` and requires a callback token or trusted internal authority. Human gates require real human or operator identity.
- **Three actions are unreachable from this tool.** `override_wait`, `restore_definition`, and `delete_definition` (except with `preview: true`) require a server-bound trusted operator identity that the public handler never supplies. They return `… requires trusted operator identity.` regardless of the arguments passed. Do not retry them with more parameters — ask a human operator.
- **`delete_definition` retires, it does not erase.** `preview: true` shows blockers and is the one form the public tool will answer. Existing runs keep their frozen revision. `delete_run` is the destructive one and is callable — it needs actor, reason, and idempotency key.
- **Idempotency.** Every mutating action takes `clientRequestId`; reuse the same value to retry safely, and generate a fresh one for a genuinely new operation.
- **`events` filters.** `eventTypes`, `afterSeq`, `limit`, and `includePayload` are all available — unlike `pm_session events`, this one can be narrowed. Payloads are opt-in (`includePayload: true`); default responses carry the event skeleton only.

<!--</instructions>-->
<!--</capability>-->
