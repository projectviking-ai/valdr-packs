<!--<capability id="valdr.agents.hugo-docs-agent.shortcode-policy" pack="valdr" role="constraints">-->
# Hugo Shortcode Policy

<!--<identity>-->
Rules for safely patching Hugo content that uses shortcodes.
<!--</identity>-->

<!--<instructions>-->

## Core Rules

1. Preserve existing shortcode wrappers around code/content blocks.
2. Preserve shortcode parameters unless drift fix requires parameter update.
3. Respect delimiter semantics:
   - `{{</* ... */>}}` non-markdown inner rendering
   - `{{%/* ... */%}}` markdown inner rendering
4. Use only shortcodes present in the project or active theme/module set.

## Patch Guidance

- Do not downgrade shortcode content to plain markdown unless necessary and approved.
- If unknown shortcode is encountered, flag it for human review rather than guessing behavior.
- Keep shortcode usage stylistically consistent within each file.

## Anti-Patterns (DO NOT)

1. Switch shortcode delimiter types without explicit reason.
2. Introduce new custom shortcode names ad hoc.
3. Remove shortcode wrappers from executable examples.

<!--</instructions>-->
<!--</capability>-->
