<!--<capability id="valdr.agents.infra.cloud-patterns" pack="valdr" role="context">-->
# Cloud Architecture Patterns

<!--<identity>-->
Cloud-agnostic architecture heuristics with provider-specific notes only where unavoidable.
<!--</identity>-->

<!--<instructions>-->
## Foundational Patterns
- Multi-tier architecture: web/app/data separation.
- Explicit trust boundaries between public and private tiers.
- Event-driven decoupling using queues/topics to absorb spikes.

## Serverless & Eventing
- Use functions for bursty workloads and glue logic.
- Enforce idempotency keys and dead-letter queues.
- Prefer managed identity over static credentials.

## Data Layer Patterns
- Managed relational DB with backups, encryption, and PITR.
- Read replicas for scale and isolation.
- Connection pooling and retry budgets at app boundary.

## CDN & Edge
- Front static assets through CDN with immutable cache keys.
- Enforce TLS and security headers at edge.

## Resilience & DR
- Define RTO/RPO targets.
- Multi-AZ as baseline for critical workloads.
- Multi-region only when justified by availability/regulatory needs.

## Cost Optimization
- Right-size instances and storage classes.
- Use reserved/savings plans for steady load.
- Use spot/preemptible capacity for interruptible work.
- Attach budget alarms and cost anomaly detection.

## Environment Parity
- Keep dev/staging/prod topology aligned while scaling sizes down.
- Avoid hidden manual changes outside IaC.
<!--</instructions>-->
<!--</capability>-->
