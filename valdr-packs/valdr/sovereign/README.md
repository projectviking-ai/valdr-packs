# Valdr Sovereign Source Layer

This layer overlays `shared/`, `raider/`, and `vanguard/` to build the Sovereign artifact:

```bash
node scripts/build-valdr-tier.mjs sovereign
```

## What Sovereign Adds

- `pm_session` tool documentation
- `pm_knowledge` tool documentation and shared knowledge workflows
- Skadi orchestration workflows
- Mimir knowledge orchestration workflows
- Sovereign Nikol agent-memory notebook bindings
- Session-aware Gunnar guidance
- Session-aware Sigrid review handoff
- Session-aware executor review routing
- Sovereign overrides for audit and review docs where live session control is relevant

## Sovereign Scope

Sovereign is the only tier that includes:

- Session spawning
- Session messaging
- Knowledge source curation, ingest health, search, code-map, and agent memory workflows
- Launch-time reviewer orchestration
- Worktree-aware sprint and merge flows

## Identity Rule

The generated Sovereign archive is self-contained and imports as logical pack `valdr`, so installing it cleanly replaces lower-tier definitions with the same handles and `valdr.*` keys.
