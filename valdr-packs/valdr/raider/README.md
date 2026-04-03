# Valdr Raider Source Layer

This layer plus `shared/` builds the Raider artifact:

```bash
node scripts/build-valdr-tier.mjs raider
```

## What Raider Ships

- Domain and utility agents
- Freya planner
- Sigrid reviewer
- Manual and UI-oriented guidance only

## What Raider Does Not Ship

- MCP tool documentation
- Executor workflows
- Auditor workflows
- Orchestrator agents
- Live session or spawn capabilities

## Identity Rule

The generated Raider archive is self-contained, but it still imports as logical pack `valdr`. Higher tiers replace shared agents and capabilities by reusing the same handles and `valdr.*` keys.
