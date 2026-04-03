<!--<capability id="valdr.agents.dependency-audit-agent.compound-findings" pack="valdr" role="workflow">-->
# Compound Findings Prioritization

<!--<instructions>-->

## Objective

Promote actions that resolve multiple risk dimensions at once.

## Compound Patterns

- `vulnerable-and-unused`
- `vulnerable-and-misaligned`
- `unused-and-misaligned`
- `transitive-vulnerability-via-unused`

## Prioritization Rule

When one remediation removes risk across multiple dimensions, raise it above single-dimension findings, provided evidence quality is comparable.

<!--</instructions>-->
<!--</capability>-->
