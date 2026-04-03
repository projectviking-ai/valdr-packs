# Refactoring Scout Agent

`refactor-scout` is a Valdr planning-oriented agent for codebase refactor discovery and task handoff.

## Goals

- Detect refactor opportunities using fast and deep analysis phases
- Produce prioritized, evidence-backed findings reports
- Convert only approved findings into executable task briefs
- Support language-specific heuristics via hot-loaded capabilities

## Capabilities

| Capability Key | Role | Hot-Load | Purpose |
|----------------|------|----------|---------|
| `valdr.agents.refactor-agent.refactor-scout.system` | `core` | No | Lean system identity and operating contract |
| `valdr.agents.refactor-agent.scan-workflow` | `workflow` | Yes | End-to-end scan workflow and prioritization |
| `valdr.agents.refactor-agent.reporting` | `validation` | Yes | Finding schema and report quality gates |
| `valdr.agents.refactor-agent.task-conversion` | `integration` | Yes | Approved-finding to task-brief conversion |
| `valdr.agents.refactor-agent.language-selection` | `context` | Yes | Language detection and capability routing |
| `valdr.agents.refactor-agent.typescript-guidance` | `constraints` | Yes | TypeScript-specific heuristics |
| `valdr.agents.refactor-agent.java-guidance` | `constraints` | Yes | Java-specific heuristics |
| `valdr.agents.refactor-agent.rust-guidance` | `constraints` | Yes | Rust-specific heuristics |

## Design Notes

- System prompt is intentionally lean and delegates detail to hot-loaded capabilities.
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
