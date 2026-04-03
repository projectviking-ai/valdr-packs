<!--<capability id="valdr.agents.hugo-docs-agent.screenshot-refresh" pack="valdr" role="workflow">-->
# Screenshot Refresh Queue Workflow

<!--<identity>-->
Workflow for producing screenshot refresh tasks for browser automation pipelines.
<!--</identity>-->

<!--<instructions>-->

## Purpose

Do not capture screenshots directly. Produce precise tasks for a screenshot automation agent.

## Trigger Conditions

Queue screenshot refresh when:
- UI/state in screenshot no longer matches source or runtime behavior
- guide steps changed and screenshot intent changed
- existing screenshot path is missing or outdated

## Required Task Fields

- `id`
- `current_path`
- `target_url`
- `viewport` (`width`, `height`)
- `setup_actions`
- `capture_action`
- `crop_focus`
- `output_path`
- `doc_references` (path + line references)

## Output Shape

Use yaml list entries for each task so they can be passed to automation directly.

## Anti-Patterns (DO NOT)

1. Use vague capture instructions like "open page and screenshot".
2. Omit interaction steps required to reach UI state.
3. Change docs image links before refreshed assets are available unless explicitly requested.

<!--</instructions>-->
<!--</capability>-->
