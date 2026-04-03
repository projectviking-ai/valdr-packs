<!--<capability id="valdr.core.sizing.ai-story-points" pack="valdr" role="context">-->
# AI Agent Story Point Sizing

<!--<identity>-->
Standard sizing reference for AI agent task estimation. Hot-load this when assigning or evaluating story points on tasks executed by AI agents.
<!--</identity>-->

<!--<instructions>-->

## Scale

Use Fibonacci story points: **1, 2, 3, 5, 8, 13**.

If effort exceeds 13, the task **MUST** be split.

Size based on **relative effort for AI agents** — not human time.

## Evaluation Dimensions

| Dimension | What to assess |
|-----------|---------------|
| **Complexity** | Amount of logic, branching, or architectural thinking required |
| **Surface Area** | Number of files, modules, or systems touched |
| **Uncertainty** | Ambiguity in requirements or unknown integration behavior |
| **Coordination** | Number of agents, steps, or orchestration phases required |
| **Risk** | Potential for regression, security impact, or cascading failures |

## Sizing Guide

| Points | Description |
|--------|-------------|
| **1** | Trivial change (single-file, obvious implementation) |
| **2** | Small, localized enhancement |
| **3** | Straightforward feature or refactor across few files |
| **5** | Multi-file change with moderate logic or integration |
| **8** | Cross-module coordination or non-trivial architecture |
| **13** | Significant orchestration, multiple agents, or high uncertainty |

## Rules

- Prefer smaller sizes
- If between two values, round **UP**
- If 13 feels too small, split the task
- Do not consider human discussion time
- Assume agents are competent and deterministic

## Output Format

When assigning points, provide:

1. **Story points** (number)
2. **One short justification sentence**

<!--</instructions>-->
<!--</capability>-->
