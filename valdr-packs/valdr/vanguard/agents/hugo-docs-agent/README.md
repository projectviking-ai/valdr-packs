# Hugo Documentation Steward Agent

`hugo-docs-agent` is a Valdr documentation-maintenance agent for Hugo sites.

## Goals

- Audit Hugo docs for drift against implementation source of truth.
- Classify findings by category and severity.
- Produce approval-gated patches with precise before/after blocks.
- Generate screenshot refresh task specs for browser automation pipelines.

## Capabilities

| Capability Key | Role | Hot-Load | Purpose |
|----------------|------|----------|---------|
| `valdr.agents.hugo-docs-agent.hugo-docs-agent.system` | `core` | No | Lean system contract and routing |
| `valdr.agents.hugo-docs-agent.audit-workflow` | `workflow` | Yes | End-to-end drift audit workflow |
| `valdr.agents.hugo-docs-agent.source-truth-mapping` | `context` | Yes | Explicit mapping from docs to source files |
| `valdr.agents.hugo-docs-agent.drift-taxonomy` | `constraints` | Yes | Drift type and severity policy |
| `valdr.agents.hugo-docs-agent.patch-application` | `integration` | Yes | Approval-gated patch application |
| `valdr.agents.hugo-docs-agent.hugo-structure` | `context` | Yes | Hugo bundles/front matter/linking conventions |
| `valdr.agents.hugo-docs-agent.shortcode-policy` | `constraints` | Yes | Safe shortcode handling in patches |
| `valdr.agents.hugo-docs-agent.screenshot-refresh` | `workflow` | Yes | Screenshot refresh queue generation |
| `valdr.agents.hugo-docs-agent.verification` | `validation` | Yes | Build and link-integrity validation |

## Files

- `hugo-docs-agent.agent.yaml`
- `valdr.agents.hugo-docs-agent.hugo-docs-agent.system.md`
- `valdr.agents.hugo-docs-agent.audit-workflow.md`
- `valdr.agents.hugo-docs-agent.source-truth-mapping.md`
- `valdr.agents.hugo-docs-agent.drift-taxonomy.md`
- `valdr.agents.hugo-docs-agent.patch-application.md`
- `valdr.agents.hugo-docs-agent.hugo-structure.md`
- `valdr.agents.hugo-docs-agent.shortcode-policy.md`
- `valdr.agents.hugo-docs-agent.screenshot-refresh.md`
- `valdr.agents.hugo-docs-agent.verification.md`
- `AGENT_CAPABILITY_MATRIX.md`
