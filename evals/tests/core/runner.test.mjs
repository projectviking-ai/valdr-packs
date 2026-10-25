import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createLifecycle } from '../../core/lifecycle.mjs';

// These tests inject the external Valdr/provider boundary; the trial and evidence code is real.
import * as runner from '../../core/runner.mjs';
import { selectProfile } from '../../cli/config.mjs';
const profile = selectProfile('sol-high');
const options = { valdrBin: 'valdr', maxRepairs: 1, timeoutMs: 1000, tier: 'sovereign' };

function setup(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-trials-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const launches = [], closed = [], prepared = [], created = [];
  const suite = {
    id: 'state-suite', version: 1, defaultAgent: 'agent.yaml', requiredTools: ['pm_task'],
    scenarios: [{ id: 'one', title: 'First task' }, { id: 'two', title: 'Second task' }],
    policy: context => (_method, params) => params?.arguments?.taskKey === context.taskKey,
    prepare: async (env, { scenario }) => { const context = { taskKey: scenario.id }; prepared.push(context); return context; },
    prompt: ({ context }) => `Repair ${context.taskKey}`,
    beforeAttempt: async ({ context }) => ({ taskKey: context.taskKey, before: true }),
    evaluate: async ({ beforeState, authored }) => ({ ok: authored.finalMessage === 'pass', beforeState }),
    feedback: () => 'Try again using the reported findings',
    ...overrides.suite,
  };
  const dependencies = {
    createIsolatedEnvironment: async args => {
      const index = created.length;
      const repoRoot = path.join(directory, `owned-${index}`, 'repo');
      fs.mkdirSync(repoRoot, { recursive: true });
      const env = { repoRoot, home: path.dirname(repoRoot), broker: { requests: [] }, ...args,
        close: async () => { closed.push(index); return { ok: true, authorityClosed: true }; } };
      created.push(env);
      return env;
    },
    installAgent: async () => ({ handle: 'test-agent', role: 'executor' }),
    runAgentTurn: async (env, args) => {
      launches.push({ env, ...args });
      return { settled: true, sessionUlid: `session-${args.scenarioId}`, finalMessage: args.scenarioId === 'one' && !args.sessionUlid ? 'fail' : 'pass', events: [] };
    },
    ...overrides.dependencies,
  };
  return { input: { options, suite, selected: suite.scenarios, directory, packsRoot: directory, profile }, dependencies, launches, closed, prepared, created };
}

test('isolates scenarios, continues repairs, and retains first-attempt results and states', async t => {
  const fixture = setup(t);
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.ok, true);
  assert.equal(result.firstCandidatePassed, 1);
  assert.equal(result.eventuallyPassed, 2);
  assert.equal(result.repairsUsed, 1);
  assert.deepEqual(fixture.closed, [0, 1]);
  assert.equal(fixture.launches[1].sessionUlid, 'session-one');
  assert.equal(fixture.launches[2].sessionUlid, undefined);
  assert.notEqual(fixture.launches[0].env.home, fixture.launches[2].env.home);
  assert.equal(fixture.created[0].requestAllowed('tools/call', { arguments: { taskKey: 'one' } }), true);
  assert.equal(fixture.created[0].requestAllowed('tools/call', { arguments: { taskKey: 'two' } }), false);
  const first = JSON.parse(fs.readFileSync(path.join(fixture.input.directory, 'one/attempt-1/result.json')));
  assert.equal(first.evaluation.ok, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture.input.directory, 'one/attempt-1/before-state.json'))), { taskKey: 'one', before: true });
});

