<!--<capability id="valdr.core.specs.agent-yaml" pack="valdr" role="context">-->
# Spec: Agent YAML

Mirror of the canonical `.agent.yaml` contract used by Valdr pack import/export.

<!--<instructions>-->

## Source Of Truth

- `valdr-packs/AGENT-SPEC.md`
- Related: `valdr-packs/PACK-SPEC.md`
- Related: `valdr-packs/PROMPT-SPEC.md`

## Location

- Agent manifests live at the root folder of the agent they describe.
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
- Agent manifests do not include `pack` or `version`; those live in `pack.yaml`.

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
- `capabilities[].category`: optional category label. Must match capability markdown category when both are present.
- `capabilities[].prompt-tags`: optional comma-separated tags applied to the capability backing prompt during import.
- `capabilities[].hot-load`: if true, capability is not loaded by default.
- Capability-backed prompt metadata defaults from capability markdown headers; `capabilities[].prompt-tags` can override tags.
- `prompts`: list of prompt references (non-capability prompts).
- `prompts[].key`: prompt key from `<!--<prompt key="...">-->`.
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
- `constraint` normalizes to `constraints`.

## Prompt Roles

Allowed roles:
- `system`
- `guide`
- `checklist`
- `policy`
- `context`

## System Prompt Rule

- The core capability acts as the base system prompt.
- `prompts` may include `role: system`; these append after core capability content.
- Exactly one `capabilities[].role: core` is required.
- Multiple core capabilities should fail validation.

## Export/Import Guarantees

- Export preserves capability order and hot-load flags.
- Capability prompt keys are derived from capability keys when not explicit.
- Imported capabilities map to prompt-backed records; capability key stays stable.

<!--</instructions>-->
<!--</capability>-->
