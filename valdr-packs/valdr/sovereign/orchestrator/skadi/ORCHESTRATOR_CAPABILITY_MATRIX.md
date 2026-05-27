# Orchestrator — Capability Matrix (Skadi)

> **Status:** Registered — capabilities and base agent registered in PM MCP.

| Capability Key | Role | Pack | Hot-Load | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.orchestrator.skadi.system` | `core` | `valdr` | `no` | `valdr.orchestrator.skadi.system.md` |
| `valdr.orchestrator.skadi.sprint-planning` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.skadi.sprint-planning.md` |
| `valdr.orchestrator.skadi.task-staffing` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.skadi.task-staffing.md` |
| `valdr.orchestrator.skadi.review-routing` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.skadi.review-routing.md` |
| `valdr.orchestrator.skadi.sprint-prep` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.skadi.sprint-prep.md` |
| `valdr.orchestrator.skadi.launch-readiness` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.skadi.launch-readiness.md` |
| `valdr.orchestrator.skadi.launch-executor` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.skadi.launch-executor.md` |
| `valdr.orchestrator.skadi.session-messaging` | `workflow` | `valdr` | `yes` | `valdr.orchestrator.skadi.session-messaging.md` |
| `valdr.core.knowledge.memory-append` | `workflow` | `valdr` | `yes` | `valdr/sovereign/core/knowledge/valdr.core.knowledge.memory-append.md` |
| `valdr.core.tools.pm-knowledge` | `integration` | `valdr` | `yes` | `valdr/sovereign/core/tools/valdr.core.tools.pm-knowledge.md` |
| `valdr.core.sizing.ai-story-points` | `context` | `valdr` | `yes` | `valdr/core/sizing/valdr.core.sizing.ai-story-points.md` |

## Agent Registration

```
pm_agent {
  action: "create",
  name: "Skadi Sprint Orchestrator",
  handle: "skadi",
  kind: "bot",
  defaultRole: "orchestrator",
  tags: ["valdr", "orchestrator", "sprint", "planning", "staffing", "review-routing", "launch-readiness", "session-messaging", "knowledge", "agent-memory"],
  capabilities: [
    { key: "valdr.orchestrator.skadi.system" }
  ]
}
```

Skadi agent registers with handle `skadi`.

The manifest includes core plus hot-load bindings. The core prompt is the only always-loaded capability; hot-load entries remain discoverable on the agent record and are loaded on demand with `pm_capability prompt`.

## Hot-Loading Pattern

```bash
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.sprint-prep" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.sprint-planning" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.task-staffing" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.review-routing" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.launch-readiness" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.launch-executor" }
pm_capability { action: "prompt", key: "valdr.orchestrator.skadi.session-messaging" }
pm_capability { action: "prompt", key: "valdr.core.knowledge.memory-append" }
pm_capability { action: "prompt", key: "valdr.core.sizing.ai-story-points" }
```

Load `valdr.core.tools.pm-knowledge` only when the tool contract or validation behavior needs diagnosis.
