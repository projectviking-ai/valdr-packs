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
| `delete_definition` | Preview retirement blockers for an exact version | `workflowKey`, `version`, `expectedContentHash`, `preview: true` |
| `start` | Create a run from a registered definition | `workflowKey`, `clientRequestId` + `version` or `contentHash` |
| `rerun` | Start a fresh run from a terminal one | `sourceRunUlid`, `clientRequestId` |
| `get_run` | Inspect a run; compact by default, pass include flags for detail | `runUlid` |
| `list_runs` | Search runs | — |
| `events` | Read replayable run events | `runUlid` |
| `advance` | Perform one ready transition | `runUlid` |
| `input` | Record a callback for an open await-condition step | `runUlid`, `stepKey`, `waitUlid`, `kind: callback`, `outcome`, `callbackToken`, `clientRequestId` |
| `retry_step` | Retry the latest eligible failed or blocked attempt | `runUlid`, `stepKey`, `expectedAttempt`, `clientRequestId`; check action help for attribution fields |
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
`validate` applies strict validation automatically. Resolve errors and review
warnings before running the definition.

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
Validates strictly, then creates and drives a durable run from the unsaved
definition and returns its results. Side effects are real: sessions launch and
tasks change. Use a disposable subject within the authorized execution scope.

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
Use a unique `clientRequestId` for each new run; `pm_generate_ulid` can supply
one. Reuse it only when repeating the same start request after an interrupted
response. A workflow permits one active run per subject. A pending, running,
waiting, or blocked run prevents another start for that subject; inspect it
before choosing recovery or a deliberate restart.

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
The default response is compact enough for polling. Opt into step, wait, or child
details with the matching include flag. `includeAcceptedInputs: true` adds
accepted callback and gate evidence; `includeDefinition: true` includes the
definition revision used by this run; `includeDependencies: true` shows its
selected child-workflow versions. Request only the details needed for the
diagnosis, and avoid logging callback tokens or sensitive agent output.

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
- **Callback input is not human approval.** Use `input` only for a supported
  await-condition callback with the token issued for that wait. Human approval
  and Questions gates resolve through Valdr UI.
- **Retire and restore in Valdr UI.** Use `delete_definition` with `preview: true`
  to inspect retirement blockers. Existing runs retain their selected revision.
- **Run deletion is permanent.** `delete_run` removes closed workflow history
  and needs the registered actor, reason, and request ID. Inspect the target
  run tree before using it.
- **Idempotency.** Every mutating action takes `clientRequestId`; reuse the same value to retry safely, and generate a fresh one for a genuinely new operation.
- **`events` filters.** `eventTypes`, `afterSeq`, `limit`, and `includePayload` are all available — unlike `pm_session events`, this one can be narrowed. Payloads are opt-in (`includePayload: true`); default responses carry the event skeleton only.

Public reference: [Workflow MCP actions](https://valdr.ai/valdr/docs/valdr-mcp/workflows/).

<!--</instructions>-->
<!--</capability>-->
