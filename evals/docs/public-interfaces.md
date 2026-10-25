# Public evaluation interfaces

The harness runs pack agents and workflow scenarios using public Codex CLI and
Valdr MCP interfaces. It does not read Valdr application source, copy activation
state, or use unpublished service endpoints.

## Setup and boundaries

Run with Bun from the repository root. Bun loads the existing `.env`; the
harness preserves `VALDR_DB_USERNAME` and `VALDR_DB_PASSWORD` and the normal
`~/.valdr` setup. It uses the existing license without a new key or activation
copy. Replacing those credentials or redirecting the default Valdr base directory
breaks the existing setup and is not fixture isolation.

Fixtures use fresh owned `--pm-home` and `--runtime-root` paths and a scratch Git
repository. Before mutations, public `pm_health` must confirm that the PM data
path matches the owned home. The user's normal workspace is never a fixture.
See [installation](https://valdr.ai/valdr/docs/getting-started/install/).

The author runs with public `codex exec`, exact-ID `exec resume` for repairs,
and the persona composed through `pm_agent.get_prompt`. Codex uses its existing
sign-in. Personal configuration, rules, inherited skills, shell, web and unrelated
MCP connections are disabled. The configured broker permits only suite-authorized
requests; provider approval is granted only to that broker. The installed-CLI
scope test uses a loopback model server to inspect actual prompts and tools,
exercise resource discovery and denial, and verify same-thread repair without
model calls. Codex's native resource and resource-template listing helpers may
target `valdr` or omit the server because it is the only configured connection.
Resource reads, foreign targets and other native helpers remain outside the
author's permitted scope.

A completed turn, matching final-message file and stopped process group are
required before scoring. Provider access failures remain infrastructure failures.
Provider-managed transcripts stay in normal Codex storage. Authentication is not
copied into fixtures or evidence.

## Workflow evidence

Definitions are validated and saved through `pm_workflow`. Each variant starts
an owned run; bounded advancement follows active children and retains the
one-time public callback token in memory. Callback submission receipts correlate
the evaluator's exact request with its acknowledged input ID and durable
accepted-input/event records. Tokens are redacted.

Run detail includes the saved definition, every attempt, latest step status,
waits and children. Event pagination must reach its final page; attempt identities,
latest-step records and completion events must agree before scoring. Child
associations and event sequence establish ordering; timestamps alone do not.
Command assertions use actual normalized operation results, and returned receipts
must trace to those results through definition mappings. Loops retain their
previous-pass lineage. Missing or truncated evidence prevents a score.

Sources: [workflow operations](https://valdr.ai/valdr/docs/valdr-mcp/workflows/),
[runtime values](https://valdr.ai/valdr/docs/workflows/definition-authoring/#runtime-values),
[bounded loops](https://valdr.ai/valdr/docs/workflows/steps/condition/#bounded-loop-back),
[child workflows](https://valdr.ai/valdr/docs/workflows/steps/subworkflow/), and
[command results](https://valdr.ai/valdr/docs/workflows/steps/command/#results).

## Evidence required by each case

The workflow catalog contains 11 cases and 33 vectors. Keep the existing briefs,
holdouts, operation requirements and type checks when changing how execution
evidence is collected.

| Case | Required observable evidence |
| --- | --- |
| `01_routed_release` | Selected and skipped steps, actual probe output, and preparation → action → optional audit → finish order; unknown routes stop before effects. |
| `02_loop_receipts` | Setup once, three actual inspect/decision passes, previous reason from the immediately preceding pass, and final typed outputs; preflight refusal executes no loop. |
| `03_typed_fanout` | Real children in input order with typed inputs/results; no children for empty input; rejected second child blocks parent completion. |
| `04_nested_contracts` | Actual root → middle → leaf relationships, typed input/output forwarding, and refusal propagated through both ancestors. |
| `05_callback_quality_gate` | Accepted callback outcome and payload, digest validation, exactly the selected action branch, and no effects after a mismatched digest. |
| `06_optional_task_lookup` | Actual nullable task read, boolean presence, exact found/missing branch, real task identity and typed results. |
| `07_child_loop_exhaustion` | One real child per pass, setup once, successful first pass or exactly three exhausted passes, and no extra child or completion after exhaustion. |
| `08_callback_task_fanout` | Accepted exact task list, ordered child reads with each item's actual task/project association, and no children for invalid lists. |
| `09_business_release` | Actual publish/archive/audit command results with exact order and multiplicity, independent of authored step names; no operations for an unknown route. |
| `10_business_review` | Actual review/remediation/publication sequence, total review limit, retained immediately preceding review evidence, and no final remediation or publication after exhaustion. |
| `11_business_approval` | Announcement, unique matching callback wait, accepted correlated decision, disposition then audit; wrong request or seal prevents effects. |
| Task repair 01, 04, 05, 06 | Completed agent turn, exact requested description/checklist-label edits, required read/update/reload sequence, valid receipt, and unchanged guard task and unrelated state. |
| Task repair 02, 03, 07, 08, 09 | Completed agent turn and correct refusal, with no mutation attempt, including denied, partial, reverted or no-op writes. |

Actual Command results must be distinguishable from invented declared outputs.
Command outcomes and captured output are public behavior; confirm their supported
retrieval through the run API. [Command results](https://valdr.ai/valdr/docs/workflows/steps/command/#results)


## Validation

See [development checks](readiness.md) for offline, installed-CLI and full live
suite commands. Regression tests cover incomplete event pages, missing attempts,
wrong child scopes, invented receipts, reordered operations, invalid callback
correlation, unverified provider completion and incomplete shutdown.

Fixture and mocked-provider checks establish harness behavior. Actual agent
results come only from completed live trials. Preserve failed trials and replay
unchanged candidates separately when correcting an evaluator.
