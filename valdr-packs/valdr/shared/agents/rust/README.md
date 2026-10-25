# Rust Task Agent (`rust-task-agent`)

> **Type:** Dumb Agent (Code Executor)
> **Pack:** `valdr`
> **Handle:** `@rust-task-agent`

## Overview

A language-specialized task executor for Rust codebases. It emphasizes safety, correctness, and maintainable crate architecture.

## Capabilities

| Capability | Role | Description |
|------------|------|-------------|
| `valdr.agents.rust.rust-task-agent.system` | core | Main persona and execution workflow |
| `valdr.agents.rust.build` | constraints | Cargo build/tooling guidance |
| `valdr.agents.rust.code.rules` | constraints | Rust coding conventions |
| `valdr.agents.rust.design.solid` | workflow | Trait-driven design principles |
| `valdr.agents.rust.testing` | workflow | Unit/integration/property testing guidance |

## Language Focus

- Ownership, borrowing, and lifetimes with pragmatic ergonomics
- Explicit `Result<T, E>` and `Option<T>` handling
- Trait-based composition over inheritance patterns
- Cargo workspace and feature-flag hygiene
- Strict policy for `unsafe` usage and validation
