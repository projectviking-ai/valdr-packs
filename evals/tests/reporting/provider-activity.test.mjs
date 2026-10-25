import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { evidenceFixture, saveProviderEvents } from './fixtures.mjs';
import { loadEvidence } from '../../reporting/evidence.mjs';
import { buildReport } from '../../reporting/report.mjs';
import { renderHtmlReport } from '../../reporting/html.mjs';

const completedEvents = [
  { type: 'thread.started', thread_id: 'thread-public' },
  { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'I will read the isolated task.' } },
  { type: 'item.started', item: { id: 'item_1', type: 'mcp_tool_call', server: 'valdr', tool: 'pm_task', arguments: { action: 'get', taskKey: 'REPAIR-1' }, result: null, error: null, status: 'in_progress' } },
  { type: 'item.completed', item: { id: 'item_1', type: 'mcp_tool_call', server: 'valdr', tool: 'pm_task', arguments: { action: 'get', taskKey: 'REPAIR-1' }, result: { content: [{ type: 'text', text: 'Read the isolated task' }], structured_content: { task: { key: 'REPAIR-1' } } }, error: null, status: 'completed' } },
  { type: 'item.completed', item: { id: 'item_2', type: 'file_change', changes: [{ path: '/unread/submission.json', kind: 'add' }], status: 'completed' } },
  { type: 'item.completed', item: { id: 'item_3', type: 'agent_message', text: 'The approved change is ready.' } },
  { type: 'turn.completed', usage: { input_tokens: 200, cached_input_tokens: 100, output_tokens: 30 } },
];

