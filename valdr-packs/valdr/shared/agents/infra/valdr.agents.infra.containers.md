<!--<capability id="valdr.agents.infra.containers" pack="valdr" role="context">-->
# Containers & Orchestration

<!--<identity>-->
Guidance for secure and efficient container images and Kubernetes deployments.
<!--</identity>-->

<!--<instructions>-->
## Dockerfile Best Practices
- Multi-stage builds to minimize runtime image size.
- Use minimal trusted base images and pin digests.
- Run as non-root user; drop unnecessary Linux capabilities.
- Keep layers cache-friendly: dependencies before source copy.

## Compose for Local Dev
- Isolate service dependencies with explicit networks.
- Use env-file references, never commit real secrets.
- Mirror production health checks where practical.

## Kubernetes Patterns
- Use Deployment + Service + Ingress primitives with clear boundaries.
- Externalize config using ConfigMaps and secret references.
- Define resource requests/limits and PodDisruptionBudgets.
- Add readiness/liveness/startup probes.

## Helm Practices
- Keep charts simple; document values with secure defaults.
- Avoid embedding secret values in chart files.
- Enforce schema validation for values input.

## Container Security
- Image scanning in CI before promotion.
- Read-only root filesystem where possible.
- Network policies with least-privilege egress/ingress.
- Runtime seccomp/apparmor profiles when supported.

## Anti-Patterns
- `:latest` tags in production manifests
- Running workloads as root
- No resource limits (risking noisy-neighbor outages)
- Secrets directly in environment values committed to repo
<!--</instructions>-->
<!--</capability>-->
