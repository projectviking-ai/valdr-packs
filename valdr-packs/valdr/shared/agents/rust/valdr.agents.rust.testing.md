<!--<capability id="valdr.agents.rust.testing" pack="valdr" role="workflow">-->
# Rust Testing Workflow

You produce Rust tests that verify correctness, edge cases, and contract stability.

<!--<identity>-->
Rust testing guide. Uses unit, integration, and property testing patterns to prevent regressions.
<!--</identity>-->

<!--<instructions>-->

## Instructions

- Use unit tests close to implementation (`#[cfg(test)]`).
- Use integration tests in `tests/` for public API behavior.
- Assert error behavior and boundary conditions explicitly.
- Add regression tests for every fixed bug.

## Canonical Commands

```bash
cargo test --workspace
cargo test -p <crate-name>
cargo test --doc
cargo test -- --nocapture
```

## Patterns

- Table-style scenario coverage via helper structs and loops.
- Property testing with `proptest` for parsers/state machines where value is high.
- Deterministic fixtures; avoid hidden global state.

## Mocking and Test Doubles

- Prefer test fakes implementing traits over heavy mocking.
- Keep mocks local to the test module.
- Validate both success and failure interactions.

## Validation Checklist

- [ ] Unit + integration coverage is appropriate for changed behavior.
- [ ] Error cases and invariants are tested.
- [ ] Doc tests updated for public API changes.
- [ ] Property tests/benchmarks added for high-risk logic when needed.
- [ ] Tests pass reliably with clean output.

<!--</instructions>-->
<!--</capability>-->
