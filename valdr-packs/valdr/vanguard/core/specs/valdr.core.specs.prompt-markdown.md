<!--<capability id="valdr.core.specs.prompt-markdown" pack="valdr" role="context">-->
# Spec: Prompt Markdown

Mirror of the canonical prompt markdown contract used by Valdr pack import/export.

<!--<instructions>-->

## Source Of Truth

- `valdr-packs/PROMPT-SPEC.md`
- Related: `valdr-packs/AGENT-SPEC.md`
- Related: `valdr-packs/PACK-SPEC.md`

## Location

- Prompt files may live anywhere under pack `includes` paths.
- Recommended filename: `<prompt-key>.md`.
- Example path: `valdr-packs/valdr/valdr/core/context/hugo-documentation-context.md`.

## Required Header Shape

```md
<!--<prompt key="hugo-documentation-context" pack="valdr" role="context">-->
# Hugo Documentation Context

Prompt body content...
<!--</prompt>-->
```

- `key`: canonical prompt key.
- `pack`: pack key.
- `role`: prompt role.

## Optional Header Attributes

```md
<!--<prompt key="hugo-documentation-context" pack="valdr" role="context" tags="docs,hugo,reference">-->
```

- `tags`: optional comma-separated prompt tags.

## Capability-Backed Prompt Tags

- Capability markdown may define tags for auto-generated prompts:
  - `<!--<capability id="..." pack="..." role="..." prompt-tags="docs,workflow">-->`
- Agent YAML capability entries may also define `prompt-tags` on `capabilities[]`.
- Import applies `prompt-tags` to the derived backing prompt.
- When both are present, agent YAML `prompt-tags` takes precedence for that import.
- Export writes backing prompt tags back into `prompt-tags`.

## Prompt Roles

Allowed roles:
- `system`
- `guide`
- `checklist`
- `policy`
- `context`

## Content Rules

- Prompt content begins after the opening tag.
- First heading is treated as display name (recommended `# <name>`).
- Remaining content is persisted as prompt body.
- Closing `<!--</prompt>-->` is recommended.

## Validation Rules

- Prompt keys use dashed naming and lowercase.
- Tags canonicalize on import/export:
  - lowercase
  - unique
  - sorted
- Unknown or empty tags are ignored.

## Export/Import Guarantees

- Export emits prompt markdown (not JSON internals).
- Export includes `tags="..."` when tags exist.
- Import preserves canonicalized tags on prompt records.
- Prompt shape is stable for direct tar/gzip roundtrip workflows.

<!--</instructions>-->
<!--</capability>-->
