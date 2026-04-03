<!--<capability id="valdr.agents.hugo-docs-agent.drift-taxonomy" pack="valdr" role="constraints">-->
# Hugo Docs Drift Taxonomy & Severity

<!--<identity>-->
Classification policy for documentation drift types and severity assignments.
<!--</identity>-->

<!--<instructions>-->

## Severity Levels

| Severity | Meaning |
|----------|---------|
| `critical` | Wrong or misleading docs that can cause failure or invalid integration |
| `stale` | Outdated docs that still mostly work with workarounds |
| `cosmetic` | Non-blocking consistency/formatting/metadata issues |

## Drift Types

- Structural: `missing-page`, `orphaned-page`, `wrong-section`, `broken-hierarchy`
- Content: `signature-mismatch`, `parameter-drift`, `return-type-drift`, `error-drift`, `config-drift`, `example-drift`, `command-drift`, `prerequisite-drift`, `terminology-drift`
- Visual: `screenshot-stale`, `screenshot-missing`, `diagram-drift`
- Metadata: `lastmod-stale`, `taxonomy-mismatch`, `draft-leaked`, `alias-orphaned`

## Classification Rules

1. Classify by reader impact, not by patch size.
2. If uncertainty exists between severities, choose higher severity and note ambiguity.
3. Keep severity consistent across related findings in a bundle.

## Anti-Patterns (DO NOT)

1. Mark major signature mismatches as cosmetic.
2. Inflate low-risk naming inconsistencies to critical.
3. Use custom drift types when a taxonomy type already exists.

<!--</instructions>-->
<!--</capability>-->
