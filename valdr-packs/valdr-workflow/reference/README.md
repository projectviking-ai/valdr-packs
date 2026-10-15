# Workflow reference library

Verdandi uses a short navigation capability and detailed references loaded when
the requested workflow needs them. These are shared capabilities: another
workflow author can bind the same keys and roles with `hot-load: true`. Step
references use `workflow`; executable-tool references use `integration`.

## Start with the workflow

Use the existing [authoring reference](../orchestrator/verdandi/valdr-workflow.verdandi.authoring.md)
for definitions, inputs, expressions, routes, loop backs, sessions, reviews,
gates, and subworkflows. The [operating reference](../orchestrator/verdandi/valdr-workflow.verdandi.operating.md)
covers runs and recovery; [debugging](../orchestrator/verdandi/valdr-workflow.verdandi.debugging.md)
covers evidence and failure diagnosis.

For human approval or clarification, load
[`valdr-workflow.steps.human-gate`](steps/valdr-workflow.steps.human-gate.md).
It includes approval previews, Questions schema, typed answers, delivery back to
existing sessions, and guards that prevent asking for an exhausted revision pass.

Then choose the executable mechanism:

| Capability | What it covers |
|---|---|
| [`valdr-workflow.tools.overview`](tools/valdr-workflow.tools.overview.md) | Step and tool selection, result envelopes, discovery, business outcomes |
| [`valdr-workflow.tools.valdr`](tools/valdr-workflow.tools.valdr.md) | Internal Valdr actions inside workflows, family-to-contract map, identity and normalized results |
| [`valdr-workflow.tools.command`](tools/valdr-workflow.tools.command.md) | Built-in shell execution, inputs/cwd/env, string stdout, failure and retry |
| [`valdr-workflow.tools.git`](tools/valdr-workflow.tools.git.md) | Eight built-in Git actions, required arguments, exact commit evidence and drift |
| [`valdr-workflow.tools.github`](tools/valdr-workflow.tools.github.md) | Pull-request creation/adoption from approved proposal and repository evidence |
| [`valdr-workflow.tools.user-tools`](tools/valdr-workflow.tools.user-tools.md) | Installed typed actions, full revision/schema pins, direct gateway differences and uncertain effects |

“Internal Valdr actions” means public workflow-callable actions such as
`pm_task/get`; it does not mean private implementation APIs. The Valdr action
reference links the existing detailed `valdr.core.tools.*` capabilities rather
than duplicating the entire MCP manual. Agent-visible tools and workflow-callable
tools are different catalogs.

## Use from an agent

The Workflow pack includes `reference/` and Verdandi already binds these
capabilities. In a session, request the one needed:

```text
pm_capability { action: "prompt", key: "valdr-workflow.tools.command" }
```

For another agent, add the selected binding to its manifest:

```yaml
capabilities:
  - key: valdr-workflow.tools.command
    role: integration
    hot-load: true
```

Bind the overview and any other references that agent must navigate to. Keep
identity and essential constraints always loaded; load detailed contracts only
as needed. Existing `valdr-workflow.verdandi.user-tools` remains a compatibility
entrypoint to the shared user-tool and gateway references.

## Examples and verification

Examples are step fragments unless explicitly described otherwise. Supply their
declared workflow inputs, dependencies, and actual installed identities before
validation. User-tool pins must come intact from the installed catalog; the
reference deliberately does not publish a fabricated content hash.

The references follow the public Valdr workflow documentation and shipped pack
definitions. They have no dependency on a documentation or application source
checkout. Use the installed Builder/catalog and scoped action help to resolve
version differences, strictly validate the complete definition, and prove
execution only in an authorized environment. Validation and execution are
different claims; a disposable PM home does not sandbox external effects.
