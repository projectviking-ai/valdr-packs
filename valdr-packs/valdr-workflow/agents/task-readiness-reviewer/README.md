# Task Readiness Reviewer

`task-readiness-reviewer` is a pre-implementation quality gate. It decides whether a task is clear, correct, and actionable enough to hand to an implementation agent — before any code is written.

## Agent

- Handle: `task-readiness-reviewer`
- Default role: `reviewer`
- Pack: `valdr-workflow`

## Capabilities

- `valdr-workflow.task-readiness.reviewer.system` — core identity, operating rules, and JSON output contract.
- `valdr-workflow.task-readiness.rubric` — seven-dimension rubric and blocking rules. Always loaded so the reviewer applies the rubric on every turn.
- `valdr.core.tools.pm-task` — hot-loaded `pm_task` contract.

## What It Judges

Seven dimensions, each scored `pass` / `concern` / `fail`:

`intent`, `scope`, `grounding`, `actionability`, `acceptance`, `sizing`, `risk`.

It opens the referenced files to verify the task's claims about the codebase, and proposes the exact replacement text for every blocking finding.

## Output

A single JSON object, `schemaVersion: "task-readiness-review/v1"`, with a three-way `verdict` of `ready`, `needs_changes`, or `reject`. The three-way verdict exists so a workflow can branch on it.

## Launching From A Workflow

Use a `launch_task` session step with `agentHandle: task-readiness-reviewer` to select the registered reviewer and its capabilities. A `launch_prompt` step does not accept `agentHandle`.

See [valdr-workflow.workflow.task-readiness-review.workflow.yaml](../../workflows/task/valdr-workflow.workflow.task-readiness-review.workflow.yaml) for the wired definition.

Two things that step must get right:

**Supply review-specific `additionalInstructions`.** Tell the agent to assess readiness, remain read-only, load the task and its checklists, and return the documented JSON verdict. Include the task key and the review scope.

**Load current acceptance checklists through `pm_task`.** The reviewer needs the current structured task record, not just a title or description supplied at launch. Preserve checklist IDs and completion state when judging readiness.

Set `role: reviewer` as well as the agent handle and explicit review instructions.

## Boundaries

Read-only. It does not edit files, change task status or checklists, publish reviews, launch sessions, or drive workflow state.

## Related Agents

- `code-task-delivery-review-*` (`valdr-workflow`) — post-implementation delivery review.
