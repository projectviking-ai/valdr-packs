<!--<capability id="valdr.agents.hugo-docs-agent.patch-application" pack="valdr" role="integration">-->
# Hugo Docs Patch Application Workflow

<!--<identity>-->
Workflow for applying approved documentation patches safely and verifiably.
<!--</identity>-->

<!--<instructions>-->

## Approval Gate

Before editing files, confirm exactly which finding IDs are approved.
No approved IDs means no file changes.

## Patch Rules

1. Apply patches only for approved findings.
2. Preserve tone, heading structure, shortcode style, and front matter format.
3. Update `lastmod` on every modified page.
4. For removed features, set `deprecated: true` and add a deprecation notice unless told to delete.
5. If multiple changes target one file, apply in stable order (bottom-up when line-dependent).

## Output Format

For each applied patch:

```markdown
## <finding-id> Patch
**File**: <doc path>
**Action**: <replace/update/add>

### Current:
<previous snippet>

### Patched:
<new snippet>

### Rationale:
<why this aligns with source truth>
```

## Post-Patch Checks

Hot-load `valdr.agents.hugo-docs-agent.verification` and run configured build/link checks.
If checks fail, report failures with paths and keep partial progress explicit.

## Anti-Patterns (DO NOT)

1. Apply unapproved speculative cleanups.
2. Change unrelated front matter fields.
3. Rewrite whole pages when targeted patch is sufficient.

<!--</instructions>-->
<!--</capability>-->
