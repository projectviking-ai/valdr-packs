# Launcher Preset Router

`launcher-preset-router` reads a task and the registered launcher presets, and returns the preset key the task should be executed with — or `unknown` when nothing distinguishes the candidates. It routes on what presets **declare** about themselves, never on inference from model names.

## Agent

- Handle: `launcher-preset-router`
- Default role: `orchestrator`
- Pack: `valdr-workflow`

## Capabilities

See [AGENT_CAPABILITY_MATRIX.md](AGENT_CAPABILITY_MATRIX.md).

The policy and both `base` capabilities are deliberately **not** hot-load: `buildSystemPrompt` filters hot-load capabilities out of the system prompt, so the router would otherwise choose without its policy or its provider knowledge.

## Output Contract

The final message is a single JSON object:

```json
{
  "outcome": "decided",
  "presetKey": "<key from this turn's listing>",
  "decidedAt": "level_3_description",
  "reasoning": "<one or two sentences citing the declared metadata used>"
}
```

`outcome` is `decided` or `unknown`; on `unknown`, `presetKey` is also `unknown`.

A workflow `session_output` gate parses this, maps `$.outcome` to a workflow outcome, and — with `payload.includeParsed: true` — exposes the whole parsed object downstream at `$.normalized.input.payload.gate.parsed.<field>`. Malformed JSON or an unrecognised `outcome` blocks the run rather than mis-routing.

`decidedAt` records which level of the policy settled it. A registry deciding mostly at `level_4_config` is one whose presets need better descriptions.

## Wiring

Use the [Choose Launcher Preset](../../workflows/task/valdr-workflow.workflow.preset-routing.workflow.yaml) workflow, designed to be called as a subworkflow:

```yaml
- key: pick_preset
  kind: subworkflow
  workflow:
    key: valdr-workflow.task.choose-preset
    version: 0.4.0
  inputs:
    taskKey: "${workflow.inputs.taskKey}"
    routerLauncherConfigKey: "${workflow.inputs.routerPreset}"
  outputs:
    outcome: "$.normalized.child.outputs.outcome"
    presetKey: "$.normalized.child.outputs.presetKey"
```

Branch on `outcome`: `preset_decided` proceeds with `presetKey`; `preset_unknown` is where the calling workflow applies its own default, pauses for a human, or stops. The router deliberately does not choose a default for you.

### Choosing the router's own preset

Valdr MCP is available in every session, so `config.mcpServers` is not a consideration — deployments wire MCP either per preset or at the harness, and its absence means nothing.

What matters is **model capability**. The router must honour a strict JSON output contract, and that is where a weak model fails: in testing, a small model produced correct routing but wrapped it in prose, which the gate rejects. A capable model honoured the contract first time. Pick a preset accordingly.

## Improving Routing Quality

The router is only as good as the metadata your presets carry. A registry with empty `tags` and null `description` gives it nothing to route on, so decisions fall through to configuration signals or to `unknown`.

To get real routing, give each preset a `description` stating what it is for, whether it is code-capable, and how it compares on cost and speed to your others. Note that `pm_provider` exposes only `list_presets`, `create_preset`, and `help` — there is no `update_preset`, so existing presets are annotated through the UI. Some deployments expose only `description` in that UI, which is why the policy treats description as the primary signal.

## Boundaries

Read-only. It does not edit files, change task state, create or modify presets, or launch sessions.
