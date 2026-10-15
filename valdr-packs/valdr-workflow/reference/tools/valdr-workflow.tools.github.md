<!--<capability id="valdr-workflow.tools.github" pack="valdr-workflow" role="integration">-->
# Workflow Tool: GitHub

<!--<identity>-->
Publish an approved pull-request proposal against frozen repository and commit evidence using the built-in GitHub workflow action.
<!--</identity>-->

<!--<instructions>-->

## Action and prerequisites

The built-in workflow tool has one action:
`tool: { id: github, action: create_pull_request }` on a `kind: tool` step.
It is distinct from the installed `valdr-tools.user.gh` CLI adapter, whose
available actions come from its own manifest.

The workflow host needs GitHub CLI installed and authenticated for the selected
repository. The project must resolve to a registered repository. A project
association may supply `projectKey`; bind it explicitly when the destination is
an input. Use `repoId` when selecting among registered repositories. There is no
arbitrary `cwd` target for this action.

## Required inputs

| Field under `inputs` | Bind from |
| --- | --- |
| `projectKey` | Registered project, or its permitted run association |
| `remoteName` | Chosen configured Git remote, commonly `origin` |
| `expectedRemoteUrlDigest` | Frozen `git/remote_status` remote identity |
| `baseBranch`, `headBranch` | Approved target and source branches |
| `expectedHeadSha` | Exact full approved head commit |
| `title`, `body`, `draft` | Operator-approved proposal values |

`draft` is a boolean: an exact reference preserves it; string interpolation does
not. Valdr supplies the request identity. Do not invent a tool-specific actor or
reuse a human's identity to imply approval.

## Build the publication sequence

1. Resolve local base/head commits and record remote identity/ref expectations.
2. Retain the exact diff and its digest with `git/diff`; draft the proposal from
   those frozen commits, not a later working-tree diff.
3. Present the proposal and frozen evidence to the authorized operator. The
   operator can edit title, body, and draft state in the proposal gate.
4. Read the approved gate's output values, recheck the recorded evidence, and
   use `git/push` to publish the exact approved head with its remote lease.
5. Require a successful push receipt, then create or adopt the pull request.

The action neither approves the proposal nor pushes the branch. The official
`valdr-workflow.pull-request.create` workflow supplies the complete sequence;
inspect its installed exact version before reusing it. Hot-load
`valdr-workflow.tools.git` for the Git contracts and
`valdr-workflow.verdandi.authoring` for gates and dependencies.

## Publication fragment

This fragment assumes the named evidence, proposal, push, and push-check steps
already exist. It is not a standalone workflow:

```yaml
- key: create_pr
  name: Create pull request
  kind: tool
  needs: [observe_remote, resolve_head, approve_proposal, accept_push]
  when:
    - kind: value_equals
      value: "${steps.approve_proposal.outputs.outcome}"
      equals: approved
  tool: { id: github, action: create_pull_request }
  inputs:
    projectKey: "${workflow.inputs.projectKey}"
    remoteName: "${workflow.inputs.remoteName}"
    expectedRemoteUrlDigest: "${steps.observe_remote.outputs.remoteUrlDigest}"
    baseBranch: "${workflow.inputs.baseBranch}"
    headBranch: "${workflow.inputs.headBranch}"
    expectedHeadSha: "${steps.resolve_head.outputs.resolvedSha}"
    title: "${steps.approve_proposal.outputs.title}"
    body: "${steps.approve_proposal.outputs.body}"
    draft: "${steps.approve_proposal.outputs.draft}"
  outputs:
    outcome: "$.normalized.outcome"
    number: "$.normalized.number"
    url: "$.normalized.url"
    approvedProposalDigest: "$.normalized.approvedProposalDigest"
```

Use a condition to accept `created` or `existing` before declaring publication
successful. Map `number` as a number and URL/digest as strings. Later consumers
depend on `create_pr` and reference its declared outputs.

## Existing requests, failure, and recovery

The handler may adopt a matching existing same-repository pull request.
`existing` is not permission to adopt arbitrary work. A changed remote, head
commit, or proposal blocks publication instead of silently changing what was
approved. Do not regenerate proposal fields after the approval gate or omit
frozen identity inputs to get past the check.

Inspect the exact failed attempt and external pull-request state before retrying
an interrupted publication. A missing response does not prove that no request
was created. Preserve the approved evidence and use supported workflow recovery;
cancelling the run does not close or delete a published pull request.

Authoring or validating this step does not authorize execution. A complete test
can push a branch and publish a real pull request, so use the user's authorized
repository and approval boundary. Validation cannot establish GitHub sign-in or
repository permissions.

## Anti-patterns

- Inventing built-in GitHub actions for listing, merging, commenting, or closing.
- Confusing this action with a user-tool `gh` adapter or a direct CLI command.
- Creating the pull request before the exact head has been pushed successfully.
- Publishing a writer's draft fields instead of the operator-approved fields.
- Using moving refs, changed proposal text, or a different remote after approval.
- Treating cancellation or a lost reply as proof publication did not happen.

Public reference: [GitHub steps](https://valdr.ai/valdr/docs/workflows/steps/github/).

<!--</instructions>-->
<!--</capability>-->
