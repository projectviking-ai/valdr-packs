# Agent YAML Specification

This document defines the `.agent.yaml` format for agent assembly in Valdr packs.

Related specs:
- `valdr-packs/PACK-SPEC.md`
- `valdr-packs/PROMPT-SPEC.md`

## Location

- Agent manifests live at the **root folder of the agent** they describe.
- Recommended filename: `<handle>.agent.yaml`.
- Example path: `valdr-packs/valdr/valdr/reviewer/sigrid/sigrid.agent.yaml`.

## Required Fields

```yaml
schemaVersion: 1.0
agent:
  handle: sigrid
  name: Sigrid Reviewer
  kind: bot
  defaultRole: reviewer
capabilities:
  - key: valdr.reviewer.sigrid.system
    role: core
```

- `schemaVersion`: manifest schema version (string or number).
- `agent.handle`: canonical handle for registry.
- `agent.name`: display name.
- `agent.kind`: `bot`, `human`, or `ci`.
- `agent.defaultRole`: primary role (e.g., reviewer, executor, planner).
- `capabilities`: list of capability bindings.
- Agent manifests do **not** include `pack` or `version`; those live in the pack-level `pack.yaml`.

## Optional Fields

```yaml
agent:
  tags:
    - valdr
    - reviewer
capabilities:
  - key: valdr.reviewer.sigrid.workflow
    role: workflow
    category: orchestration
    prompt-tags: reviewer,workflow
    hot-load: true
prompts:
  - key: valdr-reviewer-sigrid-guide
    role: guide
    hot-load: true
```

- `agent.tags`: list of tags.
- `capabilities[].category`: optional category label for display/filtering. Must match capability markdown category when both are present.
- `capabilities[].prompt-tags`: optional comma-separated tags applied to the capability's backing prompt. When present, these override capability-header prompt tags for import.
- `capabilities[].hot-load`: if true, the capability is not loaded by default.
- Capability-backed prompt metadata defaults from capability markdown headers; `capabilities[].prompt-tags` can override tags at import time.
- `prompts`: list of prompt references (non-capability prompts).
- `prompts[].key`: prompt key from `<!--<prompt key="...">-->` tags.
- `prompts[].hot-load`: if true, prompt is not loaded by default.

## Capability Roles

Allowed roles:
- `core`
- `workflow`
- `constraints`
- `context`
- `validation`
- `integration`

Legacy alias:
- `constraint` should be normalized to `constraints`.

## Prompt Roles

Allowed roles:
- `system`
- `guide`
- `checklist`
- `policy`
- `context`

## System Prompt Rule

- The **core capability** acts as the base system prompt.
- `prompts` may include `role: system` entries; these are appended after the core capability.
- Exactly one `capabilities[].role: core` is required.
- If multiple core capabilities exist, tooling should fail validation.

## Example (Sigrid Reviewer)

```yaml
schemaVersion: 1.0
agent:
  handle: sigrid
  name: Sigrid Reviewer
  kind: bot
  defaultRole: reviewer
  tags:
    - valdr
    - reviewer
    - code-review
    - quality
    - gatekeeper
capabilities:
  - key: valdr.reviewer.sigrid.system
    role: core
    category: system
  - key: valdr.reviewer.sigrid.workflow
    role: workflow
    category: orchestration
    hot-load: true
  - key: valdr.reviewer.sigrid.severity
    role: constraints
    category: policy
    hot-load: true
  - key: valdr.reviewer.sigrid.scoring
    role: constraints
    category: policy
    hot-load: true
prompts:
  - key: valdr-system-prompt
    role: system
  - key: valdr-system-guide
    role: guide
    hot-load: true
```
