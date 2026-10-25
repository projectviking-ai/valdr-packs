<!--<capability id="valdr-workflow.steps.human-gate" pack="valdr-workflow" role="workflow">-->
# Human Approval and Clarification

<!--<identity>-->
Executable human-gate contracts: approval context, typed questions, answer propagation, and clarification within bounded revision loops.
<!--</identity>-->

<!--<instructions>-->

Use with `valdr-workflow.verdandi.authoring` for the surrounding definition,
conditions, session receipt gates, and loop corridors. The examples are step
fragments; supply their declared inputs and upstream steps in the complete
workflow before strict validation.

## Approval

The only way to stop for a person.

Before using this fragment, declare required string inputs `taskKey` and
`operatorHandle`. Supply `operatorHandle` with the registered human who will
decide, even when a bot such as Verdandi starts the run. The upstream
`create_spec` step must publish `path`, `writerSessionUlid`, and `reviewId` for
the reviewed specification and its existing writer session and review.

```yaml
- key: approve_spec
  name: Approve specification
  kind: human_gate
  needs: [create_spec]
  humanGate:
    prompt: "Approve the reviewed specification for ${workflow.inputs.taskKey}?"
    approvalText: Approve spec
    rejectionText: Reject
    references:                    # up to 8, kept in authored order
      - kind: task
        target: "${workflow.inputs.taskKey}"
        label: Open task
      - kind: session
        target: "${steps.create_spec.outputs.writerSessionUlid}"
        label: Open writer session
    preview:                       # up to 5 documents, unique keys
      documents:
        - key: spec
          label: Spec
          path: "${steps.create_spec.outputs.path}"
          sourceSessionUlid: "${steps.create_spec.outputs.writerSessionUlid}"
    feedback:                      # where a rejection's notes land
      sourceSessionUlid: "${steps.create_spec.outputs.writerSessionUlid}"
      taskKey: "${workflow.inputs.taskKey}"
      reviewId: "${steps.create_spec.outputs.reviewId}"
  waitsFor:
    kind: workflow_input
    expected: [approved, rejected]
    authorizedHandles: ["${workflow.inputs.operatorHandle}"]
  onFailure: { action: block }
```

A human gate presents approval content; it does not create comments, reviews, or sessions. Put any durable question or comment in an explicit replay-safe tool step before the gate.

References may be `task`, `session`, `run`, or `url`. Bind their targets from the records that produced the approval material; URL targets must be absolute `http:` or `https:` URLs. Authored labels and order are presentation data and must be preserved.

Feedback is valid only when at least one preview document exists. Each preview document needs the session that produced it, or the reviewer has nothing to open. Feedback reuses the existing source session, task, and review; it does not launch another agent or create a review.

Unlike a session wait, a human gate **does** author its `authorizedHandles` — the approval must come from a real human or operator identity. Human approval outcomes are `approved` and `rejected`; do not substitute the durable review outcomes `review_approved` and `review_changes_requested`.

## Approve a pull-request proposal

Use `humanGate.pullRequestProposal` to let the operator edit the title, body,
and draft state before approving publication. Keep it separate from a Questions
gate. Bind the repository, branches, exact head commit, writer session, and diff
evidence from the steps that produced them.

This fragment comes from the shipped `valdr-workflow.pull-request.create`
workflow. It depends on that workflow's declared inputs and upstream evidence
steps:

```yaml
- key: approve_proposal
  name: Approve pull request proposal
  kind: human_gate
  needs: [draft_proposal]
  humanGate:
    prompt: Review and approve the frozen pull request proposal.
    approvalText: Publish pull request
    rejectionText: Reject
    pullRequestProposal:
      repository: "${steps.observe_remote.outputs.repositoryOwner}/${steps.observe_remote.outputs.repositoryName}"
      remoteName: "${workflow.inputs.remoteName}"
      baseBranch: "${workflow.inputs.baseBranch}"
      headBranch: "${workflow.inputs.headBranch}"
      headSha: "${steps.resolve_head.outputs.resolvedSha}"
      writerSessionUlid: "${steps.draft_proposal.outputs.sessionUlid}"
      evidenceDigest: "${steps.read_diff.outputs.digest}"
      evidence:
        runUlid: "${steps.read_diff.outputs.runUlid}"
        stepRunUlid: "${steps.read_diff.outputs.stepRunUlid}"
      initial:
        title: "${steps.draft_proposal.outputs.title}"
        body: "${steps.draft_proposal.outputs.body}"
        draftFrom: "${workflow.inputs.initialDraft}"
  waitsFor:
    kind: workflow_input
    expected: [approved, rejected]
    authorizedHandles: ["${workflow.inputs.operatorHandle}"]
  outputs:
    outcome: $.normalized.input.outcome
    title: $.normalized.input.payload.title
    body: $.normalized.input.payload.body
    draft: $.normalized.input.payload.draft
```

`evidence.runUlid`, `evidence.stepRunUlid`, and `evidenceDigest` must refer to
the same captured diff. `initial.draftFrom` is an exact reference to a boolean;
use `initial.draft` for a literal boolean. The initial title and body are the
writer's proposal. The gate outputs `title`, `body`, and `draft` contain the
operator-approved values.

