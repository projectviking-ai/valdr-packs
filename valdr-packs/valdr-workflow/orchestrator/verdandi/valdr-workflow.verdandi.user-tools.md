<!--<capability id="valdr-workflow.verdandi.user-tools" pack="valdr-workflow" role="workflow">-->
# Local User Tools

<!--<identity>-->
Discover, inspect, and directly test installed user tools, or use their frozen contracts in workflow steps. Keep direct gateway invocation separate from workflow authoring.
<!--</identity>-->

<!--<instructions>-->

## Direct Discovery and Testing

Hot-load `valdr.core.tools.pm-user-tool` for the gateway contract. On a server exposing it, use `pm_user_tool` with `help`, then `search` and `describe` to inspect visible installed actions and their schemas. Run an action directly only when the task authorizes its effects; no workflow or managed session is required. This can prove the action itself, but it does not prove a workflow's mappings or control flow.

`run` requires nested object `input`, an existing absolute `cwd`, and a `clientRequestId`; it accepts no `actorHandle`. Authored `action` or `cwd` fields stay in `input`. Search, describe, and new runs default to latest installed; optional `revision` selects a label and each response identifies the selection. The gateway keeps hashes internal. Read direct results from `data.result`.

Use a fresh ID for a new operation, and the same ID for a matching repeat. A completed request replays; an unresolved claim returns `outcome_unknown` and never starts another process. Reconcile external effects before deliberately issuing a fresh ID. Tool/action/session policy can deny gateway access or `run`; capability bindings do not widen those permissions.

## Pinned Workflow Steps (Valdr 0.3.3+)

For reusable code or CLI actions, use the `valdr-workflow-tools` authoring skill and the canonical `valdr-tools` pack. These remain `kind: tool` steps: select the exact installed ID/action (`<pack>.user.<name>` or legacy `user.<name>`) and retain catalog `revision`, `contentHash`, `inputSchema`, and `outputSchema`. Obtain the complete pin from the Builder/catalog: gateway `describe` omits `contentHash`. Never invent it or author `pm_user_tool.run` as a workflow step. Map workflow success from `$.normalized.data`.

Imported tools are immediately available in the Builder; import never runs them. Workflow execution uses host permissions like Command steps. Optional step-level `cwd` sits alongside `tool` and `inputs`, accepts expressions, and resolves absolute overrides or relative paths from the workflow session worktree/project repository; without context, the authority cwd is the fallback. Use step-level `cwd` for execution context; authored action fields remain in `inputs`. Do not add a project key to the process request.

Existing runs retain their pins. A manual/unknown action with uncertain external effects needs reconciliation before retry; a workflow operation ID remains stable across ordinary retries while attempt IDs change. Never substitute an unrestricted command string for a missing supported action.

<!--</instructions>-->
<!--</capability>-->
