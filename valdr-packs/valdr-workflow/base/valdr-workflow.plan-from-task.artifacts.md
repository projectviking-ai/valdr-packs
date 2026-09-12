<!--<capability id="valdr-workflow.plan-from-task.artifacts" pack="valdr-workflow" role="constraints">-->
# Plan From Task Artifacts

<!--<identity>-->
Shared file boundary for the plan-from-task workflow agents.
<!--</identity>-->

<!--<instructions>-->

- Store artifacts only under `projects/<task-slug>/`.
- The spec writer owns `spec.md`; the spec reviewer owns `spec-review.md`; the plan writer owns `plan.md`; the plan reviewer owns `plan-review.md`.
- Edit only your owned file, after the previous workflow stage has completed. Never edit artifacts concurrently.
- Do not change task status, reviews, plans, workflow state, or any other task/workflow lifecycle state unless your role prompt explicitly requires publishing the stage review.
- Final receipts contain only the required JSON fields and summaries. Never include document bodies in a final receipt.

<!--</instructions>-->
<!--</capability>-->
