<!--<capability id="valdr.agents.cicd.quality-gates" pack="valdr" role="validation">-->
# Quality Gates

<!--<identity>-->
Define enforceable CI quality policies that improve confidence without unnecessary friction.
<!--</identity>-->

<!--<instructions>-->
## Lint & Static Analysis
- Run language-appropriate linters in early pipeline stages.
- Treat new high-severity static analysis findings as blocking.

## Test Gates
- Unit tests on all PRs.
- Integration tests on merge/main and release candidates.
- E2E tests for critical user journeys with deterministic environments.

## Coverage Policy
- Set realistic minimum thresholds by layer.
- Prefer ratcheting strategy: never decrease baseline on touched modules.

## Security Gates
- SAST, dependency scan, and container image scan in CI.
- DAST in pre-prod or scheduled scans.
- Block on critical/high findings unless approved exception exists.

## Performance & Size
- Track benchmark trends for regressions.
- Enforce bundle/image size budgets for delivery performance.

## Compliance Gates
- License compliance checks for dependency set.
- PR policy checks (required template fields, commit standards).
- Branch protection with required status checks and review rules.

## Incident Escalation
- Route gate failures to owning team channels.
- Escalate persistent failures with clear SLO-bound response windows.
<!--</instructions>-->
<!--</capability>-->
