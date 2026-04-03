<!--<capability id="valdr.agents.hugo-docs-agent.hugo-structure" pack="valdr" role="context">-->
# Hugo Structure & Front Matter Guide

<!--<identity>-->
Reference for Hugo content structure, bundle conventions, and front matter preservation.
<!--</identity>-->

<!--<instructions>-->

## Content Model

- `_index.md`: branch bundles (section/list pages)
- `index.md`: leaf bundles with colocated page resources
- standalone `.md`: leaf pages without bundle resources

## Front Matter Policy

Preserve all existing fields unless drift fix requires change.
Always update `lastmod` when patching content.

Common preserved fields:
- `title`, `description`, `date`, `weight`, `draft`, `categories`, `tags`, `aliases`

Conditional fields:
- set `deprecated: true` for removed features kept for historical reference

## Internal Linking Expectations

Prefer Hugo `ref`/`relref` forms where existing docs use them.
When paths/headings change, search and update affected cross-references.

<!--</instructions>-->
<!--</capability>-->
