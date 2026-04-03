# Agent Prompt Tag Map

This document catalogs the structured tags used in agent charters and prompt fragments so we can keep tagging consistent and later use tags + capabilities + prompts for scoring agent execution.

## Conventions

- All tags are embedded in HTML comments: `<!--<tag ...>-->` … `<!--</tag>-->`.
- Tags may include attributes (for example, `version="1.0"`, `id="status-1"`).
- Tag names are lowercase with underscores; versions are carried via a `version` attribute, not in the tag name.

---

## Charter-Level Tags (Agent Charters)

Used in `agents/*.md` to structure full agent charters.

- `charter`
  - Example: `<!--<charter name="Agent Prompt Architect" version="1.1" scope="pm_mcp">-->`
  - Scope: wraps the entire charter document.
  - Purpose: identifies the agent, schema version, and primary scope.

- `metadata`
  - Wraps key metadata such as `charter_version`, `last_reviewed`, `maintainer`.

- `agentic_preamble`
  - Describes the agent’s high-level identity, autonomy, and mission.

- `purpose`
  - Defines the core role and goals of the agent.

- `inputs`
  - Lists expected inputs and context sources (files, tools, environment).

- `output_spec`
  - Specifies required outputs and their shape (for example, JSON payloads, checklists).

- `payload_schema_hint`
  - Provides a minimal schema hint for structured outputs.

- `research_loop`
  - Encodes the default research/exploration workflow.

- `research_priority`
  - States precedence rules for sources of truth (for example, repo vs. external).

- `planning_checklist`
  - Contains planning steps the agent should always complete before implementation.

- `responsibilities`
  - Groups responsibilities sub-tags; used as a container for role-specific duties.

  - `context_synthesis`
    - How the agent aggregates and reports domain/context information.

  - `prompt_authoring`
    - How the agent writes and structures prompts or fragments.

  - `quality_review`
    - Quality gates and review behaviors, especially for review-type agents.

  - `library_stewardship`
    - Responsibilities for maintaining prompt libraries and mappings.

  - `portfolio_hygiene`
    - Expectations for keeping agents, prompts, and capabilities clean and current.

- `workflow`
  - Describes the high-level step-by-step workflow (from intake to completion).

- `tooling`
  - Lists CLI tools, MCP tools, and other utilities the agent should use.

- `tool_policy`
  - Encodes allowed/disallowed tool usage and safety constraints.

- `success_conditions`
  - Defines when the agent should consider the task “done”.

- `registry`
  - Container for tags that describe how the agent interacts with the agent registry.

  - `discover`
    - How to discover existing agents via MCP (for example, `pm_agent_list`).

  - `update`
    - How to update existing agents (for example, `pm_agent_update`).

  - `register`
    - How to register new agents (for example, `pm_agent_create`).

  - `housekeeping`
    - Ongoing registry hygiene requirements (metadata, capabilities, prompts).

- `deliverables`
  - Enumerates artifacts produced by the agent (charters, prompts, context files).

- `validation`
  - Validation checks (lint, MCP validation, consistency checks) the agent must perform.

- `collaboration`
  - Coordination expectations with other agents (for example, PM, QA).

- `definition_of_done`
  - Final, user-facing definition of when a task is complete.

- `self_reflection`
  - Optional section where the agent evaluates its own performance.

- `fallback`
  - Guidance for degraded modes or what to do when ideal tooling is unavailable.

---

## Behavior Fragment Tags (Base Prompts)

Used primarily in `agents/prompts/base/*.md` to define reusable behavioral fragments.

- `identity`
  - Short identity paragraph for a fragment (for example, communication style, safety posture).

- `instructions`
  - Container for the main behavioral instructions in a fragment.

- `communication_guidelines`
  - Attributes: `version="1.0"`
  - Describes how the agent should communicate (tone, Markdown usage, when to ask questions).

- `prompt`
  - Attributes: `key` (canonical dashed prompt key), `pack` (workspace/focus area, e.g., `typescript`, `pm-ui`, `sql`), `role` (purpose, e.g., `guide`, `charter`, `ops-guide`), optional `version`.
  - Usage: wraps a whole prompt file that will be registered in MCP (system/charter/guide level). Example:
    - `<!--<prompt key="typescript-agent-guide" pack="typescript" role="guide" version="1.1">--> ... <!--</prompt>-->`
  - Scoring: allows auditors to detect which top-level prompt was in force and map to registry versions.

- `prompt_fragment`
  - Attributes: `id`, `pack`, `role`, optional `version`, optional `model` (selector or wildcard as per model selector rules below).
  - Usage: wrap reusable chunks inside larger prompts when you need fragment-level hashing/versioning without making it a standalone capability.

- `guideline`
  - Attributes: `type` (e.g., `testing`, `security`, `observability`, `performance`), optional `id`, `pack`, `version`, optional `model` selectors.
  - Purpose: wrap normative guidance blocks (rules/expectations) so auditors can map compliance to specific guideline types.

- `checklist`
  - Attributes: `type` (e.g., `pull-request`, `release`, `validation`), optional `id`, `pack`, `version`.
  - Purpose: wrap actionable checklists agents must follow or emit; enables scoring against required checklists.

