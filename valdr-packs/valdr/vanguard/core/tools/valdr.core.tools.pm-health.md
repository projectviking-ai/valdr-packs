<!--<capability id="valdr.core.tools.pm-health" pack="valdr" role="integration">-->
# Tool: pm_health

Check the connected Valdr installation and its available MCP tools. Use the
compact response for connectivity; request detail when a tool appears missing
or the installed version matters to a diagnosis.

<!--<instructions>-->

## Usage

```text
pm_health
pm_health { detail: true }
```

Read the returned status, Valdr version, and tool inventory. The compact
inventory lists tool names; detailed mode includes descriptions. Use each tool's
own `help` action for its current arguments and examples.

## When to use

- Confirm that Valdr is reachable before beginning an operation.
- Confirm the connected version when behavior differs from the documentation.
- Check which tools are available to the current connection.
- Inspect reported setup or access problems before retrying a missing tool.

Tool availability does not establish permission for a particular operation.
Follow session policy and the selected action's contract. Do not bypass a
missing tool through a different client or shell command.

Health output may contain machine-specific locations and identifiers. Include
only the status, version, or tool names needed in a shared diagnostic; omit local
paths and other connection details unless the user explicitly needs them.

<!--</instructions>-->
<!--</capability>-->
