---
name: valdr-workflow-tools
description: Use when authoring, importing, or updating local CLI and code tools for Valdr workflows, including full CLI-tree discovery, typed manifests, pack validation, and workflow integration.
---

# Valdr Workflow Tools

Produce reviewable source artifacts for Valdr workflows; the host supplies runtimes, dependencies and authentication. Start from the canonical `valdr-packs/valdr-tools` examples in this repository. Keep one maintained source and distribute its archive.

1. Read [the contract](references/contract.md) before authoring a manifest or dispatcher. Include explicit files, typed input/output, a one-shot protocol example, side effects and retry behavior.
2. For a CLI, read [discovery](references/cli-discovery.md). Discover the installed version and full tree separately from choosing executable actions. Keep each tool's runner and command table independent; use the source generator for shipped CLI tools. Keep unimplemented leaves and discovery gaps visible.
3. Validate and build through the Valdr CLI. Run harmless fixtures through the actual runtime; separate static, stub, installed-runtime and authenticated evidence.
4. Read [import and updates](references/import-and-updates.md) before changing an imported tool. Preserve local edits and existing run pins. Imported tools are immediately available in the Builder; import never runs them.

Deliver the manifest, inventoried source, request/result fixtures, CLI inventory when applicable, and exact validation results. External writes need the task's authorization and a known retry/reconciliation contract. Do not install dependencies, log in, or switch profiles merely to make validation pass.
