import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { TOOL_ID, TOOL_REVISION } from '../../tools/pr-feedback/contract.mjs';
import { decide, emptyState, normalizeState, formatAutomationBody } from '../../tools/pr-feedback/feedback.mjs';

const sha = 'a'.repeat(40);
const at = n => new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString();
const question = { body: 'Should the timeout change?', url: 'https://github.com/acme/widgets/pull/7#issuecomment-41', createdAt: at(1), headSha: sha, itemIds: ['ic:1'], answerAuthors: ['maintainer'], checkFix: true };
const item = (id, body, author = 'maintainer') => ({ id, body, author, createdAt: at(2), url: 'https://github.com/acme/widgets/pull/7#issuecomment-42' });
const tick = (over = {}) => decide({ state: { ...emptyState(), questions: [question] }, pr: { state: 'open', merged: false, headSha: sha, headAvailable: true }, items: [], checks: { pending: false, failing: [{ name: 'test' }] }, freshRequestId: 'request-1', now: at(3), ...over });

test('published questions survive reload and block only same-head CI retries', () => {
  const state = { ...emptyState(), questions: [question] };
  const saved = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(saved.questions, [question]);
  saved.questions[0].body = 'changed';
  assert.equal(state.questions[0].body, question.body);
  assert.equal(tick().decision, 'idle');
  const unrelated = tick({ items: [item('ic:2', 'Fix the spelling')] });
  assert.equal(unrelated.decision, 'dispatch');
  assert.equal(unrelated.nextState.inFlight.checkFix, false);
  assert.equal(tick({ pr: { state: 'open', headSha: 'b'.repeat(40), headAvailable: true } }).decision, 'dispatch');
});

test('only an allowed fresh answer reopens a question and carries its context', () => {
  const answer = item('ic:2', `Yes, regarding ${question.url}`);
  for (const wrong of [{ ...answer, author: 'someone-else' }, { ...answer, createdAt: at(0) }, { ...answer, body: question.url + '0' }, { ...answer, body: `<!-- ${question.url} -->` }]) {
    const result = tick({ items: [wrong] });
    assert.equal(result.nextState.inFlight.checkFix, false);
    assert.deepEqual(result.nextState.questions, [question]);
  }
  const result = tick({ items: [item('ic:1', 'Original finding'), answer] });
  assert.equal(result.nextState.inFlight.checkFix, true);
  assert.deepEqual(result.nextState.inFlight.itemIds, ['ic:1', 'ic:2']);
  assert.deepEqual(result.nextState.inFlight.questions, [question]);
  assert.deepEqual(result.nextState.questions, []);
  const done = tick({ state: result.nextState, round: { status: 'completed' } });
  assert.equal(done.nextState.inFlight, null);
  assert.deepEqual(done.nextState.questions, []);
});

test('thread replies answer only an unambiguous question', () => {
  const q = { ...question, threadRootId: 'rc:3' };
  const answer = { ...item('rc:4', 'Yes'), inReplyTo: 'rc:3' };
  assert.equal(tick({ state: { ...emptyState(), questions: [q] }, items: [answer] }).nextState.inFlight.checkFix, true);
  const result = tick({ state: { ...emptyState(), questions: [q, { ...q, url: question.url + '2' }] }, items: [answer] });
  assert.equal(result.nextState.inFlight.checkFix, false);
});

test('question checkpoint rejects malformed or oversized caller data', () => {
  for (const q of [{ ...question, checkFix: 'yes' }, { ...question, answerAuthors: [] }, { ...question, body: 'x'.repeat(1001) }, { ...question, url: 'file:///secret' }, { ...question, createdAt: 'yesterday' }, { ...question, headSha: '' }, { ...question, extra: true }]) {
    assert.throws(() => normalizeState({ ...emptyState(), questions: [q] }), { code: 'invalid_state' });
  }
});

const runner = fileURLToPath(new URL('../../tools/pr-feedback/runner.mjs', import.meta.url));
const fake = fileURLToPath(new URL('./fake-gh.mjs', import.meta.url));
const ok = value => ({ stdout: JSON.stringify(value) });
const root = 'repos/acme/widgets';
const comment = (id, body, login = 'maintainer') => ({ id, body, user: { login, type: 'User' }, author_association: 'MEMBER', html_url: `https://github.com/acme/widgets/pull/7#issuecomment-${id}`, created_at: at(2) });
function sandbox(t, overrides = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'portable-pr-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'bin'));
  const gh = path.join(dir, 'bin/gh');
  writeFileSync(gh, `#!/bin/sh\nexec "${process.execPath}" "${fake}" "$@"\n`);
  chmodSync(gh, 0o755);
  const fixture = path.join(dir, 'fixtures.json'), log = path.join(dir, 'calls.jsonl');
  writeFileSync(fixture, JSON.stringify({
    'GET user': ok({ login: 'automation' }),
    [`GET ${root}/pulls/7`]: ok({ state: 'open', merged: false, head: { sha, ref: 'feature', repo: { full_name: 'acme/widgets' } }, base: { ref: 'main', repo: { full_name: 'acme/widgets' } } }),
    [`GET ${root}/branches/feature`]: ok({ name: 'feature' }),
    [`GET ${root}/issues/7/comments`]: ok([[]]), [`GET ${root}/pulls/7/comments`]: ok([[]]), [`GET ${root}/pulls/7/reviews`]: ok([[]]),
    [`GET ${root}/commits/${sha}/check-runs`]: ok([{ total_count: 1, check_runs: [{ name: 'test', status: 'completed', conclusion: 'success' }] }]),
    ...overrides,
  }));
  return {
    run(action, input) {
      const result = spawnSync(process.execPath, [runner], { input: JSON.stringify({ protocolVersion: 1, toolId: TOOL_ID, toolRevision: TOOL_REVISION, operationId: 'op', attemptId: 'attempt', action, input }), encoding: 'utf8', timeout: 30000, env: { PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, FAKE_GH_FIXTURE: fixture, FAKE_GH_LOG: log } });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    },
    calls: () => existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [],
  };
}
const input = { owner: 'acme', repo: 'widgets', number: 7 };

