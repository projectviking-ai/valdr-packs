# Dependency Audit Scout -- Capability Matrix

| Capability Key | Role | Pack | Prompt Fragment |
| --- | --- | --- | --- |
| `valdr.agents.dependency-audit-agent.dependency-audit-scout.system` | `core` | `valdr` | `valdr.agents.dependency-audit-agent.dependency-audit-scout.system.md` |
| `valdr.agents.dependency-audit-agent.intake-routing` | `workflow` | `valdr` | `valdr.agents.dependency-audit-agent.intake-routing.md` |
| `valdr.agents.dependency-audit-agent.vulnerability-reachability` | `workflow` | `valdr` | `valdr.agents.dependency-audit-agent.vulnerability-reachability.md` |
| `valdr.agents.dependency-audit-agent.unused-detection` | `workflow` | `valdr` | `valdr.agents.dependency-audit-agent.unused-detection.md` |
| `valdr.agents.dependency-audit-agent.alignment-analysis` | `workflow` | `valdr` | `valdr.agents.dependency-audit-agent.alignment-analysis.md` |
| `valdr.agents.dependency-audit-agent.compound-findings` | `workflow` | `valdr` | `valdr.agents.dependency-audit-agent.compound-findings.md` |
| `valdr.agents.dependency-audit-agent.reporting-scorecard` | `validation` | `valdr` | `valdr.agents.dependency-audit-agent.reporting-scorecard.md` |
| `valdr.agents.dependency-audit-agent.upgrade-planning` | `integration` | `valdr` | `valdr.agents.dependency-audit-agent.upgrade-planning.md` |
| `valdr.agents.dependency-audit-agent.audit-guardrails` | `constraints` | `valdr` | `valdr.agents.dependency-audit-agent.audit-guardrails.md` |
| `valdr.agents.dependency-audit-agent.npm-bun-context` | `context` | `valdr` | `valdr.agents.dependency-audit-agent.npm-bun-context.md` |
| `valdr.agents.dependency-audit-agent.cargo-context` | `context` | `valdr` | `valdr.agents.dependency-audit-agent.cargo-context.md` |
| `valdr.agents.dependency-audit-agent.jvm-context` | `context` | `valdr` | `valdr.agents.dependency-audit-agent.jvm-context.md` |

All capabilities are bundled with the agent pack.

## Composition

Minimal load:
- `valdr.agents.dependency-audit-agent.dependency-audit-scout.system`

Standard full audit:
- `valdr.agents.dependency-audit-agent.dependency-audit-scout.system`
- `valdr.agents.dependency-audit-agent.intake-routing`
- `valdr.agents.dependency-audit-agent.vulnerability-reachability`
- `valdr.agents.dependency-audit-agent.unused-detection`
- `valdr.agents.dependency-audit-agent.alignment-analysis`
- `valdr.agents.dependency-audit-agent.compound-findings`
- `valdr.agents.dependency-audit-agent.reporting-scorecard`
- `valdr.agents.dependency-audit-agent.upgrade-planning`
- `valdr.agents.dependency-audit-agent.audit-guardrails`
- ecosystem context capabilities based on detected manifests
