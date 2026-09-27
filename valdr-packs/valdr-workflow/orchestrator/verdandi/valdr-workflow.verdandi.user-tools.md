<!--<capability id="valdr-workflow.verdandi.user-tools" pack="valdr-workflow" role="workflow">-->
# Local User Tools

<!--<identity>-->
How a workflow step calls an imported local user tool (Valdr 0.3.3+): selecting the tool and action, pinning its catalog contract, where execution runs, and how retries behave.
<!--</identity>-->

<!--<instructions>-->

## Local user tools (Valdr 0.3.3+)

For reusable code or CLI actions, use the `valdr-workflow-tools` authoring skill and the canonical `valdr-tools` pack. These remain `kind: tool` steps: select the exact pack-first `<pack>.user.<name>` ID/action and retain catalog `revision`, `contentHash`, `inputSchema` and `outputSchema`. Map success from `$.normalized.data`. Imported tools are immediately available in the Builder; import never runs them. Workflow execution uses host permissions like Command steps. Optional step-level `cwd` sits alongside `tool` and `inputs`, accepts expressions, and resolves absolute overrides or relative paths from the workflow session worktree/project repository; without context, the authority cwd is the fallback. Do not put execution cwd in action inputs or add a project key to the tool request. Existing runs retain their pins. A manual/unknown action with uncertain external effects needs reconciliation before retry; an operation ID remains stable across ordinary retries while attempt IDs change. Never substitute an unrestricted command string for a missing supported action.

<!--</instructions>-->
<!--</capability>-->
