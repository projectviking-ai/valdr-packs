<!--<capability id="valdr.core.tools.pm-user-tool" pack="valdr" role="integration">-->
# Tool: pm_user_tool

Discover and invoke visible installed user tools through Valdr MCP without creating a workflow, project record, or managed session. Requires a server exposing `pm_user_tool` and Sovereign access.

<!--<instructions>-->

## Actions

| Action | Purpose | Required Params |
|---|---|---|
| `help` | Read gateway usage, examples, cautions, and compatibility notes | — |
| `search` | Find installed tool actions; omit `query` to browse | — |
| `describe` | Read one action's exact schemas and effective runner limits | `toolId`, `toolAction` |
| `run` | Execute one supported installed action | `toolId`, `toolAction`, object `input`, absolute `cwd`, `clientRequestId` |

`help` accepts only `{ action: "help" }`; it returns the standard structured tool-help payload. `search`, `describe`, and `run` return `{ action, ok, data }` on success or `{ action, ok: false, error }` on failure, in both structured content and JSON text. Failures set `isError: true`; failed runs can also include execution metadata in `data`.

## Discover, Describe, Run

```json
{"action":"help"}
```

```json
{"action":"search","query":"text summary","limit":20}
```

```json
{"action":"describe","toolId":"valdr-tools.user.node","toolAction":"summarize"}
```

```json
{"action":"run","toolId":"valdr-tools.user.node","toolAction":"summarize","input":{"text":"Hello Valdr"},"cwd":"/absolute/project/path","clientRequestId":"<fresh ULID>"}
```

Use IDs returned by the live catalog; the example requires the Node starter to be installed. Inspect `availability`, `sideEffects`, `retry`, and the described schemas before running. Search and describe execute no user program. An `available` action can still fail at run time if its host executable or declared environment is unavailable.

- **Search:** optional `query`, exact `toolId`, `revision`, `offset` (default 0), and `limit` (default 20, maximum 100). Every case-insensitive query word must match the tool/action metadata or action path. `data.hits` contains one hit per selected tool/action, with the selected `revision`; `total` and nullable `nextOffset` support pagination. Pages read a live catalog. Unsupported actions remain visible with `availabilityReason`.
- **Describe:** optional `revision`; returns selected revision, action metadata, `inputSchema`, `outputSchema`, and effective `limits`. Use these schemas directly. Unsupported actions can be described but cannot run.
- **Run:** optional `revision` and integer `timeoutSeconds` from 1 to 300. Omission uses the manifest timeout; an override can only shorten manifest and host limits. `data.result` is the validated action result. Metadata includes the selected revision, canonical directory, effective timeout, request/operation/attempt IDs, bounded diagnostics, and `replayed`.

`toolAction` names the authored action; gateway `action` selects the operation above. Authored fields named `action`, `cwd`, or `timeoutSeconds` belong inside `input` when required by the described schema. Gateway `cwd` is a required existing absolute directory; it has no process-directory fallback. Unknown or action-inappropriate gateway fields are rejected. Do not send `actorHandle`, project/session context, content hashes, schemas, shell text, executable overrides, or environment overrides as gateway fields.

## Version Selection and Repeat Requests

Search, describe, and a new run select the most recently installed **visible** revision by default, not the highest semantic version. Optional `revision` selects a version label. Responses identify the selected revision; pass it to a later call when you want that label. Approved overwrite can replace bytes under the same label, so this does not guarantee identical describe-to-run bytes. Hashes remain internal. Describe and run fail for a missing requested revision or an action absent from the selected revision, without falling back to an older version. Search includes only tools with the selected revision.

Generate a fresh `clientRequestId` with `pm_generate_ulid` for a new operation. Repeating that ID keeps the original artifact and effective timeout. Send the same tool/action, input, directory, and compatible revision/timeout: a recorded terminal result replays with `replayed: true`; changed invocation data returns `request_conflict`. On a repeat, omitted revision/timeout retain the original selection; supplied values must match it.

`outcome_unknown` means a claim exists without a durable terminal result. It may still be running or may have lost its owner. Repeating the request never starts another process. Reconcile its outcome and external effects before deliberately using a fresh ID. There are no automatic retries or `status`, `retry`, or `cancel` actions. Removal denies new gateway calls and replay of the removed artifact even when a snapshot remains for frozen workflows.

Run waits synchronously. Configure the MCP client's response timeout above expected execution plus startup/cleanup; the SDK default is 60 seconds while tool execution can reach 300 seconds. MCP cancellation requests process termination, but timeout/cancellation can leave external effects. Check `error.code`, `error.started`, `error.needsAttention`, and diagnostics before deciding what to do next.

## Permissions and Workflow Boundary

The gateway uses the existing host user-tool runner, declared environment, and validation. Side-effect labels describe actions; they grant no authority. Tool/action/session policies still apply and can allow discovery while denying `run`. Loading this capability or seeing a tool in `pm_health` does not add it to an explicit session tool list. Respect missing tools and policy denials; do not route around them with a shell client.

Use the gateway for direct discovery, inspection, or an authorized standalone invocation. Workflow definitions must continue using their dedicated pinned user-tool steps: `id`, `action`, `revision`, `contentHash`, `inputSchema`, and `outputSchema` from the Builder/catalog. Gateway describe deliberately omits the hash and cannot supply a complete workflow pin. Do not author `pm_user_tool.run` as a workflow step. Existing frozen workflow pins and result mapping remain unchanged.

<!--</instructions>-->
<!--</capability>-->
