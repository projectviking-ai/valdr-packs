import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { evidenceFixture, saveProviderEvents } from './fixtures.mjs';
import { loadEvidence } from '../../reporting/evidence.mjs';
import { buildReport, renderTextReport } from '../../reporting/report.mjs';

test('saved report includes scenario, author, assertions, cleanup, and source details inline', t => {
  const fixture = evidenceFixture(t, evidence => {
    evidence.scenarios[1].findings = [{ target: 'checklist', proposedFix: 'Use the approved replacement' }];
    evidence.summary.results[1].projectKey = 'EVAL-2';
    evidence.summary.results[1].cleanup = { ok: true, deletedProject: 'EVAL-2', verified: ['project absent'] };
    Object.assign(evidence.summary.results[1].attempts[0], {
      author: { durationMs: 200, finalMessage: 'Applied the replacement',
        submission: { path: '/unread/submission.json', sha256: 'a'.repeat(64), bytes: 42 } },
    });
  });
  saveProviderEvents(fixture, [{ type: 'item.completed', item: { id: 'item_0', type: 'mcp_tool_call', server: 'valdr', tool: 'pm_task', arguments: { action: 'update' }, result: null, error: null, status: 'completed' } }], 'beta');
  const report = buildReport(loadEvidence(fixture.directory));
  assert.equal(report.context?.charter?.maxRepairs, 1);
  assert.equal(report.context.sourceManifest.promptFiles[0].path, 'example/persona.md');
  assert.equal(report.context.summary.completedAt, '2026-10-16T12:00:00Z');
  assert.equal(Object.hasOwn(report.context.summary, 'results'), false);
  const scenario = report.cases[1];
  assert.equal(scenario.definition.brief, 'Second fixture');
  assert.equal(scenario.definition.findings[0].proposedFix, 'Use the approved replacement');
  assert.deepEqual(scenario.cleanupReceipt, { ok: true, deletedProject: 'EVAL-2', verified: ['project absent'] });
  assert.equal(scenario.evidence.projectKey, 'EVAL-2');
  assert.equal(Object.hasOwn(scenario.evidence, 'attempts'), false);
  assert.equal(Object.hasOwn(scenario.evidence, 'cleanup'), false);
  const attempt = scenario.attempts[0].evidence;
  assert.equal(attempt.author.finalMessage, 'Applied the replacement');
  assert.equal(scenario.attempts[0].activity[0].item.tool, 'pm_task');
  assert.deepEqual(attempt.evaluation.variants[0].assertions[0], {
    pass: false, message: 'Expected the approved replacement', actual: 'old', expected: 'new',
  });
  assert.deepEqual(attempt.author.submission, { path: '/unread/submission.json', sha256: 'a'.repeat(64), bytes: 42 });
  assert.equal(report.metrics.firstCandidatePassed, 1);
  assert.equal(report.metrics.eventuallyPassed, 2);
});

test('all embedded evidence redacts nested credentials including serialized event payloads', t => {
  const fixture = evidenceFixture(t, evidence => {
    evidence.charter.connection = { apiKey: 'charter-secret-value' };
    evidence.sourceManifest.metadata = { authToken: 'manifest-secret-value' };
    evidence.summary.metadata = { password: 'summary-secret-value' };
    evidence.scenarios[0].fixture = { authorization: 'scenario-secret-value' };
    const result = evidence.summary.results[0];
    result.metadata = { secret: 'case-secret-value' };
    result.cleanup.receipt = { authKey: 'cleanup-secret-value' };
    result.attempts[0].evaluation.variants = [{ id: 'alpha', ok: true, assertions: [{ pass: true, message: 'Credentials checked', actual: { password: 'assertion-secret-value' }, expected: { present: true } }] }];
  });
  saveProviderEvents(fixture, [{ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: '{"credentials":{"apiKey":"event-secret-value"},"usage":{"tokens":123}}' } }]);
  const evidence = loadEvidence(fixture.directory);
  const report = buildReport(evidence);
  assert.equal(report.context?.charter?.connection?.apiKey, '[REDACTED]');
  assert.equal(report.context.sourceManifest.metadata.authToken, '[REDACTED]');
  assert.equal(report.context.summary.metadata.password, '[REDACTED]');
  assert.equal(report.cases[0].definition.fixture.authorization, '[REDACTED]');
  assert.equal(report.cases[0].evidence.metadata.secret, '[REDACTED]');
  assert.equal(report.cases[0].cleanupReceipt.receipt.authKey, '[REDACTED]');
  assert.deepEqual(JSON.parse(report.cases[0].attempts[0].activity[0].item.text), { credentials: { apiKey: '[REDACTED]' }, usage: { tokens: 123 } });
  assert.equal(report.cases[0].attempts[0].evidence.evaluation.variants[0].assertions[0].actual.password, '[REDACTED]');
  assert.doesNotMatch(JSON.stringify(report), /secret-value/);
  assert.equal(evidence.charter.connection.apiKey, 'charter-secret-value');
});

