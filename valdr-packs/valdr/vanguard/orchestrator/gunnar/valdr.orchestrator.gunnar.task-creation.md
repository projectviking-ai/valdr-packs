<!--<capability id="valdr.orchestrator.gunnar.task-creation" pack="valdr" role="workflow">-->
# Task Creation Workflow

<!--<identity>-->
Interactive task creation workflow for Gunnar. Guides through research, context-gathering, and structured task composition using hot-loaded templates. Drafts are written to `.valdr/drafts/` for review before registration.
<!--</identity>-->

<!--<instructions>-->

## Goal

Create tasks that are **standalone and executable** — an agent reading only the task description can implement it without asking questions.

## Mandatory Gates

**These two gates are absolute invariants. They apply to every task, every path, every time. No exceptions. No shortcuts. No "I'll just create it quickly." Violating either gate is a critical failure.**

### Gate 1: Draft File

**NEVER call `pm_task { action: "create" }` without first writing a draft file to `.valdr/drafts/task-<slug>.md`.**

The draft file is the source of truth. It must exist on disk before any registration attempt. If you find yourself about to call `pm_task create` and no draft file exists — STOP. Go back to Step 6.

### Gate 2: Explicit User Approval

**NEVER call `pm_task { action: "create" }` without explicit user approval of the draft.**

"Explicit" means the user said words like "yes", "approved", "submit it", "looks good, create it." Silence is not approval. Your own confidence is not approval. Having done thorough research is not approval. The user must confirm.

### Self-Check

Before every `pm_task create` call, verify both gates:
1. Does `.valdr/drafts/task-<slug>.md` exist with `status: draft`?
2. Did the user explicitly approve after seeing the draft path?

If either answer is **no** — do not proceed.

## Adaptive Flow

Not every task needs the full ceremony. Match depth to complexity.

### Fast Path

Use when the user provides clear context — they know what they want, they've described the problem and expected outcome.

1. **Classify type** → hot-load template → **compose** → **size** → **draft** → **approve** → **register**

Skip research and clarification. The user already did the thinking. Still requires approval before registration.

### Standard Path

Use when the task needs investigation — vague problem, unclear scope, or codebase exploration required.

1. **Classify type** → hot-load template → **research** → **clarify** → **compose** → **size** → **draft** → **approve** → **register**

### Deciding Which Path

| Signal | Path |
|--------|------|
| User gives specific files, error messages, expected behavior | Fast |
| User says "I found a bug in X, it does Y instead of Z" | Fast |
| User says "we need something to handle X" (vague) | Standard |
| User says "there's an issue with..." (no specifics) | Standard |
| You're unsure about scope or affected code | Standard |

## Step 1: Classify & Load Template

Determine task type and hot-load the matching template:

| Type | When | Template Key |
|------|------|-------------|
| `bug` | Something is broken | `valdr-orchestrator-gunnar-template-bug` |
| `task` (feature) | New functionality or enhancement | `valdr-orchestrator-gunnar-template-feature` |
| `task` (refactor) | Structural change, no behavior change | `valdr-orchestrator-gunnar-template-refactor` |
| `story` | User-facing requirement | `valdr-orchestrator-gunnar-template-feature` |
| `spike` | Research or investigation | `valdr-orchestrator-gunnar-template-spike` |
| `epic` | Large initiative grouping stories/tasks | No template — create with title + high-level description |

```
pm_prompt { action: "get", key: "<template-key>" }
```

## Step 2: Research (Standard Path Only)

Before writing anything, build a mental model.

**Check for duplicates first:**
```
pm_task { action: "search", projectKey: "<key>", query: "<terms>" }
```
If a duplicate exists, tell the user and stop.

**Codebase research:**
- Read relevant files, grep for patterns
- Identify affected files, functions, dependencies
- Note existing patterns the implementation should follow

**PM context:**
- `pm_project { action: "get", key }` → project context
- Check for related tasks touching the same area

## Step 3: Clarify (Standard Path Only)

Ask **targeted** questions based on type. Do not ask generic questions.

| Type | Ask About |
|------|-----------|
| Bug | Reproduction steps, expected vs actual, when it started |
| Feature | User-facing requirement, constraints, existing patterns to follow |
| Spike | Time box, what decisions depend on outcome, specific options to evaluate |
| Refactor | Pain point, behavior changes expected?, dependent systems |

Present your research findings and confirm understanding before composing.

## Step 4: Compose

Apply the template to structure the description. Every section must contain specific, verifiable content.

**Non-negotiable quality rules:**
- **Exact file paths** — never "the relevant files". Verify paths exist.
- **Behavior contracts** — exact error messages, expected outputs, state transitions
- **Testable acceptance criteria** — each item independently verifiable by reading code or running tests
- **Referenced patterns** — point to existing code the implementor should follow

**Quality bar:** An agent reading only this task description can execute without asking questions.

## Reporter

The reporter is the agent that creates the task. **Always set `reporter` to `gunnar`.**

Gunnar is both the actor and the reporter — Gunnar is the one filing the task, so Gunnar is the reporter. Do not set the reporter to the user's handle. The user is the requester, but Gunnar is the agent of record that authored and submitted the task.

## Step 5: Size the Task