for (const failure of ['prepare', 'provider', 'evaluate', 'cleanup']) {
  test(`closes owned environments and reports ${failure} failure without claiming a pass`, async t => {
    const overrides = failure === 'prepare' ? { suite: { prepare: async () => { throw new Error('fixture unavailable'); } } }
      : failure === 'evaluate' ? { suite: { evaluate: async () => { throw new Error('state read unavailable'); } } }
      : failure === 'provider' ? { dependencies: { runAgentTurn: async () => ({ settled: true, error: 'provider failed', events: [] }) } } : {};
    const fixture = setup(t, overrides);
    fixture.input.selected = [fixture.input.suite.scenarios[0]];
    if (failure === 'cleanup') {
      const create = fixture.dependencies.createIsolatedEnvironment;
      fixture.dependencies.createIsolatedEnvironment = async args => {
        const env = await create(args);
        env.close = async () => { fixture.closed.push(0); throw new Error('did not close'); };
        return env;
      };
    }
    const result = await runner.runTrials(fixture.input, fixture.dependencies);
    assert.equal(result.ok, false);
    assert.equal(result.infrastructureIncomplete, 1);
    assert.deepEqual(fixture.closed, [0]);
    if (failure !== 'cleanup') assert.equal(result.authorScenariosEvaluated, 0);
  });
}

function authoredFileTrial(t, { candidate } = {}) {
  const fixture = setup(t, {
    suite: { submissionFile: 'candidate.json',
      captureState: async ({ environment }) => { fs.writeFileSync(path.join(environment.repoRoot, 'candidate.json'), '{"value":"later"}'); return {}; },
      evaluate: async ({ submission }) => ({ ok: submission.value === 'original' }),
    },
    dependencies: { runAgentTurn: async environment => {
      if (candidate !== undefined) fs.writeFileSync(path.join(environment.repoRoot, 'candidate.json'), candidate);
      return { settled: true, sessionUlid: 'session', finalMessage: 'Submitted', events: [] };
    } },
  });
  fixture.input.selected = [fixture.input.suite.scenarios[0]];
  fixture.input.options = { ...options, maxRepairs: 0 };
  return fixture;
}

test('a missing submission remains unscored even if the workspace later changes', async t => {
  const fixture = authoredFileTrial(t);
  fixture.input.options.maxRepairs = 1;
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.outcome, 'submission_incomplete');
  assert.equal(result.submissionIncomplete, 1);
  assert.equal(result.infrastructureIncomplete, 0);
  assert.equal(result.authorScenariosEvaluated, 0);
  assert.equal(result.repairsUsed, 0);
  const record = result.results[0].attempts[0];
  assert.deepEqual(record.submissionIncomplete, { reason: 'missing_submission', cause: 'undetermined' });
  assert.equal(record.author.submissionError.code, 'ENOENT');
  assert.equal(record.author.submissionError.path, path.join(fixture.created[0].repoRoot, 'candidate.json'));
});

test('invalid JSON is an evaluated submission failure, and the original bytes are retained', async t => {
  const fixture = authoredFileTrial(t, { candidate: '{bad json' });
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.outcome, 'candidate_failed');
  assert.equal(result.authorScenariosEvaluated, 1);
  assert.equal(result.infrastructureIncomplete, 0);
  assert.equal(result.submissionIncomplete, 0);
  assert.equal(fs.readFileSync(path.join(fixture.input.directory, 'one/attempt-1/submission.json'), 'utf8'), '{bad json');
});

test('captures a submission once beside all turn evidence and evaluates its immutable bytes', async t => {
  const fixture = authoredFileTrial(t, { candidate: '{"value":"original"}' });
  const captures = [];
  const write = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', (target, ...args) => {
    if (String(target).endsWith('/submission.json')) captures.push(target);
    return write(target, ...args);
  });
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  const attemptDir = path.join(fixture.input.directory, 'one/attempt-1');
  const record = result.results[0].attempts[0];
  assert.equal(result.outcome, 'passed');
  assert.deepEqual(captures, [path.join(attemptDir, 'submission.json')]);
  assert.equal(record.author.submission.path, path.join(attemptDir, 'submission.json'));
  assert.equal(fs.readFileSync(record.author.submission.path, 'utf8'), '{"value":"original"}');
  assert.equal(fs.statSync(record.author.submission.path).mode & 0o777, 0o444);
  for (const name of ['request.json', 'author.json', 'tool-requests.json']) {
    assert.ok(fs.existsSync(path.join(attemptDir, name)), `Missing attempt evidence: ${name}`);
  }
  assert.equal(fs.existsSync(path.join(fixture.input.directory, 'one/author/attempt-1')), false);
});

