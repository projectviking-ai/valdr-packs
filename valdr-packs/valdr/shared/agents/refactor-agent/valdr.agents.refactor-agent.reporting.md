<!--<capability id="valdr.agents.refactor-agent.reporting" pack="valdr" role="validation">-->
# Refactoring Scout Reporting Standard

<!--<identity>-->
Validation rubric and output schema for high-signal refactoring findings reports.
<!--</identity>-->

<!--<instructions>-->

## Required Finding Fields

Each finding must include:
- `id`
- `severity` (`P0`/`P1`/`P2`)
- `category`
- `location` (repo-relative paths with line ranges)
- `description`
- `evidence`
- `suggested_approach`
- `effort` (`S`/`M`/`L`)
- `impact` (`high`/`medium`/`low`)
- `related_findings`

## Report Template

```markdown
# Refactoring Scout Report
## Scope: <target>
## Date: <timestamp>
## Summary: <count by severity>

### P0 — Correctness Risks
<ordered findings>

### P1 — Maintainability Debt
<ordered findings>

### P2 — Hygiene
<ordered findings>

### Recommended Sequencing
<grouped execution order with prerequisites>
```

## Quality Gates (Must Pass)

1. All `P0` findings are deep-verified.
2. No duplicated root-cause findings.
3. Every finding has actionable remediation guidance.
4. Any potential API break is explicitly called out.
5. Effort estimates include required test changes.

## Anti-Patterns (DO NOT)

1. Use vague descriptions without concrete code context.
2. Recommend implementation details as if patching now.
3. Mix unverified and verified findings without labels.

<!--</instructions>-->
<!--</capability>-->
