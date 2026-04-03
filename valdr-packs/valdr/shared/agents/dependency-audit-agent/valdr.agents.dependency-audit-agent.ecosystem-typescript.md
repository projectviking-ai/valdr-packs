<!--<capability id="valdr.agents.dependency-audit-agent.ecosystem-typescript" pack="valdr" role="workflow">-->
# TypeScript / Bun / Node Ecosystem Audit

<!--<identity>-->
Full audit workflow for TypeScript, JavaScript, Bun, and Node.js projects using npm, Bun, yarn, or pnpm package managers.
<!--</identity>-->

<!--<instructions>-->

## Step 1: Dependency Inventory

### 1a: Identify Package Manager and Lockfile

| File Present | Package Manager | Lockfile |
|---|---|---|
| `bun.lockb` | Bun | `bun.lockb` (binary — use `bun install --dry-run` to inspect) |
| `package-lock.json` | npm | `package-lock.json` |
| `yarn.lock` | Yarn | `yarn.lock` |
| `pnpm-lock.yaml` | pnpm | `pnpm-lock.yaml` |

**If no lockfile exists:** emit a **critical reproducibility finding** — resolved versions are non-deterministic.

### 1b: Build Dependency List

```bash
# List direct dependencies with versions
cat package.json | jq '{dependencies, devDependencies, peerDependencies, optionalDependencies}'

# Check for workspace declarations
cat package.json | jq '.workspaces // empty'
```

For monorepos, repeat for each workspace:
```bash
# Find all workspace package.json files
find . -name "package.json" -not -path "*/node_modules/*" -maxdepth 3
```

Classify each dependency by scope:
- `dependencies` → production
- `devDependencies` → dev/build
- `peerDependencies` → peer (host must provide)
- `optionalDependencies` → optional (missing is not fatal)

### 1c: Check for Overrides and Resolutions

```bash
# npm overrides
cat package.json | jq '.overrides // empty'

# Yarn resolutions
cat package.json | jq '.resolutions // empty'

# pnpm overrides
cat package.json | jq '.pnpm.overrides // empty'
```

Overrides are important context — they may pin versions for security patches or force alignment.

## Step 2: Vulnerability Scan

### 2a: Run Native Audit

```bash
# Bun (preferred for Bun projects)
bun audit 2>/dev/null || echo "bun audit not available"

# npm
npm audit --json 2>/dev/null

# Fallback: check lockfile against OSV
# Read advisory data from https://osv.dev/
```

### 2b: Capture Advisory Metadata

For each vulnerability found, record:
- **Advisory ID**: GHSA-xxxx or CVE-xxxx
- **Package**: affected package name
- **Affected range**: version constraint that is vulnerable
- **Fixed version**: first patched version
- **Severity**: critical/high/medium/low (from advisory)
- **Direct or transitive**: is the vulnerable package in `dependencies` or pulled in transitively?

### 2c: Reachability Analysis

Trace whether the vulnerable code path is actually used:

```bash
# Find imports of the vulnerable package
rg "from ['\"]<package-name>" --type ts --type js -l
rg "require\(['\"]<package-name>" --type ts --type js -l

# Check which specific module/function is vulnerable (from advisory)
# Then trace if that specific export is imported
rg "<vulnerable-export>" --type ts --type js -l
```

Classify reachability:

| Classification | Criteria | Example |
|---|---|---|
| `reachable` | Direct import of vulnerable function/module with matching usage pattern | `import { parse } from 'vulnerable-pkg'` and advisory affects `parse()` |
| `potentially-reachable` | Package is imported but specific vulnerable path is unclear | Package used but vulnerability is in a sub-module |
| `unreachable` | Vulnerable function/module is not imported or used anywhere | Advisory affects `serialize()` but only `parse()` is imported |
| `unknown` | Cannot determine — transitive dependency or dynamic usage | Pulled in by another package, no direct import |

**Never classify as `unreachable` without concrete evidence** — show the import analysis that proves the vulnerable path is not used.

### 2d: Adjusted Urgency

Combine advisory severity with reachability:

| Advisory Severity | Reachable | Potentially | Unreachable | Unknown |
|---|---|---|---|---|
| Critical | **P0** | **P1** | P2 | **P1** |
| High | **P1** | P2 | P3 | P2 |
| Medium | P2 | P3 | P3 | P3 |
| Low | P3 | P3 | Info | P3 |

## Step 3: Unused Dependency Detection

### 3a: Scan for Import Usage

```bash
# Find all import/require statements
rg "from ['\"]" --type ts --type js -o | sort | uniq -c | sort -rn

# Check each declared dependency against imports
# For a specific package:
rg "(from ['\"]<package>|require\(['\"]<package>)" --type ts --type js -l
```

### 3b: Check Non-Obvious Usage Before Flagging

These patterns use dependencies without explicit imports:

| Pattern | How to Check | Example |
|---|---|---|
| **CLI/scripts** | `package.json` scripts field | `"scripts": { "lint": "eslint ." }` → `eslint` is used |
| **Config plugins** | Config files reference the package | `eslint.config.js` → `@eslint/js` |
| **Type-only packages** | `@types/*` packages | `@types/node` — no runtime import but needed for typecheck |
| **PostCSS/Babel plugins** | Referenced in tool configs | `postcss.config.js`, `babel.config.js` |
| **Bin scripts** | `npx <package>` or direct bin usage | CI scripts, Makefiles |
| **Subpath imports** | `import from '<package>/sub'` | Won't match root package grep |
| **Workspace hoisting** | Dep used by workspace child but declared at root | Check child `package.json` files |

### 3c: Classify Results

| Classification | Meaning |
|---|---|
| `unused` | No import, no script, no config, no type reference — safe to remove |
| `dev-only` | Used only in dev scripts/config — may be mis-scoped in `dependencies` |
| `config-only` | Used via config file reference, not imported in source |
| `type-only` | `@types/*` or `import type` only — no runtime usage |
| `possibly-unused` | Uncertain — could be runtime/reflection/dynamic require |

**A false positive that removes a build-critical dependency is worse than a missed cleanup.** Use `possibly-unused` when uncertainty remains.

## Step 4: Version Alignment Analysis

### 4a: Detect Drift

For monorepos, build a package-by-workspace matrix:

```bash
# Compare versions of the same package across workspaces
rg '"<package-name>"' **/package.json --type json
```

Drift types:

| Type | Description | Severity |
|---|---|---|
| Resolved mismatch | Same constraint, different resolved version | Low |
| Constraint mismatch | Different version constraints across workspaces | Medium |
| Duplicate install | Same package at multiple versions in `node_modules` | Medium |
| Workspace pin drift | Workspace protocol version doesn't match published | High |
| Override shadowing | Override hides a security-relevant version bump | High |

### 4b: Distinguish Intentional vs Accidental

Misalignment can be intentional:
- Independently deployed services may pin different versions
- Overrides/resolutions may exist for specific reasons
- `peerDependencies` ranges intentionally allow flexibility

Report context before escalation — don't assume all drift is a bug.

## Output

After completing all steps, hand off findings to `valdr.agents.dependency-audit-agent.reporting-remediation` for scorecard synthesis and upgrade planning.

## Anti-Patterns (DO NOT)

1. Run `npm install`, `bun install`, `yarn add`, or any package-modifying command
2. Assume `@types/*` packages are unused because they have no runtime imports
3. Flag workspace-hoisted dependencies as unused without checking child workspaces
4. Ignore `overrides`/`resolutions` — they may be critical security pins
5. Classify transitive vulnerabilities as `unreachable` just because the direct import looks safe

<!--</instructions>-->
<!--</capability>-->
