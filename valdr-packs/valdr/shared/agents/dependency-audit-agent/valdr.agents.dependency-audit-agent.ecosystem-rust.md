<!--<capability id="valdr.agents.dependency-audit-agent.ecosystem-rust" pack="valdr" role="workflow">-->
# Rust / Cargo Ecosystem Audit

<!--<identity>-->
Full audit workflow for Rust projects using Cargo, including workspace crates, feature flags, and conditional compilation.
<!--</identity>-->

<!--<instructions>-->

## Step 1: Dependency Inventory

### 1a: Parse Cargo Manifests

```bash
# Root manifest
cat Cargo.toml

# Check for workspace
rg "\[workspace\]" Cargo.toml
rg "members" Cargo.toml
```

For workspaces, locate all member crates:
```bash
# Find all Cargo.toml files
find . -name "Cargo.toml" -not -path "*/target/*" -maxdepth 3
```

### 1b: Build Dependency List

```bash
# Full dependency tree
cargo tree 2>/dev/null

# Dependency tree for a specific crate
cargo tree -p <crate-name> 2>/dev/null

# Check for duplicate crate versions
cargo tree --duplicates 2>/dev/null
```

Classify each dependency:
- `[dependencies]` → production
- `[dev-dependencies]` → test/bench only
- `[build-dependencies]` → build script (`build.rs`) only
- `optional = true` → feature-gated (only included when feature is enabled)

### 1c: Feature and Patch Context

```bash
# Check for feature declarations and their dependency implications
rg "\[features\]" Cargo.toml -A 20

# Check for patch/replace directives
rg "\[patch\." Cargo.toml -A 5
rg "\[replace\]" Cargo.toml -A 5
```

Patches are important context — they may override upstream versions for security fixes or local development.

## Step 2: Vulnerability Scan

### 2a: Run Cargo Audit

```bash
# JSON output for structured analysis
cargo audit --json 2>/dev/null

# Fallback: check against RustSec advisory DB
# https://rustsec.org/advisories/
```

If `cargo audit` is not installed, fall back to OSV API lookups using crate names and versions from `Cargo.lock`.

### 2b: Capture Advisory Metadata

For each vulnerability found, record:
- **Advisory ID**: RUSTSEC-xxxx or CVE-xxxx
- **Crate**: affected crate name
- **Affected range**: vulnerable version range
- **Patched version**: first fixed version (if available)
- **Severity**: from advisory or CVSS score
- **Direct or transitive**: is the crate in `[dependencies]` or pulled in by another crate?

### 2c: Reachability Analysis

Rust's module system and trait-based dispatch make reachability analysis more tractable than dynamic languages:

```bash
# Find direct imports of the vulnerable crate
rg "use <crate_name>::" --type rust -l
rg "extern crate <crate_name>" --type rust -l

# Check if the specific vulnerable function/type is used
rg "<vulnerable_item>" --type rust -l
```

Additional Rust-specific considerations:

| Pattern | Reachability Impact |
|---|---|
| Feature-gated dependency | Only reachable if feature is enabled — check `Cargo.toml` `[features]` |
| Target-gated dependency | `[target.'cfg(...)'.dependencies]` — only on specific platforms |
| `build.rs` dependency | Only runs at compile time, not in the final binary |
| Proc-macro dependency | Runs at compile time only — code generation, not runtime |
| Optional dependency | Only included when feature is explicitly enabled |

Classify reachability using the same scale: `reachable`, `potentially-reachable`, `unreachable`, `unknown`.

**Rust advantage:** Unused imports are compile errors (unless `#[allow(unused)]`), so if a crate is imported, it's almost certainly used. Focus reachability on *which specific module/function* is vulnerable.

### 2d: Adjusted Urgency

Apply the same severity × reachability matrix as other ecosystems (see system prompt). For feature-gated or target-gated dependencies, check if the feature/target is actually enabled in the project before adjusting.

## Step 3: Unused Dependency Detection

### 3a: Scan for Crate Usage

```bash
# Find all use/extern crate statements
rg "^use " --type rust -o | sort | uniq -c | sort -rn
rg "extern crate " --type rust

# Check for a specific crate
rg "(use <crate_name>|extern crate <crate_name>|<crate_name>::)" --type rust -l
```

### 3b: Check Non-Obvious Usage Before Flagging

| Pattern | How to Check | Example |
|---|---|---|
| **`build.rs` usage** | Check `build-dependencies` against `build.rs` imports | `cc` crate used in `build.rs` for C compilation |
| **Proc-macro crate** | Check for `#[derive(MacroName)]` or `#[macro_name]` in source | `serde_derive`, `thiserror` |
| **Feature-gated re-export** | Crate enables a feature on another crate | `tokio` with `features = ["full"]` |
| **`#[cfg(test)]` only** | Used in test modules but not main code | Should be in `[dev-dependencies]` |
| **Trait implementations** | Crate provides trait impls via `use` without explicit function calls | `anyhow`, `eyre` — used via `?` operator |
| **Runtime/FFI** | Linked at runtime, no Rust import | C/C++ bindings, dynamic loading |

### 3c: Scope Misplacement

Flag dependencies that are in the wrong scope:
- Test-only crate in `[dependencies]` → should be `[dev-dependencies]`
- Build-only crate in `[dependencies]` → should be `[build-dependencies]`
- Unused feature flags on dependencies → wasted compile time and binary size

## Step 4: Version Alignment Analysis

### 4a: Detect Duplicates

```bash
cargo tree --duplicates 2>/dev/null
```

Duplicate crate versions increase binary size and can cause subtle bugs when types from different versions are incompatible.

### 4b: Drift Types

| Type | Description | Severity |
|---|---|---|
| Duplicate crate versions | Same crate at 2+ versions in dependency tree | Medium |
| Workspace member constraint drift | Members pin different versions of the same crate | Medium |
| Patch overriding upstream | `[patch]` directive hides upstream version | High (if security-relevant) |
| Yanked crate version | Resolved version has been yanked from crates.io | High |

### 4c: Workspace Alignment

For workspace projects, check `[workspace.dependencies]` for centralized version management:
```bash
rg "\[workspace.dependencies\]" Cargo.toml -A 50
```

Crates not using `workspace = true` inheritance may drift independently.

## Output

After completing all steps, hand off findings to `valdr.agents.dependency-audit-agent.reporting-remediation` for scorecard synthesis and upgrade planning.

## Anti-Patterns (DO NOT)

1. Run `cargo update`, `cargo add`, or any dependency-modifying command
2. Ignore feature gates when assessing reachability — a feature-gated dep may never be compiled
3. Flag proc-macro or build-dependency crates as unused based on runtime import analysis alone
4. Assume duplicate crate versions are always a problem — semver allows compatible ranges
5. Skip `build.rs` and `[build-dependencies]` — they're a common source of false positives

<!--</instructions>-->
<!--</capability>-->
