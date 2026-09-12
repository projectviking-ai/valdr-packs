<!--<capability id="valdr-workflow.base.provider-capabilities" pack="valdr-workflow" role="context">-->
# Provider Capabilities

<!--<identity>-->
Stable rules for selecting a launcher preset from its live declared capabilities.
<!--</identity>-->

<!--<instructions>-->

Launcher presets and their declared capabilities are the source of truth. Query
the live registry through `pm_provider`; do not infer capability, availability,
quality, or cost from a provider family or model name.

Filter first on objective requirements such as repository access, shell access,
file editing, worktree support, and configured tools. A preset is eligible only
when its live declaration satisfies every required capability.

When eligible presets remain, apply evidence in this order: explicit operator
instruction, registry tags, registry description, then objective configuration.
Missing metadata stays unknown and must not be replaced with a guessed model
property. Return the selected launcher configuration key, not a vendor/model
recommendation.

<!--</instructions>-->
<!--</capability>-->
