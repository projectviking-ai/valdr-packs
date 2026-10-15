<!--<capability id="valdr-workflow.tools.valdr" pack="valdr-workflow" role="integration">-->
# Valdr Actions Inside Workflows

<!--<identity>-->
Author supported Valdr actions as workflow steps with explicit inputs, recorded result mappings, and deliberate effects. Resolve each action against the installed workflow catalog and its direct MCP contract.
<!--</identity>-->

<!--<instructions>-->

## Available tool families

The aggregate Valdr adapter exposes catalog-approved actions from these families.
Availability and fields depend on the installed runtime; this table is a map to
contracts, not a promise that every direct call is executable in a workflow.

| Workflow tool ID | Purpose | Detailed action contract |
|---|---|---|
| `pm_project` | Project context and configuration | `valdr.core.tools.pm-project` |
| `pm_task` | Task reads, prompts, edits, comments, and status transitions | `valdr.core.tools.pm-task` |
| `pm_sprint` | Sprint creation, task membership, and checked closeout | `valdr.core.tools.pm-sprint` |
| `vmp` | Plans and plan-backed work | `valdr.core.tools.vmp` |
| `pm_agent` | Agent identities, roles, and composed prompts | `valdr.core.tools.pm-agent` |
| `pm_session` | Agent session lifecycle and evidence | `valdr.core.tools.pm-session` |
| `pm_review` | Review records, assignments, and decisions | `valdr.core.tools.pm-review` |
| `pm_audit` | Session evidence and audit records | `valdr.core.tools.pm-audit` |
| `pm_provider` | Configured provider presets and declared capabilities | `valdr.core.tools.pm-provider` |
| `pm_prompt` | Reusable prompt content | `valdr.core.tools.pm-prompt` |
| `pm_capability` | Capability discovery and prompt loading | `valdr.core.tools.pm-capability` |
| `pm_knowledge` | Registered knowledge queries and context | `valdr.core.tools.pm-knowledge` |
| `pm_workflow` | Definition and run operations | `valdr.core.tools.pm-workflow` |

`pm_health` and ULID utilities are not workflow steps. Use `git`, `github`, and
`command` for their built-in operations. An installed user tool uses its own ID
and complete pin; `pm_user_tool` is a direct-call gateway, not a workflow tool ID.
External MCP servers belong in a configured agent session.

Prefer the dedicated `session`, `review`, and `subworkflow` kinds when launching
agents, independent reviewers, and child workflows. They express lifecycle,
waits, gates, and child completion directly. Load the authoring reference for
their contracts rather than copying raw tool calls into a graph.

## Inputs and identity

```yaml
- key: load_task
  name: Read current task
  kind: tool
  tool: { id: pm_task, action: get }
  inputs:
    taskKey: "${workflow.inputs.taskKey}"
  outputs:
    status: "$.normalized.task.status"
    assignee: "$.normalized.task.assigneeHandle"
```

Put the action under `tool`, not inside `inputs`. Author all action-specific
required values. The runtime supplies supported run-owned fields where it has
context; do not assume arbitrary required arguments can be inferred. Explicit
subject bindings make reuse across task/project scopes clear.

Use the action's current field names, such as `to` for task status, rather than
guessing them from a returned object. Pass the actual runtime actor when that
action accepts `actorHandle`; adding a human's name does not grant their
authority. Catalog exposure does not bypass action permissions, review gates,
trusted-operator restrictions, idempotency, or status-transition validation.

For example, after a genuinely completed executor step:

```yaml
- key: mark_in_review
  name: Submit task for review
  kind: tool
  needs: [await_executor]
  tool: { id: pm_task, action: change_status }
  inputs:
    taskKey: "${workflow.inputs.taskKey}"
    to: in_review
    actorHandle: "${runtime.actor}"
  outputs:
    status: "$.normalized.task.status"
```

This is a graph fragment, not a standalone runnable definition. Define and gate
`await_executor` according to its actual completion contract. A handler may
reject the transition if the task is not eligible.

## Results and business decisions

Prefer the workflow adapter's `$.normalized` fields, but use `$.raw` when the
required handler data is not included in normalization. Downstream expressions
use declared outputs, for example
`${steps.load_task.outputs.status}`. Direct MCP `data` envelopes and session gate
JSON are separate contracts; do not copy their paths without checking the
workflow result picker or a recorded run.

| Action/result | Selector | Interpretation |
|---|---|---|
| `pm_task/get` task status | `$.normalized.task.status` | Current persisted state, not a verdict about task quality |
| `pm_review/list` collection | `$.normalized.reviews` | Can be an empty array on a successful read |
| `pm_review/list` selected review | `$.normalized.review` | Can be null; do not dereference it without proving a match exists |
| `pm_workflow/list_runs` collection | `$.normalized.runs` | Run rows; choose the intended run explicitly |
| `pm_workflow/list_runs` paging | `$.normalized.page` | Inspect pagination before treating a page as the entire result |
| `vmp/commit_markdown` saved plan identity | `$.normalized.planId` | Actual persisted plan ID; map it directly into the following `get_plan` input |
| `vmp/commit_markdown` saved task identities | `$.normalized.taskIds` | Persisted task IDs, not task content |
| `vmp/get_plan` plan summary | `$.normalized.plan` | Plan metadata and `taskKeys`; does not include the full spec or task records |
| `vmp/get_plan` persisted specification | `$.raw.spec` | Full specification with requirements |
| `vmp/get_plan` persisted tasks | `$.raw.tasks` | Full records including IDs, keys, titles, summaries, acceptance and requirement links |

