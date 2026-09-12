# Verdandi — Workflow Orchestrator

Verdandi authors, runs, inspects, debugs, and repairs Valdr workflows. It is the
agent to reach for when a workflow needs to exist, needs to run, or has stopped
and nobody knows why.

## Why this agent exists

Workflow authoring has a specific failure mode: a definition that validates
cleanly and still cannot run. An agent handle that does not exist, a gate whose
`extract.path` names a field the agent never emits, a schema field the runtime
silently ignores, or simply a stale server answering with old contracts — each
produces a confident-looking result that is wrong.

Verdandi's prompts encode those failures directly, so a user does not rediscover
them one run at a time.

## Capabilities

| Key | Role | Hot-load | Purpose |
|---|---|---|---|
| `valdr-workflow.verdandi.system` | core | no | Identity, the four jobs, the working loop |
| `valdr-workflow.verdandi.hazards` | constraints | **no** | Failure modes that mislead rather than announce themselves |
| `valdr-workflow.base.mcp-access` | constraints | **no** | How PM data is reached, and how it is not |
| `valdr-workflow.verdandi.authoring` | workflow | yes | Step kinds, how a step waits, expressions, contracts |
| `valdr-workflow.verdandi.operating` | workflow | yes | Starting, watching, re-running, cancelling |
| `valdr-workflow.verdandi.debugging` | workflow | yes | Symptom table and the diagnostic order |
| `valdr.core.tools.*` | integration | yes | Tool contracts pulled in on demand |

`hazards` and `mcp-access` are deliberately **not** hot-load. `buildSystemPrompt`
filters hot-load capabilities out of the system prompt, and these two are the
rules that stop Verdandi shipping something that validates but cannot run — they
have to be present on every turn.

## The rule it is built around

**A workflow that validates has not been shown to run.** Validation checks
shape. It cannot see whether a handle exists, whether an agent will honour a JSON
contract, or whether a declared field is actually consumed by the runtime. The
sharpest case: a session input step with two expected outcomes and no gate
validates cleanly and then parks its run forever.

Verdandi closes that gap with `test_definition`, which drives an unsaved
definition through a real run before anything is registered — and where it has
not run something, it says so, reporting validation and execution as separate
claims.

## Using it

Launch it like any registered agent — `pm_session launch_task` with
`agentHandle: verdandi` and a preset able to honour instructions and reach the
repository. It needs the Valdr MCP tools, which every preset provides.

Good first asks:

- "Write me a workflow that reviews a task for readiness and blocks if it isn't."
- "Run `<workflow>` against `<task>` and tell me what it did."
- "Run `<ulid>` is blocked. Why?"
- "This validates but the run won't start. What's wrong?"

## Related

- A target workspace may provide its own workflow documentation or operating
  ledger.
