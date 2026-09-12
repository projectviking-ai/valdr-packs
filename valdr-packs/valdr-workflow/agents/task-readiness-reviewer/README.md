# Task Readiness Reviewer

`task-readiness-reviewer` is a pre-implementation quality gate. It decides whether a task is clear, correct, and actionable enough to hand to an implementation agent — before any code is written.

## Agent

- Handle: `task-readiness-reviewer`
- Default role: `reviewer`
- Pack: `valdr-workflow`

## Capabilities

- `valdr-workflow.task-readiness.reviewer.system` — core identity, operating rules, and JSON output contract.
- `valdr-workflow.task-readiness.rubric` — seven-dimension rubric and blocking rules. Deliberately **not** hot-load: `buildSystemPrompt` filters hot-load capabilities out of the system prompt, and this gate must never score without the rubric present.
- `valdr.core.tools.pm-task` — hot-loaded `pm_task` contract.

## What It Judges

Seven dimensions, each scored `pass` / `concern` / `fail`:

`intent`, `scope`, `grounding`, `actionability`, `acceptance`, `sizing`, `risk`.

It opens the referenced files to verify the task's claims about the codebase, and proposes the exact replacement text for every blocking finding.

## Output

A single JSON object, `schemaVersion: "task-readiness-review/v1"`, with a three-way `verdict` of `ready`, `needs_changes`, or `reject`. The three-way verdict exists so a workflow can branch on it.

## Launching From A Workflow

Use a `launch_task` session step, not `launch_prompt`. Workflow-managed `launch_prompt` uses a fixed ad-hoc system prompt and does not apply a registered agent's persona, so the reviewer would run without its rubric or output contract.

See [valdr-workflow.workflow.task-readiness-review.workflow.yaml](../../workflows/task/valdr-workflow.workflow.task-readiness-review.workflow.yaml) for the wired definition.

Two things that step must get right:

**`additionalInstructions` is mandatory.** Workflow-managed `launch_task` builds its turn prompt with `buildWorkflowExecutorPromptsForTask`, whose default turn instruction is *"Implement only the scoped workflow task in the current worktree."* `additionalInstructions` replaces that default. Omit it and the reviewer is told to implement the task.

**The turn prompt carries only title and description.** That builder emits `systemPrompt + turnInstructions + "Task KEY — title" + descriptionMd`. Acceptance checklists are not included, so the agent must load them via `pm_task`. Do not interpolate the checklist array into a prompt string — workflow expression interpolation applies `String()` to arrays, producing `[object Object]`.

`role` is a label here; it does not change the prompt builder. Only `auditor` combined with `sessionUlidToAudit` selects a different builder.

## Boundaries

Read-only. It does not edit files, change task status or checklists, publish reviews, launch sessions, or drive workflow state.

## Related Agents

- `code-task-delivery-review-*` (`valdr-workflow`) — post-implementation delivery review.