test('collect retains question, inline location, URL and thread while removing hidden instructions', t => {
  const q = { ...question, threadRootId: 'rc:3' };
  const sb = sandbox(t, { [`GET ${root}/pulls/7/comments`]: ok([[{ ...comment(4, '<!-- hidden -->Yes'), path: 'src/check.js', line: 8, in_reply_to_id: 3 }]]) });
  const state = tick({ state: { ...emptyState(), questions: [q] }, items: [{ ...item('rc:4', 'Yes'), inReplyTo: 'rc:3' }] }).nextState;
  const result = sb.run('collect', { ...input, itemIds: ['rc:4'], headSha: sha, state });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.data.questions, [{ body: question.body, url: question.url, answerIds: ['rc:4'] }]);
  assert.equal(result.data.items[0].body, 'Yes');
  assert.equal(result.data.items[0].path, 'src/check.js');
  assert.equal(result.data.items[0].line, 8);
  assert.equal(result.data.items[0].inReplyTo, 'rc:3');
});

test('snapshot returns merge evidence but does not infer downstream closeout', t => {
  const merged = { state: 'closed', merged: true, head: { sha, ref: 'feature' }, base: { ref: 'stable', repo: { full_name: 'acme/widgets' } }, merge_commit_sha: 'b'.repeat(40), merged_at: at(4) };
  const sb = sandbox(t, { [`GET ${root}/pulls/7`]: ok(merged) });
  const result = sb.run('snapshot', { ...input, state: emptyState(), freshRequestId: 'request' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.prOutcome, 'merged');
  assert.deepEqual(result.data.mergeEvidence, { repository: 'acme/widgets', baseBranch: 'stable', headBranch: 'feature', headSha: sha, mergeCommitSha: 'b'.repeat(40), mergedAt: at(4) });
  assert.equal(sb.calls().length, 1);
});

test('contradictory merge data fails and unmerged closure has no merge evidence', t => {
  for (const over of [{ state: 'open', merged: true, merge_commit_sha: 'b'.repeat(40), merged_at: at(4) }, { state: 'closed', merged: true }, { state: 'closed', merged: true, merge_commit_sha: 'bad', merged_at: at(4) }, { state: 'closed', merged: false }]) {
    const sb = sandbox(t, { [`GET ${root}/pulls/7`]: ok({ head: { sha, ref: 'feature' }, base: { ref: 'main', repo: { full_name: 'acme/widgets' } }, ...over }) });
    const result = sb.run('snapshot', { ...input, state: emptyState(), freshRequestId: 'request' });
    if (over.merged) assert.equal(result.ok, false);
    else { assert.equal(result.ok, true); assert.equal(result.data.mergeEvidence, null); }
  }
});

test('a lost POST response is reconciled on retry; separate reply targets remain independent', t => {
  const target = 'notice:41';
  const endpoint = `${root}/issues/7/comments`;
  const published = comment(41, formatAutomationBody('Please clarify.', target), 'automation');
  const sb = sandbox(t, {
    [`GET ${endpoint}`]: ok([[comment(1, 'Finding')]]),
    [`POST ${endpoint}`]: { exitCode: 1, stderr: 'connection lost', after: { [`GET ${endpoint}`]: ok([[comment(1, 'Finding'), published]]) } },
  });
  const request = { ...input, replies: [{ itemId: 'ic:1', target, body: 'Please clarify.' }] };
  assert.equal(sb.run('reply', request).error.code, 'github_unavailable');
  const retried = sb.run('reply', request);
  assert.equal(retried.ok, true, JSON.stringify(retried));
  assert.equal(retried.data.results[0].outcome, 'existing');
  assert.equal(sb.calls().filter(call => call.key.startsWith('POST')).length, 1);
  assert.ok(sb.calls().find(call => call.key.startsWith('POST')).fields.body.includes('target=notice:41'));
  sb.run('reply', { ...input, replies: [{ itemId: 'ic:1', target: 'notice:42', body: 'Applied.' }] });
  assert.equal(sb.calls().filter(call => call.key.startsWith('POST')).length, 2);
});

test('a question posted during a round is not counted as a completed repair', () => {
  const inFlight = { requestId: 'r', itemIds: ['ic:1'], headSha: sha, checkFix: true, failureReported: false };
  const saved = tick({ state: { ...emptyState(), questions: [question], inFlight }, round: { status: 'completed' } }).nextState;
  assert.deepEqual(saved.handled, []);
  assert.deepEqual(saved.checkFix, { lastSha: null, attempts: 0 });
  const resumed = tick({ state: saved, items: [item('ic:1', 'Original'), item('ic:2', question.url)] });
  assert.equal(resumed.nextState.inFlight.checkFix, true);
  assert.deepEqual(resumed.nextState.inFlight.itemIds, ['ic:1', 'ic:2']);
});

test('a failed answer round retains its question context on explicit retry', () => {
  const items = [item('ic:1', 'Original'), item('ic:2', question.url)];
  const started = tick({ items }).nextState;
  const failed = tick({ state: started, round: { status: 'failed' }, items }).nextState;
  const retried = tick({ state: failed, items: [...items, { ...item('ic:3', 'Retry'), createdAt: at(4) }], now: at(5) });
  assert.deepEqual(retried.nextState.inFlight.questions, [question]);
});
