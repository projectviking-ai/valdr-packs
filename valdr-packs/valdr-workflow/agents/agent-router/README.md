# Agent Router

`agent-router` reads a task and the registered agents, and returns the handle of the agent that should take it in a given role — or `unknown` when no eligible agent declares a connection to the work. It routes on what agents **declare** about themselves, never on inference from a handle.

## Agent

- Handle: `agent-router`
- Default role: `orchestrator`
- Pack: `valdr-workflow`

## Capabilities

See [AGENT_CAPABILITY_MATRIX.md](AGENT_CAPABILITY_MATRIX.md).

The policy and `base.mcp-access` are deliberately **not** hot-load: `buildSystemPrompt` filters hot-load capabilities out of the system prompt, so the router would otherwise choose without its policy.

## Output Contract

```json
{
  "outcome": "decided",
  "agentHandles": ["<handle from this turn's listing>"],
  "decidedAt": "level_2_tags",
  "reasoning": "<one or two sentences citing the declared metadata used>"
}
```

`outcome` is `decided` or `unknown`; on `unknown`, `agentHandles` is an empty array. A `session_output` gate parses this, maps `$.outcome`, and exposes the parsed object downstream at `$.normalized.input.payload.gate.parsed.<field>`.

## Eligibility Filters

Four hard filters, all objectively checkable against the registry:

| Filter | Why |
| --- | --- |
| `kind` is `bot` | A `human` agent is a person, not something a workflow can launch. |
| `defaultRole` matches the requested role | An executor is not a substitute for a reviewer. |
| Produces a non-empty system prompt | Needs one non-hot-load capability or one `prompts` entry. Bare handles registered for CLI attachment carry no instructions to work from. |
| Not operator-excluded | Via `tags` or `notes` marking it deprecated or not for routing. |

A `core` capability is **not** required — an agent whose capabilities are all `workflow` or `guide` role still composes a working system prompt, and requiring `core` would wrongly exclude working agents.

## Filter The Listing At The Source

The full agent listing is large enough to crowd out the task the router is meant to be reading. `pm_agent list` accepts `kinds`, `defaultRoles`, `capabilityKeys`, `search`, and `limit`, so the router queries narrowly:

```
pm_agent { action: "list", kinds: ["bot"], defaultRoles: ["executor"], limit: 100 }
```

That both shrinks the result and applies the first two eligibility filters server-side.

## Wiring

```yaml
- key: pick_agent
  kind: subworkflow
  workflow:
    key: valdr-workflow.task.choose-agent
    version: 0.10.0
  inputs:
    taskKey: "${workflow.inputs.taskKey}"
    role: executor
    routerLauncherConfigKey: "${workflow.inputs.routerPreset}"
  outputs:
    outcome: "$.normalized.child.outputs.outcome"
    agentHandles: "$.normalized.child.outputs.agentHandles"
```

Branch on `outcome`: `agent_decided` proceeds with the ordered `agentHandles`; `agent_unknown` is where the calling workflow applies its own default, pauses for a human to assign, or stops.

Call it once per role. A delivery workflow that needs an implementer and then a reviewer runs it twice, with `role: executor` and `role: reviewer`.

### Pairing with the preset router

This router chooses **who**; [`launcher-preset-router`](../launcher-preset-router/) chooses **what it runs on**. They are independent and compose:

```yaml
- key: pick_agent    # -> agentHandles
- key: pick_preset   # -> presetKey
- key: implement
  session:
    reviewerHandles: "${steps.pick_agent.outputs.agentHandles}"
    launcherConfigKey: "${steps.pick_preset.outputs.presetKey}"
```

## Improving Routing Quality

The router is only as good as the metadata your agents carry. Tags are the strongest signal — an agent tagged with its technology and domain routes reliably; one with no tags falls through to its capabilities, then its name, then `unknown`.

Unlike launcher presets, agents carry `tags`, `capabilities`, and `notes`, so there is considerably more to route on.

## Boundaries

Read-only. It does not edit files, change task state, modify agents, or launch sessions. It never returns a human agent.