Normalization is action-specific, not a copy of every handler field. For VMP
readback, use `$.raw` when one downstream receipt needs the complete
`{ plan, spec, tasks }` result; `$.normalized` contains only the `plan` summary.
Do not look for full task records at `$.normalized.tasks` or treat `taskKeys` as
content verification. `commit_markdown` supplies `planId`, `planKey`, `specId`,
and `taskIds` in its normalized result; extracting those known fields needs no
agent interpretation. Confirm these selectors against the installed result
picker or a recorded run before relying on a different runtime version.

Map only fields that later steps need. List actions are not implicit selectors
for the latest relevant record. Check subject, status, and provenance before
using a review or run to authorize another action.

## Read and validate an actual plan artifact

`vmp/validate_markdown` takes the **complete Markdown string** in `markdown`;
a path, summary, or claimed agent validation is not that document. A session
ULID supplies workspace context, not a generic file-read action. Do not invent
`pm_session/read_file` or `vmp/validate_markdown_from_worktree`. Confirm an
installed user tool's actual read action, or use authorized `command/run` on
the workflow host. For a known `plan.md` in the writer's worktree:

```yaml
- key: read_plan
  name: Read the actual plan Markdown
  kind: tool
  tool: { id: command, action: run }
  inputs:
    sourceSessionUlid: "${workflow.inputs.writerSessionUlid}"
    cwd: .
    command: "test -f ./plan.md && test ! -L ./plan.md && cat ./plan.md"
    timeoutSeconds: 30
  outputs:
    markdown: "$.normalized.stdout"
    truncated: "$.normalized.stdoutTruncated"
  onFailure: { action: block }
- key: require_complete_plan
  name: Require complete captured Markdown
  kind: condition
  needs: [read_plan]
  checks:
    - { kind: value_equals, value: "${steps.read_plan.outputs.truncated}", equals: false }
  outputs:
    reason: Plan output was truncated; validation requires the complete document.
  onFailure: { action: block }
- key: validate_plan
  name: Validate captured VMP Markdown
  kind: tool
  needs: [require_complete_plan]
  tool: { id: vmp, action: validate_markdown }
  inputs:
    markdown: "${steps.read_plan.outputs.markdown}"
  outputs:
    valid: "$.normalized.valid"
    errors: "$.normalized.errors"
  onFailure: { action: block }
- key: require_valid_plan
  name: Require valid VMP Markdown before approval
  kind: condition
  needs: [validate_plan]
  checks:
    - { kind: value_equals, value: "${steps.validate_plan.outputs.valid}", equals: true }
  outputs:
    reason: "The plan is invalid and cannot be approved or saved: ${steps.validate_plan.outputs.errors}"
  onFailure: { action: block }
```

Declare `writerSessionUlid` as an input or bind the session that produced the
artifact, adding its launch to `read_plan.needs` when it is in this graph.
Command stdout remains a string, which is exactly what validation needs.
`valid: false` is a normal tool result; branch on it to bounded repair or block.
It is not caught by the tool's `onFailure` alone.

Present the same captured Markdown to the human. If a file preview is used,
freeze those bytes for the preview; a mutable writer file is not a stable
approval target. After an explicit `approved` condition, pass the same
`${steps.read_plan.outputs.markdown}` to `vmp/commit_markdown`, with a registered
`plannerAgentHandle` and stable `idempotencyKey` for that save. Read the saved
plan and tasks back with `vmp/get_plan`. A supported
`commit_markdown_from_worktree` action reads a file at save time; it does not
imply a matching validation action or prove that its current bytes were the
ones approved.

## Validation and execution

1. Load the relevant core capability and inspect scoped action help for unknown
   inputs or results. Confirm the installed workflow catalog supports the action.
2. Strictly validate the complete definition, resolving missing arguments,
   unavailable actions, and invalid expressions.
3. When execution is authorized, exercise the intended success and rejection
   paths against disposable subjects and inspect persisted step results.
4. Report validation separately from execution. Handler behavior and authority
   constraints still apply after schema validation succeeds.

`test_definition` creates a durable real run even though the definition is not
registered. Project/task writes, session launches, provider costs, and nested
workflow operations retain their normal effects. A disposable PM home isolates
PM state; it does not sandbox shell commands or external services.

## Anti-patterns

- Enumerating unrelated capabilities when one action contract is missing.
- Treating an empty list as a tool failure, or as proof the underlying work passed.
- Selecting arbitrary collection entries or guessing normalized paths.
- Repeating a rejected action with invented authority fields.
- Using a raw tool launch without the session/review completion gate required
  before downstream effects.

<!--</instructions>-->
<!--</capability>-->