- `execution_loop`
  - Attributes: `version="1.0"`
  - Defines the planning/execution loop, modes, and stop conditions.

- `tool_usage_policy`
  - Attributes: `version="1.0"`
  - Encodes how to use MCP tools, what is canonical, and what is forbidden.

- `safety_and_data`
  - Attributes: `version="1.0"`
  - Standardized data-handling and secrecy rules.

- `status_update_spec`
  - Attributes: `version="1.0"`
  - Requirements for short progress/status updates.

- `summary_spec`
  - Attributes: `version="1.0"`
  - Requirements for final summaries at the end of a turn or task.

- `examples`
  - Container for example interactions illustrating the behavior of the fragment.

---

## Capability Metadata Tags

Used in `agents/prompts/**` to bind a block of text to a capability for hashing/versioning and scoring.

- `capability`
  - Attributes:
    - `id` — canonical capability identifier (for example, `planning.vmp`, `planning.vmp.system`, `planning.vmp.typescript`).
    - `pack` — logical prompt pack (normalized to `valdr` for internal prompts).
    - `role` — capability role from the enum: `core` | `workflow` | `constraints` | `context` | `validation` | `integration`.
      - `core` — Identity, mission, non-negotiable behavior.
      - `workflow` — How the agent operates, loops, execution patterns.
      - `constraints` — Rules, do-nots, invariants, safety rails.
      - `context` — Domain knowledge, background, assumptions.
      - `validation` — Checks, evidence, scoring criteria.
      - `integration` — Tools, MCP, IO contracts, system interaction.
  - Usage:
    - Wrap the full capability prompt body, including the heading:
      - `<!--<capability id="planning.vmp" pack="valdr" role="core">-->`
      - `# Capability Prompt — \`planning.vmp\``
      - `...`
      - `<!--</capability>-->`
  - Scoring note:
    - The canonical version for a capability can be derived by hashing the canonicalized content inside a `capability` block and mapping `(id, hash)` to a semantic version externally.

---

## Example Annotation Tags

Used inside `examples` blocks to structure example I/O.

- `user_query`
  - Attributes: `id="comm-1"`, `id="loop-1"`, etc.
  - Represents a labeled input example from the user’s perspective.

- `assistant_response`
  - Attributes: `id="comm-1"`, `id="loop-1"`, etc.
  - Represents the corresponding assistant response example; `id` should match the paired `user_query`.

---

## Tagging Criteria

Use these criteria to select tags consistently. For full definitions, see the sections above.

- **Capability prompt (full prompt)**: Use `capability` when the file defines a complete capability that should map to a capability key and be hashable as a unit.
- **Registry prompt**: Use `prompt` when the content is intended to be registered in MCP as a top-level prompt.
- **Reusable block**: Use `prompt_fragment` for modular, reusable chunks inside other prompts (not standalone).
- **Rules and expectations**: Use `guideline` to group normative guidance by type (testing, security, etc.).
- **Actionable lists**: Use `checklist` for stepwise actions you want tooling to score.
- **Behavioral contracts**: Use `communication_guidelines`, `execution_loop`, `tool_usage_policy`, `safety_and_data`, `status_update_spec`, `summary_spec` for standardized behavior.
- **Examples**: Always wrap example I/O in `examples`, with paired `user_query` and `assistant_response` IDs.
- **Versioning**: Add `version` attributes for behavioral tags and bump on meaningful changes; keep `id` attributes stable.

---

## Tagging Guidelines and Future Scoring

- Prefer reusing the tags defined here over inventing new ones; if you need a new tag, add it to this map with a short description.
- Use `version` attributes on behavioral tags (`communication_guidelines`, `execution_loop`, etc.) when you introduce breaking or significant changes.
- Keep `id` attributes stable for examples so they can be referenced in tests, docs, or scoring pipelines.
- Model scoping: Behavioral tags (`instructions`, `communication_guidelines`, `execution_loop`, `tool_usage_policy`, `safety_and_data`, `status_update_spec`, `summary_spec`) may target models via either a `model="<selector>[,<selector>...]"` attribute on the tag **or** nested `<model type="<selector>"> … </model>` blocks placed directly inside the tag. Selectors may be exact IDs or glob wildcards with `*` (any substring, e.g., `gpt-*`, `gpt-*-codex`, `gemini-*-flash`; `?` MAY be supported for single-char). Content with no model targeting is the default and MUST exist. Model selectors must come from the canonical allowlist (to be stored with prompts, e.g., `agents/prompts/MODEL_IDS.json`). Precedence: exact match > more specific wildcard (longest literal) > file order.
- Scoring hooks: `prompt`, `prompt_fragment`, `guideline`, and `checklist` tags exist to let auditors and tooling map observed prompts to specific guideline/checklist blocks. Use `type` attributes on `guideline`/`checklist` so automated scoring can align evidence with the correct rule set (e.g., `type="testing"`, `type="pull-request"`).
- In the future, prompt analysis and agent scoring can key off:
  - Which behavioral fragments (and versions) an agent includes.
  - Which capabilities and registry operations it is allowed to perform.
  - How often its execution traces align with the expectations encoded in these tags.
