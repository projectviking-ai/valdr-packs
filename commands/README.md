# Valdr Commands

Canonical command definitions for AI coding assistants. These markdown files are the source of truth for command content in this repository.

## Available Commands

| Command | Invocation | Description |
|---------|------------|-------------|
| `valdr-agent` | `/valdr-agent <handle>` | Load an agent persona from the registry |

## Usage

```
/valdr-agent sigrid      # Load the Sigrid reviewer persona
/valdr-agent freya       # Load the Freya planner persona
/valdr-agent gunnar      # Load the Gunnar orchestrator persona
```

## Command Format

Commands use YAML frontmatter followed by markdown content:

```markdown
---
name: command-name
description: "Short description shown in command listings"
allowed-tools: mcp__valdr__pm_agent mcp__valdr__pm_health
---

# Command Title

Instructions for the command...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Command name (used for `/name` invocation) |
| `description` | Yes | Short description for help menus |
| `allowed-tools` | No | Space-separated MCP tool names |

### Argument Placeholders

| Placeholder | Description |
|-------------|-------------|
| `$ARGUMENTS` | Everything after the slash command |

## Repository Role

This repository currently defines command source files in `commands/`, but the top-level `Makefile` only manages skill sync targets plus `generate-valdr-pack`. Keep command docs accurate in this directory and align any platform-specific command distribution flow separately.

## Adding New Commands

1. Create `<name>.md` in this directory
2. Add YAML frontmatter with `name`, `description`, and optional `allowed-tools`
3. Write the command content
4. Verify the command examples and metadata in this directory
5. Commit the source changes

## Commands vs Skills

- **Commands**: Single-file, user-invoked via `/command-name`
- **Skills**: Multi-file folders, model-invoked automatically

See the top-level `README.md` for the current repository sync model.
