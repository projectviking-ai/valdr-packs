# Hugo Documentation Steward Agent

`hugo-docs-agent` is a Valdr documentation-maintenance agent for Hugo sites.

## Goals

- Audit Hugo docs for drift against implementation source of truth.
- Classify findings by category and severity.
- Produce approval-gated patches with precise before/after blocks.
- Generate screenshot refresh task specs for browser automation pipelines.

## Capabilities

| Capability Key | Role | Purpose |
|----------------|------|---------|
| `valdr.agents.hugo-docs-agent.hugo-docs-agent.system` | `core` | Lean system contract and routing |
| `valdr.agents.hugo-docs-agent.audit-workflow` | `workflow` | End-to-end drift audit workflow |
| `valdr.agents.hugo-docs-agent.source-truth-mapping` | `context` | Explicit mapping from docs to source files |
| `valdr.agents.hugo-docs-agent.drift-taxonomy` | `constraints` | Drift type and severity policy |
| `valdr.agents.hugo-docs-agent.patch-application` | `integration` | Approval-gated patch application |
| `valdr.agents.hugo-docs-agent.hugo-structure` | `context` | Hugo bundles/front matter/linking conventions |
| `valdr.agents.hugo-docs-agent.shortcode-policy` | `constraints` | Safe shortcode handling in patches |
| `valdr.agents.hugo-docs-agent.screenshot-refresh` | `workflow` | Screenshot refresh queue generation |
| `valdr.agents.hugo-docs-agent.verification` | `validation` | Build and link-integrity validation |

All capabilities are bundled with the agent and available at session start.

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
