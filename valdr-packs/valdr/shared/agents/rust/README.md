# Rust Task Agent (`rust-task-agent`)

> **Type:** Dumb Agent (Code Executor)
> **Pack:** `valdr-internal`
> **Handle:** `@rust-task-agent`

## Overview

A language-specialized task executor for Rust codebases. It emphasizes safety, correctness, and maintainable crate architecture.

## Capabilities

| Capability | Role | Description |
|------------|------|-------------|
| `valdr.internal.agents.rust.rust-task-agent.system` | core | Main persona and execution workflow |
| `valdr.internal.agents.rust.build` | constraints | Cargo build/tooling guidance |
| `valdr.internal.agents.rust.code.rules` | constraints | Rust coding conventions |
| `valdr.internal.agents.rust.design.solid` | workflow | Trait-driven design principles |
| `valdr.internal.agents.rust.testing` | workflow | Unit/integration/property testing guidance |

## Language Focus

- Ownership, borrowing, and lifetimes with pragmatic ergonomics
- Explicit `Result<T, E>` and `Option<T>` handling
- Trait-based composition over inheritance patterns
- Cargo workspace and feature-flag hygiene
- Strict policy for `unsafe` usage and validation
