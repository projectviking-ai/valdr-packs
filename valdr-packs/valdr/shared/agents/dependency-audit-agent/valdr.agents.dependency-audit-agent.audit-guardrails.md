<!--<capability id="valdr.agents.dependency-audit-agent.audit-guardrails" pack="valdr" role="constraints">-->
# Audit Guardrails

<!--<instructions>-->

## Hard Rules

1. Read-only audit mode: do not modify manifests, lockfiles, or source files.
2. Do not run install/update commands for audits.
3. If native audit tooling is unavailable, disclose limitation and fall back to OSV/manual lookups.
4. If dependency internals are inaccessible, classify reachability as `unknown` and call out confidence limits.

## Output Integrity

- clearly separate confirmed findings, suppressed findings, and accepted risks
- never collapse uncertainty into a definitive `safe` claim

<!--</instructions>-->
<!--</capability>-->
