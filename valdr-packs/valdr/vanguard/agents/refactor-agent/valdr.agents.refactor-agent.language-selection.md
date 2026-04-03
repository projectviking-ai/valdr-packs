<!--<capability id="valdr.agents.refactor-agent.language-selection" pack="valdr" role="context">-->
# Refactoring Scout Language Selection

<!--<identity>-->
Routing guide for selecting language-specific refactor heuristics and capability packs.
<!--</identity>-->

<!--<instructions>-->

## Detection Inputs

Use repository signals:
- TypeScript/JavaScript: `tsconfig*.json`, `package.json`, `bun.lock`, `pnpm-lock.yaml`
- Java: `pom.xml`, `build.gradle*`, `settings.gradle*`
- Rust: `Cargo.toml`, `Cargo.lock`, `rust-toolchain*`

## Capability Routing

| Detected Language | Capability to Hot-Load |
|-------------------|-------------------------|
| TypeScript | `valdr.agents.refactor-agent.typescript-guidance` |
| Java | `valdr.agents.refactor-agent.java-guidance` |
| Rust | `valdr.agents.refactor-agent.rust-guidance` |
| Polyglot | Load all relevant guidance capabilities |

## Mixed-Repo Strategy

1. Partition scan by workspace/module language.
2. Apply language-specific heuristics per partition.
3. Normalize findings to shared severity taxonomy (`P0`/`P1`/`P2`).

## Anti-Patterns (DO NOT)

1. Apply TypeScript heuristics to Java or Rust modules.
2. Emit language-specific findings without confirming language/toolchain evidence.

<!--</instructions>-->
<!--</capability>-->
