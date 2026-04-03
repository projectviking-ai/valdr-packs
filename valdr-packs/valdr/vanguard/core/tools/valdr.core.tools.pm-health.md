<!--<capability id="valdr.core.tools.pm-health" pack="valdr" role="integration">-->
# Tool: pm_health

Check MCP server status.

<!--<instructions>-->

## Usage

```
pm_health
→ {
    "status": "ok",
    "info": {
      "name": "pm-mcp",
      "version": "0.1.0",
      "tools": ["pm_agent", "pm_task", ...],
      ...
    }
  }
```

## Response Fields

| Field | Description |
|-------|-------------|
| `status` | Server status (`ok` or error) |
| `info.tools` | Available tool names |
| `info.version` | Server version |
| `info.dataDir` | Data directory path |
| `info.dbPath` | Database file path |

## When to Use

- Verify server is running before operations
- Check available tools
- Debug connectivity issues

<!--</instructions>-->
<!--</capability>-->
