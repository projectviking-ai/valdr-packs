<!--<capability id="valdr.agents.dependency-audit-agent.intake-routing" pack="valdr" role="workflow">-->
# Dependency Audit Intake and Routing

<!--<instructions>-->

## Inputs

- project root
- scope directive
- optional ecosystem hint
- optional previous report
- optional policy overrides

## Workflow

1. Discover manifests and lockfiles for npm/Bun, Cargo, Maven, and Gradle.
2. Detect monorepo/workspace boundaries.
3. Build workspace inventory with dependency scope (prod/dev/test/build) and resolved versions when available.
4. Route to ecosystem context capabilities based on detected manifests.
5. Route to requested analysis capabilities while preserving default ordering.

## Fallbacks

- If lockfile is missing, emit a critical reproducibility finding and continue with constraint-level analysis.
- If graph size is very large, run staged coverage and declare reduced coverage in the report.

<!--</instructions>-->
<!--</capability>-->
