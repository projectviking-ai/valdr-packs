<!--<capability id="valdr.agents.infra.incident-triage" pack="valdr" role="workflow">-->
# Incident Triage Workflow

<!--<identity>-->
Structured diagnostic workflow for outages, degraded services, and unexpected behavior. Diagnose before fixing. Report incrementally. Bias toward rollback.
<!--</identity>-->

<!--<instructions>-->
Follow these steps in order. Do not skip to fixes before completing diagnosis.

## Step 1: Establish Scope

Before investigating, answer these questions:

- **What is the symptom?** (errors, latency, downtime, data inconsistency)
- **Who is affected?** (all users, specific region, specific endpoint, internal only)
- **When did it start?** (correlate with recent deployments, config changes, or external events)
- **What environment?** (dev, staging, production)

If the user hasn't provided this context, ask before proceeding.

## Step 2: Check Health

Run read-only inspection commands in this order. Hot-load the relevant cloud cheatsheet for CLI syntax.

1. **Endpoint health** — `curl` the health check endpoint. Is the service responding at all?
2. **Service status** — Check the orchestrator/platform status (ECS, Cloud Run, Kubernetes, Fly.io, etc.). Are instances running? Are deployments healthy?
3. **Recent deployments** — List recent deployments/revisions. Did something just ship?
4. **Resource health** — Check CPU, memory, disk, connection counts. Is anything saturated?

Report findings after each check. Do not batch — the user needs to see progress.

## Step 3: Read Logs

Focus the log query on the symptom timeframe:

1. Start with error-level logs from the affected service in the last 2 hours.
2. Look for patterns: repeated errors, stack traces, connection timeouts, permission denials.
3. Check for upstream dependency failures (database, cache, external API).
4. If the service recently deployed, compare log patterns before and after deployment.

## Step 4: Identify Root Cause

Based on health checks and logs, classify the issue:

| Category | Indicators | Common Causes |
|----------|-----------|---------------|
| **Deployment** | Started after a deploy, new error patterns | Bad code, missing env vars, config mismatch |
| **Scaling** | High CPU/memory, connection pool exhaustion | Traffic spike, resource limits too low, no autoscaling |
| **Dependency** | Timeout errors, connection refused to downstream | Database down, external API outage, DNS failure |
| **Networking** | Connection timeouts, TLS errors, 502/503 from LB | Security group change, certificate expiry, DNS misconfiguration |
| **Permissions** | Access denied, 403 errors, IAM policy errors | Role change, key rotation, policy detachment |
| **Data** | Inconsistent responses, missing records | Migration failure, replication lag, corruption |

## Step 5: Propose Fix

Apply the minimum change to restore service:

1. **Rollback first** — If caused by a recent deployment, propose rollback to the last known good revision. This is almost always the fastest path to recovery.
2. **Mitigate, don't redesign** — During an incident, propose the smallest fix that stops the bleeding. Full redesign comes after the incident is resolved.
3. **Classify the fix by blast radius** — Even under pressure, follow the risk classification from the system prompt. Destructive fixes still require explicit approval.
4. **Verify the fix** — After applying, re-run the health checks from Step 2 to confirm recovery.

## Step 6: Document

After the incident is resolved, summarize:

```
## Incident Summary
- **Symptom**: <what was observed>
- **Impact**: <who was affected, for how long>
- **Root cause**: <what actually broke>
- **Fix applied**: <what was done to restore service>
- **Prevention**: <what should change to prevent recurrence — IaC change, alert addition, test gap>
```

## Rules During Triage

- **Read before write.** Never apply fixes before completing Steps 1-4.
- **Report incrementally.** Share each finding as you go — do not wait for a complete diagnosis.
- **Bias toward rollback.** If a recent deployment correlates with the issue, rollback first, investigate second.
- **Do not make unrelated changes.** Even if you notice other issues during triage, stay focused on the active incident.
- **Ask for approval on destructive actions.** Time pressure does not override the approval policy.
<!--</instructions>-->
<!--</capability>-->
