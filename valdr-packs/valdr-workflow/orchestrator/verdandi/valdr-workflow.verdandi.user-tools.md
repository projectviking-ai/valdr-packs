<!--<capability id="valdr-workflow.verdandi.user-tools" pack="valdr-workflow" role="workflow">-->
# User Tools for Workflow Authoring

<!--<identity>-->
Route user-tool work to the shared workflow execution reference and the direct MCP gateway contract.
<!--</identity>-->

<!--<instructions>-->

Load `valdr-workflow.tools.user-tools` for installed action discovery, complete
workflow pins, schemas, cwd, typed outputs, prerequisites, and retry semantics.
Load `valdr.core.tools.pm-user-tool` for direct gateway call envelopes and policy.
Use `valdr-workflow.tools.overview` when choosing between a user tool, built-in
Command, a Valdr action, or an agent session.

The boundaries to keep in mind:

- A workflow uses the actual installed tool ID and action with all six pin fields:
  `id`, `action`, `revision`, `contentHash`, `inputSchema`, and `outputSchema`.
  Gateway `describe` does not return the content hash; obtain the complete pin
  from the installed Builder/catalog. Never invent one.
- `pm_user_tool` is the direct-call gateway, not a workflow `tool.id`.
  Its authorized `run` uses nested `input`, an absolute `cwd`, and a
  `clientRequestId`; it accepts no `actorHandle`.
- User-tool workflow execution cwd is beside `tool` and `inputs`. Action data
  remains in `inputs`; success data maps from `$.normalized.data`.
- Importing never runs the tool or installs its host dependencies. An uncertain
  write needs reconciliation before another attempt. A direct success does not
  prove a workflow's bindings or control flow.

For reusable program or CLI packaging, use the `valdr-workflow-tools`
authoring skill from Valdr Packs and the `valdr-tools` starter pack. Do not
replace a missing supported action with an unrestricted command to evade its
contract.

<!--</instructions>-->
<!--</capability>-->