for (const { operation, code } of [
  { operation: 'writeFileSync', code: 'EIO' },
  { operation: 'writeFileSync', code: 'ENOSPC' },
  { operation: 'writeFileSync', code: 'EEXIST' },
  { operation: 'readFileSync', code: 'EIO' },
  { operation: 'readFileSync', code: 'ENOENT' },
]) test(`submission evidence ${operation} ${code} is infrastructure failure without scoring or repair`, async t => {
  const fixture = authoredFileTrial(t, { candidate: '{"value":"original"}' });
  fixture.input.options.maxRepairs = 1;
  const original = fs[operation];
  t.mock.method(fs, operation, (target, ...args) => {
    if (String(target).endsWith('/submission.json')) throw Object.assign(new Error(`Evidence ${operation} failed: ${code}`), { code, path: target });
    return original(target, ...args);
  });
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.authorScenariosEvaluated, 0);
  assert.equal(result.repairsUsed, 0);
  assert.equal(result.outcome, 'infrastructure_incomplete');
  assert.equal(result.infrastructureIncomplete, 1);
  assert.equal(result.submissionIncomplete, 0);
  assert.equal(result.results[0].attempts.length, 1);
  assert.match(result.results[0].attempts[0].infrastructureError, new RegExp(`Evidence ${operation} failed: ${code}`));
  assert.deepEqual(fixture.closed, [0]);
});

test('state capture failure retains the completed author and immutable submission evidence', async t => {
  const fixture = authoredFileTrial(t, { candidate: '{"value":"original"}' });
  fixture.input.options.maxRepairs = 1;
  fixture.input.suite.captureState = async () => { throw new Error('Persisted state unavailable'); };
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  const record = result.results[0].attempts[0];
  assert.equal(record.author?.sessionUlid, 'session');
  assert.equal(record.author.settled, true);
  const savedAuthor = JSON.parse(fs.readFileSync(path.join(fixture.input.directory, 'one/attempt-1/author.json'), 'utf8'));
  assert.equal(savedAuthor.sessionUlid, 'session');
  assert.deepEqual(savedAuthor.submission, record.author.submission);
  assert.equal(fs.readFileSync(savedAuthor.submission.path, 'utf8'), '{"value":"original"}');
  const savedSummary = JSON.parse(fs.readFileSync(path.join(fixture.input.directory, 'summary.json'), 'utf8'));
  assert.deepEqual(savedSummary.results[0].attempts[0].author.submission, savedAuthor.submission);
  assert.equal(result.outcome, 'infrastructure_incomplete');
  assert.equal(result.authorScenariosEvaluated, 0);
  assert.equal(result.repairsUsed, 0);
  assert.deepEqual(fixture.closed, [0]);
});

test('preflight needs fixture and registry tools without author session tools', async () => {
  let seeded = false, closed = false;
  const result = await runner.checkSuite({ directory: 'unused', suite: {
    id: 'task-suite', requiredTools: ['pm_health', 'pm_task'], scenarios: [{ id: 'one' }],
    check: async () => { seeded = true; },
  } }, { createIsolatedEnvironment: async ({ requiredTools }) => {
    assert.deepEqual(new Set(requiredTools), new Set(['pm_health', 'pm_task', 'pm_generate_ulid', 'pm_prompt', 'pm_capability', 'pm_agent']));
    return { close: async () => { closed = true; return { ok: true }; } };
  } });
  assert.equal(result.ok, true);
  assert.equal(seeded, true);
  assert.equal(closed, true);
});

