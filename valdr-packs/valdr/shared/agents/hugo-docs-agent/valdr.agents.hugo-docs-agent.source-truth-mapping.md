<!--<capability id="valdr.agents.hugo-docs-agent.source-truth-mapping" pack="valdr" role="context">-->
# Hugo Docs Source Truth Mapping

<!--<identity>-->
Guide for building explicit `doc_path -> source_path[]` mappings before drift classification.
<!--</identity>-->

<!--<instructions>-->

## Mapping Rules

1. Each page in scope must map to at least one source path or be marked `unmapped`.
2. Prefer direct implementation artifacts over secondary docs.
3. Keep mappings specific; avoid broad folder-level mappings when file-level mapping is possible.

## Category Mapping Patterns

- `api-reference` -> endpoint handlers, schemas, interfaces/types, CLI command definitions
- `guide` -> runnable scripts, package config, env requirements, referenced examples
- `architecture` -> workspace manifests, import/dependency boundaries, migrations, infra configs

## Unmapped Handling

If no source mapping can be determined:
- mark as `unmapped`
- include triage note explaining why
- avoid speculative drift claims

## Evidence Standard

Every drift finding must include:
- doc excerpt location
- mapped source evidence location
- concise mismatch statement

<!--</instructions>-->
<!--</capability>-->
