<!--<capability id="valdr-workflow.tools.user-tools" pack="valdr-workflow" role="integration">-->
# Workflow Tools: Imported User Tools

<!--<identity>-->
Discover installed user actions, preserve their exact workflow pins and typed schemas, and interpret direct-call versus workflow execution evidence correctly.
<!--</identity>-->

<!--<instructions>-->

## Choose the invocation surface

| Surface | Contract |
| --- | --- |
| Direct agent call | `pm_user_tool` gateway with `search`, `describe`, or authorized `run`; success data is `data.result` |
| Workflow step | `kind: tool`, actual installed `tool.id` and action, complete frozen pin; success data is `$.normalized.data` |

Do not author `pm_user_tool/run` as a workflow step. A workflow calls the actual
installed ID, such as `valdr-tools.user.node`, not the gateway. Capability
documents describe actions; loading one does not install a tool or widen MCP
permissions. Importing a pack makes its tools available without executing them,
installing dependencies, or signing in to an external CLI.

## Discover and inspect narrowly

Use the in-session gateway if available. Hot-load `valdr.core.tools.pm-user-tool`
for full direct-call details:

```text
pm_user_tool { action: "search", query: "text summary" }
pm_user_tool {
  action: "describe",
  toolId: "valdr-tools.user.node",
  toolAction: "summarize"
}
```

Inspect the selected action's input/output schemas, revision, limits,
`execution`, `sideEffects`, and `retry`. `execution: unsupported` is not
executable. An available action can still lack a host runtime, credentials, or
working directory. Search and describe do not execute code.

Direct calls default to the most recently installed visible revision; the
Builder prefers the highest semantic version for new workflow steps. Select the
revision explicitly when needed. **Gateway `describe` omits `contentHash`**:
obtain the complete workflow pin from the Builder/catalog rather than inventing
a hash or assuming direct discovery supplies a full pin.

## Preserve all six pin fields

| Field in the step's `tool` block | Required value |
| --- | --- |
| `id` | Actual installed `<pack>.user.<name>` ID; legacy `user.<name>` only when actually installed |
| `action` | Exact selected manifest action ID |
| `revision` | Exact installed revision label |
| `contentHash` | Full selected `sha256:` content hash |
| `inputSchema` | Complete selected action input schema |
| `outputSchema` | Complete selected action output schema |

Copy that block intact from the selected installed revision. Do not shorten
schemas, replace them with `true` for convenience, omit properties, or guess the
hash. Valdr verifies the pin and retained files before execution. New imports do
not update existing workflow steps or past runs; review and select the new pin,
then save a new workflow version to upgrade.

## Inputs, cwd, and typed outputs

These are fields to put **beside the complete `tool` block** selected above for
the Node `summarize` action. The fragment deliberately omits the installation's
pin; it is not a complete executable step:

```yaml
key: summarize
name: Summarize text
kind: tool
cwd: "${workflow.inputs.workingDirectory}"
inputs:
  text: "${workflow.inputs.text}"
outputs:
  characters: "$.normalized.data.characters"
  words: "$.normalized.data.words"
  lines: "$.normalized.data.lines"
```

Declare the referenced workflow inputs; the returned counts are integers. A
later consumer declares `needs: [summarize]` and reads
`${steps.summarize.outputs.words}`. Exact references preserve numbers, booleans,
objects, arrays, and null; interpolation produces text. Action inputs must match
the pinned schema: Valdr does not coerce strings, insert defaults, or remove
extra fields. Schema defaults are annotations, not runtime substitutions.

For user tools, execution **`cwd` is a step field beside `tool` and `inputs`**,
unlike Command's `inputs.cwd`. An absolute override is used as-is; a relative
path resolves from the creating session's worktree, otherwise the project
repository, otherwise Valdr's starting directory. The directory must exist.
When the creating session has no worktree, provide an existing absolute cwd.
This selects a starting directory, not a sandbox.

The action's `inputs` remain its own data, including any fields it independently
names `action` or `cwd`. Valdr does not inject project keys, cwd, or workflow
context into that data. Declare and bind any context the action itself needs.
The program reads its actual directory through its language's standard API.

## Direct runs are different

A direct `pm_user_tool run` requires `toolId`, `toolAction`, nested object
`input` (including `{}` when appropriate), an existing absolute `cwd`, and a
fresh `clientRequestId` from `pm_generate_ulid`. It accepts no `actorHandle`.
Only execute when the user's task authorizes the action's effects.

