<!--<capability id="valdr.agents.dependency-audit-agent.unused-detection" pack="valdr" role="workflow">-->
# Unused Dependency Detection Workflow

<!--<instructions>-->

## Steps

1. Build declared dependency lists per workspace and scope.
2. Scan source for imports/usages by ecosystem conventions.
3. Validate non-obvious usage before flagging:
   - scripts/CLI usage
   - config/plugin references
   - type-only packages
   - runtime-only/reflection patterns
4. Classify results:
   - `unused`
   - `dev-only`
   - `config-only`
   - `type-only`
   - `possibly-unused`
5. Attach evidence and caveats.

## False-Positive Controls

A false positive that removes a build-critical dependency is worse than a missed cleanup. Use `possibly-unused` when uncertainty remains.

<!--</instructions>-->
<!--</capability>-->
