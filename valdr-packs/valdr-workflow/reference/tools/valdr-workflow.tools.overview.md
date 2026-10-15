<!--<capability id="valdr-workflow.tools.overview" pack="valdr-workflow" role="integration">-->
# Workflow and Tool Reference

<!--<identity>-->
Choose the workflow step and executable tool that fit the requested outcome, then load its precise contract. Keep workflow control flow, built-in tools, Valdr actions, and installed user tools distinct.
<!--</identity>-->

<!--<instructions>-->

## Choose the mechanism

| Need | Workflow mechanism | Detailed capability |
|---|---|---|
| Inputs, dependencies, routes, expressions, output contracts, bounded loop backs | Workflow definition and `condition` steps | `valdr-workflow.verdandi.authoring` |
| Agent execution or continuation | `session` step with a supported launch/input action and an explicit completion gate | `valdr-workflow.verdandi.authoring`, `valdr.core.tools.pm-session` |
| Independent review | `review` step with the correct reviewer and verdict contract | `valdr-workflow.verdandi.authoring`, `valdr.core.tools.pm-review` |
| Reusable workflow, fan-out, or child result | Version-pinned `subworkflow` step | `valdr-workflow.verdandi.authoring` |
| Human approval or Questions answer | `human_gate`; use its supported outcomes and authorized input path | `valdr-workflow.verdandi.authoring`, `valdr-workflow.verdandi.operating` |
| External callback, including custom outcomes | `await_condition` with `workflow_input`, authorized handles, and the intended source binding | `valdr-workflow.verdandi.authoring`, `valdr-workflow.verdandi.operating` |
| Wait for a supported runtime condition | `await_condition` | `valdr-workflow.verdandi.authoring` |
| Read or mutate Valdr data | `kind: tool` with an available Valdr tool/action | `valdr-workflow.tools.valdr` |
| Execute a trusted shell command | `kind: tool`, `command/run` | `valdr-workflow.tools.command` |
| Inspect or deliver reviewed repository work | `kind: tool`, `git/<action>` | `valdr-workflow.tools.git` |
| Publish an approved pull-request proposal | `kind: tool`, `github/create_pull_request` | `valdr-workflow.tools.github` |
| Reuse a typed local program or CLI adapter | `kind: tool`, installed user-tool ID/action with a complete pin | `valdr-workflow.tools.user-tools` |
| Use an external MCP integration exposed to an agent | Configured agent `session` | `valdr.core.tools.pm-session` |

For starting, inspecting, retrying, or cancelling runs, load
`valdr-workflow.verdandi.operating`. For stalled gates, failed actions, and frozen
definition diagnosis, load `valdr-workflow.verdandi.debugging`. Use
`valdr.core.tools.pm-workflow` for the public API envelopes.

## Load the relevant contract

```
pm_capability { action: "prompt", key: "valdr-workflow.tools.command" }
```

Load the overview when choosing an unfamiliar mechanism, then only the detailed
references needed for the graph. The references describe workflow execution;
core `valdr.core.tools.*` capabilities describe the matching direct MCP calls.
They complement each other and their result envelopes are not interchangeable.

The installed Builder/catalog determines available workflow actions. Check the
matching action's live help and strictly validate the complete definition.
`pm_workflow/help.topic` accepts action names such as `validate`, or `all`;
`command`, `loop_back`, and step kinds are not help topics. Capability search
finds prose; it does not enumerate executable workflow actions. A missing
capability named `command` does not make the built-in action unavailable.

## Tool step contract

```yaml
- key: load_task
  name: Read task status
  kind: tool
  tool: { id: pm_task, action: get }
  inputs:
    taskKey: "${workflow.inputs.taskKey}"
  outputs:
    status: "$.normalized.task.status"
```

- `tool.id` and `tool.action` select the implementation. Put action-specific
  arguments in `inputs`; declare its actual required fields.
- `outputs` map the recorded action result. Downstream references use
  `${steps.load_task.outputs.status}`. Use the exact documented selector and type.
- Exact `${...}` references preserve structured values. Interpolation inside a
  larger string produces text. Command stdout remains text even if it looks like
  JSON; user-tool structured results live under `$.normalized.data`.
- Dependency completion does not establish business success. Check the actual
  outcome, status, or verdict before permitting the next effect. Some actions
  successfully return a drift, empty collection, or business-failure result.
- A valid graph does not prove an action can execute with the current identity,
  repository, credentials, or runtime. Validate first; run only within the user's
  authorized execution scope and report precisely what was proven.

## Design the control flow before the effects

Turn a business request into explicit decisions: allowed inputs, successful
outcomes, rejection paths, retryable work, and the evidence required to proceed.
Use `when` checks for conditional steps and condition outputs for explanations.
Do not assume a skipped dependency automatically skips all its descendants.

For a bounded `loop_back`, `max` is total passes, not additional retries. Its
source condition needs one `value_equals` check with a closed literal `domain`
and a literal `equals` value from that domain. Neither field can be made dynamic
by routing an expression through another step output. If the business rule
depends on runtime data, first express it using supported operations and an
explicit finite outcome; then gate the loop on a fixed outcome. See the
authoring capability for corridor restrictions and previous-pass receipt paths.

Before a publication or mutation, connect approval to the exact evidence being
acted upon. Freeze the applicable repository identity, commit, proposal, or
tool revision. A retry is another attempt at a real action; reconcile uncertain
effects instead of generating a new operation merely to bypass a stop.

## Anti-patterns

- Inventing a generic shell, JSON parser, tool action, or output selector.
- Treating every MCP tool visible to an agent as a workflow tool.
- Using `pm_user_tool` as a workflow `tool.id`, or inventing a user-tool pin.
- Replacing a dedicated session, review, or subworkflow step with a raw call that
  loses its lifecycle and completion semantics.
- Reporting validation, a successful process exit, or a resolved wait as proof
  that the requested business outcome occurred.

<!--</instructions>-->
<!--</capability>-->
