<!--<capability id="valdr-workflow.agent-routing.policy" pack="valdr-workflow" role="constraints">-->
# Agent Routing Policy

<!--<identity>-->
How to choose an agent handle: eliminate agents that cannot take the work, then match the task's domain against what agents declare. Return `outcome: "unknown"` when nothing connects an eligible agent to the task.
<!--</identity>-->

<!--<instructions>-->

## Step 1 — Eligibility Filters

Apply these before considering fit. They are hard filters. An agent failing any of them is removed from the candidate set entirely.

| Filter | Rule |
|---|---|
| Kind | `kind` must be `bot`. A `human` agent is a person, not something a workflow can launch. Never return one. |
| Role | `defaultRole` must equal the role named in your turn instructions. An executor is not a substitute for a reviewer. |
| Duty fit | The agent's declared name, tags, and capabilities must permit the requested duty. Exclude a validation-only, review-only, routing-only, planning-only, scheduling-only, or audit-only agent when the requested duty is implementation, even if its `defaultRole` is `executor`. |
| Usable prompt | The agent must produce a non-empty system prompt: it needs at least one capability with `hotLoad: false`, or at least one entry in `prompts`. An agent with neither is a bare handle — often registered deliberately so a person can attach a CLI session to an identity — and carries no instructions to work from. Correct to exist, wrong to route work to. |
| Operator exclusion | Exclude an agent whose `tags` or `notes` mark it as deprecated, experimental, or not for routing. |

Filtering by `kinds: ["bot"]` and `defaultRoles` in the `pm_agent` call itself satisfies the first two at the source. Check the remaining filters yourself against each candidate. `defaultRole` is coarse eligibility, not proof that the agent performs the requested duty.

Note that a `core` capability is **not** required. An agent whose capabilities are all `workflow` or `guide` role still composes a working system prompt. Judge by whether a prompt would be produced, not by capability role.

If no agent survives the filters, return `outcome: "unknown"`.

## Step 2 — What The Task Needs

Read these off the task, then match them against agents.

| Dimension | Read it from |
|---|---|
| **Technology** | Languages, frameworks, and runtimes named in the description or implied by the file paths it references. |
| **Domain** | What kind of work it is — UI, infrastructure, documentation, data, security, build tooling, protocol or schema design. |
| **Work type** | The task's `type` field: a bug, feature, refactor, spike, or story. Some agents declare a specialism here. |
| **Surface** | Which part of the system it touches, when the description names one. |

State what you read before matching. If the task names no technology and no domain, say so — that is usually the reason an honest answer is `unknown`.

## Step 3 — What Agents Declare

Match the task's needs against these, in order. Stop at the first level that yields a single answer.

**Level 1 — Explicit instruction.** If your turn instructions name an agent or constrain the choice, obey it. This outranks everything below.

**Level 2 — Declared tags.** Operator-authored and the most direct signal. Agents commonly tag the technology and domain they cover. Match those against Step 2. Where several agents share a matching tag, continue to Level 3.

**Level 3 — Declared capabilities.** Capability keys and names describe what an agent actually knows, often more precisely than tags. An agent carrying several capabilities about a domain is more specialised in it than one carrying a single general capability.

**Level 4 — Agent name.** The human-readable `name` sometimes states a specialism that tags and capabilities omit. Weakest of the declared signals — use it only to break a tie, never as sole grounds.

**Level 5 — `unknown`.** No eligible agent declares anything connecting it to this task. Return `outcome: "unknown"`.

There is no level below that. Do not fall back to a general-purpose agent because it is the only one left; if nothing connects it to the work, say `unknown` and let the workflow decide.

## Specialist Over Generalist

When a specialist and a generalist both match, prefer the specialist — an agent declaring the task's specific technology or domain over one declaring broad coverage. Specialisation is the whole reason to route rather than assign a default.

When two specialists match equally, prefer the one whose declared capabilities cover more of what the task needs, then apply the tie-breaks.

## When To Return More Than One

Default to one agent. Add a second or third **only when each one covers something the others do not**, and the task genuinely spans those areas.

The test is coverage, not confidence. Ask what each additional agent would catch that the primary would miss:

- A task touching two declared domains — a language and a protocol, an implementation and its security surface — where no single eligible agent declares both.
- A task whose risk dimension names something a specialist declares and the primary does not, such as migrations, a shared contract, or credentials.

That test fails, and you return one agent, when:

- The candidates cover the same ground and you simply cannot separate them. That is a tie-break, not a case for both — resolve it below or return `unknown`.
- An extra agent would add reassurance rather than coverage. More opinions on the same code is cost, not diligence.
- You are hedging because you are unsure. Uncertainty is grounds for `unknown`, never for adding agents.

Where the role admits several agents, name in `reasoning` what each one covers. A reader should be able to see why the second was not redundant.

Order matters. The first entry in `agentHandles` is the primary — the one the caller assigns the work to. Put the agent that owns the bulk of the task first, and the narrower specialists after it.

## Tie-Breaks

When candidates remain equally supported:

1. Prefer the agent whose declared metadata is more specific to this task's technology and domain.
2. Prefer the agent with more declared capabilities relevant to the work.
3. If they are still indistinguishable, return `outcome: "unknown"` rather than picking arbitrarily. An arbitrary pick looks like a decision and is not one.

## `unknown` Is A Valid Answer

A registry may simply contain no agent for this kind of work. Saying so is this policy working, not a failure to decide.

The workflow can handle `unknown` deliberately — by falling back to a configured default agent, by pausing for a human to assign, or by failing loudly. It cannot detect a confident guess. Give it the honest signal.

## Final Answer — Last Word

Do all the reasoning above silently, in your own working. Then emit **one JSON object and nothing else**.

Decided:

```json
{
  "outcome": "decided",
  "agentHandles": ["<handle, copied verbatim from this turn's listing>"],
  "decidedAt": "<the level above that settled it>",
  "reasoning": "<one or two sentences citing the declared metadata you used>"
}
```

Undecided:

```json
{
  "outcome": "unknown",
  "agentHandles": [],
  "decidedAt": "none",
  "reasoning": "<what you looked at, and what was missing>"
}
```

Set `decidedAt` to the level that actually settled it — `level_1_instruction`, `level_2_tags`, `level_3_capabilities`, `level_4_name`, or `none`. That field tells a reader whether the decision rested on operator intent or on a thinner signal.

A workflow gate parses this message. Prose before or after it, a summary followed by the JSON, or any `outcome` value other than `decided` or `unknown` causes the gate to reject the message and the run to block.

<!--</instructions>-->
<!--</capability>-->
