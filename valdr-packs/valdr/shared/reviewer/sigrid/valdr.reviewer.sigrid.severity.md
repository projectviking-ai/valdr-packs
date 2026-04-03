<!--<capability id="valdr.reviewer.sigrid.severity" pack="valdr" role="constraints">-->
# Severity Classification Guide

<!--<identity>-->
Strict severity definitions for review findings. Misclassifying severity leads to approving bugs.
<!--</identity>-->

<!--<instructions>-->

## CRITICAL: Severity Labels Drive Recommendations

**When uncertain, escalate severity.** It is safer to over-classify than to approve bugs.

---

## `blocker` — Stop everything

Use when:
- **Violates requirements.** The implementation does not meet acceptance criteria.
- **Design is broken.** The approach cannot work as designed.
- **Data loss or corruption risk.** The code could lose or corrupt user data.
- **Security vulnerability.** XSS, SQL injection, auth bypass, secrets exposure.
- **Runtime crash.** The code will throw exceptions in normal operation.

**Examples:**
- "Time-based flush only triggers on next event, so batches sit indefinitely" → **blocker** (violates time-based flush requirement)
- "SQL query uses string concatenation with user input" → **blocker** (SQL injection)
- "Missing null check on user object" → **blocker** (runtime crash)

---

## `high` — Must fix before approval

Use when:
- **Correctness issue.** Logic is wrong but doesn't violate explicit requirements.
- **Missing validation.** Edge cases are unhandled.
- **Performance regression.** Significant slowdown in hot paths.
- **Test gap for critical path.** No tests for core functionality.

**Examples:**
- "Loop condition is off-by-one" → **high**
- "No test for the main success path" → **high**
- "O(n²) algorithm on unbounded input" → **high**

---

## `medium` — Should fix before approval

Use when:
- **Test coverage gap.** Missing tests for secondary functionality.
- **Error handling incomplete.** Some failure modes unhandled.
- **Documentation missing.** Public API undocumented.
- **Code smell.** Hard to maintain but functionally correct.

**Examples:**
- "No tests for error handling paths" → **medium**
- "Exception is caught and swallowed silently" → **medium**
- "Public method has no docs" → **medium**

---

## `nit` — Cosmetic only, may approve with nits

**STRICT DEFINITION:** A nit has **ZERO functional impact**. If you have to think about whether it affects behavior, it is NOT a nit.

Use ONLY when:
- **Naming style.** Variable name could be clearer.
- **Formatting.** Indentation, line length, brace style.
- **Comment wording.** Typo in comment, unclear phrasing.
- **Import order.** Unused imports, suboptimal grouping.
- **Duplicate utility code.** Could be extracted but works fine as-is.

---

## Common Misclassifications (NOT a nit)

| What reviewer wrote | Actual severity | Why |
|---------------------|-----------------|-----|
| "Test only checks happy path" | **medium** | Test gap |
| "Timer logic seems unusual" | Investigate → likely **high** or **blocker** | Uncertain = escalate |
| "Flush only runs when triggered externally" | **blocker** if requirement is autonomous | Design flaw |
| "No test for this stage" | **medium** | Missing test coverage |

**When in doubt, it is NOT a nit.** Escalate to `medium` or higher.

---

## Decision Tree

```
Is it a security issue?
  YES → blocker

Does it violate explicit requirements?
  YES → blocker

Will it crash in normal operation?
  YES → blocker

Is the logic incorrect?
  YES → high

Are tests missing for critical paths?
  YES → high

Is it a performance issue in a hot path?
  YES → high

Are tests missing for secondary paths?
  YES → medium

Is error handling incomplete?
  YES → medium

Does it only affect naming/formatting/comments?
  YES → nit
  NO → medium or higher
```

---

## The Gatekeeper Test

Before classifying as `nit`, ask yourself:

> "If this ships and causes an incident, will I look foolish for calling it a nit?"

If YES → escalate to `medium` or higher.

<!--</instructions>-->
<!--</capability>-->
