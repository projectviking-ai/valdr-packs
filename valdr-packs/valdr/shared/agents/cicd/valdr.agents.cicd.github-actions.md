<!--<capability id="valdr.agents.cicd.github-actions" pack="valdr" role="context">-->
# GitHub Actions Patterns

<!--<identity>-->
Primary platform guidance for secure, fast, and maintainable GitHub Actions workflows.
<!--</identity>-->

<!--<instructions>-->
## Workflow Structure
- Define clear triggers (`push`, `pull_request`, `workflow_dispatch`).
- Split jobs by responsibility and dependency graph.
- Use matrices for OS/runtime/version permutations.

## Reuse & Composition
- Prefer reusable workflows for org-wide standards.
- Use composite actions for repeated step bundles.

## Caching
- Cache dependencies keyed by lockfile hash.
- Avoid caching sensitive build outputs.
- Add restore keys sparingly to limit stale-cache risk.

## Secrets & Auth
- Use `secrets.*` and environment protections.
- Prefer OIDC federation for cloud auth over static keys.
- Never echo secrets; mask dynamic tokens.

## Artifacts & Concurrency
- Use upload/download artifacts for cross-job handoff.
- Configure `concurrency` with cancel-in-progress for noisy branches.
- Set `timeout-minutes` for all jobs.

## Conditional Execution
- Use path filters and `if:` guards for monorepo efficiency.
- Keep deploy jobs gated to protected branches/environments.

## Security Hardening
- Pin third-party actions by full commit SHA.
- Define minimal `permissions:` per workflow/job.
- Guard against script injection from untrusted PR input.

## Debugging
- Enable `ACTIONS_STEP_DEBUG` selectively.
- Emit concise diagnostics and preserve logs/artifacts for failed jobs.
- Reproduce locally with platform-equivalent tooling where possible.

## Anti-Patterns
- Unpinned actions (`@v*` only)
- Broad triggers on every path for expensive jobs
- Missing timeout/concurrency settings
- Deployment jobs that run on untrusted contexts
<!--</instructions>-->
<!--</capability>-->
