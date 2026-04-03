# Valdr Packs

This directory contains pack specifications and authored pack content used to produce importable `.valdr-pack.tar.gz` archives.

## Specs

- `PACK-SPEC.md` — `pack.yaml` schema, include rules, and archive expectations
- `AGENT-SPEC.md` — `.agent.yaml` schema and agent assembly rules
- `PROMPT-SPEC.md` — tagged capability and prompt markdown conventions
- `TAG-MAP.md` — structured naming and tagging guidance

## Directory Layout

```text
valdr-packs/
├── PACK-SPEC.md
├── AGENT-SPEC.md
├── PROMPT-SPEC.md
├── TAG-MAP.md
└── <pack>/
    ├── README.md
    ├── pack.yaml            # optional if the pack is generated from layers
    ├── agents/
    ├── shared/
    └── ...
```

Each pack directory is its own authored source tree. A pack may be:

- a concrete pack root with a checked-in `pack.yaml`
- a layered source tree that is assembled into a temporary concrete pack before archive generation

## Building

The generic archive generator lives at the repository root:

```bash
node scripts/generate-valdr-pack.mjs <pack-dir>
```

It expects a concrete pack directory containing `pack.yaml` plus all included files.

This repo also contains a pack-specific wrapper for the layered Valdr pack:

```bash
node scripts/build-valdr-tier.mjs raider
node scripts/build-valdr-tier.mjs vanguard
node scripts/build-valdr-tier.mjs sovereign
```

That wrapper assembles a temporary concrete pack tree and then delegates to `generate-valdr-pack.mjs`.

## Pack Authoring Rules

- Keep `pack.yaml` as the contract for the final distributable pack.
- Keep agent handles and capability keys stable when a higher-tier or derived pack is meant to replace lower-tier content.
- Put reusable instructions in tagged markdown capabilities instead of duplicating large prompt bodies.
- Do not commit generated staging trees or archives.

## Authoring Workflow

1. Define the pack layout and includes.
2. Write `pack.yaml` or a build wrapper that generates it.
3. Author `.agent.yaml` manifests and tagged markdown capabilities/prompts.
4. Build the archive locally.
5. Verify the archive packages successfully before publishing.

Generated outputs and staging trees live under `build/` and should not be committed.

## Included Packs

- `valdr/` — the canonical Valdr multi-tier pack for the Valdr PM ecosystem

See the README inside each pack directory for pack-specific structure and build rules.
