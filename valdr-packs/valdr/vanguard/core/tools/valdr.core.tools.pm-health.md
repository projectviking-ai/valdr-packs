<!--<capability id="valdr.core.tools.pm-health" pack="valdr" role="integration">-->
# Tool: pm_health

Return runtime details for the Project Manager MCP server. The default response is a compact connectivity check; pass `{ detail: true }` for the verbose tool inventory.

<!--<instructions>-->

## Usage

**Compact (default) — connectivity check and tool-name inventory:**
```
pm_health
→ {
    "status": "ok",
    "info": {
      "name": "pm-mcp",
      "version": "<version>",
      "startTs": "<iso-8601-timestamp>",
      "runtimeId": "<runtime-uuid>",
      "cwd": "<cwd>",
      "dataDir": "<data-dir>",
      "dbPath": "<db-path>",
      "pid": <pid>,
      "tools": ["pm_agent", "pm_task", "..."],
      "license": { "status": "valid", "tier": "<tier>" }
    }
  }
```

**Detailed — adds the verbose per-tool inventory:**
```
pm_health { detail: true }
→ {
    "status": "ok",
    "info": {
      "name": "pm-mcp",
      "version": "<version>",
      "startTs": "<iso-8601-timestamp>",
      "runtimeId": "<runtime-uuid>",
      "cwd": "<cwd>",
      "dataDir": "<data-dir>",
      "dbPath": "<db-path>",
      "pid": <pid>,
      "tools": ["pm_agent", "pm_task", "..."],
      "license": { "status": "valid", "tier": "<tier>" },
      "toolsDetailed": [
        { "name": "pm_agent", "description": "Agent management (action: create|get|list|...)." },
        { "name": "pm_task", "description": "Task management (action: create|get|...)." },
        "..."
      ]
    }
  }
```

> Local values (`cwd`, `dataDir`, `dbPath`, `runtimeId`, `pid`, `startTs`, and the exact `version`) are environment-specific. The placeholders above stand in for live output — do not copy literal paths, UUIDs, or process IDs into docs.

## Response Fields

| Field | Description |
|-------|-------------|
| `status` | Server status (`ok` or error) |
| `info.name` | Server name (`pm-mcp`) |
| `info.version` | Server version (varies by release; do not assume a fixed number) |
| `info.startTs` | Server start time (ISO 8601) |
| `info.runtimeId` | Unique identifier for this running process instance |
| `info.cwd` | Working directory the server was launched from |
| `info.dataDir` | Valdr data directory path |
| `info.dbPath` | SQLite database file path |
| `info.pid` | OS process ID of the running server |
| `info.tools` | Array of registered tool names (compact inventory) |
| `info.license` | License object `{ status, tier }` |
| `info.toolsDetailed` | **Detail mode only.** Verbose per-tool inventory — an array of `{ name, description }` covering every registered tool |

## `toolsDetailed[]` — Verbose Tool Inventory

`toolsDetailed[]` appears only when `detail: true` is passed. It is the authoritative, verbose inventory of the live tool surface: one `{ name, description }` entry per registered tool, where `description` is the full per-tool summary (including its `action: ...` list). Use it to discover the complete action surface and to confirm exactly which tools the server exposes — the compact `info.tools` array gives names only.

## Inventory Role

`pm_health` is the canonical source of truth for what the running server exposes:

- **Compact `info.tools`** — fast names-only list to confirm the server is up and which tools are present.
- **Detailed `info.toolsDetailed`** — full descriptions and action surfaces for every tool, useful when other tools appear missing or when verifying the exposed surface after a schema or registry change.

## When to Use

- Verify the server is running and reachable before operations
- Inspect the registered tool inventory — names via the compact response, full descriptions and action surfaces via `detail: true`
- Confirm license `status` and `tier`
- Debug connectivity, data directory, or database path issues

<!--</instructions>-->
<!--</capability>-->
