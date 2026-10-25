---
name: valdr-evals
description: Use when running Valdr pack-agent evaluations, adding agent test scenarios or suites, investigating evaluation failures, or creating HTML reports and comparisons from saved harness evidence in this repository.
---

# Valdr Evals

Use the repository's `evals/run.mjs` harness and report renderer. Run commands from the repository root, three directories above this skill. Read the [harness guide](../../../evals/README.md) for setup, profiles and CLI options; use `bun evals/run.mjs --help` for the current interface.

## Run evaluations

Match the suite to the agent's assignment: [task repair](../../../evals/docs/task-repair.md) measures authorized edits and refusals; [workflow authoring](../../../evals/docs/workflow-authoring.md) measures submitted workflows. Infer the requested agent from context; resolve ambiguity before treating a default agent as the user's candidate. `--agent` selects a manifest relative to the public `valdr-packs/` tree; honor the requested tier and profile.

Run with **Bun from the repository root** so it loads the existing `.env`. Preserve `VALDR_DB_USERNAME` and `VALDR_DB_PASSWORD` and use the normal `~/.valdr` setup and its existing license. Do not replace those credentials with generated values or ask for another license. The harness isolates fixture data through owned PM/runtime paths and verifies ownership with public health readback.

Live runs use the public Codex CLI, its existing sign-in and the scoped Valdr MCP broker. See the [public interface contract](../../../evals/docs/public-interfaces.md) when debugging startup, completion, callback or execution evidence. Keep this public repository independent of private Valdr source, activation state and unpublished endpoints.

Use a dry run to show the intended case selection and bounds. Keep zero repairs unless the user requests a repair experiment. A full-suite request selects every case. Setup or provider failures remain unscored; do not retry them as candidate repairs.

```sh
bun evals/run.mjs list task-repair
bun evals/run.mjs doctor task-repair
bun evals/run.mjs run task-repair --scenario 01_exact_replacement,02_missing_replacement --max-repairs 0 --round smoke --dry-run

bun evals/run.mjs doctor workflow-authoring
bun evals/run.mjs run workflow-authoring --scenario 01_routed_release --max-repairs 0 --round smoke --dry-run
```

Apply the same agent, tier, configuration and profile options to doctor, preview and run. `list`, `doctor`, dry-run, reporting, comparison and saved workflow replay make no model calls. See [readiness](../../../evals/docs/readiness.md) for the full no-model validation command; it does not measure agent performance.

Preserve failed invocations. Resolve documented setup failures before retrying; do not loop on infrastructure failures or silently increase repair budgets.

## Build scenarios

Read [adding suites](../../../evals/docs/adding-suites.md), the matching suite documentation and its existing scenario/fixture/evaluator modules. Scenarios are source modules selected by registered IDs; there is no runtime scenario-file import. Reuse the matching suite's contract when the task fits it; otherwise implement and register a focused suite through the documented hooks.

- Give each case a stable ID/title, a public task brief and explicit observable success/failure requirements. Keep evaluator-only expectations and holdouts out of author prompts and instruction tuning.
- Seed owned disposable fixtures through public APIs. Scope agent actions to the assignment; evaluate persisted state or execution receipts, including forbidden effects, instead of accepting claimed success.
- Add positive and meaningful failure regressions. Persist assertions in the existing `variants[].assertions` contract; distinguish candidate, policy and infrastructure outcomes.
- Bump the suite version when scenarios, fixtures or scoring change. Update scenario hash tests and documented counts; register new evaluator dependencies and their required source-receipt regression. Preserve the old trial when correcting an evaluator; replay its unchanged candidate separately.

Run `make test-evals` and the relevant installed-CLI fixture or replay checks. Fixture and mocked-provider checks do not establish agent performance. Execution scoring requires verified evidence from supported public interfaces for every required assertion; otherwise mark the scenario unavailable rather than weakening the assertion. Existing integrations select fixed cases; add focused integration coverage when new fixture behavior is otherwise unexercised. A scenario-development request alone does not require a full paid benchmark; select a representative validation scope. Reuse the harness rather than adding wrapper runners, alternate schemas or another provider adapter.

## Deliver reports

Take the evidence directory printed by the completed command, then generate a standalone HTML report. Select a fresh output name when one already exists.

```sh
bun evals/run.mjs report <run-directory> --format html --output <run-directory>/report.html
bun evals/run.mjs compare <baseline-directory> <candidate-directory> --format html --output comparison.html
```

Open the HTML in the available browser/viewer and verify the summary, case/attempt details and integrated evidence. Use the report's embedded evidence views for the reading experience; deliver a clickable HTML file link rather than a collection of JSON links. Keep original evidence unchanged and regenerate reports through the CLI.

Report selected cases/variants, first-attempt and eventual results, repairs, effective model/profile, incomplete outcomes and cleanup status. Preflight/replay artifacts are not agent scores; one trial is diagnostic, not a reliability estimate. Comparisons require compatible provenance and case sets; surface refusal reasons instead of inferring improvement. Consult [evidence and isolation](../../../evals/docs/evidence.md) when interpreting failures or cleanup. Preserve failed trials and do not prune evidence as an incidental part of evaluation or reporting.
