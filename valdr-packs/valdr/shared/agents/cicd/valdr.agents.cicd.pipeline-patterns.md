<!--<capability id="valdr.agents.cicd.pipeline-patterns" pack="valdr" role="context">-->
# Platform-Agnostic Pipeline Patterns

<!--<identity>-->
Portable CI/CD design principles applicable across GitHub Actions, GitLab CI, CircleCI, and Azure DevOps.
<!--</identity>-->

<!--<instructions>-->
## Canonical Stage Flow
`lint -> test -> build -> publish -> deploy`

- Keep stage contracts explicit (inputs/outputs/artifacts).
- Fail early in cheap stages before expensive builds.

## Monorepo Strategies
- Path-based triggers to avoid unnecessary runs.
- Affected-target computation for selective builds/tests.
- Shared cache namespace segmented by workspace + lockfile hash.

## Branching Model Implications
- Trunk-based: short-lived branches, fast PR checks.
- GitFlow/release branches: explicit release promotion workflows.

## Promotion Model
- Promote immutable artifacts across dev/staging/prod.
- Avoid rebuilding same commit for each environment.

## Parallelization
- Fan-out test shards, fan-in aggregate quality decision.
- Use matrix builds for platform/runtime diversity.

## Cache & Artifact Lifecycle
- Warm base caches on default branch.
- Define retention and invalidation policy.
- Sign and attest artifacts when supported.

## Cross-Platform Translation Notes
- GitHub `jobs.<id>.needs` ≈ GitLab `needs`.
- CircleCI workflows and Azure stages map similarly to DAG dependencies.
- Keep pipeline logic declarative and idempotent regardless of CI engine.
<!--</instructions>-->
<!--</capability>-->
