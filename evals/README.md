# Valdr evaluations for pack authors

Discover evaluation scenarios and inspect saved Valdr agent results from this
checkout. The suites define **task-repair** (9 cases) and **workflow-authoring**
(11 scenarios, 33 fixture variants). Fixture checks and supported workflow replay
use the installed
`valdr` CLI with fresh disposable evaluation directories.

Live runs launch the selected pack persona with the public Codex CLI and use
Valdr's public MCP APIs for owned fixtures and workflow execution. Agent tools
are restricted through the suite's audited MCP broker. Reports, comparisons,
scenario discovery and dry-run previews remain available offline.

## Getting started

Use **Bun 1.4.3+** for offline commands. Fixture checks additionally require Git,
macOS/Linux and the installed `valdr` CLI. `doctor` checks fixture readiness
without requiring Codex or provider authentication. Run these commands from this repository root:

```sh
# Discover available cases. This is entirely offline.
bun evals/run.mjs list task-repair

# Check prerequisites, persona, isolated fixtures and cleanup. No model calls.
bun evals/run.mjs doctor task-repair

# Preview a single case and its model-turn allowance. No execution.
bun evals/run.mjs run task-repair --scenario 01_exact_replacement --dry-run
```

Run from the repository root with Bun so it loads your existing `.env`.
`VALDR_DB_USERNAME` and `VALDR_DB_PASSWORD` must match your working Valdr setup;
exporting the same variables also works. The harness preserves these credentials
and the normal `~/.valdr` setup, including the existing license. No separate
license, key or path is needed.

Every evaluation uses a fresh `--pm-home`, scratch repository and runtime
directory. Public health readback must confirm the owned PM path before fixture
writes. The default workspace is never used for fixtures. Credentials and local
`.env` files are excluded from evidence.

Live agent runs additionally require the public `codex` CLI on PATH and its
existing sign-in. The harness ignores personal Codex configuration and rules,
applies the selected persona and tool restrictions, and checks a completed turn
and process shutdown before scoring. Repairs resume the exact provider thread.
Codex retains its normal provider-managed transcripts; authentication is not copied.

`doctor` checks Valdr, the selected persona, fixture readback and cleanup without
model calls. It does not claim that provider authentication or a model turn was
verified. See [public interfaces](docs/public-interfaces.md) for the evidence
this integration relies on.

Preview output shows the selected agent/profile and planned maximum author turns. Runs
default to **zero repairs**. An explicit `--max-repairs 1` or `2` describes a
repair experiment within the same scenario session and fixture.

## Commands

| Command | Purpose | Uses a model? |
|---|---|---|
| `list [suite]` | Discover case IDs and descriptions | No |
| `doctor [suite]` | Check installed CLI prerequisites and isolated fixtures | No |
| `run [suite]` | Run the selected agent against the selected scenarios | Yes |
| `run [suite] --dry-run` | Preview selection, profile and maximum turns | No |
| `replay workflow-authoring --bundle file --scenario id` | Evaluate an unchanged saved candidate for a supported scenario | No |
| `report <run>` | Read saved results; optionally export standalone HTML | No |
| `compare <baseline> <candidate>` | Compare runs with provenance checks | No |
| `runs` | Inventory saved evidence | No |
| `prune` | Preview retention; delete eligible evidence only with `--apply` | No |

The default suite is `workflow-authoring`. Use `--scenario id,id` to select a
subset, `--agent relative/manifest.agent.yaml` to choose another agent, and
`--tier raider|vanguard|sovereign` to control capability resolution. Agent paths
are relative to `valdr-packs/` under `--packs-root`. Higher tiers are never
loaded implicitly. Fixture checks verify the required tools exposed by the installed CLI.

```sh
bun evals/run.mjs list workflow-authoring
bun evals/run.mjs doctor workflow-authoring --valdr-bin /absolute/path/to/valdr
bun evals/run.mjs run workflow-authoring --scenario 01_routed_release --round candidate --dry-run
bun evals/run.mjs replay workflow-authoring --bundle ./saved/bundle.json \
  --scenario 06_optional_task_lookup
bun evals/run.mjs --help
```

## Read and compare saved runs

Reporting works offline, including on a machine without Valdr or Codex installed.
Pass a saved run directory or its `summary.json` file:

