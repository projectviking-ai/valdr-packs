<!--<capability id="valdr-workflow.tools.command" pack="valdr-workflow" role="integration">-->
# Workflow Tool: Command

<!--<identity>-->
Author and inspect built-in Command steps with the correct inputs, string output contract, execution context, and recovery boundaries.
<!--</identity>-->

<!--<instructions>-->

## Select the action

Use `kind: tool` with `tool: { id: command, action: run }` for a trusted,
non-interactive shell command. Multiline commands and pipelines are supported.
This is a built-in workflow action, not an imported user tool or a capability
named `command`. It needs no user-tool revision, hash, or schema pin.

Use a pinned user tool when reusable code needs a typed action contract and
portable files. Hot-load `valdr-workflow.tools.user-tools` for that path.

## Inputs and execution context

| Field under `inputs` | Contract |
| --- | --- |
| `command` | Required shell command string |
| `cwd` | Optional absolute directory or path relative to the selected execution base |
| `sourceSessionUlid` | Optional existing agent session whose worktree supplies that base |
| `timeoutSeconds` | Optional seconds; default `300`, `0` disables the timer |
| `env` | Optional object of string environment overrides, such as `{ CI: "true" }` |

For Command, `cwd` belongs in **`inputs.cwd`**. An omitted or relative directory
resolves from the selected session worktree, the run's creating session
worktree, or the registered project repository. Confirm that the chosen
directory exists on the workflow host. A working directory selects where the
process starts; it does not contain its access. Absolute paths, symlinks, and
relative `..` segments can lead outside the repository.

Commands inherit a filtered host environment. Override variables under
`inputs.env`; names use letters, digits, and underscores, cannot start with a
digit, and values must be strings without NUL characters. Quote YAML booleans
and numbers. Set `NODE_ENV` explicitly if needed. These values are saved in the
definition, so inherit credentials from the host instead of placing secrets in
the workflow.

## Minimal example and output mappings

```yaml
- key: probe
  name: Produce a receipt
  kind: tool
  tool: { id: command, action: run }
  inputs:
    command: "printf '%s' 'ready'"
    timeoutSeconds: 5
  outputs:
    ok: "$.normalized.ok"
    receipt: "$.normalized.stdout"
```

The normalized receipt includes `status`, `ok`, `exitCode`, `signal`, `stdout`,
`stderr`, `durationMs`, and resolved `cwd`. Output also records byte counts and
truncation flags; captured stdout and stderr are each limited to 1 MiB. Inspect
the returned contract before mapping additional diagnostic fields.

`$.normalized.stdout` is a **string**, even if the command printed a number or
JSON. It does not become an object at `$.normalized.stdout.someField`. Use a
supported parsing operation or a typed user tool if downstream steps need
structured data. A literal `printf` receipt needs no JSON parser.

Later consumers declare `needs: [probe]` and use
`${steps.probe.outputs.receipt}`. An exact reference preserves the mapped type;
surrounding text converts it to a string. `ok` is boolean, not the text `"true"`.

Object interpolation, including `" ${steps.probe.outputs.receipt}"`, renders YAML,
not JSON. Do not pass it to `JSON.parse` or `json.loads`. Command environment
values are strings: bind scalar fields or an already serialized JSON string;
otherwise require an available safe YAML parser for the interpolated text.
An exact object reference preserves the object and does not turn it into a
valid environment string.

For a repository check after an implementation session, put
`sourceSessionUlid: "${steps.implement.outputs.sessionUlid}"` in `inputs` and
declare `needs: [implement]`. Do not assume the agent's current shell directory
is the workflow's directory.

For an artifact read, select the producing session's worktree and return the
actual file bytes on stdout. Guard `$.normalized.stdoutTruncated: false` before
treating the capture as a complete document. Keep a dynamic path out of shell
source; pass it as a quoted argument through `inputs.env` and enforce the
intended path boundary. Hot-load `valdr-workflow.tools.valdr` for the complete
artifact-read and VMP Markdown validation pattern.

## Failure, retry, and cancellation

A zero exit produces `ok: true`. Nonzero exit, timeout, signal, or cancellation
produces `ok: false` and follows the step's failure policy. Inspect the attempt's
error and receipt; a following condition is not a substitute for handling a
tool failure that already stopped the run. Preserve validation and execution as
separate claims: validation does not run the command or check host dependencies.

An eligible manual Command retry may use reviewed saved changes to `command`,
`cwd`, `timeoutSeconds`, and `env` under the same workflow key and version. It
does not change the frozen graph, dependencies, output mappings, or
`sourceSessionUlid`. Use the retry preview's `expectedContentHash` to reject
stale reviews. Hot-load `valdr.core.tools.pm-workflow` for the current retry API.

Stopping a command targets that exact active attempt and retains partial output.
The workflow blocks by default or fails with `onFailure.action: fail`. Manual
retry depends on the latest attempt and a safe error category; an authored
`retry.maxAttempts` is not a manual recovery cap or automatic backoff schedule.
Retrying can repeat side effects; cancellation does not undo them.

Commands run on macOS/Linux as the workflow host user and are not sandboxed.
Run only authorized commands. Output redaction is best effort; keep credentials
out of command output and review evidence before sharing it.

## Anti-patterns

- Searching capability names to decide whether the built-in action exists.
- Using a user-tool pin for `command/run`, or putting Command cwd beside `inputs`.
- Treating stdout as parsed JSON or an untruncated transcript.
- Saving secrets in `inputs.env` or claiming cwd contains host access.
- Bypassing a stopped attempt with a new command before reconciling effects.
- Calling a workflow tested because its definition validated.

Public reference: [Command steps](https://valdr.ai/valdr/docs/workflows/steps/command/).

<!--</instructions>-->
<!--</capability>-->
