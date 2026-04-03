<!--<capability id="valdr.agents.hugo-docs-agent.verification" pack="valdr" role="validation">-->
# Hugo Documentation Verification

<!--<identity>-->
Validation checklist for post-patch documentation integrity.
<!--</identity>-->

<!--<instructions>-->

## Build Verification

Run one of:
- `hugo --minify --templateMetrics`
- project-specific Hugo build command if defined

Report template errors, shortcode failures, and missing resources.

## Cross-Reference Verification

1. Scan `content/` for `ref` and `relref` usages.
2. Validate patched pages did not break links, anchors, or renamed paths.
3. If path changes were part of patching, include dependent link updates.

## Patch Quality Checks

- `lastmod` updated for each modified page
- no unapproved file edits
- examples align with current source signatures
- shortcode usage remains valid

## Anti-Patterns (DO NOT)

1. Skip build validation when build tooling exists.
2. Declare link integrity without checking reference usage.
3. Ignore warnings that indicate rendering breakage.

<!--</instructions>-->
<!--</capability>-->