for (const mode of ['check', 'replay']) test(`${mode} report exposes recorded evaluation and cleanup without inventing agent measurements`, t => {
  const fixture = evidenceFixture(t, evidence => {
    evidence.charter.mode = mode;
    delete evidence.summary.results;
    evidence.summary.evaluation = { ok: true, variants: [{ id: 'probe', ok: true, assertions: [{ pass: true, message: 'Expected output', actual: 'ready', expected: 'ready' }] }] };
    evidence.summary.cleanup = { ok: true, deletedProject: 'PROBE' };
  });
  const report = buildReport(loadEvidence(fixture.directory));
  assert.equal(report.context?.summary?.evaluation?.variants?.[0]?.assertions?.[0]?.actual, 'ready');
  assert.deepEqual(report.context.summary.cleanup, { ok: true, deletedProject: 'PROBE' });
  assert.equal(report.metrics, null);
  assert.deepEqual(report.cases, []);
  assert.match(renderTextReport(report), /not an agent performance score/);
  assert.doesNotMatch(renderTextReport(report), /First attempt:/);
});

test('unstarted case retains its frozen definition while incomplete scores and text remain unchanged', t => {
  const fixture = evidenceFixture(t, evidence => {
    evidence.summary.outcome = 'cancelled';
    evidence.summary.ok = false;
    delete evidence.summary.completedAt;
    evidence.summary.results = [{ scenarioId: 'alpha', title: 'First case', cancelled: true, cleanup: { ok: true }, attempts: [{ attempt: 1, infrastructureError: 'Interrupted' }] }];
  });
  const evidence = loadEvidence(fixture.directory);
  const before = renderTextReport(buildReport(evidence));
  evidence.scenarios[1].brief = 'The selected test never started';
  const report = buildReport(evidence);
  assert.equal(report.cases[1].definition?.brief, 'The selected test never started');
  assert.equal(report.cases[1].cleanupReceipt, null);
  assert.equal(report.cases[1].evidence, null);
  assert.equal(report.cases[1].outcome, 'not_started');
  assert.equal(report.cases[1].firstPassed, null);
  assert.equal(report.cases[1].eventualPassed, null);
  assert.equal(report.outcome, 'cancelled');
  assert.equal(report.complete, false);
  assert.equal(renderTextReport(report), before);
});

test('deeply nested saved metadata remains reportable with explicit omitted detail', t => {
  const fixture = evidenceFixture(t);
  const before = renderTextReport(buildReport(loadEvidence(fixture.directory)));
  const nested = '{"child":'.repeat(5000) + '{"apiKey":"deep-secret-value"}' + '}'.repeat(5000);
  fs.writeFileSync(path.join(fixture.directory, 'source-manifest.json'), `{"metadata":${nested},"apiKey":"manifest-secret-value"}`);
  const report = buildReport(loadEvidence(fixture.directory));
  assert.match(JSON.stringify(report.context.sourceManifest.metadata), /Nested evidence omitted/);
  assert.equal(report.context.sourceManifest.apiKey, '[REDACTED]');
  assert.doesNotMatch(JSON.stringify(report), /secret-value/);
  assert.equal(renderTextReport(report), before);
});

test('deep serialized payloads are bounded before redaction without dropping scored assertions', t => {
  const nested = '{"child":'.repeat(5000) + '{"password":"deep-secret-value"}' + '}'.repeat(5000);
  const fixture = evidenceFixture(t, evidence => {
    const attempt = evidence.summary.results[0].attempts[0];
    attempt.evaluation.variants = [{ id: 'alpha', ok: true, assertions: Array.from({ length: 150 }, (_, index) => ({ pass: true, message: `Assertion ${index + 1}`, actual: 'ready', expected: 'ready' })) }];
  });
  saveProviderEvents(fixture, [{ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: `{"apiKey":"event-secret-value","nested":${nested}}` } }]);
  const report = buildReport(loadEvidence(fixture.directory));
  const attempt = report.cases[0].attempts[0].evidence;
  assert.equal(JSON.parse(report.cases[0].attempts[0].activity[0].item.text).apiKey, '[REDACTED]');
  assert.match(report.cases[0].attempts[0].activity[0].item.text, /Nested evidence omitted/);
  assert.doesNotMatch(JSON.stringify(report), /secret-value/);
  assert.equal(attempt.evaluation.variants[0].assertions.length, 150);
  assert.ok(attempt.evaluation.variants[0].assertions.every(assertion => assertion.pass));
  assert.equal(report.metrics.firstCandidatePassed, 1);
  assert.equal(report.metrics.eventuallyPassed, 2);
});
