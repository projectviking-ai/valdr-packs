<!--<capability id="valdr.agents.dependency-audit-agent.reporting-scorecard" pack="valdr" role="validation">-->
# Reporting and Scorecard Validation

<!--<instructions>-->

## Required Finding Fields

- `id`, `severity`, `dimension`, `ecosystem`, `package`, `workspace`
- `description`, `evidence`, `remediation`, `effort`, `risk`, `related_findings`
- vulnerabilities also require `reachability`, `confidence`, and advisory metadata

## Scorecard Metrics

- direct/transitive dependency counts
- reachable vs unreachable vulnerability counts
- unused dependency counts
- misalignment/duplicate counts
- oldest dependency age

## Validation Gates

1. Every vulnerability has reachability + confidence + evidence.
2. Unused findings include non-obvious usage checks.
3. Alignment findings identify intentional vs accidental divergence.
4. Effort and risk are realistic and actionable.

<!--</instructions>-->
<!--</capability>-->
