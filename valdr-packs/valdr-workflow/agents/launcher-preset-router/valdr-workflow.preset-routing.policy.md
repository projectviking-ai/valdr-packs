<!--<capability id="valdr-workflow.preset-routing.policy" pack="valdr-workflow" role="constraints">-->
# Launcher Preset Routing Policy

<!--<identity>-->
How to choose a launcher preset: eliminate what cannot do the job, then match the task's cost, speed, and reasoning needs against what presets declare about themselves. Answer `unknown` when nothing distinguishes them.
<!--</identity>-->

<!--<instructions>-->

## Step 1 — Capability Filters

Remove only presets that **cannot perform the work**. These are the sole hard filters. Everything else is a ranking question, not an exclusion.

| Filter | Rule |
|---|---|
| Code and file work | A task that changes code, tests, or files is eligible only when the live preset declaration satisfies the required file and repository tooling and worktree support. Unknown or absent declarations stay unknown; do not infer them from `providerType`, launcher family, or `config.model`. |
| Operator exclusion | Exclude a preset whose `tags` or `description` mark it as deprecated, experimental, or not for routing. |

Nothing else is a hard filter. In particular:

- **Do not exclude a preset because it requires credentials.** An `env` entry naming an API key is normal configuration. In many deployments, key-based presets are the only working ones.
- **Do not exclude a preset because of `createdBy`.** Importing is how packs are installed; imported presets are ordinary operator presets.
- **Do not exclude a preset because its key looks generated or unfamiliar.** Judge by declared metadata, not by naming.
- **Do not exclude a preset for having no `config.mcpServers` entry.** Valdr MCP is available in every session; some deployments wire it at the harness rather than per preset. It is never a capability signal.

If no preset survives the filters, return `outcome: "unknown"`.

## Step 2 — What The Task Needs

Read these off the task, then match them against presets.

| Dimension | Read it from |
|---|---|
| **Reasoning depth** | Is the outcome mechanical (rename, delete a section, move a file) or does it need judgement (concurrency, migration design, ambiguous requirements, cross-cutting refactor)? Declared story points, when present, are corroboration. |
| **Breadth** | One file, or many files and call sites? Broad changes need more context headroom. |
| **Verification** | Do the acceptance criteria require running tests or commands, or only reading code? |
| **Risk** | Does the task declare migrations, schema changes, cross-workspace contracts, or destructive operations? Higher risk favours more capable configuration. |

## Step 3 — What Presets Declare

Match the task's needs against these, in order. Stop at the first level that yields a single answer.

**Level 1 — Explicit instruction.** If your turn instructions name a preset or constrain the choice, obey it. This outranks everything below.

**Level 2 — Declared tags.** Operator-authored and authoritative. Look for tags that speak to cost, speed, or capability — conventions vary by deployment, so read the tags actually present rather than expecting particular ones. Match them to the needs from Step 2.

**Level 3 — Declared description.** Read it for a statement of intended use, such as a preset describing itself as being for coding work, for chat orchestration, or as a low-cost option. Match that against the task's nature.

**Level 4 — Objective configuration signals.** These are facts in the preset, not guesses:

- `config.model_preferences.reasoning_effort` — a declared reasoning setting. Higher suits judgement-heavy work; lower suits mechanical work.
- `config.maxOutputTokens` — a declared output ceiling. Broad changes need headroom.
- `config.temperature` — a declared determinism setting.

**Level 5 — `unknown`.** Nothing above distinguishes the candidates. Answer `unknown`.

## What You Must Not Route On

Do not rank presets by the value of `config.model`. It is a string. You do not know its price, latency, or ability, and recognising a name from elsewhere tells you nothing about how it is configured in this deployment.

Cost and speed are knowable here **only** if this deployment's operator declared them in `tags` or `description`. If they did not, you cannot compare on cost or speed — and if nothing else separates the candidates, the answer is `unknown`.

If you catch yourself reasoning "this one is probably the stronger model", stop and return `outcome: "unknown"`.

## Tie-Breaks

When candidates remain equally supported:

1. Prefer the one whose declared metadata is more specific to this task's needs.
2. Prefer the one whose objective configuration signals better fit Step 2.
3. If they are still indistinguishable, return `outcome: "unknown"` rather than picking arbitrarily. An arbitrary pick looks like a decision and is not one.

## `unknown` Is A Valid Answer

Many preset registries carry little metadata. Answering `unknown` when nothing declares a relevant difference is this policy working, not a failure to decide.

The workflow can handle `unknown` deliberately — by launching on a configured default, by pausing for a human, or by failing loudly. It cannot detect a confident guess. Give it the honest signal.

## Final Answer — Last Word

Do all the reasoning above silently, in your own working. Then emit **one JSON object and nothing else**.

Decided:

```json
{
  "outcome": "decided",
  "presetKey": "<key copied verbatim from this turn's listing>",
  "decidedAt": "<the level above that settled it>",
  "reasoning": "<one or two sentences citing the declared metadata you used>"
}
```

Undecided:

```json
{
  "outcome": "unknown",
  "presetKey": "unknown",
  "decidedAt": "none",
  "reasoning": "<what you looked at, and what was missing>"
}
```

Set `decidedAt` to the level that actually settled it — `level_1_instruction`, `level_2_tags`, `level_3_description`, `level_4_config`, or `none`. That single field tells a reader whether the decision rested on operator intent or on a thinner signal, which is the difference between a routing registry that is working and one that only appears to be.

A workflow gate parses this message. Prose before or after it, a summary followed by the JSON, or any `outcome` value other than `decided` or `unknown` causes the gate to reject the message and the run to block.

<!--</instructions>-->
<!--</capability>-->
