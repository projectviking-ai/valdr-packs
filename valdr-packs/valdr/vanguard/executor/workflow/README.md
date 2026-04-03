# Task Execution Workflow

Thin workflow wrapper with hot-loadable details for task execution.

> **Pack:** `valdr` — Core workflow for launched task agents

## Architecture

**Thin wrapper + hot-loadable details**

```
┌─────────────────────────────────────┐
│ System Prompt                       │
├─────────────────────────────────────┤
│ [Persona capability]                │  ← domain expertise
│ [valdr.executor.workflow]           │  ← thin process (~500 tokens)
└─────────────────────────────────────┘

Hot-load on demand:
  valdr.executor.workflow.status-change
  valdr.executor.workflow.preflight
  valdr.executor.workflow.prior-work
  valdr.executor.workflow.handle-resolution
  valdr.executor.workflow.checklist
  valdr.executor.workflow.self-review
  valdr.executor.workflow.completion
  valdr.executor.workflow.recovery
  valdr.executor.workflow.blocker
  valdr.executor.workflow.review
```

## Files

```
workflow/
├── README.md                                    # This file
├── valdr.executor.workflow.md                   # Thin wrapper (include upfront)
├── valdr.executor.workflow.status-change.md     # Hot-load: status transitions
├── valdr.executor.workflow.preflight.md         # Hot-load: CLI preflight checks
├── valdr.executor.workflow.prior-work.md        # Hot-load: prior work check
├── valdr.executor.workflow.handle-resolution.md # Hot-load: resolve actor handle
├── valdr.executor.workflow.checklist.md         # Hot-load: checklist management
├── valdr.executor.workflow.self-review.md       # Hot-load: pre-submission checks
├── valdr.executor.workflow.completion.md        # Hot-load: summary format
├── valdr.executor.workflow.recovery.md          # Hot-load: recovery and resume
├── valdr.executor.workflow.blocker.md           # Hot-load: obstacle handling
└── valdr.executor.workflow.review.md            # Hot-load: review feedback
```

## Usage

### For Launched Agents

Include `valdr.executor.workflow` in agent capabilities with role `workflow`. The thin wrapper provides the execution flow outline. Agents hot-load detailed guidance as needed.

### Composition Example

```
Agent: typescript-executor
  Capabilities:
    - typescript.core (role: core)           # Persona
    - valdr.executor.workflow (role: workflow)  # Process
```

### Hot-Loading

From within the thin wrapper, agents load details:

```
pm_capability { action: "prompt", key: "valdr.executor.workflow.completion" }
→ { "role": "workflow", "capability": "<detailed format>" }
```

## Template Variables

The workflow uses template variables injected by the launcher:

| Variable | Purpose |
|----------|---------|
| `{{actorHandle}}` | Agent's handle for PM mutations |
| `{{taskKey}}` | Task being executed |

## Customization

Users can:
- Replace `valdr.executor.workflow` with their own process
- Override specific hot-loadable capabilities
- Skip the workflow entirely for non-task agents

## Token Budget

| Component | Est. Tokens |
|-----------|-------------|
| Thin wrapper | ~500 |
| Each hot-load | ~200-400 |
| **Upfront cost** | **~500** |