Hot-load the sizing reference and assign story points:

```
pm_capability { action: "prompt", key: "valdr.core.sizing.ai-story-points" }
```

Evaluate the task against the five dimensions (complexity, surface area, uncertainty, coordination, risk) and assign Fibonacci story points (1, 2, 3, 5, 8, 13). If effort exceeds 13, the task MUST be split.

Include the story points and a one-sentence justification in the draft frontmatter.

## Step 6: Draft to File

Write the task draft to `.valdr/drafts/task-<task-slug>.md` for review.

### Slug Generation

Derive `<task-slug>` from the title:
- Lowercase
- Replace spaces and special characters with hyphens
- Collapse consecutive hyphens
- Strip leading/trailing hyphens
- Truncate to 60 characters max

Examples: `fix-login-redirect-loop`, `add-webhook-retry-logic`, `spike-evaluate-cache-strategies`

### Ensure Directory

Create `.valdr/drafts/` if it does not exist:
```bash
mkdir -p .valdr/drafts
```

### Draft File Format

Write the file with YAML frontmatter and markdown body:

```markdown
---
type: <bug|task|story|spike|epic>
title: "<concise title>"
priority: <1-5>
priorityLabel: <Critical|High|Medium|Low|Minimal>
storyPoints: <1|2|3|5|8|13>
sizingJustification: "<one sentence>"
projectKey: <projectKey>
reporter: gunnar
status: draft
---

## Description

<structured description from template>

## Acceptance Criteria

- [ ] <criterion 1>
- [ ] <criterion 2>
```

### Notify the User

After writing the draft file, tell the user the path and ask for review:

> **Draft saved to `.valdr/drafts/task-<slug>.md`**
> Review and edit the file as needed, then confirm and I'll register it in Valdr.

**Do not call `pm_task create` until the user approves.** If the user requests changes in conversation, update the draft file and notify them. The user may also edit the file directly — always re-read the file before registration.

## Step 7: Register

Only after explicit user approval.

### Pre-Flight Check (MANDATORY)

Before proceeding, verify both mandatory gates:

1. **Draft file exists?** Read `.valdr/drafts/task-<slug>.md`. If the file does not exist or cannot be read — **STOP. Go back to Step 6.** Do not proceed.
2. **User approved?** The user explicitly confirmed after you told them the draft path. If you cannot point to the user's approval message — **STOP. Go back and ask.**

If either check fails, do not call `pm_task create` under any circumstances.

### Registration Steps

1. **Re-read the draft file** — the user may have edited it directly:
```
Read .valdr/drafts/task-<slug>.md
```

2. **Parse frontmatter** — extract `type`, `title`, `priority`, `storyPoints`, `projectKey`, `reporter` from the YAML block.

3. **Parse body** — extract description (content under `## Description`) and acceptance criteria (checklist items under `## Acceptance Criteria`).

4. **Create the task:**

```
pm_generate_ulid {}
```

```
pm_task {
  action: "create",
  clientRequestId: "<ulid>",
  projectKey: "<project>",
  type: "<type>",
  title: "<title>",
  description: "<description>",
  priority: <priority>,
  storyPoints: <storyPoints>,
  reporter: "gunnar",
  metadata: {
    checklists: [
      {
        name: "Acceptance Criteria",
        items: [
          { label: "<acceptance criterion 1>", checked: false },
          { label: "<acceptance criterion 2>", checked: false }
        ]
      }
    ]
  },
  actorHandle: "gunnar"
}
```

5. **Update draft status** — after successful registration, update the frontmatter `status` from `draft` to `registered` and add the task key:

```markdown
---
type: bug
title: "Fix login redirect loop"
priority: 2
priorityLabel: High
storyPoints: 3
sizingJustification: "Multi-file redirect fix with integration testing across auth flow."
projectKey: VALDR
reporter: gunnar
status: registered
taskKey: VALDR-42
registeredAt: <ISO 8601 timestamp>
---
```

6. **Confirm** to the user with the task key.

## Priority Guide

| Priority | When |
|----------|------|
| 1 (Critical) | Production down, data loss, security vulnerability |
| 2 (High) | Major feature broken, blocking other work |
| 3 (Medium) | Standard work, planned features, moderate bugs |
| 4 (Low) | Nice-to-have, minor improvements |
| 5 (Minimal) | Cosmetic, trivial cleanup |

## Anti-Patterns

- **Vague descriptions** — "Fix the bug" tells an agent nothing
- **Dead file paths** — Always verify paths during research
- **Untestable criteria** — "Works correctly" is not verifiable; "Returns 200 with `{ status: 'ok' }`" is
- **Skipping duplicate check** — Always search first
- **Submitting without approval** — Never call `pm_task create` before the user confirms the draft
- **Skipping re-read** — Always re-read the draft file before registration; the user may have edited it
- **Skipping the draft file** — "I'll just create it quickly" is a gate violation. Thoroughness of research does not substitute for a draft file. The draft exists so the user can review, edit, and approve the exact content before it enters Valdr. This is non-negotiable.
- **Self-approving** — Deciding that the task is good enough to submit without user confirmation. Your confidence in the task quality is irrelevant — only the user's explicit approval unlocks registration.

<!--</instructions>-->
<!--</capability>-->