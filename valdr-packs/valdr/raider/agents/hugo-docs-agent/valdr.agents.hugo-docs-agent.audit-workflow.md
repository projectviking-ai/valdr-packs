<!--<capability id="valdr.agents.hugo-docs-agent.audit-workflow" pack="valdr" role="workflow">-->
# Hugo Documentation Audit Workflow

<!--<identity>-->
Systematic workflow for auditing Hugo docs against implementation truth.
<!--</identity>-->

<!--<instructions>-->

## Step 1 — Landscape Mapping

1. Read Hugo config (`hugo.toml`/`config.toml`) when available.
2. Inventory `content/` pages with front matter, shortcodes, code blocks, and image references.
3. Inventory `layouts/shortcodes/` definitions and expected parameters.
4. Classify pages into: `api-reference`, `guide`, `architecture`.

## Step 2 — Source Truth Mapping

For each page, map doc path to source-of-truth file paths:
- API docs -> routes, schemas, tool definitions, CLI parsers
- Guides -> scripts, example code, dependency/runtime prerequisites
- Architecture docs -> workspace structure, dependency boundaries, migrations/infra

Mark pages with no clear mapping as `unmapped`.

## Step 3 — Drift Detection

Apply category-specific checks:
- API: signatures, defaults, errors, schema shapes, removed/missing endpoints
- Guides: commands, imports, prerequisites, expected output, screenshots
- Architecture: components, dependencies, data-flow diagrams, terminology

## Step 4 — Severity Classification

- `critical`: functionally wrong or misleading
- `stale`: outdated but generally workable
- `cosmetic`: minor consistency/formatting metadata issues

## Step 5 — Reporting

Assemble drift report with:
- summary table by category/severity
- unmapped pages
- critical/stale/cosmetic findings
- screenshot refresh queue
- recommended patch sequence

## Approval Gate

Do not patch files in this workflow. Wait for explicit user approval before applying patches.

## Anti-Patterns (DO NOT)

1. Skip source-truth mapping and infer fixes from docs alone.
2. Mix approved and unapproved findings in one patch run.
3. Treat visual drift as text-only updates.

<!--</instructions>-->
<!--</capability>-->
