# Manifest and one-shot process contract

Validate manifests with `valdr validate-pack`. See the [custom-tool documentation](https://valdr.ai/valdr/docs/workflows/user-tools/) for the manifest and runtime reference.
The canonical starters are `valdr-packs/valdr-tools/tools/` in this repository.

## Artifact

Put a `*.tool.yaml` (preferred), `*.tool.yml` or `*.tool.json` manifest under a pack's `includes` path.
Use YAML for maintained manifests; the stdin/stdout wire protocol below remains JSON.
Required top-level fields are `schemaVersion: 1`, `id`, `revision`, `name`, `description`,
`files`, `process`, `limits` and nonempty `actions`. Unknown fields are rejected.

- IDs use pack-first naming: `<pack>.user.<name>`, such as `valdr-tools.user.acli`. Legacy `user.*` IDs remain readable for existing workflow pins; author new tools with the pack name first. Revisions identify immutable authored content.
- Optional top-level `icon` names a Heroicon, such as `code-bracket` for Node. Names use lowercase letters, digits and hyphens, at most 64 characters. The UI supports `command-line`, `code-bracket`, `code-bracket-square`, `variable`, `cube`, `cpu-chip`, `server-stack`, `cloud`, `ticket` and `document-text`; omitted or unknown names use the default tool icon. Each tool ID appears under its `name` in the Builder library. An icon change changes artifact identity and needs a new revision after import.
- `files` explicitly inventories `{path, executable?}` relative to the manifest directory.
  No parent traversal, symlinks, absolute asset paths, or other tool manifests.
- `process` declares `executable`, literal `args`, and optional `inheritEnv` names.
  Omit `process.cwd`; its optional legacy value is ignored. Workflow context selects the
  working directory, with an optional step-level override. Exact inventoried file arguments
  become absolute paths under the retained tool root; other arguments remain literal.
  A relative executable must be inventoried with `executable: true`.
  A host command on PATH is a prerequisite, not an installation request.
- `limits` requires positive integer `timeoutSeconds`, `maxInputBytes`, `maxResultBytes`, `maxLogBytes`.
  The host caps execution at 300 seconds and each stream/request limit at 1 MiB.
- Each action declares stable `id`, nonempty catalog `path`, `name`, `description`,
  `inputSchema`, `outputSchema`, `execution`, `sideEffects` and `retry`.
  Action IDs and paths are unique within the tool. IDs are stable identifiers;
  a path is a catalog presentation path, not executable shell text.
- `execution: unsupported` requires a concrete `unsupportedReason`; a supported action omits it.
  Use `sideEffects: read|write|unknown` and `retry: manual|idempotent` honestly.

Schemas use the supported strict JSON Schema 2020-12 subset. Input is an object;
output validates the successful `data` value and may be a schema object or boolean.
Prefer a useful typed output; `true` means JSON pass-through with no stable field guarantee.
Refs must be self-contained JSON Pointers to inspected schema locations. Remote refs,
resource `$id`, anchors, dynamic refs, custom keywords and OpenAPI `nullable` are rejected.
Use `type: ["string", "null"]` for a nullable string. YAML must represent one JSON-compatible
value: no duplicate keys, non-finite numbers, custom types or cycles.

## Protocol

The engine writes one JSON request to stdin and closes it. In these examples, replace `<revision>` with the revision from the starter’s `summary.tool.yaml`:

```json
{"protocolVersion":1,"toolId":"valdr-tools.user.node","toolRevision":"<revision>","action":"summarize","input":{"text":"Hello Valdr\nTools are ready."},"operationId":"local-example-operation","attemptId":"local-example-attempt-1"}
```

Run this request with the Node starter from its tool directory:

```sh
printf '%s\n' '{"protocolVersion":1,"toolId":"valdr-tools.user.node","toolRevision":"<revision>","action":"summarize","input":{"text":"Hello Valdr\nTools are ready."},"operationId":"local-example-operation","attemptId":"local-example-attempt-1"}' | node main.mjs
```

Exactly one success envelope goes to stdout, with process exit zero:

```json
{"ok":true,"data":{"characters":28,"words":5,"lines":2}}
```

A domain failure uses this envelope (no success data):

```json
{"ok":false,"error":{"code":"not_found","message":"The requested resource does not exist."}}
```

Logs go to stderr. Nonzero exit, malformed/multiple stdout results, timeout,
size overflow or output-schema mismatch are failures even if a success envelope was emitted.
The workflow sees success at `$.normalized.data`; failures have no normalized success data.
Use literal argv and explicit schemas rather than accepting a shell command string.
`input` contains authored action input only; operation/attempt metadata is outside it.
The JSON request has no project key, working directory or other workflow context.

## Working directory and environment

Optional `cwd` belongs on the workflow step alongside `tool` and `inputs`, never inside
an action input. It accepts expressions. Absolute paths override the directory; relative
paths resolve from the workflow session worktree or project repository. When omitted,
use that base, falling back to the authority process cwd if there is no workflow directory.
The tool root still resolves inventoried executables and file arguments.

Manifest `process.inheritEnv` names are inherited directly from the host when present;
internal and unsafe names are filtered. The baseline includes PATH, HOME, TMPDIR, LANG
and LC_*. Host permissions and existing CLI credentials apply, like a Command step;
working-directory selection and environment filtering do not provide an OS sandbox.

## Writes and retries

`operationId` is stable for an ordinary retry of the same logical operation and frozen
request. `attemptId` is unique per process attempt. Explicit reruns and distinct loop
iterations are new operations, even if the authored input looks identical.

A write is `idempotent` when repeating the same request is safe: either its downstream API
or durable reconciliation mechanism reliably deduplicates the same operation, or the write
converges, so running it again overwrites the same outputs (for example, a build writing to
`target/`). Pass `operationId` as the idempotency key when the downstream API supports that
contract; do not use `attemptId` for deduplication. If neither holds, declare
`retry: manual`. Mark unknown effects `unknown`. The declaration is the tool's default;
users adapt it in their copy to fit their own process, as the Maven starter's `build` shows.

After a manual/unknown action starts, failure or interruption may mean an external write
succeeded. Treat `needs_attention` as a reconciliation task: inspect the external system
for the original operation, record evidence, then choose the supported recovery action.
Do not auto-repeat an uncertain write. Stale in-flight user-tool claims also need attention;
there is no generic process-resume guarantee. Previously saved successful results replay
without spawning the tool again. Cancellation cannot roll back external effects.
