# Valdr Workflow Pack

`valdr-workflow@0.13.0` adds reusable task, sprint, planning, and pull-request workflows to Valdr. It is a companion to `valdr@0.3.0` Sovereign and requires Valdr CLI `0.3.0`.

Use this supported compatibility tuple. Download the CLI from [Valdr releases](https://github.com/projectviking-ai/valdr-releases/releases) and both packs from [Valdr Packs releases](https://github.com/projectviking-ai/valdr-packs/releases):

| Component | Release tag | Asset |
| --- | --- | --- |
| Valdr CLI `0.3.0` | `v0.3.0` in `projectviking-ai/valdr-releases` | `valdr-v0.3.0-macos-arm64.tar.gz` and `.sha256` |
| Sovereign `0.3.0` | `v0.3.0` | `valdr-sovereign.valdr-pack.tar.gz` |
| Workflow `0.13.0` | `valdr-workflow-v0.13.0` | `valdr-workflow.valdr-pack.tar.gz` |

## Import

1. Install the exact compatible Valdr CLI.
2. Download the Sovereign and Workflow archives from their GitHub releases.
3. In the Valdr UI pack import flow, preflight the Sovereign archive, review its plan, and commit it.
4. Preflight the Workflow archive, confirm that its core capability references resolve, review its plan, and commit it.

If either pack is already installed, keep active and frozen workflow runs intact. Use the preflight plan's update or replace operations to update definitions; do not delete the installed pack as a shortcut. The Workflow archive does not replace the core pack. Its agents reference Sovereign capabilities including `pm_workflow` and `pm_session` guidance.

## Configure a project

Before starting a workflow:

1. Attach a Git repository to a Valdr project.
2. Configure launcher presets in Valdr. Use `pm_provider` with `action: list_presets` to inspect their keys and declared capabilities.
3. Register bot agents for implementation and review. Use `pm_agent` with `action: list`, `kinds: ["bot"]`, and the required role to inspect eligible handles. Routing considers declared role, tags, capabilities, usable prompt, and operator exclusions; it does not guess from a handle or model name.
4. Choose a human `operatorHandle` for correction and pull-request approval gates.

Router and sizing presets only need PM data access and must honour strict JSON output. Readiness review, implementation, code review, planning, and pull-request writing presets need repository access. The preset router uses live declared capabilities. If it cannot decide, a configured fallback is used; without one, the workflow blocks instead of launching an unknown preset. Agent routing follows the same rule for executor and reviewer defaults.

## Git and publication defaults

`idea-to-sprint` and `task.prepare-deliver-and-publish` default `remoteName` to `origin`; pass another remote name when needed. The single-task entrypoint may omit `baseRef`, in which case implementation begins from the repository's current checkout. Idea-to-sprint captures its base from the planning session and creates a deterministic plan delivery branch.

Pull requests start as drafts unless `initialDraft` is false. The writer can draft metadata from frozen commit and diff evidence, but cannot publish. The named human operator reviews the exact proposal and is the only authority that can approve publication.

## Primary entrypoints

- `valdr-workflow.idea-to-sprint@0.20.0`: plan an idea, execute its sprint, and publish the reviewed delivery.
- `valdr-workflow.task.prepare-deliver-and-publish@0.3.0`: take one written task through readiness, staffing, delivery, review, commit, and pull request.
- `valdr-workflow.pull-request.create@0.4.0`: publish an existing branch through a frozen-evidence approval gate.

All subworkflow versions are exact. Validation must report zero unresolved workflow references before release. Empty executor, reviewer, and preset fallbacks deliberately block when routing returns unknown.

## Validate from source

Set `VALDR_BIN` to the exact compatible CLI, then run:

```bash
make validate-valdr-workflow VALDR_BIN=/path/to/valdr
```
