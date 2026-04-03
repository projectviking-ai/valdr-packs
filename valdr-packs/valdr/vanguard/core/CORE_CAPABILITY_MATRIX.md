# Valdr Core — Capability Matrix

> **Status:** Registered — all capabilities registered in PM MCP.

## Tool Capabilities

| Capability Key | Role | Pack | Prompt ID (ULID) | Prompt Fragment |
| --- | --- | --- | --- | --- |
| `valdr.core.tools.pm-project` | `workflow` | `valdr` | `01KF14142SZ45RX95H13AFSZ41` | `valdr.core.tools.pm-project.md` |
| `valdr.core.tools.pm-task` | `workflow` | `valdr` | `01KF14144NM828FJ4ETRN6R0YG` | `valdr.core.tools.pm-task.md` |
| `valdr.core.tools.pm-sprint` | `workflow` | `valdr` | `01KF14146NKV6EVCDP5QE5GZG5` | `valdr.core.tools.pm-sprint.md` |
| `valdr.core.tools.pm-review` | `workflow` | `valdr` | `01KF142P0FHW0DX7X7SZTE6QBS` | `valdr.core.tools.pm-review.md` |
| `valdr.core.tools.pm-agent` | `workflow` | `valdr` | `01KF14140XT2DVAY6PZTR2TEZ5` | `valdr.core.tools.pm-agent.md` |
| `valdr.core.tools.pm-prompt` | `workflow` | `valdr` | `01KF142NW5FKKBAVF3EVXP7790` | `valdr.core.tools.pm-prompt.md` |
| `valdr.core.tools.pm-capability` | `workflow` | `valdr` | `01KF142P2N3FDZFD1132ZDHAYH` | `valdr.core.tools.pm-capability.md` |
| `valdr.core.tools.vmp` | `workflow` | `valdr` | `01KF143KGKXKVTSN7SRH5YB6M5` | `valdr.core.tools.vmp.md` |
| `valdr.core.tools.pm-generate-ulid` | `workflow` | `valdr` | `01KF143KM8NY29Q89EHPR13FNB` | `valdr.core.tools.pm-generate-ulid.md` |
| `valdr.core.tools.pm-health` | `workflow` | `valdr` | `01KF143KJJFMG48XC4XEX5AAB6` | `valdr.core.tools.pm-health.md` |

## Usage Notes

- All capabilities have `role: workflow` and `pack: valdr`
- These are **building block** capabilities — agents compose them based on their needs
- Keep tool documentation focused on usage patterns, not implementation details

## Hot-Loading Pattern

To hot-load a capability at runtime:

```
pm_capability { action: "prompt", key: "valdr.core.tools.pm-task" }
→ { "role": "workflow", "capability": "<prompt content>" }
```

## Composition Guide

### By Agent Role

| Role | Recommended Capabilities |
|------|-------------------------|
| **Orchestrator** | All tools |
| **Task Runner** | `pm-task`, `pm-review`, `pm-generate-ulid` |
| **Planner** | `pm-project`, `pm-task`, `pm-sprint`, `vmp`, `pm-generate-ulid` |
| **Reviewer** | `pm-task`, `pm-review`, `pm-generate-ulid` |
| **Registry Admin** | `pm-agent`, `pm-prompt`, `pm-capability`, `pm-generate-ulid` |

### Minimal Sets

**Read-only navigation:**
- `pm-project`, `pm-task`, `pm-sprint`

**Full PM operations:**
- All tool capabilities

**Registry operations only:**
- `pm-agent`, `pm-prompt`, `pm-capability`, `pm-generate-ulid`

## Registration Example

```
# Link to an agent
pm_agent {
  action: "update",
  handle: "my-agent",
  capabilities: {
    set: [
      { key: "valdr.core.tools.pm-task" },
      { key: "valdr.core.tools.pm-review" },
      { key: "valdr.core.tools.pm-generate-ulid" }
    ]
  }
}
```
