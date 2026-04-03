# Refactoring Scout Agent

`refactor-scout` is a Valdr planning-oriented agent for codebase refactor discovery and task handoff.

## Goals

- Detect refactor opportunities using fast and deep analysis phases
- Produce prioritized, evidence-backed findings reports
- Convert only approved findings into executable task briefs
- Support language-specific heuristics via bundled capabilities

## Capabilities

| Capability Key | Role | Purpose |
|----------------|------|---------|
| `valdr.agents.refactor-agent.refactor-scout.system` | `core` | Lean system identity and operating contract |
| `valdr.agents.refactor-agent.scan-workflow` | `workflow` | End-to-end scan workflow and prioritization |
| `valdr.agents.refactor-agent.reporting` | `validation` | Finding schema and report quality gates |
| `valdr.agents.refactor-agent.task-conversion` | `integration` | Approved-finding to task-brief conversion |
| `valdr.agents.refactor-agent.language-selection` | `context` | Language detection and capability routing |
| `valdr.agents.refactor-agent.typescript-guidance` | `constraints` | TypeScript-specific heuristics |
| `valdr.agents.refactor-agent.java-guidance` | `constraints` | Java-specific heuristics |
| `valdr.agents.refactor-agent.rust-guidance` | `constraints` | Rust-specific heuristics |

All capabilities are bundled with the agent and available at session start.

## Design Notes

- System prompt is intentionally lean and delegates detail to bundled capabilities.
- The scan workflow is read-only by default.
- Task conversion is gated behind explicit user approval.

## Files

- `refactor-scout.agent.yaml`
- `valdr.agents.refactor-agent.refactor-scout.system.md`
- `valdr.agents.refactor-agent.scan-workflow.md`
- `valdr.agents.refactor-agent.reporting.md`
- `valdr.agents.refactor-agent.task-conversion.md`
- `valdr.agents.refactor-agent.language-selection.md`
- `valdr.agents.refactor-agent.typescript-guidance.md`
- `valdr.agents.refactor-agent.java-guidance.md`
- `valdr.agents.refactor-agent.rust-guidance.md`
- `AGENT_CAPABILITY_MATRIX.md`
