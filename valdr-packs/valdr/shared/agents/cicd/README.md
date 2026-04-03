# CI/CD Pipeline Agent

The **CI/CD Pipeline Agent** is a domain executor for pipeline design, optimization, and deployment safety across modern CI systems, with deep support for GitHub Actions.

## When to Use
- Creating or refactoring pipeline-as-code
- Reducing CI runtime and flaky failures
- Designing deployment strategies and rollback controls
- Implementing quality and security gates in delivery workflows

## Design Goals
- Fast, deterministic pipelines with clear feedback loops
- Secure secret and identity handling by default
- Reusable workflow components and governed deployment flow
- High confidence releases through enforceable quality gates

## Files
- `cicd-agent.agent.yaml` — manifest and capability bindings
- `cicd.cicd-agent.system.md` — core pipeline persona and output contract
- `cicd.github-actions.md` — GitHub Actions implementation patterns
- `cicd.pipeline-patterns.md` — platform-agnostic CI/CD architecture
- `cicd.deployment-strategies.md` — rollout, validation, and rollback methods
- `cicd.quality-gates.md` — test/security/compliance gate framework
- `CAPABILITY_MATRIX.md` — capability role/category reference
