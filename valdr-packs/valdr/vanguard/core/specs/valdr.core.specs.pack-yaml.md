<!--<capability id="valdr.core.specs.pack-yaml" pack="valdr" role="context">-->
# Spec: Pack YAML

Mirror of the canonical `pack.yaml` contract for distributable Valdr packs.

<!--<instructions>-->

## Source Of Truth

- `valdr-packs/PACK-SPEC.md`
- Related: `valdr-packs/AGENT-SPEC.md`
- Related: `valdr-packs/PROMPT-SPEC.md`

## Scope

- The `valdr-packs/` root is not a pack.
- Each distributable pack has its own root under `valdr-packs/<pack>/`.
- Pack manifest path: `valdr-packs/<pack>/pack.yaml`.

## Required Fields

```yaml
schemaVersion: 1.0
pack: valdr
name: Valdr Pack
version: 0.1.0
description: Canonical Valdr pack distributed from valdr-packs/valdr.
```

- `schemaVersion`: manifest schema version (string or number).
- `pack`: canonical pack key used in capability and prompt tags.
- `name`: human-friendly pack name.
- `version`: semantic version.
- `description`: short summary.

## Optional Fields

```yaml
authors:
  - name: Jane Doe
    handle: janed
license: MIT
homepage: https://example.com
repository: https://github.com/org/repo
tags: [valdr, agents]
includes:
  - path: valdr
    description: Core Valdr agents and capabilities.
```

- `authors`: list of author objects (`name` required, `handle` optional).
- `license`: SPDX license identifier.
- `homepage`: URL string.
- `repository`: URL string.
- `tags`: short strings for discovery.
- `includes`: directories (relative to pack root) scanned by tooling.

## Discovery Rules

- Tooling reads `pack.yaml` and scans only `includes` paths (or pack root if omitted).
- Entities are discovered from file headers:
  - `<!--<capability id="..." pack="..." role="..." category="..." prompt-tags="tag-a,tag-b">-->`
  - `<!--<prompt key="..." pack="..." role="..." tags="tag-a,tag-b">-->`
- `pack.yaml` does not enumerate entities directly.

## Validation Rules

- `pack` is lowercase and stable across releases.
- `includes` paths are relative to pack root and must not escape it.
- Capability markdown supports optional `category`.
- Capability markdown supports optional `prompt-tags` for generated backing prompts.
- Agent YAML capability entries may include `prompt-tags`; these override capability-header prompt tags for that import.
- Prompt markdown supports optional comma-separated `tags`.
- Prompt tags canonicalize to lowercase, unique, sorted values on import/export.

## Export/Import Guarantees

- Archive layout remains under `valdr-packs/<pack>/...`.
- `manifest.json` carries checksums, digest, entity counts, and dependency graph.
- Pack imports are conflict-aware and deterministic.

<!--</instructions>-->
<!--</capability>-->
