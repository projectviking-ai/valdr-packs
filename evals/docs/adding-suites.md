# Adding an evaluation suite

The CLI supports `list`, `doctor`, `run`, `replay`, `report`, `compare`,
`runs` and `prune` through
`evals/run.mjs`. The runner passes an optional lifecycle to suite evaluation;
pass it through to any owned runtime environment. Throw infrastructure errors
for failed readback/transport rather than returning a candidate score.
Use the shared evidence writer and schema/outcome conventions.

The shared runner owns installed CLI startup, fixture isolation, agent loading,
author receipts, bounded attempts, evidence capture, and cleanup. A suite
owns its fixtures, public task briefs, permitted agent actions, submission
contract, and evaluation. Keep task-specific logic inside its suite directory.

Use [`task-repair/index.mjs`](../suites/task-repair/index.mjs) for a suite that
checks persisted PM changes, or
[`workflow-authoring/index.mjs`](../suites/workflow-authoring/index.mjs) for a
suite that evaluates a submitted file.

## Register a suite

1. Add `evals/suites/<suite-id>/index.mjs` with the contract below. Put supporting
   modules beside it and tests under `evals/tests/<suite-id>/`.
2. Register its modules and loader in [`suites/registry.mjs`](../suites/registry.mjs).
   The CLI and comparison share that registry. Add CLI coverage for the selection
   and prove every evaluator dependency has a required source receipt.
3. Document the cases, default agent, permitted operations, expected evidence,
   and interpretation in this directory; link it from the
   [main guide](../README.md).
4. Run `make test-evals` and `bun evals/run.mjs doctor <suite-id>`. Exercise
   supported fixture and replay paths through the installed CLI. Live agent
   runs use the public Codex CLI and scoped Valdr MCP broker;
   offline tests do not establish measured agent performance. Mark fixtures that
   lack supported execution evidence with `evaluationUnavailable`; keep their
   limitation visible in listing, previews and replay results.

No separate provider SDK or plugin registry is needed. Agent manifests and
capabilities come from the selected public packs repository. Agent identity,
task suite, and execution profile remain independent inputs.

## Suite contract

| Field or hook | Contract |
| --- | --- |
| `id`, `version`, `defaultAgent`, `scenarios` | Stable suite ID/version, default manifest path relative to the public `valdr-packs/` tree, and scenarios with unique `id` and `title`; use `evaluationUnavailable` to explain an authoring-only fixture |
| `requiredTools` | Public tool names needed by the suite; the runner adds shared fixture and registry requirements |
| `policy(context)` | Returns `(method, params) => boolean`; restrict mutation arguments as well as action names |
| `check(environment, options)` | Fixture/readback check without model calls after tool and agent preflight |
| `prepare(environment, { scenario, packsRoot })` | Create fixtures through public APIs and return scenario context |
| `prompt({ environment, scenario, context, agent })` | Public task brief, excluding evaluator code and expected answers |
| `submissionFile` (optional) | Relative JSON output file; without it, the final message is the submission |
| `beforeAttempt({ environment, context, scenario })` (optional) | Return state to preserve before each turn |
| `captureState({ environment, context })` (optional) | Capture state after a turn, including provider failures |
| `evaluate({ environment, context, scenario, authored, submission, beforeState, outputDir, valdrBin })` | Return `{ ok, ...evidence }`; return semantic failures, throw for infrastructure/readback failures |
| `feedback(evaluation)` | Observed diagnostics for repair within the original authority |
| `stopOnSafetyRejection` (optional) | Stop when `evaluation.safety.safe === false` makes repair inappropriate |
| `replay(...)` (optional) | Suite-specific evaluation without authoring; CLI replay currently supports workflow bundles only |

The runner calls `prepare` once per scenario and reuses its context across
repair turns. The filtered broker stays closed until context exists. Avoid
policies that permit broad operations just because fixtures share a fresh PM
home: scope task keys, mutable fields, workflow definitions, and other relevant
arguments to the assignment.

Use `environment.call` for trusted fixture/evaluator operations. Agent calls
must pass through the filtered broker. Preserve observations needed to detect
failed, denied, no-op, or reverted mutations; checking only the final state can
miss violations. If an action makes a trial invalid even after repair, return a
safety rejection and enable `stopOnSafetyRejection`.

## Keep evaluations reproducible

Create fixtures in owned evaluation directories through documented CLI and MCP
interfaces. Keep existing user data separate and enforce the suite's permitted
actions. Preserve submitted artifacts unchanged for scoring. Require documented
evidence of the selected persona, execution profile and completed turn before
assigning an agent score.

Write suite evidence under `outputDir`, using the shared evidence writer for
structured records. Record actual and expected values for assertions and retain
raw state alongside any normalized comparison. Store assertions once under
`variants[].assertions` as `{ pass, message, actual, expected }`; each variant
has an `id` and `ok` result. Keep execution errors, validation failures, and
safety diagnostics separate from these scored assertions. Bump the suite version when
scoring or fixtures change. Never include `.env`, credentials, or authentication
files as source/evidence artifacts.

Test meaningful failure paths as well as successful examples: malformed output,
missing tools, denied actions, incomplete provider turns, repair behavior, and
cleanup failures. A passing `doctor <suite-id>` establishes fixture and API
compatibility; it does not establish the agent's ability to complete the task.

Keep holdouts separate from instruction tuning, preserve unsuccessful trials,
and compare results only with matching suite versions, fixtures, policies,
profiles, and budgets. The supported suites assess task performance; they do
not provide a universal score across unrelated agent roles.

Offline comparison deliberately requires known evaluator provenance. When adding
a suite or evaluator dependency, update the minimum source receipts in
`suites/registry.mjs` and add a regression proving missing module/fixture hashes
refuse comparison. Source snapshots must retain all evaluator dependencies.
