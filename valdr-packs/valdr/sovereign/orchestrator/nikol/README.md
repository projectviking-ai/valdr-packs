# Nikol - Sovereign Registry Orchestrator

This sovereign override keeps Nikol's registry-authoring role and adds the PM knowledge notebook workflow for durable agent memory.

## What Sovereign Adds

- Hot-load binding for `valdr.core.knowledge.memory-append`
- Hot-load binding for `valdr.core.tools.pm-knowledge` when tool-contract diagnostics are needed
- System-prompt routing for recording registry and pack-authoring learnings in Nikol's notebook

The vanguard Nikol source remains unchanged because vanguard does not include `pm_knowledge`.

## Memory Notebook Use

Nikol records only durable registry, capability, prompt, and pack-authoring learnings. Hot-load `valdr.core.knowledge.memory-append` for routine notebook writes. Use `pm_knowledge record_entry` with:

- `mode: "append"`
- `entryType: "agent_knowledge"`
- `agentHandle: "nikol"`
- `scope: "project"` plus `projectId` when the learning is project-bound
- `scope: "global"` only for cross-project registry conventions

Do not use `create` or `update` for `agent_knowledge`; notebook memory is append-only.
Load `valdr.core.tools.pm-knowledge` only when the tool contract or a validation error needs deeper diagnosis.
