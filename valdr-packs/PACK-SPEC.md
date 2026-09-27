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
  - path: workflows
    description: Workflow definitions shipped by the pack.
```

- `authors`: list of author objects (`name` required, `handle` optional).
- `license`: SPDX license identifier.
- `homepage`: URL string.
- `repository`: URL string.
- `tags`: list of short strings for discovery.
- `includes`: list of directories (relative to pack root) that tooling should scan.

## Discovery Rules

- Tooling reads `pack.yaml` and scans only the `includes` paths (or pack root if omitted).
- User workflow tools (Valdr 0.3.3+) are discovered from `*.tool.yaml`, `*.tool.yml`, and `*.tool.json` under included paths.
- Workflows are discovered from canonical `*.workflow.yaml` and `*.workflow.yml` files under the included paths.
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

## Executable user workflow tools

The standalone `valdr-packs/valdr-tools` pack is the canonical source for language starters and CLI adapters. A tool manifest declares a pack-first `<pack>.user.<name>` identity, revision, name, actions and schemas, explicit file inventory, process argv/environment names, and resource limits. Optional top-level `icon` selects a named Heroicon; omitted or unknown names use the default tool icon. Validate manifests with `valdr validate-pack`; use the [authoring skill](../skills/valdr-workflow-tools/SKILL.md) for process and update requirements.

A source archive carries negotiated `userTools.version: 1` entries with tool ID, revision, content hash, manifest path and owning pack key. The original manifest and all inventoried files are retained. Older readers that do not understand this metadata must reject the archive. Use a compatible Valdr CLI to validate and generate executable-tool archives.

Each CLI occupies `tools/<cli>/` (`gh`, `aws`, `gcloud`, or `acli`) with its own manifest and self-contained `runner.mjs`; no other CLI command table enters its snapshot. `scripts/generate-user-workflow-cli-tools.mjs` emits these files, and `--check` verifies them.

Imported tools are immediately available as individual named Builder library entries, one per tool ID. New steps use the latest installed revision, while existing workflow pins remain unchanged. Manage installed revisions in **Workflows → Tools**, after **Runs**; import/export remains in **Settings → Valdr Packs**. Import never executes files, installs dependencies or authenticates CLIs. Workflows execute their programs on the host, like Command steps, and select the working directory; optional step-level `cwd` supports absolute or relative overrides and expressions. New manifests omit `process.cwd`; the optional legacy value is ignored. Inventoried file arguments resolve against the retained tool root. Manifest `inheritEnv` names are used directly with internal and unsafe names filtered. No project key or workflow context is added to the JSON stdin/stdout contract.

Export contains source bytes and pins, excluding host environment values. Same ID/revision with changed content conflicts; change revision and select the new pin explicitly. Host-installed runtime and CLI versions remain independent of the source hash.
