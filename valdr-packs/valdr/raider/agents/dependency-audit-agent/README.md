# Dependency Audit Scout Agent

`dependency-audit-scout` is a Valdr planner-style agent for dependency risk auditing across npm/Bun, Cargo, and JVM ecosystems.

## Goals

- Detect vulnerabilities with reachability and confidence context
- Identify unused dependencies with false-positive controls
- Detect version alignment drift across monorepos
- Promote compound findings that deliver high-value remediation
- Produce phased, execution-ready upgrade plans without direct dependency edits

## Capabilities

| Capability Key | Role | Purpose |
| --- | --- | --- |
| `valdr.agents.dependency-audit-agent.dependency-audit-scout.system` | `core` | Lean identity and intent routing |
| `valdr.agents.dependency-audit-agent.intake-routing` | `workflow` | Discovery, inventory, and routing |
| `valdr.agents.dependency-audit-agent.vulnerability-reachability` | `workflow` | Advisory analysis plus code-path reachability |
| `valdr.agents.dependency-audit-agent.unused-detection` | `workflow` | Declared-vs-used detection and classification |
| `valdr.agents.dependency-audit-agent.alignment-analysis` | `workflow` | Version drift and duplication analysis |
| `valdr.agents.dependency-audit-agent.compound-findings` | `workflow` | Multi-dimension prioritization |
| `valdr.agents.dependency-audit-agent.reporting-scorecard` | `validation` | Report completeness and scorecard integrity |
| `valdr.agents.dependency-audit-agent.upgrade-planning` | `integration` | Phased plan + execution handoff |
| `valdr.agents.dependency-audit-agent.audit-guardrails` | `constraints` | Read-only rules and fallback policy |
| `valdr.agents.dependency-audit-agent.npm-bun-context` | `context` | npm/Bun ecosystem nuance |
| `valdr.agents.dependency-audit-agent.cargo-context` | `context` | Cargo ecosystem nuance |
| `valdr.agents.dependency-audit-agent.jvm-context` | `context` | Maven/Gradle ecosystem nuance |

All capabilities are bundled with the agent and available at session start.

## Files

- `dependency-audit-scout.agent.yaml`
- `valdr.agents.dependency-audit-agent.dependency-audit-scout.system.md`
- `valdr.agents.dependency-audit-agent.intake-routing.md`
- `valdr.agents.dependency-audit-agent.vulnerability-reachability.md`
- `valdr.agents.dependency-audit-agent.unused-detection.md`
- `valdr.agents.dependency-audit-agent.alignment-analysis.md`
- `valdr.agents.dependency-audit-agent.compound-findings.md`
- `valdr.agents.dependency-audit-agent.reporting-scorecard.md`
- `valdr.agents.dependency-audit-agent.upgrade-planning.md`
- `valdr.agents.dependency-audit-agent.audit-guardrails.md`
- `valdr.agents.dependency-audit-agent.npm-bun-context.md`
- `valdr.agents.dependency-audit-agent.cargo-context.md`
- `valdr.agents.dependency-audit-agent.jvm-context.md`
- `AGENT_CAPABILITY_MATRIX.md`
