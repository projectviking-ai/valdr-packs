# Workflow Capabilities — Matrix

> **Pack:** `valdr`
> **Status:** Registered — capabilities available via `pm_capability { action: "prompt", key: "..." }`.

## Core Capability (Include Upfront)

| Capability Key | Role | Prompt ID | Purpose |
|----------------|------|-----------|---------|
| `valdr.executor.workflow` | `workflow` | `01KFBHXHHGHATX8GAK907YAHZ4` | Thin execution flow wrapper |

## Hot-Loadable Capabilities

| Capability Key | Role | Prompt ID | When to Load |
|----------------|------|-----------|--------------|
| `valdr.executor.workflow.status-change` | `workflow` | `01KFBHXHJZ8WJ0YSMMTR2K97EA` | Status transition details |
| `valdr.executor.workflow.preflight` | `workflow` | `01KFBHXHME5QFX0G59DEG9XKDB` | CLI preflight checks |
| `valdr.executor.workflow.prior-work` | `workflow` | `01KFBHXHP4C9GNB63D1623EBP4` | Prior work check for in_progress |
| `valdr.executor.workflow.handle-resolution` | `workflow` | `01KFBHXHQGE23Z5HXXKTG9XMKN` | Resolve actor handle (CLI/manual) |
| `valdr.executor.workflow.checklist` | `workflow` | `01KFBHXHS2XS6ZE47E5JM027KT` | Checklist toggle patterns |
| `valdr.executor.workflow.self-review` | `validation` | `01KFBHXHTH3BY0R05WPRN6Y046` | Pre-submission verification |
| `valdr.executor.workflow.completion` | `workflow` | `01KFBHXHW19AAKHBVSS9JZP5A8` | Summary format |
| `valdr.executor.workflow.recovery` | `workflow` | `01KFBHXHXF08DQNRKNXHT9DTC3` | Error handling and session recovery |
| `valdr.executor.workflow.blocker` | `workflow` | `01KFBHXHYZY66M9NANA73C3YKQ` | Obstacle handling |
| `valdr.executor.workflow.review` | `workflow` | `01KFBHXJ0N0DC7P4G2TH794YK2` | Review feedback handling |

## Composition Pattern

```
Agent capabilities:
  1. [Persona] - domain expertise (core role)
  2. [valdr.executor.workflow] - process wrapper (workflow role)

Hot-load during execution:
  pm_capability { action: "prompt", key: "valdr.executor.workflow.<detail>" }
```
