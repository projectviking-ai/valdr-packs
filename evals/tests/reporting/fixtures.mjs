import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function saveProviderEvents(fixture, events, scenarioId = 'alpha', attempt = 1) {
  const file = path.join(fixture.directory, scenarioId, `attempt-${attempt}`, 'provider-events.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(events));
  return file;
}

export function evidenceFixture(t, mutate = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-report-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const evidence = {
    directory,
    summary: { schemaVersion: 1, suite: 'task-repair', suiteVersion: 3, ok: true, outcome: 'passed', completedAt: '2026-10-16T12:00:00Z',
      results: [
        { scenarioId: 'alpha', title: 'First case', cleanup: { ok: true }, attempts: [{ attempt: 1, author: { durationMs: 100 }, evaluation: { ok: true } }] },
        { scenarioId: 'beta', title: 'Second case', cleanup: { ok: true }, attempts: [
          { attempt: 1, author: { durationMs: 200 }, evaluation: { ok: false, variants: [{ id: 'beta', ok: false, assertions: [{ pass: false, message: 'Expected the approved replacement', actual: 'old', expected: 'new' }] }] } },
          { attempt: 2, author: { durationMs: 400 }, evaluation: { ok: true } },
        ] },
      ] },
    charter: { mode: 'run', suite: 'task-repair', suiteVersion: 3, agentPath: 'example/agent.agent.yaml', tier: 'sovereign',
      profile: { key: 'named-profile', providerType: 'codex', model: 'fixture-model', reasoningEffort: 'high', sandboxMode: 'workspace-write', approvalPolicy: 'never' },
      maxRepairs: 1, timeoutMs: 600000, round: 'baseline', startedAt: '2026-10-16T11:00:00Z',
      authorBinary: { version: 'codex-cli 1.0.0', sha256: 'c'.repeat(64), platform: 'darwin', arch: 'arm64' },
      binary: { sha256: 'b'.repeat(64), platform: 'darwin', arch: 'arm64' } },
    scenarios: [{ id: 'alpha', title: 'First case', brief: 'First fixture' }, { id: 'beta', title: 'Second case', brief: 'Second fixture' }],
    sourceManifest: { runnerFiles: [
      { path: 'run.mjs', sha256: '9'.repeat(64) },
      { path: 'suites/registry.mjs', sha256: '8'.repeat(64) },
      ...['agents','arguments','author','binary','evidence','harness','lifecycle','mcp','proxy','results','runner'].map(name => ({ path: `core/${name}.mjs`, sha256: 'c'.repeat(64) })),
      ...['index','scenarios','state','fixtures','policy','evaluate'].map(name=>({path:`suites/task-repair/${name}.mjs`,sha256:'d'.repeat(64)})),
      { path: 'reporting/html.mjs', sha256: 'e'.repeat(64) },
    ], promptFiles: [{ path: 'example/persona.md', sha256: 'f'.repeat(64) }, { path: 'example/workflow.workflow.yaml', sha256: '1'.repeat(64) }] },
  };
  mutate(evidence);
  for (const [name, value] of Object.entries({ 'summary.json': evidence.summary, 'charter.json': evidence.charter,
    'scenario-snapshot.json': evidence.scenarios, 'source-manifest.json': evidence.sourceManifest })) {
    if (value !== undefined) fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2));
  }
  return evidence;
}
