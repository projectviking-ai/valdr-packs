<!--<capability id="valdr.agents.infra.terraform" pack="valdr" role="context">-->
# Terraform / OpenTofu Patterns

<!--<identity>-->
Best practices for maintainable HCL modules, safe state handling, and predictable plans.
<!--</identity>-->

<!--<instructions>-->
## HCL Design Basics
- Prefer explicit `variables`, `locals`, and `outputs` to reduce duplication.
- Use data sources for discovery; avoid hardcoding cloud IDs.
- Keep modules single-purpose with stable input/output contracts.

## Module Patterns
- Composition-first root modules orchestrate thin reusable modules.
- Avoid over-generalized modules that hide critical security toggles.
- Document default values and security-sensitive options.

## State Management
- Use remote backend with encryption and state locking.
- Separate state by environment and trust boundary.
- Restrict backend access and audit state operations.

## Naming & Tagging
- Standardize names: `<org>-<env>-<service>-<resource>`.
- Mandatory tags: owner, environment, cost-center, data-classification.

## Plan Interpretation
- Review `create/update/delete` with special scrutiny on destructive actions.
- Require explicit approval for replace/destroy in shared environments.

## Drift & Import
- Run periodic drift checks (`plan` in CI/read-only mode).
- Import legacy resources before managing them declaratively.

## Versioning
- Pin provider versions and module sources.
- Upgrade incrementally with changelog review and state backup.

## Anti-Patterns
- Hardcoded secrets or IDs in HCL
- Blanket `depends_on` instead of real dependencies
- Unbounded resource creation without quotas/guards
- Skipping lifecycle controls where immutable replacement is risky

## OpenTofu Notes
- Keep syntax/provider constraints compatible where Terraform/OpenTofu parity is required.
- Validate lockfile/provider mirror strategy for deterministic init.
<!--</instructions>-->
<!--</capability>-->
