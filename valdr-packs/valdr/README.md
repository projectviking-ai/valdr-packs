# Valdr Pack

This directory contains the authored source for the Valdr pack. It builds three self-contained artifacts that all import as logical pack `valdr`.

## Source Layout

```text
valdr/
├── README.md
├── shared/       # Files common to every tier
├── raider/       # Raider-only content and overrides
├── vanguard/     # Vanguard-only content and overrides
└── sovereign/    # Sovereign-only content and overrides
```

Layering order:

- Raider = `shared + raider`
- Vanguard = `shared + raider + vanguard`
- Sovereign = `shared + raider + vanguard + sovereign`

Higher-tier overrides must keep the same relative path, agent handles, and `valdr.*` capability keys when they are intended to replace lower-tier content.

## Tier Model

### Raider

Manual and UI-oriented guidance only.

- Domain and utility agents
- Freya planner
- Sigrid reviewer
- No MCP tool docs, executor flows, auditors, or orchestrators

### Vanguard

MCP-enabled PM workflows without live session orchestration.

- Adds PM tool docs, executor workflows, Gunnar, Nikol, and Tyr v2
- Keeps follow-up in PM state and comments
- Excludes `pm_session`, Skadi, session spawning, and session messaging

### Sovereign

Full orchestration tier.

- Adds `pm_session`
- Adds Skadi
- Adds session-aware reviewer, executor, and orchestrator overrides
- Supports spawning, session messaging, and worktree-aware orchestration

## Building

Run these commands from the repository root:

```bash
node scripts/build-valdr-tier.mjs raider
node scripts/build-valdr-tier.mjs vanguard
node scripts/build-valdr-tier.mjs sovereign
```

Or build all tiers:

```bash
make build-valdr-all
```

Default outputs:

- `build/valdr-raider.valdr-pack.tar.gz`
- `build/valdr-vanguard.valdr-pack.tar.gz`
- `build/valdr-sovereign.valdr-pack.tar.gz`

## Authoring Rules

- Put files in `shared/` only when the content is truly common.
- Put higher-tier replacements at the same relative path so overlays are deterministic.
- Keep overlapping agent handles and `valdr.*` capability keys stable across tiers.
- Do not commit generated build trees or archives.
