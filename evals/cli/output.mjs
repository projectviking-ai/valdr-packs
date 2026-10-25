export const HELP = `Valdr evaluations for pack authors

Usage: bun evals/run.mjs <command> [suite] [options]
  list     List scenarios without Valdr or model usage
  doctor   Check installed CLI prerequisites and fixtures; no model calls
  run      Evaluate an agent through public Codex and Valdr interfaces
  replay   Evaluate a saved workflow bundle without a model
  runs     Inventory saved evidence offline
  prune    Preview evidence retention; deletion requires --apply
  report <run>                  Read saved evaluation evidence offline
  compare <baseline> <candidate> Compare compatible saved agent evaluations

Examples:
  bun evals/run.mjs list task-repair
  bun evals/run.mjs doctor task-repair
  bun evals/run.mjs run task-repair --scenario 01_exact_replacement --dry-run
  bun evals/run.mjs replay workflow-authoring --bundle bundle.json --scenario 06_optional_task_lookup

Options:
  --suite workflow-authoring|task-repair   Alternative to positional suite
  --config file.json --profile name       Named Codex profile (default: sol-high)
  --agent path --tier raider|vanguard|sovereign
  --scenario id,id|all --max-repairs 0..2 --timeout-ms 1000..1200000
  --valdr-bin executable --packs-root path --evidence-root path --round label
  --dry-run                              Preview run bounds without executing
  --json                                 One final JSON result; progress on stderr

Offline report/compare options:
  --format text|html --output file.txt|file.html --json
  HTML requires --output; existing files are never overwritten.

Offline runs/prune options:
  --evidence-root directory --json
  prune: --older-than-days 30 --keep 5 --include-failed --apply|--dry-run
  Default is preview. Active, incomplete and unknown evidence stays protected.

Bun 1.4.3+ runs the harness. Fixture checks require Git and the installed valdr CLI.
Doctor checks fixture readiness only. Live runs await harness verification of
public turn-completion evidence and effective tool restrictions.
Profiles and troubleshooting: evals/README.md`;

export function renderPreview(preview) {
  return `${preview.dryRun ? 'Run preview (no execution)' : 'Live evaluation'}: ${preview.suite}\n` +
    `Agent: ${preview.agentPath}\nProfile: ${preview.profileName} (${preview.profile.model}, ${preview.profile.reasoningEffort})\n` +
    `Live authoring: available\nScenarios: ${preview.scenarios.length}; repairs per scenario: ${preview.maxRepairs}; planned maximum model turns: ${preview.maximumAuthorTurns}\n` +
    preview.scenarios.map(scenario => `  ${scenario.id}  ${scenario.title}${scenario.evaluationUnavailable ? ' [authoring fixture: execution unavailable]' : ''}`).join('\n');
}
export function renderResult(options, result) {
  if (Array.isArray(result)) return `${options.suite}: ${result.length} scenarios\n${result.map(item => `  ${item.id}  ${item.title}${item.evaluationUnavailable ? ' [authoring fixture: execution unavailable]' : ''}`).join('\n')}`;
  if (result.dryRun) return renderPreview(result);
  if (result.checks) return `Fixture readiness: ${result.ok ? 'ready' : 'needs attention'}\n` + result.checks.map(check =>
    `  ${check.ok ? 'PASS' : 'FAIL'} ${check.id}: ${check.message}${!check.ok && check.fix ? `\n       Fix: ${check.fix}` : ''}`).join('\n') + '\nProvider calls: 0';
  return `Evaluation: ${result.outcome ?? (result.ok ? 'passed' : 'unsuccessful')}\n` +
    (result.scenarios !== undefined ? `Scenarios: ${result.scenarios}; first attempt passed: ${result.firstCandidatePassed}; eventually passed: ${result.eventuallyPassed}; repairs: ${result.repairsUsed}\n` : '') +
    (result.error ? `Reason: ${result.error}\n` : '') + (result.directory ? `Evidence: ${result.directory}\n` : '') +
    (result.results ?? []).filter(item => !item.attempts.some(attempt => attempt.evaluation?.ok)).map(item =>
      `  ${item.scenarioId}: ${item.outcome ?? 'unsuccessful'} — ${item.attempts.at(-1)?.infrastructureError ?? item.attempts.at(-1)?.evaluation?.error ?? 'See scenario result.json for assertion details.'}`).join('\n');
}