```sh
bun evals/run.mjs report .valdr-evals/<run-directory>
bun evals/run.mjs report .valdr-evals/<run-directory> --format html --output report.html
bun evals/run.mjs compare .valdr-evals/<baseline> .valdr-evals/<candidate>
bun evals/run.mjs compare .valdr-evals/<baseline> .valdr-evals/<candidate> \
  --format html --output comparison.html
```

HTML reports open with a plain-language verdict and next action. **Inspect evidence**
jumps to the **What we tested** ledger, which groups each case's final execution
variants. Expand a variant to read its Expected and Observed outcomes, then its
assertion details with actual and expected values. The run facts sidebar records
the agent, model, date, outcome and final check counts.

First-attempt passes, repaired passes, failures and unscored cases stay distinct.
Assertion totals use each scored case's final attempt; earlier attempts remain in
collapsible supporting evidence. Agent time excludes fixture setup, evaluation
execution and cleanup. Run details and provenance stay collapsed below the results.
Nested evidence uses full-width rows so expanding it does not squeeze values into
narrower columns.

HTML files are standalone and include expandable scenario briefs, author responses,
assertions, session activity, cleanup receipts and source provenance. Evidence is
embedded in the page, so the report remains readable when copied away from its run
directory. Bundled Tabler icons are embedded in the HTML, with no external resources,
scripts or JSON navigation links. Large collections and deeply nested values use
explicitly marked previews; original
evidence remains in the run directory. Existing output files are never overwritten.
Session activity is read from each attempt's `provider-events.json`, including
interrupted turns without an author receipt. Missing or empty activity is labeled.
These files are limited to 10,000 events each and 64 MiB combined; symlinks are refused.
Use `--json` for one structured result, or `--output report.txt` to save text.
Reports read original evidence without changing its scores or JSON files.

Comparison checks the same suite/version, scenario definitions, effective
execution settings, tier, timeout/repair budget, binary identity and runtime/
evaluator source hashes. Shipped workflow example changes also invalidate
workflow-authoring comparisons; task-repair does not load those examples. Agent
identities and prompt/capability changes may differ on purpose;
profile aliases are allowed when their effective settings match. Different case
orders do not change compatibility.

Missing provenance, incompatible runs and incomplete/cancelled runs cannot
establish improvement. Comparison shows the reason and exits `1`. A valid
complete comparison exits `0` even when it identifies regressions; inspect the
JSON `assessment` for automation. First-attempt and eventual performance remain
separate; case changes prevent a net total from hiding mixed improvements and
regressions. A single trial per candidate is diagnostic, not a reliability estimate.

Readiness/preflight and replay artifacts can be reported, but are never displayed
as measured agent performance. Missing timings remain “Not recorded.”

## Manage saved evidence

```sh
bun evals/run.mjs runs
bun evals/run.mjs prune                         # Preview: older than 30 days, keep newest 5
bun evals/run.mjs prune --older-than-days 60 --keep 10
bun evals/run.mjs prune --older-than-days 60 --keep 10 --apply
```

`--apply` permanently deletes selected evidence directories. Review the preview
first. Failed candidate results stay protected unless `--include-failed` is also
supplied. Active, cancelled, incomplete, malformed, linked and unknown evidence
always stays protected. The newest-run allowance counts complete validated runs across the selected root.
Both commands support `--evidence-root directory` and `--json`, work offline,
and leave execution configuration unloaded. The default root is this checkout's
`.valdr-evals/`.

