<!--<capability id="valdr.orchestrator.skadi.worktree-merge" pack="valdr" role="workflow">-->
# Worktree Merge & Commit Verification

<!--<identity>-->
Worktree merge and commit verification — ensures executor work lands on the local branch before purge or advance.
<!--</identity>-->

<!--<instructions>-->

## Mandatory Invariant: Code Continuity

**The next task executor launches from the local branch HEAD.** If the current task's worktree changes are not merged into the local branch, the next executor starts from stale code and cannot build on the completed work. This breaks the entire sprint chain.

Therefore: **Purge and Advance CANNOT proceed unless `MERGE_VERIFIED = true`.**

The merge gate is not just about preserving work for audit — it is the mechanism that ensures sequential sprint tasks build on each other. A "no-op merge" or skipped merge means the next agent gets last-commit code and the sprint cannot progress correctly.

```
REPO_RESOLVED = true       →  set in Step 1b, gates Steps 2–5
WORKTREE_INSPECTED = true  →  set in Step 2, gates Step 3 (pre-merge checks)
MERGE_VERIFIED = true      →  set in Step 5, gates purge AND advance (in task-completion workflow)
```

If merge cannot be verified, **STOP the entire workflow**. Do not purge. Do not advance. Report the failure and wait for user direction.

## Step 1: Identify the Worktree Branch and Resolve Canonical Repo Root

### 1a: Identify the Worktree Branch

The task's worktree branch is typically named after the task key or was reported in the launch result. Check:

1. The session launch result (if available) includes `branchName` and `worktreePath`.
2. If not available, resolve from session:
   ```
   pm_session { action: "list", contextRef: "TASK-<taskKey>" }
   ```
   The session metadata may include worktree details.
3. **Multiple executor sessions:** If more than one executor session exists for the task, default to the **most recent** executor session's `branchName`. However, always confirm with the user before proceeding:
   > Found **<N>** executor sessions for `<taskKey>`. Using the most recent: `<branchName>` (session `<sessionUlid>`). Correct?
4. If the branch name is still unknown, ask the user. (Worktree/branch listing requires the canonical repo root, which is resolved next.)

### 1b: Resolve Canonical Repo Root from Worktree (HARD GATE)

**Before any root-repo git operations, resolve the correct repository from the worktree itself.** In multi-project sprints, the operator's shell `cwd` may point at a different project's repo. Merging into the wrong repo corrupts the sprint chain.

The worktree was created from the task's repo, so git topology is ground truth:

```bash
git -C <worktreePath> rev-parse --path-format=absolute --git-common-dir
```

This returns the shared `.git` directory path (e.g., `/Users/dev/project-repo/.git`). The parent of this path is the `canonicalRepoRoot`.

**Verify** the resolved path is a valid git root:
```bash
git -C <canonicalRepoRoot> rev-parse --show-toplevel
```
If this fails, **STOP** — the worktree's parent repo is invalid or missing.

If the current shell repo does **not** match `canonicalRepoRoot`, report:
> **Repo context note:** Current shell is in `<currentRoot>` but task repo is `<canonicalRepoRoot>`. All merge operations will target `<canonicalRepoRoot>`.

This is informational, not a blocker — all subsequent root-repo git commands use `git -C <canonicalRepoRoot>`.

Set flag: `REPO_RESOLVED = true`.

**All subsequent git commands targeting the root repo MUST use `git -C <canonicalRepoRoot>`.** Worktree-scoped commands (`git -C <worktreePath>`) are unaffected.

### 1c: Branch Fallback (if branch not found in 1a)

If the branch name was not resolved in Step 1a, use the now-resolved canonical repo root:
```bash
git -C <canonicalRepoRoot> worktree list
git -C <canonicalRepoRoot> branch --list "*<taskKey-lower>*"
```
If the branch still cannot be identified, ask the user.

## Step 2: Inspect and Commit Uncommitted Work (HARD GATE)

**This step is a hard gate. Step 3 CANNOT proceed unless this step has run.**

**NEVER compare branch HEADs, commit SHAs, or run `git log ..` to determine if work exists WITHOUT first completing this step.** Branch heads can match even when the worktree contains uncommitted executor work. Comparing SHAs alone will report "no-op" and cause data loss on purge.

Check the **task worktree directory** (not the root repo) for uncommitted, unstaged, or untracked changes:

```bash
git -C <worktreePath> status --porcelain --untracked-files=normal
```

