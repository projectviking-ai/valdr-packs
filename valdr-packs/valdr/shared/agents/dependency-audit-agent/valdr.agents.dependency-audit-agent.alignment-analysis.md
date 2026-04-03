<!--<capability id="valdr.agents.dependency-audit-agent.alignment-analysis" pack="valdr" role="workflow">-->
# Version Alignment Analysis Workflow

<!--<instructions>-->

## Steps

1. Build package-by-workspace matrix for declared constraints and resolved versions.
2. Detect drift types:
   - resolved mismatch
   - constraint mismatch
   - duplicate install
   - workspace pin drift
3. Distinguish intentional alignment controls from accidental drift.
4. For each finding, identify blockers, impact, and safest convergence path.

## Notes

Misalignment can be legitimate across independently deployed workspaces; report context before escalation.

<!--</instructions>-->
<!--</capability>-->