Only evidence inside the selected root is removed. Temporary evaluation
directories are cleaned up separately after verified process shutdown. Reports stored inside a
selected run are removed with it; save reports you want to keep elsewhere.
See [Evidence and isolation](docs/evidence.md#retention) for protection rules and
[Development checks](docs/readiness.md) for validation commands.

## Execution profiles

The default `sol-high` profile uses Codex, `gpt-6.1-sol`, and high reasoning.
Choose model and reasoning through an explicit JSON configuration:

```sh
test -f .evals.local.json || cp evals/config.example.json .evals.local.json
# Edit .evals.local.json to select models available to your Codex account.
bun evals/run.mjs run task-repair --config .evals.local.json \
  --profile sol-low --scenario 01_exact_replacement --dry-run
```

Configuration uses `schemaVersion: 1`, optional `defaults`, and named `profiles`.
A profile accepts only `providerType: "codex"`, a nonblank `model`, and
`reasoningEffort`: `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, or `ultra`.
Model availability and supported reasoning levels depend on your provider.
Workflow authoring uses `workspace-write` to submit its bundle; task repair uses
`read-only` filesystem access and edits its fixture only through MCP. Approval
policy stays `never`.

Precedence is **CLI flags → explicit configuration → built-in defaults**.
When an option is repeated, its last value wins, including `--config`.
`VALDR_BIN` supplies the binary fallback when configuration and CLI omit it.
Relative configuration paths for `packsRoot` and `evidenceRoot` resolve beside the
config file; CLI paths resolve from the current directory. Profile configuration is never
loaded implicitly. Bun loads the repository `.env` for Valdr credentials. Keep
credentials in that ignored file, the host environment or Codex login,
never in profile files. Unknown configuration fields fail before execution.

Common options:

| Option | Default |
|---|---|
| `--scenario` | `all` |
| `--max-repairs` | `0`; bounded to `0..2` |
| `--timeout-ms` | `600000` per turn; bounded to `1000..1200000` |
| `--round` | `baseline`; a lowercase label |
| `--valdr-bin` | `VALDR_BIN`, then `valdr` on PATH |
| `--packs-root` | This checkout |
| `--evidence-root` | `.valdr-evals/` under the selected packs checkout |
| `--json` | Emit one final JSON document on stdout, with progress on stderr |

## Understand the result

Evidence is retained in a new directory per invocation. Start with `summary.json`;
use its scenario outcomes to locate failed attempts. Summary records use
`schemaVersion: 1`. Attempt directories use one-based numbering: `attempt-1`
contains the initial result, and `attempt-2` contains the first repair, if enabled.

| Outcome | Meaning |
|---|---|
| `passed` | The selected evaluation passed and cleanup was verified |
| `candidate_failed` | A submitted candidate failed a requirement or assertion |
| `policy_rejected` | A candidate or observed action violated suite policy |
| `infrastructure_incomplete` | Setup, provider, transport, readback or cleanup could not be verified |
| `submission_incomplete` | The required submission was absent when captured; its cause is undetermined |
| `cancelled` | The invocation was interrupted; available evidence is retained |

A case may pass after repair while retaining earlier failed attempts. Report
first-attempt and eventual passes separately. Infrastructure failures do not
become candidate repair feedback. A passing doctor check establishes fixture compatibility. It does not enable
live authoring or measure agent quality.

Press **Ctrl-C** to stop. SIGINT/SIGTERM trigger cooperative cancellation and
bounded resource cleanup. Exit codes are
`0` for success, `1` for unsuccessful evaluation/readiness, `130` for SIGINT,
and `143` for SIGTERM. Inspect cleanup receipts after an incomplete/cancelled
run. Temporary evaluation directories are deleted after owned process shutdown
is verified; evidence remains available. SIGKILL, host failure or unverified
shutdown can leave temporary directories requiring manual cleanup. The harness
does not copy authentication files. Retention commands remove eligible completed
evidence only.

## Troubleshooting

| Symptom | Next step |
|---|---|
| Valdr not found | Install it or supply `--valdr-bin` |
| Required tools or startup unavailable | Check the installed CLI setup and the reported preflight error |
| Missing Valdr credentials | Run with Bun from the repository root to load the existing `.env`, or export both database credential variables |
| Default Valdr works but disposable preflight fails | Check fresh-workspace initialization with the existing default license; see [public interfaces](docs/public-interfaces.md) |
| Unknown profile or configuration field | Start from `config.example.json`; inspect `--help` |
| Candidate fails | Read the scenario result and failed execution assertions |
| Infrastructure incomplete | Fix the reported infrastructure cause before starting another evaluation |

## More detail and development

The repository's [Valdr Evals skill](../.agents/skills/valdr-evals/SKILL.md) guides agents
through running evaluations, adding scenarios and producing these reports.

- [Workflow authoring](docs/workflow-authoring.md): scenarios and saved-candidate replay.
- [Task repair](docs/task-repair.md): edit/refusal checks and authority boundaries.
- [Evidence and isolation](docs/evidence.md): artifact layout, interpretation and limits.
- [Adding a suite](docs/adding-suites.md): suite hooks and contributor contract.
- [Development checks](docs/readiness.md): code map and validation commands.
- [Public interfaces](docs/public-interfaces.md): setup boundaries and the evidence each live case requires.

```sh
make test-evals       # Harness tests without paid model execution
make check-evals      # Installed CLI fixtures; no model calls
make test-evals-integration # Workflow execution and task repair/refusal, no model calls
bun evals/tests/integration/workflow-binary.mjs  # Installed CLI integration check
```