**Also check for a diff against the base branch** to catch committed-but-unmerged work:

```bash
git -C <worktreePath> diff --stat <base-branch>..HEAD
```

| Check | Result | Action |
|-------|--------|--------|
| `status --porcelain` | Clean (empty) | Record `worktreeClean = true` |
| `status --porcelain` | Dirty (any output) | **Auto-commit** (see below), record `worktreeClean = false` |
| `diff --stat base..HEAD` | No changes | Record `committedChanges = false` |
| `diff --stat base..HEAD` | Has changes | Record `committedChanges = true` |

Set internal flag: `WORKTREE_INSPECTED = true` only after **both** checks have run.

**The task has already passed review at this point.** If the executor left uncommitted work, Skadi commits it in the worktree before merging. This prevents data loss when worktrees are purged.

### Auto-Commit Flow (when worktree is dirty)

1. **Report what's uncommitted** — show the user the dirty files:
   ```bash
   git -C <worktreePath> status --short
   ```

2. **Stage all changes** (including untracked task artifacts):
   ```bash
   git -C <worktreePath> add -A
   ```

3. **Commit with a clear provenance message.** The commit message should describe what the uncommitted work actually contains — do not use generic boilerplate. Format:

   ```
   chore(<taskKey>): <brief description of what the uncommitted work contains>

   <1-2 sentences explaining what files were changed and why they were uncommitted>

   Co-Authored-By: Skadi <noreply@valdr.ai>
   ```

   Example:
   ```bash
   git -C <worktreePath> commit -m "chore(PROJ-42): commit auth middleware and route handlers

   Executor finished the OAuth callback handler but did not commit after
   review approval. Includes middleware.ts, routes.ts, and test updates.

   Co-Authored-By: Skadi <noreply@valdr.ai>"
   ```

4. **Report the commit** to the user:
   > **Auto-committed uncommitted executor work** in worktree `<worktreePath>`.
   > Files committed: `<count>` | Commit: `<short-hash>`

5. Update: `committedChanges = true` (auto-commit created a new commit ahead of base).

### No-Work Determination

Only conclude "no work exists" when **ALL** of these are true:
- `WORKTREE_INSPECTED = true`
- `worktreeClean = true` (no uncommitted changes)
- `committedChanges = false` (no commits ahead of base branch)

If ANY check shows changes exist, **proceed to Step 3 and merge**.

## Step 3: Pre-Merge Checks (Canonical Repo Root)

**Pre-conditions: `REPO_RESOLVED` and `WORKTREE_INSPECTED` must both be `true`.** If Step 1b or Step 2 was skipped, go back and run them. Do not proceed.

All git commands in this step target `canonicalRepoRoot` (resolved in Step 1b).

1. Confirm we are operating on the correct repo:
   ```bash
   git -C <canonicalRepoRoot> rev-parse --show-toplevel
   ```
   The output must match `canonicalRepoRoot`. If it does not (e.g., the path is inside a worktree, not the root repo), **stop and report**.

2. Check for uncommitted changes in the canonical repo root:
   ```bash
   git -C <canonicalRepoRoot> status --porcelain
   ```
   If there are uncommitted changes, **stop and ask the user** how to proceed. Do not discard or stash without permission.

3. Verify the worktree branch has commits ahead of the current branch:
   ```bash
   git -C <canonicalRepoRoot> log --oneline <current-branch>..<worktree-branch>
   ```
   - If commits ahead → proceed to Step 4 (merge).
   - If no commits ahead AND `worktreeClean = true` AND `committedChanges = false` → report: "The worktree branch has no commits ahead and the worktree is clean. No work to merge." and **stop**.
   - If no commits ahead BUT Step 2 auto-committed changes → this should not happen (auto-commit creates a commit ahead). Re-run the check. If still no commits, **stop and report an error** — something went wrong with the auto-commit.

## Step 4: Merge (in Canonical Repo Root)

```bash
git -C <canonicalRepoRoot> merge <worktree-branch> --no-ff -m "Merge <taskKey>: <task-title>"
```

- Use `--no-ff` to preserve the task branch as a distinct merge commit for traceability.
- If the merge has conflicts, **stop and report the conflicts**. Do not auto-resolve. The user must handle merge conflicts.

## Step 5: Commit Verification (Hard Gate — Gates Purge AND Advance)

**This step is a hard gate. Purge and Advance in the task-completion workflow CANNOT proceed unless this step passes.**

