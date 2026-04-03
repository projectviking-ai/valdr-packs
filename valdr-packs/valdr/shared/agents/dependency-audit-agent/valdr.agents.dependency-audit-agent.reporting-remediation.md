<!--<capability id="valdr.agents.dependency-audit-agent.reporting-remediation" pack="valdr" role="validation">-->
# Reporting, Scorecard, and Upgrade Planning

<!--<identity>-->
Cross-ecosystem reporting framework for dependency audit findings, including compound findings analysis, health scorecard, and phased upgrade planning.
<!--</identity>-->

<!--<instructions>-->

## Step 1: Compound Findings Analysis

Before scoring, identify findings that span multiple risk dimensions. A single remediation that resolves multiple risks should be prioritized higher than single-dimension findings.

### Compound Patterns

| Pattern | Components | Why It's Worse | Priority Boost |
|---|---|---|---|
| `vulnerable-and-unused` | Vulnerability + unused dependency | Remove the dep — eliminates vuln with zero risk | Raise to top of phase 1 |
| `vulnerable-and-misaligned` | Vulnerability + version drift | Alignment fix may resolve vuln across workspaces | Raise above single-vuln findings |
| `unused-and-misaligned` | Unused + version drift | Remove the dep — eliminates alignment noise too | Group with other removals |
| `transitive-vulnerability-via-unused` | Transitive vuln through an unused direct dep | Removing unused dep eliminates entire transitive chain | Raise to top of phase 1 |
| `scope-misplaced-and-vulnerable` | Vulnerability + wrong scope (e.g., test dep in prod) | Moving to correct scope may remove from runtime classpath | Raise — scope fix may eliminate exposure |

Flag compound findings explicitly and rate them at the highest component priority.

## Step 2: Health Scorecard

Produce a summary scorecard across all audited ecosystems:

```markdown
## Health Scorecard

| Metric | Value |
|---|---|
| Ecosystems audited | <list> |
| Total direct dependencies | <count> |
| Total transitive dependencies | <count> |
| Vulnerabilities (reachable) | <count> |
| Vulnerabilities (potentially reachable) | <count> |
| Vulnerabilities (unreachable/unknown) | <count> |
| Unused dependencies | <count> |
| Possibly unused | <count> |
| Version misalignments | <count> |
| Duplicate installs | <count> |
| Compound findings | <count> |
| Oldest dependency (age) | <package> (<age>) |

### Risk Rating: <Critical / High / Medium / Low>
```

### Rating Criteria

| Rating | Criteria |
|---|---|
| **Critical** | Any P0 finding (reachable critical/high vulnerability) or confirmed secret exposure |
| **High** | P1 findings present, or >5 unused dependencies with vulnerability exposure |
| **Medium** | P2 findings only, moderate drift, some unused dependencies |
| **Low** | No vulnerabilities reachable, minimal unused, aligned versions |

## Step 3: Required Finding Fields

Every finding in the report must include:

```markdown
### <finding-id>: <title>
- **Priority**: P0 / P1 / P2 / P3 / Info
- **Dimension**: vulnerability / unused / alignment / compound
- **Ecosystem**: typescript / rust / jvm
- **Package**: <name@version>
- **Workspace**: <workspace or "root">
- **Description**: <what's wrong>
- **Evidence**: <advisory ID, import path, command output, file:line>
- **Remediation**: <specific fix>
- **Effort**: trivial / low / medium / high
- **Risk**: <what could break>
- **Related findings**: <IDs if compound>
```

Vulnerabilities also require:
- **Reachability**: reachable / potentially-reachable / unreachable / unknown
- **Confidence**: high / medium / low
- **Advisory**: <GHSA/CVE/RUSTSEC ID with affected and fixed versions>

## Step 4: Validation Gates

Before finalizing the report, verify:

1. Every vulnerability has reachability classification + confidence + evidence (import chain or limitation statement)
2. Every unused finding includes non-obvious usage checks (scripts, config, plugins, runtime patterns)
3. Every alignment finding distinguishes intentional vs accidental divergence
4. Effort and risk assessments are realistic — a "trivial" effort should not require migration work
5. Compound findings are flagged — don't report components separately without linking them

## Step 5: Phased Upgrade Plan

### Approval Gate

Produce the plan with exact commands, but **do not execute** unless explicitly approved by the human.

### Phase Model

| Phase | Scope | Risk | Actions |
|---|---|---|---|
| **Phase 1: Zero-Risk** | Removals and patches | None — removing unused or applying patch versions | Remove unused deps, apply patch-level security fixes, fix scope misplacements |
| **Phase 2: Low-Risk** | Minor upgrades | Low — semver minor should be compatible | Minor version bumps, safe alignment convergence, dev dependency updates |
| **Phase 3: Breaking** | Major upgrades | Medium-High — API changes expected | Major version migrations with explicit sequencing of dependency chains |
| **Phase 4: Deferred** | Accepted risk | N/A | No-fix vulnerabilities, approved exceptions, intentional version divergence |

### Per-Phase Requirements

Each phase must include:

```markdown
### Phase N: <name>

#### Actions
- [ ] <action> — `<exact command>`

#### Validation
- [ ] Typecheck passes: `<command>`
- [ ] Tests pass: `<command>`
- [ ] Build succeeds: `<command>`

#### Rollback
- <how to revert if something breaks>

#### Impact Notes
- <what might change in behavior>
```

### Ecosystem-Specific Commands

**TypeScript/Bun:**
```bash
# Remove unused
bun remove <package>  # or npm uninstall <package>

# Patch upgrade
bun update <package>  # or npm update <package>

# Major upgrade
bun add <package>@latest  # or npm install <package>@latest
```

**Rust:**
```bash
# Remove unused
# Edit Cargo.toml to remove the dependency, then:
cargo check

# Update within semver range
cargo update -p <crate>

# Major upgrade
# Edit Cargo.toml version constraint, then:
cargo check
```

**JVM:**
```bash
# Maven — update version in pom.xml, then:
mvn compile test

# Gradle — update version in build.gradle(.kts) or libs.versions.toml, then:
./gradlew compileJava test
```

## Anti-Patterns (DO NOT)

1. Produce an upgrade plan without rollback steps for each phase
2. Put major version upgrades in Phase 1 — they carry breaking-change risk
3. Execute any remediation commands — this is a plan, not an execution
4. Report findings without the required fields — incomplete findings are not actionable
5. Skip compound findings analysis — a single removal that fixes 3 things should be prioritized
6. Rate a project as "Low" risk when vulnerabilities have `unknown` reachability — unknown is not safe

<!--</instructions>-->
<!--</capability>-->
