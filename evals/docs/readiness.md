# Development checks

## Code map

| Path | Responsibility |
|---|---|
| `run.mjs` | Command dispatch, source snapshots and result persistence |
| `cli/` | Arguments, configuration, prerequisite checks and terminal output |
| `suites/registry.mjs` | Suite loaders and comparison provenance |
| `core/` | Installed CLI processes, scoped MCP requests, evidence and cleanup |
| `suites/task-repair/` | Task fixtures, permitted edits and result evaluation |
| `suites/workflow-authoring/` | Workflow scenarios, fixtures and result evaluation |
| `reporting/` | Saved-result summaries, comparisons and standalone HTML |
| `retention/` | Evidence inventory and retention |
| `tests/` | Offline regressions and explicit CLI integration checks |

## Validation commands

Run repository validation and offline tests with Bun 1.4.3+, Node.js and Git:

```sh
make ci-validate
```

The installed `valdr` CLI is required for fixture and integration checks.
`check-evals` verifies fixture readiness without Codex or provider authentication.
These commands make no model calls:

```sh
make test-evals
make check-evals
make test-evals-integration
```

For pack validation and all of the checks above, use:

```sh
make check-evals-readiness \
  VALDR_BIN=/absolute/path/to/installed/valdr \
  PACK_VALDR_BIN=/absolute/path/to/pinned/valdr
```

`PACK_VALDR_BIN` must match `VALDR_WORKFLOW_CLI_VERSION`; it defaults to
`VALDR_BIN`. Installed checks use the existing `.env` database credentials and
normal `~/.valdr` license setup. Run from the repository root with Bun.

The author integration check additionally needs `codex` on PATH and normal
access to its local storage. It substitutes a loopback model server, so there
are no paid model calls. It verifies the exact persona, effective model and
reasoning, absence of inherited skills and unrelated tool connections, broker
approval/denial, same-thread repair and process cleanup.

Fixture and mocked-provider checks establish harness readiness. Run both full
agent suites separately to measure actual candidate behavior:

```sh
bun evals/run.mjs run task-repair --scenario all --max-repairs 0
bun evals/run.mjs run workflow-authoring --scenario all --max-repairs 0
```

These two `run` commands use models. Offline validation requires neither a
license nor provider authentication.
