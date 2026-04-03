# Reviewer — Capability Matrix

| Capability Key | Role | Pack | Prompt Fragment |
| --- | --- | --- | --- |
| `valdr.reviewer.sigrid.system` | `core` | `valdr` | `valdr.reviewer.sigrid.system.md` |
| `valdr.reviewer.sigrid.workflow` | `workflow` | `valdr` | `valdr.reviewer.sigrid.workflow.md` |
| `valdr.reviewer.sigrid.severity` | `constraints` | `valdr` | `valdr.reviewer.sigrid.severity.md` |
| `valdr.reviewer.sigrid.scoring` | `constraints` | `valdr` | `valdr.reviewer.sigrid.scoring.md` |

## Capability Roles

| Capability | Role | Purpose |
|------------|------|---------|
| `system` | `core` | Core identity and behaviors |
| `workflow` | `workflow` | Review workflow steps |
| `severity` | `constraints` | Rules for severity classification |
| `scoring` | `constraints` | Rules for scoring and alignment |

## Composition

All capabilities are bundled with the agent:
- `valdr.reviewer.sigrid.system` (core)
- `valdr.reviewer.sigrid.workflow` (workflow)
- `valdr.reviewer.sigrid.severity` (constraints)
- `valdr.reviewer.sigrid.scoring` (constraints)
