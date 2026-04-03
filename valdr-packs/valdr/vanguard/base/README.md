# Valdr Base Capabilities

Shared capabilities for all Valdr agents interacting with PM MCP.

## Capability Index

| Capability | Role | Purpose |
|------------|------|---------|
| *(none)* | - | No mandatory base capability |

## Usage

No base capability is required for all agents. Prefer role-specific capabilities under
`orchestrator/`, `executor/`, `reviewer/`, and `core/tools`.

## Adding New Base Capabilities

Base capabilities should be:
- **Universal**: Applicable to all PM MCP agents
- **Stateless**: No task/project-specific context required
- **Foundational**: Prerequisites for other operations
