# Prompt Markdown Specification

This document defines the prompt Markdown format used by Valdr pack import/export.

## Location

- Prompt files can live anywhere under pack `includes` paths.
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

- Capability markdown may define prompt tags for auto-generated prompts:
  - `<!--<capability id="..." pack="..." role="..." prompt-tags="docs,workflow">-->`
- Agent YAML capability entries may also define `prompt-tags` on `capabilities[]`.
- These tags are applied to the derived backing prompt during import.
- When both are present, agent YAML `prompt-tags` takes precedence for that import.
- Export writes capability-backed prompt tags back into `prompt-tags`.

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
- Tags are canonicalized during import/export:
  - lowercase
  - unique
  - stable sorted order
- Unknown/empty tags are ignored.

## Export/Import Guarantees

- Export always emits prompt markdown (not JSON internals).
- Export includes `tags="..."` when tags are present.
- Import preserves canonicalized tags on prompt records.
- Prompt shape is stable for direct tar/gzip roundtrip workflows.

## Example

```md
<!--<prompt key="valdr-reviewer-sigrid-guide" pack="valdr" role="guide" tags="review,quality,gate">-->
# Valdr Reviewer Guide

Review implementation against acceptance criteria and block defects.
<!--</prompt>-->
```
