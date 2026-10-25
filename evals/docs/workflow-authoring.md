# Workflow authoring suite

Eleven authoring briefs exercise workflow definition design. Verdandi is the
default agent. Use `list workflow-authoring` to inspect case IDs and execution
availability, and the [main guide](../README.md) for configuration and reports.

Live runs use the public Codex CLI to produce an immutable workflow bundle.
Valdr's public MCP APIs validate and execute it in disposable workspaces using
the existing `.env` credentials and default license. Offline discovery, dry
runs and saved reports remain available.

Author requests denied by the suite policy reject the attempt before workflow
execution. A policy rejection ends that case, even when repair turns were requested.
The broker audit is retained alongside the submitted bundle.

## Commands

Run from the repository root:

```sh
bun evals/run.mjs list workflow-authoring
bun evals/run.mjs doctor workflow-authoring
bun evals/run.mjs run workflow-authoring --scenario 06_optional_task_lookup --dry-run
bun evals/run.mjs replay workflow-authoring \
  --bundle ./candidate/bundle.json --scenario 06_optional_task_lookup --round replay
bun evals/tests/integration/workflow-binary.mjs
```

Doctor checks fixture setup without model calls. It does not establish live
agent readiness. Replay requires successful CLI startup and the documented
operations used by the selected case.

## Scenarios

| Case | Capability exercised | Execution scoring |
| --- | --- | --- |
| 01 | Exclusive routes, conditional audit and ordered join | Supported |
| 02 | Bounded loop and previous results | Supported |
| 03 | Typed fan-out, empty input and rejected child | Supported |
| 04 | Nested required-input and typed-output contracts | Supported |
| 05 | External callback, digest check and outcome routing | Supported |
| 06 | Nullable task lookup and guarded descendants | Supported |
| 07 | Child workflow inside a bounded loop; holdout | Supported |
| 08 | Callback-fed fan-out with task scope; holdout | Supported |
| 09 | Business release routing and optional audit | Supported |
| 10 | Business review and bounded remediation | Supported |
| 11 | Business approval and ordered audit | Supported |

The catalog contains thirty-three execution vectors. Scoring uses complete,
paginated public events, actual command results, every step attempt, child-run
associations, callback acknowledgements and persisted results. Missing readback
or incomplete pagination is an infrastructure failure. Declared outputs alone
cannot prove an operation ran. The [evidence matrix](public-interfaces.md#evidence-required-by-each-case)
records each case's requirements.

Cases 01–08 constrain step names and show test inputs without providing solution
definitions. Cases 09–11 describe business outcomes without prescribing graph
structure; their test vectors stay out of author prompts. Cases 07–08 are holdouts
and must not guide instruction tuning.

## Submission and execution

A saved candidate is strict JSON with this container shape:

```json
{
  "definitions": [],
  "entryWorkflowKey": "root-workflow-key"
}
```

The definitions array must contain the complete root definition and any child
definitions required by the brief. Replay preserves the submitted bytes before
checking safety and the case contract. It never edits the source candidate.

Commands are limited to bounded, single-quoted `printf` expressions. The safety
check rejects other command languages, unrelated mutations and detached
execution. Definitions are validated through `pm_workflow`; supported replay
reads complete execution history and typed results. Missing readback or unverifiable
cleanup remains infrastructure-incomplete.

## Developing evaluations

Use Verdandi's [reference library](../../valdr-packs/valdr-workflow/reference/README.md)
for workflow authoring rules. Add positive and failure regressions for each
supported assertion. Verify the public response fields and semantics against the
installed CLI before depending on them. When the harness cannot yet verify a
requirement, retain it in the brief and keep execution scoring unavailable until
its integration checks pass.

Preserve failed submissions when fixing an evaluator. Replay the unchanged
candidate into a new evidence directory, and identify the original scenario and
candidate hashes. A corrected replay is not a new agent attempt. First-attempt
and repaired results remain separate in reports; preflight and replay results
are never agent performance measurements.

A missing required submission is unscored; its cause is not inferred from model
text. Compare only runs with compatible case sets and provenance. One trial is
a diagnostic sample, not a reliability estimate.

Evidence defaults to `.valdr-evals/`, with a new directory for every invocation.
Use `--evidence-root` to choose another location.
