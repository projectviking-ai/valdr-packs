# Security Audit Agent — Capability Matrix

> **Agent:** `security-audit-agent`
> **Pack:** `valdr`
> **Kind:** `bot`
> **Default Role:** `reviewer`

| Capability Key | Role | Category | File |
|---|---|---|---|
| `valdr.agents.security.security-audit-agent.system` | `core` | system | `valdr.agents.security.security-audit-agent.system.md` |
| `valdr.agents.security.vulnerability-patterns` | `constraints` | policy | `valdr.agents.security.vulnerability-patterns.md` |
| `valdr.agents.security.dependency-audit` | `validation` | scanning | `valdr.agents.security.dependency-audit.md` |
| `valdr.agents.security.secrets-detection` | `validation` | scanning | `valdr.agents.security.secrets-detection.md` |
| `valdr.agents.security.compliance` | `constraints` | policy | `valdr.agents.security.compliance.md` |

## Notes
- Exactly one core capability: `valdr.agents.security.security-audit-agent.system`.
- Findings should always include severity and confidence.