**Why this gate exists:** The next task executor launches from the local branch HEAD. If the merge did not land real file changes, the next agent starts from stale code and the sprint chain breaks. Purging without a verified merge destroys the only copy of the work.

Verify the merge commit is clean and actually introduced changes. All commands target `canonicalRepoRoot`.

1. Confirm the latest commit is the merge commit:
   ```bash
   git -C <canonicalRepoRoot> log --oneline -1
   ```
   The output must show the merge message `Merge <taskKey>: <task-title>`. If it does not, the merge did not produce a commit — **stop and report**.

2. Confirm no dirty state:
   ```bash
   git -C <canonicalRepoRoot> status --porcelain
   ```
   Must be clean (empty output).

3. Confirm the merge introduced actual changes:
   ```bash
   git -C <canonicalRepoRoot> diff --stat HEAD~1..HEAD
   ```
   If no files changed, the merge was a no-op — **stop and report**: "Merge commit exists but introduced no file changes. The task work may not have been committed in the worktree."

4. Record the merge commit hash — this is required for the output contract and is the proof that work was preserved before any purge.

Report the merge commit hash, changed file count, and summary to the user.

**Local only.** Do not push to remote. This step is merge + commit on the local branch only.

**MERGE_VERIFIED flag:** Set an internal flag `MERGE_VERIFIED = true` only when all 3 checks above pass. This flag gates Purge and Advance in the task-completion workflow.

## Output Contract

```markdown
## Repo Resolution (Hard Gate)
- Task: <taskKey>
- Canonical repo root: <canonicalRepoRoot> (resolved from worktree git common dir)
- Current shell repo: <currentRoot>
- Match: <yes / no — informational only>
- REPO_RESOLVED: <YES / FAILED — if failed, entire workflow MUST NOT proceed>

## Worktree Inspection (Hard Gate)
- Worktree path: <worktreePath>
- Uncommitted changes: <yes (auto-committed) / no (clean)>
- Committed changes vs base: <yes / no>
- WORKTREE_INSPECTED: <YES / SKIPPED — if skipped, merge MUST NOT proceed>

## Merge
- Target repo: <canonicalRepoRoot>
- Branch: <worktree-branch>
- Merge commit: <hash>
- Files changed: <count>
- MERGE_VERIFIED: <YES / NO — gates purge AND advance>
- Local branch HEAD after merge: <hash>
```

## Anti-Patterns (DO NOT)

1. **Purge sessions before merge is verified** — this is the most dangerous mistake. Purging destroys the worktree. If work was not merged first, it is permanently lost and the task must be re-run
2. **Skip checking the worktree for uncommitted changes** before merging — always run `git -C <worktreePath> status --porcelain --untracked-files=normal` and auto-commit if dirty
3. **Treat "no commits ahead" as "nothing to do"** without also confirming the worktree is clean — uncommitted work in the worktree is not visible in `git log` comparisons. If the worktree is dirty, auto-commit first, then re-check
4. **Proceed to purge when merge produced no file changes** — a no-op merge means work was never committed, purging would destroy it
5. **Skip the auto-commit and ask the user** — the task has already passed review; uncommitted executor work should be committed automatically to prevent data loss during purge
6. **Compare branch HEAD SHAs or commit hashes to determine "no work"** — branch heads can match when the executor worktree has uncommitted changes. ALWAYS run `git -C <worktreePath> status --porcelain` AND `git -C <worktreePath> diff --stat <base-branch>..HEAD` before concluding no work exists. This is the #1 cause of lost executor work
7. **Skip Step 2 (worktree inspection) and jump to branch comparison** — Step 2 is a hard gate. The `WORKTREE_INSPECTED` flag must be set before any branch-level comparison in Step 3
8. **Advance to the next task when `MERGE_VERIFIED` is not `true`** — the next executor launches from the local branch HEAD. Without a verified merge, it starts from stale code and cannot build on the completed task's work. This breaks the sprint chain
9. **Report "no-op merge" and proceed to advance** — a no-op merge means the work never reached the local branch. STOP. Do not purge. Do not advance. Report the failure
10. **Merge into whatever repo the operator's shell is currently in** — always resolve the canonical repo root from the worktree's git common dir (Step 1b). The operator may be running Skadi from a different project's repo directory. Using `cwd` as the merge target in a multi-project sprint will land work in the wrong repository

<!--</instructions>-->
<!--</capability>-->