Before publishing, require `outcome: approved`, recheck the repository and
commit evidence, and use those gate outputs for `github/create_pull_request`.
Do not publish the writer's initial values after the operator has edited them.
Hot-load `valdr-workflow.tools.github` for the publication sequence and inputs.

## Questions and answer propagation

Set `humanGate.questions` to select Questions mode; do not invent a separate
mode field. It accepts a literal array or one exact array reference such as
`${steps.decide.outputs.questions}`, never JSON text. The enabled gate requires
`answered` in `waitsFor.expected` and may also offer `rejected`; `approved` is
not a clarification outcome.

Use 1–12 questions with unique IDs starting with a letter, then letters,
digits, `_`, or `-`, up to 64 characters. Choose descriptive names such as
`release_target`; if the Builder rejects an ID, choose another name. Each needs
a nonblank `label` of at most 1,000 characters and a `type`: `text`, `single_choice`, `multiple_choice`, or `yes_no`. Choice questions
need 2–20 `options`, each with a unique `id` and nonblank `label` of at most
300 characters. Questions default to required; `required: false` permits an
omitted answer. Use previews for context; keep feedback and pull-request
proposals in separate gates.

This fragment assumes declared `humanHandle` and an existing
`workerSessionUlid` input. It resumes that session instead of creating a new
worker:

```yaml
- key: clarify
  name: Clarify the next revision
  kind: human_gate
  humanGate:
    prompt: Supply the missing requirement before work resumes.
    questions:
      - { id: requirement, type: text, label: "What requirement must the revision satisfy?" }
  waitsFor:
    kind: workflow_input
    expected: [answered, rejected]
    authorizedHandles: ["${workflow.inputs.humanHandle}"]
  outputs:
    outcome: "$.normalized.input.outcome"
    questions: "$.normalized.input.questions"
    answers: "$.normalized.input.payload.answers"
  onFailure: { action: block }
- key: require_answers
  name: Require answered clarification
  kind: condition
  needs: [clarify]
  checks:
    - { kind: value_equals, value: "${steps.clarify.outputs.outcome}", equals: answered }
  outputs:
    reason: Clarification was rejected; work cannot resume without answers.
  onFailure: { action: block }
- key: return_answers
  name: Return answers to the existing worker
  kind: session
  needs: [require_answers]
  session:
    action: input
    sessionUlid: "${workflow.inputs.workerSessionUlid}"
    prompt: |
      Retain this clarification for the next revision; it does not approve saving.
      Questions: ${steps.clarify.outputs.questions}
      Answers: ${steps.clarify.outputs.answers}
      Return {"outcome":"acknowledged"}, or {"outcome":"unknown"} if unable.
  waitsFor: { kind: workflow_input, expected: [acknowledged, unknown] }
  gates:
    - key: acknowledgement
      kind: session_output
      source: { event: final_agent_message, sessionUlid: "${workflow.inputs.workerSessionUlid}" }
      extract: { format: json, path: $.outcome }
      outcomes: { acknowledged: acknowledged, unknown: unknown }
      onInvalid: { action: block }
  outputs:
    outcome: "$.normalized.input.outcome"
- key: require_acknowledgement
  name: Require retained clarification before resuming
  kind: condition
  needs: [return_answers]
  checks:
    - { kind: value_equals, value: "${steps.return_answers.outputs.outcome}", equals: acknowledged }
  outputs:
    reason: The worker could not retain the clarification; revision remains blocked.
  onFailure: { action: block }
```

Answers are keyed by question ID, for example
`{"requirement":{"type":"text","value":"Preserve existing records."}}`.
A human may give a text answer even to a choice or yes/no question; preserve
the typed answer object and the questions rather than assuming a choice ID.
Propagate them to each existing session that needs the context, and depend on
its acknowledgement before resuming work. If clarification is conditional,
guard all answer consumers on the same route; skipped gates have no answers.

Resolve Human Questions and Approval through the authorized human UI. Public
MCP input cannot supply a human approval or answer. Clarification never
substitutes for a separate final approval, and `humanGate.enabled: false` is an intentional approval bypass.

## Check the revision budget before asking

Before asking a human to enable **another pass**, check that one remains.
Otherwise the last pass can solicit answers, wake the team, and immediately
exhaust without using them. For a three-pass corridor, put this guard between
`decide` and the conditional Questions gate, inside that same corridor:

```yaml
- key: clarification_budget
  name: Require a remaining revision pass
  kind: condition
  needs: [decide]
  when:
    - { kind: value_equals, value: "${steps.decide.outputs.outcome}", equals: needs_human }
  checks:
    - { kind: value_in, value: "${runtime.loop.currentPass}", allowed: [1, 2] }
  outputs:
    reason: Clarification needs another pass, but this phase has exhausted its budget.
  onFailure: { action: block }
```

Make the Questions gate depend on this guard and retain its `needs_human`
route. Match the allowed passes to the actual bound; do not reset the budget
after clarification. A deliberately designed same-pass continuation needs its
own bound, not an extra uncounted revision.

Public reference: [Human-gate steps](https://valdr.ai/valdr/docs/workflows/steps/human-gate/).

<!--</instructions>-->
<!--</capability>-->
