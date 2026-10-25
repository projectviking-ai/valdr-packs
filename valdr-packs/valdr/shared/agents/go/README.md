# Go Task Agent (`go-task-agent`)

> **Type:** Dumb Agent (Code Executor)
> **Pack:** `valdr`
> **Handle:** `@go-task-agent`

## Overview

A language-specialized task executor for Go codebases. It focuses on idiomatic implementation, robust tests, and strict validation evidence.

## Capabilities

| Capability | Role | Description |
|------------|------|-------------|
| `valdr.agents.go.go-task-agent.system` | core | Main persona and execution workflow |
| `valdr.agents.go.build` | constraints | Go build and module tooling guidance |
| `valdr.agents.go.code.rules` | constraints | Idiomatic coding conventions |
| `valdr.agents.go.design.solid` | workflow | Composition-first design principles |
| `valdr.agents.go.testing` | workflow | Go testing, race, and coverage patterns |

## Language Focus

- Explicit `error` handling with `%w` wrapping
- Module integrity (`go.mod`, `go.sum`)
- Safe concurrency with contexts/channels/sync primitives
- Pragmatic package layout (`cmd/`, `internal/`, `pkg/`)
- Composition over abstraction-heavy designs
