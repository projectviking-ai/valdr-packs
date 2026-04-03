# Pack YAML Specification

This document defines the `pack.yaml` format for Valdr packs.

Related specs:
- `valdr-packs/AGENT-SPEC.md`
- `valdr-packs/PROMPT-SPEC.md`

## Scope

- The `valdr-packs/` root is **not** a pack.
- Each distributable pack has its own root under `valdr-packs/<pack>/`.
- The pack manifest lives at `valdr-packs/<pack>/pack.yaml`.

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
- `version`: semantic version of the pack contents.
- `description`: short summary of the pack.

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
- `tags`: list of short strings for discovery.
- `includes`: list of directories (relative to pack root) that tooling should scan.

## Discovery Rules

- Tooling reads `pack.yaml` and scans only the `includes` paths (or pack root if omitted).
- Capabilities and prompts are discovered from Markdown headers:
  - `<!--<capability id="..." pack="..." role="..." category="..." prompt-tags="tag-a,tag-b">-->`
  - `<!--<prompt key="..." pack="..." role="..." tags="tag-a,tag-b">-->`
- `pack.yaml` must **not** enumerate every agent/capability/prompt.

### Capability Category

- Capability markdown may include an optional `category` attribute.
- Agent YAML capability entries may also include `category`.
- If both are present, import must fail when values differ.

### Capability Prompt Tags

- Capability markdown may include optional `prompt-tags` for the generated backing prompt.
- `prompt-tags` is a comma-separated list.
- Export writes `prompt-tags` from the capability's backing prompt tags.
- Import applies `prompt-tags` to the generated backing prompt record.
- Agent YAML capability entries may also include `prompt-tags`; when present they override capability-header prompt tags for that import.

### Prompt Tags

- Prompt markdown may include an optional `tags` attribute.
- `tags` is a comma-separated list, e.g. `tags="docs,reference,mcp"`.
- Import/export canonicalizes tags to lowercase, unique values, and stable sort order.

## Example (valdr pack)

```yaml
schemaVersion: 1.0
pack: valdr
name: Valdr Pack
version: 0.1.0
description: Canonical Valdr pack distributed from valdr-packs/valdr.
includes:
  - path: valdr
    description: Core Valdr agents and capabilities.
  - path: valdr-internal
    description: Internal executor workflows and TypeScript task agent tooling.
```
