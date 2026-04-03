# Java Task Agent (`java-task-agent`)

> **Type:** Dumb Agent (Code Executor)
> **Pack:** `valdr-internal`
> **Handle:** `@java-task-agent`

## Overview

A language-specialized task executor for Java codebases. It focuses on modern Java practices, clear architecture, and rigorous testing.

## Capabilities

| Capability | Role | Description |
|------------|------|-------------|
| `valdr.internal.agents.java.java-task-agent.system` | core | Main persona and execution workflow |
| `valdr.internal.agents.java.build` | constraints | Maven/Gradle build guidance |
| `valdr.internal.agents.java.code.rules` | constraints | Java style and API conventions |
| `valdr.internal.agents.java.design.solid` | workflow | SOLID design and package architecture guidance |
| `valdr.internal.agents.java.testing` | workflow | JUnit/Mockito/integration testing guidance |

## Language Focus

- Modern Java 17+ (records, sealed classes, pattern matching)
- Maven/Gradle and multi-module project discipline
- Intentional `Optional<T>` and null-safety practices
- Stream API with readability-first usage
- Interface-based design and dependency injection
