<!--<capability id="valdr-workflow.tools.git" pack="valdr-workflow" role="integration">-->
# Workflow Tool: Git

<!--<identity>-->
Use bounded Git actions to collect exact repository evidence and integrate reviewed delivery without inventing shell-like Git capabilities.
<!--</identity>-->

<!--<instructions>-->

## Actions and required inputs

Use `kind: tool` and `tool: { id: git, action: <action> }`. Git exposes exactly
these eight actions; it is not a wrapper for arbitrary Git subcommands.

| Action | Purpose | Required action inputs |
| --- | --- | --- |
| `status` | Repository or task-session snapshot | Project target, or `taskKey` together with `sourceSessionUlid` |
| `diff` | Retained exact-commit comparison and digest | Same target choices as `status`, plus `fromSha`, `toSha` |
| `log` | Bounded history | Project target, `ref` |
| `remote_status` | Observe remote identity and exact refs without fetching | Project target, `remoteName`, `baseBranch`, `headBranch` |
| `branch_create` | Create a canonical task/plan branch | Project target, `branchName`, `canonicalKey`, `expectedBaseSha` |
| `commit` | Commit completed, approved delivery | `taskKey`, `sourceSessionUlid`, `deliveryRunUlid`, `message` |
| `merge` | Fast-forward an unchanged target | Project target, `sourceSha`, `targetBranch`, `expectedTargetSha` |
| `push` | Push an exact local branch using a remote lease | Project target, `remoteName`, `branchName`, `expectedRemoteUrlDigest`, `expectedLocalSha`, `expectedRemoteSha` |

Bind each action's values under `inputs`. A project target uses `projectKey` or
an allowed run association; every action except `commit` also accepts `repoId`
to select a registered repository. Without a selection, the project needs one
repository or one marked primary. Git does not select its target through an
arbitrary `cwd`.

Task-session `status`/`diff` require the task and source session together. Valdr
derives the project from the task and checks session ownership. If a project is
also supplied, it must agree. `commit` likewise derives its project from the
task when omitted. An explicitly targeted step can work in a different project
from its parent run.

Git object inputs require full commit IDs. `log.ref` may instead be a validated
local branch; optional `fromSha` bounds the range, and `limit` accepts 1–100.
`branch_create.sourceBranch` may identify the expected source branch.
`push.expectedRemoteSha` may be the literal `absent` when the branch must not
exist remotely. Valdr supplies the mutating step's `clientRequestId`.

## Examples

Resolve a local branch to a full commit before using it as evidence:

```yaml
- key: resolve_head
  name: Resolve local head
  kind: tool
  tool: { id: git, action: log }
  inputs:
    projectKey: "${workflow.inputs.projectKey}"
    ref: "${workflow.inputs.headBranch}"
    limit: 1
  outputs:
    resolvedSha: "$.normalized.resolvedSha"
    commits: "$.normalized.commits"
```

Create a canonical branch without switching the checkout:

```yaml
- key: create_plan_branch
  name: Create plan branch
  kind: tool
  tool: { id: git, action: branch_create }
  inputs:
    projectKey: "${workflow.inputs.projectKey}"
    branchName: "valdr-plan/${workflow.inputs.planKey}"
    canonicalKey: "${workflow.inputs.planKey}"
    sourceBranch: "${workflow.inputs.baseBranch}"
    expectedBaseSha: "${workflow.inputs.expectedBaseSha}"
  outputs:
    outcome: "$.normalized.outcome"
    branchName: "$.normalized.branchName"
    observedSha: "$.normalized.observedSha"
```

The workflow must declare these inputs and check the branch outcome before
continuing; expected success is `created` or `existing`. Existing does not mean
replace a drifted or checked-out branch.

## Read the action's receipt

Map only fields the chosen action provides. Useful paths used by shipped
workflows include:

| Action | Paths below `$.normalized` |
| --- | --- |
| Task-session `status` | `outcome`, `sourceSessionUlid`, `branchName`, `baseRef`, `headAtStart`, `headSha`, `candidateTreeSha`, `changeDigest`, `dirtyPaths`, `deliveryPaths` |
| `diff` | `outcome`, `runUlid`, `stepRunUlid`, `digest` |
| `log` | `resolvedSha`, `commits` |
| `remote_status` | `outcome`, `repoId`, `repository.owner`, `repository.name`, `remoteUrlDigest`, `baseSha`, `headSha`, `headExpectation` |
| `branch_create` | `outcome`, `branchName`, `observedSha`, `recommendedAction` |
| `commit` | `outcome`, `branchName`, `commitSha`, `warnings` |
| `merge` | `outcome`, `observedTargetSha`, `recommendedAction` |
| `push` | `outcome`, `confirmedRemoteSha` |

Keep arrays such as `commits` and path lists as exact references. Consumers
declare `needs` and select `${steps.<key>.outputs.<name>}`, not the direct tool
response envelope. An action's outcome is evidence to check, not a blanket
success flag.

`diff` needs Git 2.41 or newer and two commits. It retains those objects and
records a complete comparison digest plus a compact receipt; it does not return
patch text. An uncommitted working tree is not an approval snapshot. Use the
frozen evidence IDs for review rather than re-reading a moving branch.

## Mutations and recovery

`commit` is narrower than shell `git commit`: it requires a completed delivery
run with approved review evidence and commits the exact paths recorded by that
delivery. A task's status or an agent's assertion of approval is not sufficient.
The shipped closeout workflow accepts `committed`, `existing`, or `unchanged`,
then passes the returned exact `commitSha` to integration.

`merge` fast-forwards only an unchanged target at `expectedTargetSha`; its
accepted outcomes are `merged` and `existing`. It is not a conflict-resolution
or general merge-commit operation. `push` checks remote identity, exact local
SHA, and the `expectedRemoteSha` lease; accepted outcomes are `pushed` and
`existing`. Hot-load `valdr-workflow.tools.github` for subsequent publication.

Most drift is returned as a routable outcome, so guard descendants explicitly.
Push `remote_drift` or `rejected` is a tool error and follows the step's failure
policy. Inspect the attempt's error/receipt and current refs before recovery.
Do not discard expected hashes or choose a new request identity to bypass drift.
Stopping a run is not a rollback of local refs or a completed remote push.

These actions never fetch, switch checkouts, or run commit hooks. Use Command
for other authorized shell operations, but do not use it to evade required
review or ref checks. Strict validation does not prove repository availability,
remote permissions, or that a mutation will succeed.

## Anti-patterns

- Inventing actions such as `checkout`, `fetch`, `reset`, or `cherry_pick`.
- Passing an arbitrary filesystem path instead of a registered repository target.
- Substituting a moving branch or abbreviated SHA for exact commit evidence.
- Treating `commit` as unrestricted staging/commit or `merge` as conflict repair.
- Proceeding on any returned outcome without checking the action's success set.
- Repeating an interrupted mutation without checking whether it took effect.

Public reference: [Git steps](https://valdr.ai/valdr/docs/workflows/steps/git/).

<!--</instructions>-->
<!--</capability>-->
