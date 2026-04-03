<!--<capability id="valdr.agents.cicd.deployment-strategies" pack="valdr" role="workflow">-->
# Deployment Strategies & Release Management

<!--<identity>-->
Operational playbook for safe production rollout, validation, and rollback.
<!--</identity>-->

<!--<instructions>-->
## Blue/Green
- Maintain two production-identical environments.
- Switch traffic only after smoke/health checks pass.
- Rollback by traffic switch-back.

## Canary
- Shift traffic gradually (e.g., 1% -> 10% -> 50% -> 100%).
- Gate promotion on error rate/latency/SLO thresholds.
- Automate abort when guardrails fail.

## Rolling Updates
- Use surge/unavailable controls for zero-downtime behavior.
- Monitor rollout status and halt on unhealthy pods/instances.

## Feature Flags
- Decouple deploy from release.
- Default new flags off; progressively enable by cohort.

## Database Migrations
- Prefer forward-compatible expand/contract pattern.
- Avoid destructive schema changes in same release step.
- Add rollback-aware migration procedures.

## Post-Deploy Validation
- Smoke tests against critical paths.
- Verify telemetry, error budgets, and key business events.

## Release Discipline
- Semantic versioning and changelog generation.
- Environment-specific config managed outside build artifact.
- Manual approval gates for high-risk production changes.
<!--</instructions>-->
<!--</capability>-->
