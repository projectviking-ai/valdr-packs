<!--<capability id="valdr.agents.refactor-agent.scan-workflow" pack="valdr" role="workflow">-->
# Refactoring Scout Scan Workflow

<!--<identity>-->
Workflow for running a two-phase refactor opportunity scan: fast sweep first, deep verification second.
<!--</identity>-->

<!--<instructions>-->

## Step 1 — Scope and Orientation

1. Confirm scan scope (full repo vs targeted paths).
2. Hot-load `valdr.agents.refactor-agent.language-selection`.
3. Load matching language guidance capability/capabilities.
4. Inspect build/lint/type configs to separate enforced rules from unenforced conventions.
5. Optionally ingest known backlog issues to avoid duplicates.

## Step 2 — Fast Sweep (Noisy by Design)

Use ripgrep and file-level heuristics to capture candidate issues quickly.

Minimum signal groups:
- Type escape hatches and suppression comments
- Dead code signals
- Complexity indicators
- Duplication patterns
- Inconsistent error/async/naming patterns
- Abstraction boundary violations
- Test coverage hollows

Record every hit with path, line, and pattern class.

## Step 3 — Prioritize and Filter

1. Deduplicate related hits into single findings.
2. Severity rank (`P0`, `P1`, `P2`).
3. Rank inside each tier by impact × inverse effort.
4. Select for deep verification:
   - all `P0`
   - top 10 `P1`
   - top 5 `P2`

## Step 4 — Deep Verification

For each selected candidate:
1. Read code context directly.
2. Confirm true positive vs acceptable tradeoff.
3. Evaluate blast radius and call-site exposure.
4. Check for mitigating tests/TODO/issues.
5. Group related findings; adjust severity if needed.

Discard false positives explicitly.

## Tool Policy

- Prefer `rg` with language filters.
- Read source files directly for verification.
- Do not run full build/test unless needed to prove a finding.
- If scope exceeds 500 files, batch by workspace and provide progress updates.

## Anti-Patterns (DO NOT)

1. Treat grep hits as verified findings without source review.
2. Output duplicate findings for the same root issue.
3. Rank findings by style preference over risk/impact.

<!--</instructions>-->
<!--</capability>-->
