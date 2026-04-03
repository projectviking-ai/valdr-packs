# Hugo Documentation Steward — Capability Matrix

| Capability Key | Role | Pack | Hot-Load | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.agents.hugo-docs-agent.hugo-docs-agent.system` | `core` | `valdr` | No | `valdr.agents.hugo-docs-agent.hugo-docs-agent.system.md` |
| `valdr.agents.hugo-docs-agent.audit-workflow` | `workflow` | `valdr` | Yes | `valdr.agents.hugo-docs-agent.audit-workflow.md` |
| `valdr.agents.hugo-docs-agent.source-truth-mapping` | `context` | `valdr` | Yes | `valdr.agents.hugo-docs-agent.source-truth-mapping.md` |
| `valdr.agents.hugo-docs-agent.drift-taxonomy` | `constraints` | `valdr` | Yes | `valdr.agents.hugo-docs-agent.drift-taxonomy.md` |
| `valdr.agents.hugo-docs-agent.patch-application` | `integration` | `valdr` | Yes | `valdr.agents.hugo-docs-agent.patch-application.md` |
| `valdr.agents.hugo-docs-agent.hugo-structure` | `context` | `valdr` | Yes | `valdr.agents.hugo-docs-agent.hugo-structure.md` |
| `valdr.agents.hugo-docs-agent.shortcode-policy` | `constraints` | `valdr` | Yes | `valdr.agents.hugo-docs-agent.shortcode-policy.md` |
| `valdr.agents.hugo-docs-agent.screenshot-refresh` | `workflow` | `valdr` | Yes | `valdr.agents.hugo-docs-agent.screenshot-refresh.md` |
| `valdr.agents.hugo-docs-agent.verification` | `validation` | `valdr` | Yes | `valdr.agents.hugo-docs-agent.verification.md` |

## Composition

Minimal load:
- `valdr.agents.hugo-docs-agent.hugo-docs-agent.system`

Audit mode:
- `valdr.agents.hugo-docs-agent.hugo-docs-agent.system`
- `valdr.agents.hugo-docs-agent.audit-workflow`
- `valdr.agents.hugo-docs-agent.source-truth-mapping`
- `valdr.agents.hugo-docs-agent.drift-taxonomy`
- `valdr.agents.hugo-docs-agent.hugo-structure`
- `valdr.agents.hugo-docs-agent.shortcode-policy`
- `valdr.agents.hugo-docs-agent.screenshot-refresh`

Patch mode:
- `valdr.agents.hugo-docs-agent.hugo-docs-agent.system`
- `valdr.agents.hugo-docs-agent.patch-application`
- `valdr.agents.hugo-docs-agent.verification`