test('completed public Codex sidecar activity appears in standalone HTML without inline author events', t => {
  const fixture = evidenceFixture(t);
  const file = saveProviderEvents(fixture, completedEvents);
  const before = fs.readFileSync(file, 'utf8');
  const report = buildReport(loadEvidence(fixture.directory));
  assert.deepEqual(report.cases[0].attempts[0].activity, completedEvents);
  const html = renderHtmlReport(report);
  for (const text of ['Session activity', '8 events', 'Thread started', 'Turn started', 'Agent message', 'valdr.pm_task', 'Tool call started', 'Tool call completed', 'Arguments', 'Result', 'REPAIR-1', 'Read the isolated task', 'File change', 'The approved change is ready.', 'Turn completed']) assert.ok(html.includes(text), text);
  assert.ok(html.indexOf('I will read the isolated task.') < html.indexOf('Read the isolated task'));
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.doesNotMatch(html, /href="[^"]*\.json(?:[?#][^"]*)?"|<script\b|<link\b|<iframe\b/);
  fs.rmSync(path.join(fixture.directory, 'alpha'), { recursive: true });
  assert.ok(html.includes('The approved change is ready.'));
});

test('interrupted public Codex sidecar shows messages, tool errors and failed turns without an author receipt', t => {
  const fixture = evidenceFixture(t, evidence => {
    evidence.summary.ok = false; evidence.summary.outcome = 'infrastructure_incomplete';
    evidence.summary.results[0].attempts = [{ attempt: 1, infrastructureError: 'Author process interrupted' }];
  });
  saveProviderEvents(fixture, [
    ...completedEvents.slice(0, 4),
    { type: 'item.completed', item: { id: 'item_1', type: 'mcp_tool_call', server: 'valdr', tool: 'pm_task', arguments: { action: 'get' }, result: null, error: { message: 'Transport disconnected <retry>' }, status: 'failed' } },
    { type: 'error', message: 'Provider stream interrupted' },
    { type: 'turn.failed', error: { message: 'Unable to finish the requested turn' } },
  ]);
  const report = buildReport(loadEvidence(fixture.directory));
  const html = renderHtmlReport(report);
  for (const text of ['7 events', 'I will read the isolated task.', 'Tool call failed', 'valdr.pm_task', 'Tool error', 'Transport disconnected &lt;retry&gt;', 'Provider error', 'Provider stream interrupted', 'Turn failed', 'Unable to finish the requested turn']) assert.ok(html.includes(text), text);
  assert.equal(report.cases[0].firstPassed, null);
  assert.equal(report.cases[0].attempts[0].durationMs, null);
  assert.doesNotMatch(html, /Transport disconnected <retry>/);
});

test('activity stays attached to its saved case and attempt', t => {
  const fixture = evidenceFixture(t);
  saveProviderEvents(fixture, [{ type: 'error', message: 'First beta attempt' }], 'beta', 1);
  saveProviderEvents(fixture, [{ type: 'turn.started' }], 'beta', 2);
  const report = buildReport(loadEvidence(fixture.directory));
  assert.equal(report.cases[0].attempts[0].activity, null);
  assert.equal(report.cases[1].attempts[0].activity[0].message, 'First beta attempt');
  assert.equal(report.cases[1].attempts[1].activity[0].type, 'turn.started');
});

test('absent and empty provider sidecars state exactly what activity was saved', t => {
  const fixture = evidenceFixture(t);
  saveProviderEvents(fixture, []);
  const report = buildReport(loadEvidence(fixture.directory));
  assert.deepEqual(report.cases[0].attempts[0].activity, []);
  assert.equal(report.cases[1].attempts[0].activity, null);
  const html = renderHtmlReport(report);
  assert.match(html, /No provider events were recorded/);
  assert.match(html, /Provider activity was not saved/);
  assert.equal(report.complete, true);
});

test('provider activity is redacted and escaped before embedding, with late events retained', t => {
  const fixture = evidenceFixture(t);
  const events = Array.from({ length: 120 }, (_, index) => ({ type: 'item.completed', item: { id: `item_${index}`, type: 'agent_message', text: `Message ${index}` } }));
  events.push({ type: 'item.completed', item: { id: 'tool', type: 'mcp_tool_call', server: 'valdr', tool: '<img src=x onerror=alert(1)>', arguments: { apiKey: 'provider-secret-value' }, result: { content: [{ type: 'text', text: '{"password":"serialized-secret-value","output":"Late tool result"}' }] }, error: null, status: 'completed' } });
  events.push({ type: 'turn.failed', error: { message: 'Late failure Bearer secret-bearer-value' } });
  saveProviderEvents(fixture, events);
  const report = buildReport(loadEvidence(fixture.directory));
  const html = renderHtmlReport(report);
  assert.match(html, /Late tool result/);
  assert.match(html, /Late failure Bearer \[REDACTED\]/);
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(html, /<img src=x|provider-secret-value|serialized-secret-value|secret-bearer-value/);
  assert.equal(report.cases[0].attempts[0].activity.length, 122);
});

test('offline sidecars redact plaintext credentials in agent messages and tool result and error text', t => {
  const fixture = evidenceFixture(t);
  const file = saveProviderEvents(fixture, [
    { type: 'item.completed', item: { id: 'message', type: 'agent_message', text: 'Command returned api_key=synthetic-secret-1234567890; taskKey=REPAIR-1' } },
    { type: 'item.completed', item: { id: 'tool', type: 'mcp_tool_call', server: 'valdr', tool: 'pm_task', arguments: { action: 'get', taskKey: 'REPAIR-1' },
      result: { content: [{ type: 'text', text: 'Tool result: "access_token"="synthetic-result-secret"; input_tokens=200; output_tokens=30' }] },
      error: { message: "Tool error 'password' = 'synthetic error password'; status=failed" }, status: 'failed' } },
  ]);
  const original = fs.readFileSync(file, 'utf8');
  const report = buildReport(loadEvidence(fixture.directory));
  const activity = report.cases[0].attempts[0].activity;
  assert.equal(activity[0].item.text, 'Command returned api_key=[REDACTED]; taskKey=REPAIR-1');
  assert.equal(activity[1].item.result.content[0].text, 'Tool result: "access_token"="[REDACTED]"; input_tokens=200; output_tokens=30');
  assert.equal(activity[1].item.error.message, "Tool error 'password' = '[REDACTED]'; status=failed");
  const html = renderHtmlReport(report);
  assert.doesNotMatch(html, /synthetic-secret-1234567890|synthetic-result-secret|synthetic error password/);
  for (const text of ['api_key=[REDACTED]', 'input_tokens=200', 'output_tokens=30', 'status=failed', 'REPAIR-1']) assert.ok(html.includes(text), text);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

for (const invalid of [{ events: [] }, [null], [{}], [{ type: '' }], [{ type: 'item.completed', item: null }], [{ type: 'item.completed', item: { type: 'mcp_tool_call', tool: {} } }]]) test(`invalid provider event sidecar rejects ${JSON.stringify(invalid)}`, t => {
  const fixture = evidenceFixture(t);
  saveProviderEvents(fixture, invalid);
  assert.throws(() => loadEvidence(fixture.directory), /provider-events\.json.*(array|event|item)/i);
});

for (const component of ['alpha', 'alpha/attempt-1', 'alpha/attempt-1/provider-events.json']) test(`provider event loader refuses symlink at ${component}`, t => {
  const fixture = evidenceFixture(t);
  const outside = path.join(fixture.directory, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'events.json'), JSON.stringify(completedEvents));
  const link = path.join(fixture.directory, component);
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(component.endsWith('.json') ? path.join(outside, 'events.json') : outside, link);
  assert.throws(() => loadEvidence(fixture.directory), /provider-events\.json.*(symbolic link|symlink)/i);
});

test('provider event loader rejects oversized files before parsing and names malformed source files', t => {
  const fixture = evidenceFixture(t);
  const file = saveProviderEvents(fixture, []);
  fs.truncateSync(file, 64 * 1024 * 1024 + 1);
  assert.throws(() => loadEvidence(fixture.directory), /provider-events\.json.*64 MiB/);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => loadEvidence(fixture.directory), /provider-events\.json.*JSON/);
});

test('provider event loader rejects non-files and excessive event counts', t => {
  const fixture = evidenceFixture(t);
  const file = saveProviderEvents(fixture, []);
  fs.unlinkSync(file); fs.mkdirSync(file);
  assert.throws(() => loadEvidence(fixture.directory), /provider-events\.json.*regular file/i);
  fs.rmdirSync(file);
  fs.writeFileSync(file, JSON.stringify(Array.from({ length: 10001 }, () => ({ type: 'turn.started' }))));
  assert.throws(() => loadEvidence(fixture.directory), /provider-events\.json.*10000/);
});
