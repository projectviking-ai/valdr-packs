# Valdr Core Tool Capabilities

Reusable MCP tool capability fragments for the Valdr tiers that support PM operations.

## Used By

- Vanguard
- Sovereign

## Included Here

- `pm-project`
- `pm-task`
- `pm-sprint`
- `pm-review`
- `pm-agent`
- `pm-prompt`
- `pm-capability`
- `vmp`
- `pm-generate-ulid`
- `pm-health`

## Session Boundary

This layer intentionally excludes `pm-session`. Sovereign adds that tool documentation as an override layer so Vanguard can remain MCP-enabled without crossing into live session orchestration.
