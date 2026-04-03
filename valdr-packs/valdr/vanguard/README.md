# Valdr Vanguard Source Layer

This layer overlays `shared/` and `raider/` to build the Vanguard artifact:

```bash
node scripts/build-valdr-tier.mjs vanguard
```

## What Vanguard Adds

- MCP-backed task, project, sprint, review, registry, provider, and planning docs
- Gunnar navigation workflows
- Nikol registry workflows
- Tyr v2 audit workflows
- Executor task and review handling flows
- Hot-load variants for shared agents and reviewer prompts

## Vanguard Boundary

Vanguard is MCP-enabled but non-orchestration:

- No `pm_session` capability
- No Skadi
- No reviewer or executor live-session wake-up
- No session spawning or session messaging

Follow-up is driven by PM state and comments, not live session control.

## Identity Rule

The generated Vanguard archive is self-contained and still imports as logical pack `valdr`. It replaces Raider content by reusing the same agent handles and `valdr.*` capability keys.
