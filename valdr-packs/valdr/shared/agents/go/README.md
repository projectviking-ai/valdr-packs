# Go Task Agent (`go-task-agent`)

> **Type:** Dumb Agent (Code Executor)
> **Pack:** `valdr-internal`
> **Handle:** `@go-task-agent`

## Overview

A language-specialized task executor for Go codebases. It focuses on idiomatic implementation, robust tests, and strict validation evidence.

## Capabilities

| Capability | Role | Description |
|------------|------|-------------|
| `valdr.internal.agents.go.go-task-agent.system` | core | Main persona and execution workflow |
| `valdr.internal.agents.go.build` | constraints | Go build and module tooling guidance |
| `valdr.internal.agents.go.code.rules` | constraints | Idiomatic coding conventions |
| `valdr.internal.agents.go.design.solid` | workflow | Composition-first design principles |
| `valdr.internal.agents.go.testing` | workflow | Go testing, race, and coverage patterns |

## Language Focus

- Explicit `error` handling with `%w` wrapping
- Module integrity (`go.mod`, `go.sum`)
- Safe concurrency with contexts/channels/sync primitives
- Pragmatic package layout (`cmd/`, `internal/`, `pkg/`)
- Composition over abstraction-heavy designs
