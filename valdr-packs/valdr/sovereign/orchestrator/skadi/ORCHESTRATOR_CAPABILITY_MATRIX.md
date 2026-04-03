# Orchestrator — Capability Matrix (Skadi)

> **Status:** Registered — capabilities and base agent registered in PM MCP.

| Capability Key | Role | Pack | Prompt ID (ULID) | Hot-Load | Prompt Fragment |
| --- | --- | --- | --- | --- | --- |
| `valdr.orchestrator.skadi.system` | `core` | `valdr` | `01KH5AHH0DJS0XNTJFDS401FAE` | `no` | `valdr.orchestrator.skadi.system.md` |
| `valdr.orchestrator.skadi.sprint-planning` | `workflow` | `valdr` | `01KH5AHH299W802G9HJ6ZNJ37M` | `yes` | `valdr.orchestrator.skadi.sprint-planning.md` |
| `valdr.orchestrator.skadi.task-staffing` | `workflow` | `valdr` | `01KH5AHH2JY9CWCBE93N4K6SMY` | `yes` | `valdr.orchestrator.skadi.task-staffing.md` |
| `valdr.orchestrator.skadi.review-routing` | `workflow` | `valdr` | `01KH5AHH2K374D5PXQP7D49Q7J` | `yes` | `valdr.orchestrator.skadi.review-routing.md` |
| `valdr.orchestrator.skadi.sprint-prep` | `workflow` | `valdr` | `01KHWGB3NJPJMM8R3DH06P11R6` | `yes` | `valdr.orchestrator.skadi.sprint-prep.md` |
| `valdr.orchestrator.skadi.launch-readiness` | `workflow` | `valdr` | `01KH5C0DQVPEP0XRMVFH165YNF` | `yes` | `valdr.orchestrator.skadi.launch-readiness.md` |
| `valdr.orchestrator.skadi.launch-executor` | `workflow` | `valdr` | `01KHM3R6YT5S76BGA2Q1B5G26B` | `yes` | `valdr.orchestrator.skadi.launch-executor.md` |
| `valdr.orchestrator.skadi.session-messaging` | `workflow` | `valdr` | `01KHMF144Y6DTMBC7B64E4YHM0` | `yes` | `valdr.orchestrator.skadi.session-messaging.md` |
| `valdr.core.sizing.ai-story-points` | `context` | `valdr` | `01KHMF74JTZBB8482GWHAKDC6S` | `yes` | `valdr/core/sizing/valdr.core.sizing.ai-story-points.md` |

## Agent Registration

```
pm_agent {
  action: "create",
  name: "Skadi Sprint Orchestrator",
  handle: "skadi",
  kind: "bot",
  defaultRole: "orchestrator",
  tags: ["valdr", "orchestrator", "sprint", "planning", "staffing", "review-routing", "launch-readiness", "session-messaging"],
  capabilities: [
    { key: "valdr.orchestrator.skadi.system" }
  ]
}
```

Skadi agent registered with handle `skadi` and ID `01KH5AJ4E1HZT7WTWFDAK58SAY`.

Shared tool-doc capabilities are registry-only hot-load entries in `skadi.agent.yaml` and are not linked on the agent record.

## Hot-Loading Pattern

```bash
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.sprint-prep" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.sprint-planning" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.task-staffing" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.review-routing" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.launch-readiness" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.launch-executor" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.session-messaging" }
pm_capability { action: "prompt", key: "valdr.core.sizing.ai-story-points" }
```
