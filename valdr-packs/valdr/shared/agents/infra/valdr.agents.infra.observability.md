<!--<capability id="valdr.agents.infra.observability" pack="valdr" role="context">-->
# Observability, Monitoring, and Alerting

<!--<identity>-->
Patterns for making infrastructure observable — structured logging, metrics, alerting, SLOs, and dashboards that surface problems before users notice.
<!--</identity>-->

<!--<instructions>-->

## The Four Golden Signals

Every service should emit metrics covering these. When designing or reviewing infra, verify coverage:

| Signal | What to Measure | Alert When |
|--------|----------------|------------|
| **Latency** | Request duration (p50, p95, p99) | p99 exceeds SLO threshold |
| **Traffic** | Requests per second, concurrent connections | Sudden spike or drop (anomaly) |
| **Errors** | Error rate as percentage of total requests | Error rate exceeds SLO budget |
| **Saturation** | CPU, memory, disk, connection pool utilization | Approaching resource limits (>80%) |

## Health Checks

Every deployed service must have health check endpoints. Define these in IaC:

- **Liveness** — Is the process running? Restart if not. Keep this cheap (no DB calls).
- **Readiness** — Can the service handle traffic? Remove from load balancer if not. May check downstream dependencies.
- **Startup** — Is the service still initializing? Prevent premature liveness failures on slow-starting apps.

When generating Kubernetes manifests, ECS task definitions, or Cloud Run configs, include probe definitions. When reviewing existing configs, flag missing probes.

## Structured Logging

Infrastructure should enforce structured logging at the platform level:

- Use JSON log format with consistent field names: `timestamp`, `level`, `message`, `service`, `trace_id`.
- Route logs to a centralized aggregator (CloudWatch, Cloud Logging, Datadog, etc.).
- Set log retention policies based on environment (dev: 7d, staging: 14d, prod: 90d minimum).
- Never log secrets, tokens, PII, or full request bodies containing sensitive data.
- Include correlation/trace IDs for request tracing across services.

## Alerting Rules

### Alert Design Principles

- Alert on **symptoms** (error rate, latency), not causes (CPU usage) — unless saturation directly causes user impact.
- Every alert must have a **runbook link** or inline remediation steps.
- Use severity levels consistently:

| Severity | Meaning | Response |
|----------|---------|----------|
| **critical** | User-facing impact right now | Page on-call, immediate response |
| **warning** | Approaching threshold or degraded but functional | Investigate within business hours |
| **info** | Notable event, no action needed | Review in daily triage |

### Alert Anti-Patterns

- Alerts that fire constantly and get ignored (alert fatigue).
- Alerts with no owner or runbook.
- Threshold-based alerts without considering baseline variance.
- Missing alerts on things that have broken before (post-incident gap).

## SLO Definition

When creating or reviewing critical services, define SLOs:

```
Service: <service-name>
SLI: <what is measured — e.g., "successful responses / total responses">
SLO: <target — e.g., "99.9% over 30-day rolling window">
Error budget: <remaining budget for the period>
Consequence: <what happens when budget is exhausted — e.g., "freeze deployments">
```

- SLOs should be defined in IaC or config alongside the service, not in a separate doc that drifts.
- Start with achievable targets based on current performance, then tighten.
- Multi-AZ deployments should target higher availability than single-AZ.

## Monitoring Infrastructure in IaC

When generating Terraform/IaC for monitoring:

- Define alerting policies as code alongside the resources they monitor.
- Create dashboard definitions as code (Grafana JSON, CloudWatch dashboard JSON, Datadog monitors as Terraform).
- Use budget alarms for cost monitoring — set at 50%, 80%, and 100% of expected monthly spend.
- Include uptime checks for public endpoints.

## Observability Checklist

When reviewing or building infrastructure, verify:

- [ ] Health check endpoints defined and wired to load balancer/orchestrator.
- [ ] Structured logging configured with appropriate retention.
- [ ] Metrics covering the four golden signals.
- [ ] Alerts defined for error rate and latency SLOs.
- [ ] Budget/cost alarms in place.
- [ ] Dashboard or monitoring view exists for the service.
- [ ] Log and metric data does not contain secrets or PII.

<!--</instructions>-->
<!--</capability>-->
