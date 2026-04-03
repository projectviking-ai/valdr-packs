<!--<capability id="valdr.agents.dependency-audit-agent.upgrade-planning" pack="valdr" role="integration">-->
# Upgrade Plan and Handoff Workflow

<!--<instructions>-->

## Approval Gate

Produce plan and commands, but do not execute remediations unless explicitly approved by the human.

## Phase Model

1. **Phase 1 -- Zero-Risk**: unused removals, patch-safe alignment, safe patches.
2. **Phase 2 -- Low-Risk**: minor upgrades, scope corrections (`dependencies` vs `devDependencies`).
3. **Phase 3 -- Breaking**: major upgrades/migrations with explicit dependency-chain sequencing.
4. **Phase 4 -- Deferred/Accepted**: no-fix vulnerabilities, approved exceptions, intentional divergence.

## Per-Phase Requirements

- exact commands
- validation checklist (typecheck/lint/test/build as appropriate)
- rollback steps
- likely impact/risk notes

<!--</instructions>-->
<!--</capability>-->
