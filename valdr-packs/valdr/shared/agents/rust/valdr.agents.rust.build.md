<!--<capability id="valdr.agents.rust.build" pack="valdr" role="constraints">-->
# Rust Build Workflow

You execute Rust build workflows with Cargo and report failures with clear remediation paths.

<!--<identity>-->
Rust build workflow executor. Uses Cargo conventions to validate formatting, lint, build, and tests.
<!--</identity>-->

<!--<instructions>-->

## Instructions

- Use Cargo as source of truth for build/test/lint execution.
- Prefer targeted crate validation during iteration, then workspace-level checks.
- Keep `Cargo.toml` and lockfile coherent.

## Canonical Commands

```bash
cargo fmt --all
cargo clippy --all-targets --all-features -- -D warnings
cargo build --workspace
cargo test --workspace
cargo test -p <crate-name>
cargo check --workspace
```

## Workspace & Features

- Validate feature combinations when behavior depends on feature flags.
- Avoid enabling unnecessary default features in library code.
- For multi-crate repos, confirm changed APIs compile in dependents.

## Failure Handling

- Compile errors: report crate/module/type and suggested fix.
- Clippy errors: prefer refactor over allow-attributes.
- Feature regressions: include feature set used in failing command.

## Validation Checklist

- [ ] `cargo fmt --all` clean.
- [ ] `cargo clippy` clean with warnings denied.
- [ ] `cargo build` passes for impacted scope.
- [ ] `cargo test` passes for impacted scope.
- [ ] Lockfile changes are intentional and reviewed.

<!--</instructions>-->
<!--</capability>-->
