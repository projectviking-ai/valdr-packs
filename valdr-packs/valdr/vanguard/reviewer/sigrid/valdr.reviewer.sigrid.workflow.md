<!--<capability id="valdr.reviewer.sigrid.workflow" pack="valdr" role="workflow">-->
# Reviewer Workflow Guide

<!--<identity>-->
CLI reviewer workflow patterns for conducting reviews through Valdr PM MCP.
<!--</identity>-->

<!--<instructions>-->

## CLI Reviewer Workflow

Use this flow for CLI-based reviews. It is strict, repeatable, and fail-closed.

### Preflight (Always)

1. `pm_task { action: "get" }` → check status first
   - If `status !== in_review` → ask user before proceeding (see status table below)
2. `pm_task { action: "comment_list" }` → pull completion summaries and evidence
3. `pm_task { action: "plan", taskKey }` → load plan context when available
4. Normalize handles (see Handle Normalization)
5. Resolve the review workspace (see Workspace Resolution)
6. Validate checklist completion (see Checklist Validation)

**Status check:**

| Status | Action |
|--------|--------|
| `in_review` | Proceed with preflight |
| `in_progress` | Ask user before moving to in_review |
| Other | Stop — task not ready for review |

### Workspace Resolution

Vanguard review is session-free. Resolve the review workspace from explicit user context first, then fall back to the current checkout.

1. If the user, task summary, or completion comment names a specific worktree or repository path, use it.
2. Otherwise, use the current working directory / checkout for review.
3. Record the chosen workspace path in your review notes.

### Route Detection

```
pm_review { action: "list", taskKey: "<task-key>" }
```

Decide route based on assignments:
- **Has reviewer assignments** → Route A (Assigned Reviewer)
- **No reviews or no assignments** → Route B (Ad-hoc Reviewer)

---

## Route A: Reviewer Assigned (PREFERRED)

When the task has assigned reviewers, take on their persona.

**Step 1: Resolve reviewer handle (deterministic)**
- If exactly 1 reviewer assignment → auto-resolve that handle
- If multiple reviewers and no selection → **STOP** and ask user to choose
- If provided handle is not in assignment list → **STOP** with error

**Step 2: Load Review Comments**
```
pm_task { action: "comment_list", taskKey, reviewId, assignmentId }
```

**Step 3: Get Review Prompt**
```
pm_review { action: "get_prompt", taskKey, reviewerHandle? }
```

If multiple reviewers exist, `reviewerHandle` is required.

**Step 4: Enforce Persona**
Treat `systemPrompt` as highest priority:
- No repo changes; review only
- MCP-first; publish via PM MCP only
- Fail-closed if MCP is unavailable

**Step 5: Review + Publish**
1. `pm_generate_ulid` → `clientRequestId`
2. Review the changes in the resolved worktree (no modifications)
3. Prepare Markdown findings
4. **Run Pre-Publish Validation (MANDATORY)** — hot-load `valdr.reviewer.sigrid.scoring`
5. Publish the review using `pm_review { action: "publish" }` — see the scoring capability for the full publish call template, required fields, and alignment rules.

**Step 6: Receipt Only (chat)**
```json
{ "reviewId": "<id>", "assignmentId": "<id>", "status": "approved", "clientRequestId": "<ulid>" }
```

**Step 7: Stop After Publish**

After publishing, return the PM receipt in chat and stop. In Vanguard there is no live executor-session wake-up or reviewer-session re-engagement. Follow-up happens when the executor or orchestrator checks `pm_review` state and comments.

---

## Route B: No Reviewer Assigned (AD-HOC)

When no reviewer is assigned, request assignment first.

**Step 1: Request Review Assignment**
Ask: "No reviewer is assigned. Should I start a review as `<your-handle>`?"

If confirmed:
```
pm_review { action: "start" } → {
  taskKey,
  reviewerHandle: "<your-handle>",
  actorHandle: "<your-handle>",
  summary: "CLI review requested",
  clientRequestId: "<fresh-ulid>"
}
```

Capture `reviewId` and `assignmentId` from response.

**Step 2: Get Review Prompt**
```
pm_review { action: "get_prompt", taskKey }
```

**Step 3: Load Review Comments**
```
pm_task { action: "comment_list", taskKey, reviewId, assignmentId }
```

**Step 4: Follow Route A Steps 4-7**

---

## Checklist Validation (MANDATORY)

Reviewers must validate every checklist item.

1. From `pm_task { action: "get" }`, inspect `metadata.checklists`
2. For each checklist item:
   - Verify it is marked `checked: true`
   - Verify evidence exists (files, tests, completion summary)

If ANY item is unchecked or cannot be verified:
- Set `status: "changes_requested"`
- Set `score: 0`
- Include finding listing missing/unverified items

---

## Handle Normalization

When working with reviewer handles:
- Trim whitespace
- Strip leading `@`
- Lowercase
- De-duplicate and sort lexicographically
- Display **without** `@` in outputs and errors

---

## Failure + Idempotency Rules

- If any MCP call fails → **STOP** and do not emit the review body
- One ULID per mutation; never reuse `clientRequestId`
- If unsure publish succeeded → re-check `pm_review { action: "list" }`
- Errors must list handles without `@` in stable sorted order

---

## Review Markdown Schema

All reviewers must use the same shape. Post via `pm_review { action: "publish" }` (never in chat).

```
# Review Summary
Task: <taskKey>
Worktree: <worktree-path | "current working directory">
- <bullet> (file/path#Lx-Ly)

## Findings
- <severity>: <finding> (file/path#Lx-Ly)
- None.

## Questions / Follow-ups
- <question> (file/path#Lx-Ly)
- None.
```

**Rules:**
- Use `blocker`, `high`, `medium`, `nit` as severity labels
- If a section has no entries, use `- None.`
- Always include `Task:` and `Worktree:` under Review Summary
- Keep references concrete: `path#Lx-Ly` or `path:line`
- Do not include MCP receipt in Markdown body

<!--</instructions>-->
<!--</capability>-->
