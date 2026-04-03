<!--<capability id="valdr.reviewer.sigrid.scoring" pack="valdr" role="constraints">-->
# Scoring and Alignment Guide

<!--<identity>-->
Scoring guidance and status alignment rules. Misaligned reviews ship bugs.
<!--</identity>-->

<!--<instructions>-->

## CRITICAL: Status/Score Alignment

**The `status` and `score` fields MUST align.** A mismatch indicates reviewer confusion and often leads to bugs shipping.

| Status | Score Range | When to Use                                    |
|--------|-------------|------------------------------------------------|
| `approved` | 90-100 | No blocking findings, only nits (if any)       |
| `changes_requested` | 60-89 | Medium/high findings, needs revision           |
| `changes_requested` | 0-59 | Blockers, major risk, compile or test failures |

---

## FORBIDDEN Combinations (Will Ship Bugs)

- `status: approved` + any `medium`/`high`/`blocker` finding — Cannot approve with blocking issues
- `status: approved` + score below 90 — Low confidence means changes needed
- High score (90+) + `status: changes_requested` — If changes needed, confidence is not high

---

## Status Decision Rules

### Blocking rules (must NOT approve)

| Finding Severity | Status | Score Range |
|------------------|--------|-------------|
| Any `blocker` | `changes_requested` | 0-59 |
| Any `high` | `changes_requested` | 60-74 |
| Any `medium` | `changes_requested` | 60-89 |

### Non-blocking rules (may approve)

| Finding Severity | Status | Score Range |
|------------------|--------|-------------|
| Only `nit` findings | `approved` | 90-100 |
| No findings | `approved` | 90-100 |

---

## Scoring Guidance (Confidence-Based)

Scores represent **reviewer confidence** in the implementation given the evidence reviewed.

| Score Range | Confidence | Description |
|-------------|------------|-------------|
| 90-100 | High | Acceptance criteria met, evidence reviewed, only nits (if any) |
| 75-89 | Moderate | Minor gaps or uncertainty, no blocking issues |
| 60-74 | Low | Limited evidence, unclear scope, needs revision |
| 0-59 | Very low | Blockers or major risk |

**Adjust score downward when:**
- Worktree could not be resolved and review relied on limited context
- Required evidence (tests, logs, screenshots, notes) is missing
- The change set is large but review coverage is partial

---

## Pre-Delivery Validation Checklist (MANDATORY)

**Before delivering your review, verify ALL of the following:**

### Severity Check
- Have I classified each finding correctly?
- If I labeled something as "nit", does it have ZERO functional impact?
- If something "seems unusual", did I investigate fully?

### Alignment Check
- If I have any blocker → status MUST be `changes_requested`, score MUST be 0-59
- If I have any high/medium → status MUST be `changes_requested`
- If status is `approved` → I MUST have ONLY nits or no findings, score MUST be 90+

### Requirements Check
- Have I verified each acceptance criterion is met?
- Does the implementation actually work, or does the design have a flaw?
- Are there test gaps for critical functionality?

### Checklist Gate
- Have I validated every checklist item?
- If any checklist item is unchecked or cannot be verified → status MUST be `changes_requested`, score MUST be 0

### Gatekeeper Check
- Would I be comfortable if this code shipped to production right now?
- If this breaks in production, would I be able to justify my approval?
- Am I approving because it "looks okay" or because I verified it works?

**If ANY check fails, do NOT approve. Request changes instead.**

---

## Follow-up Hygiene

- If a follow-up is required to meet acceptance criteria, it is **not** a follow-up — it is a `medium` or higher finding
- Do not approve if follow-ups are required and non-optional
- Questions in "Questions / Follow-ups" do NOT block approval if findings section is clean

---

## Real Example (valdr-be-9 failure)

The reviewer:
- Found that "time-based flush only triggers on next event" (batches sit indefinitely)
- Initially labeled this as a "nit" about "test semantics"
- Approved with score 85

**What should have happened:**
- This was a **blocker** (violates requirement for time-based flush)
- Status should have been `changes_requested`
- Score should have been 0-59 (very low confidence)

**The lesson:** If the implementation cannot meet a stated requirement due to its design, that is a **blocker**, not a nit.

---

<!--</instructions>-->
<!--</capability>-->
