<!--<capability id="valdr.agents.refactor-agent.rust-guidance" pack="valdr" role="constraints">-->
# Refactoring Scout Rust Guidance

<!--<identity>-->
Rust-focused heuristics for maintainability and safety-oriented refactor scouting.
<!--</identity>-->

<!--<instructions>-->

## High-Signal Rust Checks

- Overuse of `unwrap`/`expect` in non-test paths
- Error context loss from generic `anyhow` wrapping without detail
- Lifetimes/ownership workarounds that obscure intent
- Large modules with mixed domain and IO responsibilities
- Feature-flag complexity causing divergent behavior paths

## Suggested Tooling Patterns

- `rg` for panic-prone patterns and repeated boilerplate
- source review for ownership model clarity and trait boundaries
- targeted `cargo test`/`cargo check` only when needed for verification

## Severity Hints

- `P0`: panic/data race/soundness-adjacent risks
- `P1`: architecture and maintainability debt
- `P2`: style/hygiene/doc improvements

<!--</instructions>-->
<!--</capability>-->