test('suite can stop irreparable safety violations without spending repair turns', async t => {
  const fixture = setup(t, { suite: { stopOnSafetyRejection: true,
    evaluate: async () => ({ ok: false, safety: { safe: false, errors: ['forbidden write'] } }) } });
  fixture.input.selected = [fixture.input.suite.scenarios[0]];
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.ok, false);
  assert.equal(result.safetyRejected, 1);
  assert.equal(result.repairsUsed, 0);
  assert.equal(fixture.launches.length, 1);
});

test('captures persisted state even when the provider fails', async t => {
  const fixture = setup(t, { suite: { captureState: async () => ({ persisted: 'after' }) }, dependencies: {
    runAgentTurn: async () => { throw new Error('provider disconnected after mutation'); },
  } });
  fixture.input.selected = [fixture.input.suite.scenarios[0]];
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.infrastructureIncomplete, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fixture.input.directory,'one/attempt-1/after-state.json'))), { persisted: 'after' });
  assert.deepEqual(fixture.closed, [0]);
});

test('an evidence write failure still closes the owned authority', async t => {
  const fixture = setup(t);
  fixture.input.selected = [fixture.input.suite.scenarios[0]];
  const write = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', (target, ...args) => {
    if (String(target).endsWith('tool-requests.json')) throw new Error('evidence volume unavailable');
    return write(target, ...args);
  });
  await assert.rejects(runner.runTrials(fixture.input, fixture.dependencies), /evidence volume/);
  assert.deepEqual(fixture.closed, [0]);
});

test('transport failure is incomplete and never spends a repair turn', async t => {
  const fixture = setup(t, { suite: { evaluate: async () => { throw Object.assign(new Error('MCP disconnected'), { code: 'VALDR_EVAL_INFRASTRUCTURE' }); } } });
  fixture.input.selected = [fixture.input.suite.scenarios[0]];
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.outcome, 'infrastructure_incomplete');
  assert.equal(result.repairsUsed, 0);
  assert.equal(fixture.launches.length, 1);
});

for (const authored of [
  { finalMessage: 'pass' },
  { settled: false, finalMessage: 'pass' },
  { settled: 'true', finalMessage: 'pass' },
  { settled: true, finalMessage: 'pass', error: 'Turn failed' },
]) test(`unverified author completion ${JSON.stringify(authored)} prevents scoring and repairs`, async t => {
  let turns = 0;
  const fixture = setup(t, { dependencies: { runAgentTurn: async () => { turns++; return authored; } } });
  fixture.input.selected = [fixture.input.suite.scenarios[0]];
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.outcome, 'infrastructure_incomplete');
  assert.equal(result.authorScenariosEvaluated, 0);
  assert.equal(result.repairsUsed, 0);
  assert.equal(turns, 1);
  assert.equal(result.results[0].attempts.length, 1);
  assert.deepEqual(fixture.closed, [0]);
});

test('a missing author launcher never reaches scoring or a model turn', async t => {
  const fixture = setup(t, { suite: { evaluate: async () => { throw new Error('Must not evaluate'); } } });
  fixture.input.selected = [fixture.input.suite.scenarios[0]];
  fixture.dependencies.runAgentTurn = undefined;
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.outcome, 'infrastructure_incomplete');
  assert.equal(result.authorScenariosEvaluated, 0);
  assert.equal(result.repairsUsed, 0);
  assert.match(result.results[0].attempts[0].infrastructureError, /author launcher is unavailable/);
  assert.equal(fixture.launches.length, 0);
});

test('cancelled trial stops before another scenario and preserves partial evidence', async t => {
  const lifecycle = createLifecycle();
  const fixture = setup(t, { dependencies: { runAgentTurn: async () => {
    await lifecycle.cancel('SIGINT');
    lifecycle.throwIfCancelled();
  } } });
  fixture.input.options = { ...fixture.input.options, lifecycle };
  const result = await runner.runTrials(fixture.input, fixture.dependencies);
  assert.equal(result.outcome, 'cancelled');
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.results.length, 1);
  assert.deepEqual(fixture.closed, [0]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(fixture.input.directory,'summary.json'))).outcome,'cancelled');
});