Keep the ID for an identical repeat. A completed recorded invocation replays its
result without another process; conflicting arguments receive
`request_conflict`. An unresolved invocation returns `outcome_unknown`, which
does not start another process. Check `error.started` and
`error.needsAttention`. Reconcile external effects before intentionally issuing
a fresh ID. Direct success proves the action in that context, not workflow
bindings, output mappings, or control flow.

## Runtime and failure receipts

Each attempt starts a process with one JSON request on stdin: `protocolVersion`,
`toolId`, `toolRevision`, `action`, the supplied `input`, `operationId`, and
`attemptId`. The tool must emit exactly one JSON object on stdout and put logs
on stderr:

```json
{"ok":true,"data":{"characters":11,"words":2,"lines":1}}
```

```json
{"ok":false,"error":{"code":"invalid_text","message":"Text is required."}}
```

Handled failures still exit zero; a nonzero process exit is a crash and its
JSON envelope is not read. Success has only `ok`/`data`; failure has only
`ok`/`error`, with nonempty code/message. A wrapped CLI error may additionally
report `error.exitCode` and `error.signal`. Successful `data` must satisfy the
output schema. Command stdout is plain text; this user-tool protocol is the
separate mechanism that validates JSON into `$.normalized.data`.

Inspect the step's recorded error and attempt diagnostics when it fails.
Failed user-tool output mappings are not filled. Runs shows process or reported
child exit code/signal, but not the program's stderr. A tool may report a domain
result such as Maven's `result: failed` inside successful data; explicitly route
on that declared output instead of assuming every failed build is a tool error.

The manifest may set lower limits than the host maximum: 300 seconds, 1 MiB
request, 1 MiB result, and 1 MiB retained stderr. Oversized input fails before
starting. Timeout or oversized output triggers an attempt to stop the process.
Oversized stderr is not retained. Tools use host permissions; external or
detached work may outlive cancellation.

## Retry and uncertain effects

An ordinary workflow retry keeps `operationId` and changes `attemptId`; a new
run or loop iteration gets a new operation ID. A tool should deduplicate writes
by operation ID, never attempt ID. Declarations of `sideEffects` and `retry`
must describe the real action, including subprocess or external effects.

- Idempotent failures may be retried when the runtime permits it.
- If `retry: manual` or `sideEffects: unknown` fails after starting, including a
  handled error or interruption, the step blocks with **needs attention** and
  offers no Retry step. Pre-start failures may remain retryable.
- An unconfirmed interrupted attempt needs attention even for an idempotent
  action. A confirmed successful saved result is reused after restart.
- If the original inputs cannot be recovered, reconcile before a new run.

Cancellation cannot undo completed writes. Check the external system, reconcile
what happened, then cancel and start a new run only if the remaining work is safe
and authorized. Do not add automatic write retries to hide uncertainty.

## Packaging and host prerequisites

Changes to a manifest or inventoried file require a new tool revision. Keep
files in the owning pack and validate with `valdr validate-pack`; packaging and
validation do not run code. Listed files are retained and verified, while
external runtimes, CLI versions, dependencies, and sign-ins belong to each host.

The process receives a small baseline environment plus manifest-requested
`process.inheritEnv` names. Keep secrets in the host environment or CLI sign-in,
not manifests or saved inputs. Successful `data` is not redacted by Valdr;
recorded-input/error/log redaction is best effort. Tool authors must remove
credentials before emitting results.

Test invalid inputs without effects, successful and malformed output, missing
host dependencies, cwd outside the tool source directory, timeouts/cancellation,
retry semantics, and old pins after upgrades. A direct stdin test checks the
program; an isolated workflow run also checks pin verification, bindings,
environment, mappings, and recovery. Never rerun an uncertain write merely to
capture its stderr.

## Anti-patterns

- Authoring the gateway `pm_user_tool/run` instead of the installed tool ID.
- Inventing hashes or simplifying the selected action's schemas.
- Confusing workflow `$.normalized.data` with direct-call `data.result`.
- Putting execution cwd inside action inputs or assuming project context is injected.
- Assuming an import installed the runtime, authenticated a CLI, or upgraded old pins.
- Coercing typed inputs by interpolation or expecting schema defaults to be inserted.
- Treating cancellation, timeout, or a lost response as proof no write occurred.

Public references: [User-tool steps](https://valdr.ai/valdr/docs/workflows/steps/user-tool/),
[runtime](https://valdr.ai/valdr/docs/workflows/user-tools/runtime/),
[manifest](https://valdr.ai/valdr/docs/workflows/user-tools/manifest/),
[packaging](https://valdr.ai/valdr/docs/workflows/user-tools/package-and-run/),
[testing](https://valdr.ai/valdr/docs/workflows/user-tools/testing/).

<!--</instructions>-->
<!--</capability>-->
