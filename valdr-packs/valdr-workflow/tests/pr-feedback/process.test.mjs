import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as feedback from '../../tools/pr-feedback/feedback.mjs';
import { FORBIDDEN_BODY_PATTERN, TOOL_REVISION } from '../../tools/pr-feedback/contract.mjs';
import { runRequest } from '../../tools/pr-feedback/runner.mjs';
import { HEADER, emptyState, formatAutomationBody } from '../../tools/pr-feedback/feedback.mjs';

const runner = fileURLToPath(new URL('../../tools/pr-feedback/runner.mjs', import.meta.url));
const fakeGh = fileURLToPath(new URL('./fake-gh.mjs', import.meta.url));

const TOOL_ID = 'valdr-workflow.user.pr-feedback';
const REPO = 'repos/acme/widgets';
const SHA = 'a'.repeat(40);
const BRANCH = 'feature/pr-watch';
const ACCEPT = 'Accept: application/vnd.github+json';

const request = (action, input) => ({ protocolVersion: 1, toolId: TOOL_ID, toolRevision: TOOL_REVISION, action, input, operationId: 'test-operation', attemptId: 'test-attempt' });

/** Runs the real runner as a child process with `gh` resolved to fake-gh.mjs. */
function sandbox(t, fixtures = {}, extraEnv = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'pr-feedback-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  const shim = path.join(bin, 'gh');
  writeFileSync(shim, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fakeGh)} "$@"\n`);
  chmodSync(shim, 0o755);
  const fixture = path.join(dir, 'fixtures.json');
  const log = path.join(dir, 'calls.jsonl');
  writeFileSync(fixture, JSON.stringify(fixtures));
  const env = { PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_GH_FIXTURE: fixture, FAKE_GH_LOG: log, ...extraEnv };
  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []);
  const run = stdin => {
    const result = spawnSync(process.execPath, [runner], { cwd: dir, env, input: typeof stdin === 'string' ? stdin : JSON.stringify(stdin), encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim().split('\n').length, 1, 'exactly one envelope line');
    assert.ok(Buffer.byteLength(result.stdout) <= 1048576);
    assert.ok(Buffer.byteLength(result.stderr) <= 4096);
    return { envelope: JSON.parse(result.stdout), stdout: result.stdout, stderr: result.stderr, calls: calls() };
  };
  return { run };
}

const invoke = (t, action, input, fixtures, env) => sandbox(t, fixtures, env).run(request(action, input));
const succeeds = result => { assert.equal(result.envelope.ok, true, JSON.stringify(result.envelope)); return result.envelope.data; };
const fails = (result, code) => { assert.equal(result.envelope.ok, false, JSON.stringify(result.envelope)); assert.equal(result.envelope.error.code, code, JSON.stringify(result.envelope)); assert.equal(Object.hasOwn(result.envelope, 'data'), false); return result.envelope.error; };
const posts = calls => calls.filter(call => call.key.startsWith('POST '));

// fixtures ------------------------------------------------------------------------------------------------
const ok = value => ({ exitCode: 0, stdout: JSON.stringify(value), stderr: '' });
const pages = list => ok([list]);
const text = value => ({ exitCode: 0, stdout: value, stderr: '' });
const httpError = (status, message) => ({ exitCode: 1, stdout: JSON.stringify({ message }), stderr: `gh: ${message} (HTTP ${status})\n` });
const pull = (over = {}) => ({ state: 'open', merged: false, head: { sha: SHA, ref: BRANCH, repo: { full_name: 'acme/widgets' } }, base: { ref: 'main', repo: { full_name: 'acme/widgets' } }, ...(over.merged ? { merge_commit_sha: 'b'.repeat(40), merged_at: at(5) } : {}), ...over });
const base = (over = {}) => ({
  'GET user': ok({ login: 'automation' }),
  [`GET ${REPO}/pulls/7`]: ok(pull()),
  [`GET ${REPO}/branches/${BRANCH}`]: ok({ name: BRANCH }),
  [`GET ${REPO}/issues/7/comments`]: pages([]),
  [`GET ${REPO}/pulls/7/reviews`]: pages([]),
  [`GET ${REPO}/pulls/7/comments`]: pages([]),
  [`GET ${REPO}/commits/${SHA}/check-runs`]: ok([{ total_count: 0, check_runs: [] }]),
  ...over,
});

const at = minute => new Date(Date.UTC(2026, 9, 1, 0, minute)).toISOString();
const person = (login = 'dev', type = 'User') => ({ login, type });
const comment = (id, over = {}) => ({ id, user: person(), author_association: 'MEMBER', body: `comment ${id}`, html_url: `https://github.com/acme/widgets/pull/7#issuecomment-${id}`, created_at: at(id), ...over });
const review = (id, over = {}) => ({ id, user: person(), author_association: 'MEMBER', body: `review ${id}`, html_url: `https://github.com/acme/widgets/pull/7#pullrequestreview-${id}`, submitted_at: at(id), state: 'COMMENTED', ...over });
const inline = (id, over = {}) => ({ id, user: person(), author_association: 'MEMBER', body: `inline ${id}`, html_url: `https://github.com/acme/widgets/pull/7#discussion_r${id}`, created_at: at(id), path: 'src/a.js', line: 12, ...over });
const job = (id, over = {}) => ({ id, name: `job-${id}`, status: 'completed', conclusion: 'failure', html_url: `https://github.com/acme/widgets/actions/runs/9/job/${id}`, app: { slug: 'github-actions' }, ...over });
const checkRuns = runs => ok([{ total_count: runs.length, check_runs: runs }]);
const lines = (count, make) => `${Array.from({ length: count }, (_, index) => make(index + 1)).join('\n')}\n`;

const HEAD = '0123456789abcdef0123456789abcdef01234567';
const collectInput = (over = {}) => ({ owner: 'acme', repo: 'widgets', number: 7, itemIds: [], headSha: HEAD, ...over });
const snapshotInput = (over = {}) => ({ owner: 'acme', repo: 'widgets', number: 7, state: emptyState(), freshRequestId: 'req-fresh', ...over });
const replyInput = replies => ({ owner: 'acme', repo: 'widgets', number: 7, replies });
const commentInput = (over = {}) => ({ owner: 'acme', repo: 'widgets', number: 7, target: 'pr:7', body: 'Checks look green.', ...over });

// protocol ------------------------------------------------------------------------------------------------
test('runner rejects mismatched toolId, revision or action with invalid_request', t => {
  const sb = sandbox(t, base());
  const valid = request('observe', { state: emptyState(), sessions: [], implementationSessionUlid: 'impl', taskKey: 'task-1' });
  for (const [key, value] of [['protocolVersion', 2], ['toolId', 'valdr-tools.user.decide'], ['toolRevision', '0.0.0'], ['action', 'unknown'], ['action', undefined], ['operationId', undefined], ['attemptId', '']]) {
    const result = sb.run({ ...valid, [key]: value });
    fails(result, 'invalid_request');
    assert.deepEqual(result.calls, []);
  }
  for (const body of [null, [], 'text', 7]) fails(sb.run(JSON.stringify(body)), 'invalid_request');
});

test('malformed JSON and oversized stdin return bounded errors', t => {
  const sb = sandbox(t, base());
  fails(sb.run('{not json'), 'invalid_request');
  fails(sb.run(''), 'invalid_request');
  fails(sb.run(JSON.stringify({ padding: 'x'.repeat(1048576) })), 'input_limit');
  fails(sb.run('é'.repeat(524289)), 'input_limit');
});

test('invalid input is rejected before any gh call', t => {
  const sb = sandbox(t, base());
  const identify = { owner: 'acme', repo: 'widgets', number: 7, headBranch: BRANCH };
  const cases = [
    ['identify', { ...identify, owner: '../acme' }],
    ['identify', { ...identify, owner: 'a/b' }],
    ['identify', { ...identify, repo: '..' }],
    ['identify', { ...identify, repo: 'wid gets' }],
    ['identify', { ...identify, number: 0 }],
    ['identify', { ...identify, number: '7' }],
    ['identify', { ...identify, headBranch: '' }],
    ['identify', { ...identify, extra: true }],
    ['identify', { owner: 'acme', repo: 'widgets', number: 7 }],
    ['observe', {}],
    ['observe', { state: 'closed' }],
    ['snapshot', snapshotInput({ roundStatus: 'bogus' })],
    ['snapshot', snapshotInput({ roundStatus: null })],
    ['snapshot', snapshotInput({ freshRequestId: '' })],
    ['snapshot', snapshotInput({ freshRequestId: '   ' })],
    ['snapshot', { ...snapshotInput(), extra: 1 }],
    ['observe', { state: emptyState(), sessions: [], implementationSessionUlid: '', taskKey: 'task-1' }],
    ['collect', collectInput({ itemIds: Array.from({ length: 51 }, (_, index) => `ic:${index + 1}`) })],
    ['collect', collectInput({ itemIds: ['pr:7'] })],
    ['collect', collectInput({ itemIds: ['rc:01'] })],
    ['collect', collectInput({ itemIds: 'ic:1' })],
    ['collect', collectInput({ headSha: 'abc123' })],
    ['collect', collectInput({ headSha: HEAD.toUpperCase() })],
    ['collect', collectInput({ headSha: `${HEAD}0` })],
    ['collect', { ...collectInput(), extra: true }],
    ['collect', { owner: 'acme', repo: 'widgets', number: 7, itemIds: [] }],
    ['reply', replyInput([{ itemId: 'pr:7', body: 'x' }])],
    ['reply', replyInput([{ itemId: 'rc:1', body: '  ' }])],
    ['reply', replyInput([{ itemId: 'rc:1', body: 'x', extra: 1 }])],
    ['comment', commentInput({ target: 'xx:1' })],
    ['comment', commentInput({ target: 'rc:' })],
    ['comment', commentInput({ target: 'notice:' })],
    ['comment', commentInput({ target: 'notice:x' })],
    ['reply', replyInput([{ itemId: 'notice:1', body: 'x' }])],
    ['reply', replyInput([{ itemId: 'rc:01', body: 'x' }])],
    ['reply', { ...replyInput([{ itemId: 'rc:1', body: 'x' }]), allowedItemIds: 'rc:1' }],
    ['reply', { ...replyInput([{ itemId: 'rc:1', body: 'x' }]), allowedItemIds: ['pr:7'] }],
    ['reply', { ...replyInput([{ itemId: 'rc:1', body: 'x' }]), allowedItemIds: Array.from({ length: 51 }, (_, index) => `rc:${index + 1}`) }],
    ['reply', replyInput([{ itemId: 'ic:007', body: 'x' }])],
    ['reply', replyInput([{ itemId: `rv:${'1'.repeat(21)}`, body: 'x' }])],
    ['comment', commentInput({ target: 'pr:00' })],
    ['comment', commentInput({ target: 'notice:01' })],
    ['comment', commentInput({ target: 'ic:012' })],
    ['comment', commentInput({ body: '  ' })],
    ['comment', commentInput({ body: 'x'.repeat(30001) })],
    ['comment', commentInput({ body: 'null\0byte' })],
  ];
  for (const [action, input] of cases) fails(sb.run(request(action, input)), 'invalid_input');
  assert.deepEqual(sb.run(request('observe', { state: emptyState(), sessions: [], implementationSessionUlid: 'impl', taskKey: 'task-1' })).calls, []);
  const badState = sb.run(request('snapshot', snapshotInput({ state: { v: 2 } })));
  fails(badState, 'invalid_state');
  assert.deepEqual(badState.calls, []);
});

test('reply rejects a body that contains an automation marker', t => {
  const sb = sandbox(t, base());
  for (const body of [`Done.\n\n${feedback.MARKER_PREFIX} target=rc:9 -->`, `quoting ${feedback.MARKER_PREFIX}`]) {
    fails(sb.run(request('reply', replyInput([{ itemId: 'rc:200', body }]))), 'invalid_input');
    fails(sb.run(request('comment', commentInput({ body }))), 'invalid_input');
  }
  assert.deepEqual(sb.run(request('observe', { state: emptyState(), sessions: [], implementationSessionUlid: 'impl', taskKey: 'task-1' })).calls, [], 'nothing was read or posted');
});

test('reply rejects items outside allowedItemIds', t => {
  const sb = sandbox(t, replyFixtures());
  const outside = { ...replyInput([{ itemId: 'rc:200', body: 'Renamed.' }, { itemId: 'ic:100', body: 'Fixed it.' }]), allowedItemIds: ['rc:200'] };
  const rejected = sb.run(request('reply', outside));
  fails(rejected, 'invalid_input');
  assert.deepEqual(rejected.calls, [], 'nothing was read or posted, not even the allowed item');
  fails(sb.run(request('reply', { ...replyInput([{ itemId: 'rc:200', body: 'x' }]), allowedItemIds: [] })), 'invalid_input');

  const allowed = sb.run(request('reply', { ...outside, allowedItemIds: ['ic:100', 'rc:200', 'rv:300'] }));
  assert.deepEqual(succeeds(allowed).results.map(entry => [entry.itemId, entry.outcome]), [['rc:200', 'posted'], ['ic:100', 'posted']]);
  assert.equal(succeeds(sb.run(request('reply', { ...replyInput([]), allowedItemIds: [] }))).results.length, 0);
  assert.equal(succeeds(sb.run(request('reply', replyInput([{ itemId: 'rc:200', body: 'No list given.' }])))).results[0].outcome, 'posted', 'without allowedItemIds nothing changes');
});

test('reply rejects bodies with local paths or ULIDs', t => {
  const sb = sandbox(t, replyFixtures());
  const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const bodies = [
    'Fixed in /Users/alice/dev/widgets/src/a.js', 'See /home/runner/work/widgets/log', 'Tmp at /private/var/folders/ab/T/out', 'Wrote /private/tmp/session/notes',
    'Opened C:\\Users\\bob\\widgets\\a.js', `Run ${ulid} failed`, `(${ulid})`,
  ];
  for (const body of bodies) {
    fails(sb.run(request('reply', replyInput([{ itemId: 'rc:200', body }]))), 'invalid_input');
    fails(sb.run(request('comment', commentInput({ body }))), 'invalid_input');
  }
  assert.deepEqual(sb.run(request('observe', { state: emptyState(), sessions: [], implementationSessionUlid: 'impl', taskKey: 'task-1' })).calls, [], 'nothing was read or posted');
});

test('reply and comment accept urls with /home/ and /Users/ in the path', t => {
  const body = 'Docs: https://example.com/home/guide, https://github.com/acme/widgets/tree/main/docs/Users/guide.md and https://example.com:8080/private/tmp/x (see src/home/a.js). '
    + 'Also **https://example.com/Users/x**, _https://example.com/home/y_, |https://example.com/private/tmp/z|, https://example.com/~user/home/w and https://example.com/a_b/home/v.';
  const reply = invoke(t, 'reply', replyInput([{ itemId: 'rc:200', body }]), replyFixtures());
  assert.equal(succeeds(reply).results[0].outcome, 'posted');
  const posted = invoke(t, 'comment', commentInput({ body }), base({ [`POST ${REPO}/issues/7/comments`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-54' }) }));
  assert.equal(succeeds(posted).outcome, 'posted');
});

test('reply and comment reject inline-code and parenthesised local paths', t => {
  const sb = sandbox(t, replyFixtures());
  const bodies = [
    'Look at `/Users/me/dev/a.js` now', 'Output (/private/tmp/a) was empty', 'Open "/home/dev/x"', "Open '/home/dev/x'", '[log](/Users/me/x)', 'path=/home/runner/x',
    '<file:///home/x>', 'file:///Users/me/x', 'dir:/home/x', 'Wrote [/private/var/f]', 'first line\n/home/dev/x',
  ];
  for (const body of bodies) {
    fails(sb.run(request('reply', replyInput([{ itemId: 'rc:200', body }]))), 'invalid_input');
    fails(sb.run(request('comment', commentInput({ body }))), 'invalid_input');
  }
  assert.deepEqual(sb.run(request('observe', { state: emptyState(), sessions: [], implementationSessionUlid: 'impl', taskKey: 'task-1' })).calls, [], 'nothing was read or posted');
});

test('reply and comment reject local paths wrapped in markdown emphasis, tables or a home-directory tilde', t => {
  const sb = sandbox(t, replyFixtures());
  const bodies = ['Fixed **/Users/me/dev/a.js**', 'See _/home/dev/x_', '| file | |/home/dev/x| |', 'Wrote ~/private/tmp/notes', 'Bold */private/var/f*'];
  for (const body of bodies) {
    fails(sb.run(request('reply', replyInput([{ itemId: 'rc:200', body }]))), 'invalid_input');
    fails(sb.run(request('comment', commentInput({ body }))), 'invalid_input');
  }
  assert.deepEqual(sb.run(request('observe', { state: emptyState(), sessions: [], implementationSessionUlid: 'impl', taskKey: 'task-1' })).calls, [], 'nothing was read or posted');
});

test('reply and comment accept a normal body with a git sha and a url', t => {
  const body = 'Fixed in a94a8fe5ccb19ba61c4c0873d391e987982fbbd3, see https://github.com/acme/widgets/commit/a94a8fe5ccb19ba61c4c0873d391e987982fbbd3 and src/app.js:12 (run abcdefghijklmnopqrstuvwxyz, build ABCDEFGHIJKLMNOPQRSTUVWXYZ).';
  const reply = invoke(t, 'reply', replyInput([{ itemId: 'rc:200', body }]), replyFixtures());
  assert.equal(succeeds(reply).results[0].outcome, 'posted');
  assert.equal(posts(reply.calls)[0].fields.body, formatAutomationBody(body, 'rc:200'));
  const posted = invoke(t, 'comment', commentInput({ body }), base({ [`POST ${REPO}/issues/7/comments`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-53' }) }));
  assert.equal(succeeds(posted).outcome, 'posted');
});

test('unexpected failures keep credentials out of stderr and the envelope', () => {
  const secret = 'sentinel-secret-value-98765';
  const chunks = [];
  const write = process.stderr.write;
  process.stderr.write = chunk => { chunks.push(String(chunk)); return true; };
  let result;
  try { result = runRequest(request('identify', { get owner() { throw new Error(`boom ${secret}`); }, repo: 'widgets', number: 7, headBranch: BRANCH }), { env: { GH_TOKEN: secret } }); }
  finally { process.stderr.write = write; }
  fails({ envelope: result }, 'internal_error');
  assert.match(chunks.join(''), /boom \[REDACTED\]/);
  assert.equal(chunks.join('').includes(secret) || JSON.stringify(result).includes(secret), false);
});

// pure actions --------------------------------------------------------------------------------------------
test('observe is pure and never calls gh', t => {
  const result = sandbox(t).run(request('observe', { state: emptyState(), sessions: [], implementationSessionUlid: 'impl', taskKey: 'task-1' }));
  assert.deepEqual(succeeds(result), { state: emptyState(), roundStatus: '', sessionUlid: '', hasActive: 'no' });
  assert.deepEqual(result.calls, []);
});

test('identify returns normalized automation key', t => {
  const fixtures = base({ 'GET repos/Owner_X/Repo.Y/pulls/7': ok(pull({ head: { sha: SHA, ref: BRANCH, repo: { full_name: 'Owner_X/Repo.Y' } }, base: { ref: 'main', repo: { full_name: 'Owner_X/Repo.Y' } } })), [`GET repos/Owner_X/Repo.Y/branches/${BRANCH}`]: ok({ name: BRANCH }) });
  const result = invoke(t, 'identify', { owner: 'Owner_X', repo: 'Repo.Y', number: 7, headBranch: BRANCH }, fixtures);
  assert.deepEqual(succeeds(result), {
    outcome: 'watchable', owner: 'Owner_X', repo: 'Repo.Y',
    automationKey: 'valdr-workflow.pr-watch:owner_x.repo.y.7', resourceKey: 'Owner_X/Repo.Y#7', prState: 'open',
  });
  assert.ok(result.calls.every(call => call.key.startsWith('GET ')));
});

test('identify returns mismatch when headRefName differs', t => {
  const data = succeeds(invoke(t, 'identify', { owner: 'acme', repo: 'widgets', number: 7, headBranch: 'some/other-branch' }, base()));
  assert.equal(data.outcome, 'mismatch');
  assert.equal(data.prState, 'open');
  assert.equal(data.automationKey, 'valdr-workflow.pr-watch:acme.widgets.7');
  assert.equal(data.resourceKey, 'acme/widgets#7');
});

test('identify returns mismatch for a pull request from a fork', t => {
  const identify = { owner: 'acme', repo: 'widgets', number: 7, headBranch: BRANCH };
  for (const repo of [{ full_name: 'someone/widgets' }, null]) {
    const result = invoke(t, 'identify', identify, base({ [`GET ${REPO}/pulls/7`]: ok(pull({ head: { sha: SHA, ref: BRANCH, repo } })) }));
    const data = succeeds(result);
    assert.equal(data.outcome, 'mismatch', JSON.stringify(repo));
    assert.equal(data.prState, 'open');
    assert.equal(result.calls.some(call => call.key.includes('/branches/')), false, 'a fork head needs no branch lookup');
  }
  // The same repository spelled in another letter case is not a fork.
  assert.equal(succeeds(invoke(t, 'identify', identify, base({ [`GET ${REPO}/pulls/7`]: ok(pull({ head: { sha: SHA, ref: BRANCH, repo: { full_name: 'Acme/Widgets' } } })) }))).outcome, 'watchable');
  // A closed fork pull request is reported as not open.
  assert.equal(succeeds(invoke(t, 'identify', identify, base({ [`GET ${REPO}/pulls/7`]: ok(pull({ state: 'closed', head: { sha: SHA, ref: BRANCH, repo: { full_name: 'someone/widgets' } } })) }))).outcome, 'not_open');
});

test('identify returns not_open for closed and merged pull requests', t => {
  for (const merged of [false, true]) {
    const result = invoke(t, 'identify', { owner: 'acme', repo: 'widgets', number: 7, headBranch: 'some/other-branch' }, base({ [`GET ${REPO}/pulls/7`]: ok(pull({ state: 'closed', merged })), [`GET ${REPO}/branches/${BRANCH}`]: httpError(500, 'Server Error') }));
    const data = succeeds(result);
    assert.equal(data.outcome, 'not_open');
    assert.equal(data.prState, 'closed');
    assert.deepEqual(result.calls.map(call => call.key), [`GET ${REPO}/pulls/7`], 'a closed pull request needs no branch lookup');
  }
});

test('identify reports not_found for a missing pull request', t => {
  fails(invoke(t, 'identify', { owner: 'acme', repo: 'widgets', number: 7, headBranch: BRANCH }, { [`GET ${REPO}/pulls/7`]: httpError(404, 'Not Found') }), 'not_found');
});

// snapshot ------------------------------------------------------------------------------------------------
test('snapshot excludes automation comments and returns dispatch with items', t => {
  const fixtures = base({
    [`GET ${REPO}/issues/7/comments`]: ok([
      [comment(1, { body: 'Please rename the helper.' }), comment(2, { body: formatAutomationBody('Renamed.', 'ic:1') })],
      [comment(3, { user: person('ci[bot]', 'Bot'), author_association: 'NONE' }), comment(4, { author_association: 'CONTRIBUTOR' })],
    ]),
    [`GET ${REPO}/pulls/7/reviews`]: pages([review(10, { author_association: 'COLLABORATOR', state: 'CHANGES_REQUESTED', body: 'needs work' })]),
    [`GET ${REPO}/pulls/7/comments`]: pages([inline(20, { author_association: 'OWNER' }), inline(21, { body: formatAutomationBody('Done.', 'rc:20') })]),
  });
  const before = Date.now();
  const result = invoke(t, 'snapshot', snapshotInput(), fixtures);
  const data = succeeds(result);
  assert.equal(data.itemCount, 3);
  // Only the decision and the checkpoint come back: a dispatched round collects its own content.
  assert.deepEqual(Object.keys(data).sort(), ['cancelRound', 'decision', 'headSha', 'itemCount', 'mergeEvidence', 'nextState', 'notice', 'noticeTarget', 'prOutcome', 'prState', 'requestId']);
  assert.equal(data.decision, 'dispatch');
  assert.equal(data.cancelRound, 'no');
  assert.equal(data.prOutcome, 'open');
  assert.equal(data.prState, 'open');
  assert.equal(data.headSha, SHA);
  assert.equal(data.requestId, 'req-fresh');
  const { dispatchedAt, ...inFlight } = data.nextState.inFlight;
  assert.deepEqual(inFlight, { requestId: 'req-fresh', itemIds: ['ic:1', 'rv:10', 'rc:20'], headSha: SHA, checkFix: false, failureReported: false });
  assert.equal(new Date(dispatchedAt).toISOString(), dispatchedAt, 'the round is dated with an ISO timestamp');
  assert.ok(Date.parse(dispatchedAt) >= before && Date.parse(dispatchedAt) <= Date.now(), 'the runner supplies the current time');
  assert.equal(data.notice, '');
  assert.equal(data.noticeTarget, '');
  // Read-only, explicit media type, and every list endpoint is paginated.
  assert.ok(result.calls.length >= 6);
  for (const call of result.calls) {
    assert.equal(call.args[0], 'api');
    assert.ok(call.key.startsWith('GET '), call.key);
    assert.ok(call.headers.includes(ACCEPT), call.key);
    const listing = /\/(comments|reviews|check-runs)$/.test(call.key);
    assert.equal(call.args.includes('--paginate'), listing, call.key);
    assert.equal(call.args.includes('--slurp'), listing, call.key);
  }
});

test('snapshot treats absent and empty roundStatus as no round and passes a live status to decide', t => {
  const fixtures = base({ [`GET ${REPO}/issues/7/comments`]: pages([comment(1)]) });
  for (const input of [snapshotInput(), snapshotInput({ roundStatus: '' })]) {
    assert.equal(succeeds(invoke(t, 'snapshot', input, fixtures)).decision, 'dispatch');
  }
  const running = succeeds(invoke(t, 'snapshot', snapshotInput({ hasActive: 'yes' }), fixtures));
  assert.equal(running.decision, 'idle');
  assert.equal(running.requestId, '');
  assert.equal(Object.hasOwn(running, 'roundFeedback'), false);
  assert.equal(running.itemCount, 1);
  assert.equal(running.noticeTarget, '');
});

test('snapshot cancels and reports a round that has run longer than the stall limit', t => {
  const started = dispatchedAt => ({ ...emptyState(), inFlight: { requestId: 'req-1', runUlid: 'run-1', itemIds: ['ic:1'], headSha: SHA, checkFix: false, failureReported: false, dispatchedAt } });
  const stale = new Date(Date.now() - feedback.MAX_ROUND_MS - 60000).toISOString();
  const stalled = succeeds(invoke(t, 'snapshot', snapshotInput({ state: started(stale), roundStatus: 'running' }), base()));
  assert.equal(stalled.decision, 'report_failure');
  assert.equal(stalled.cancelRound, 'yes');
  assert.equal(stalled.noticeTarget, 'notice:1');
  assert.match(stalled.notice, /\(round_stalled\)/);
  assert.deepEqual(stalled.nextState.hold, { reason: 'round_stalled', sinceHeadSha: SHA, since: stalled.nextState.hold.since });
  assert.deepEqual(stalled.nextState.inFlight, { ...started(stale).inFlight, failureReported: true });

  const recent = new Date(Date.now() - 60000).toISOString();
  const running = succeeds(invoke(t, 'snapshot', snapshotInput({ state: started(recent), roundStatus: 'running' }), base()));
  assert.equal(running.decision, 'idle');
  assert.equal(running.cancelRound, 'no');
});

test('snapshot returns closed without reading the branch, feedback or checks', t => {
  const result = invoke(t, 'snapshot', snapshotInput({ hasActive: 'yes' }), base({ [`GET ${REPO}/pulls/7`]: ok(pull({ state: 'closed', merged: true })), [`GET ${REPO}/branches/${BRANCH}`]: httpError(500, 'Server Error') }));
  const data = succeeds(result);
  assert.equal(data.decision, 'closed');
  assert.equal(data.cancelRound, 'yes');
  assert.equal(data.prOutcome, 'merged');
  assert.equal(data.prState, 'closed');
  assert.equal(data.itemCount, 0);
  assert.deepEqual(result.calls.map(call => call.key), [`GET ${REPO}/pulls/7`]);
  assert.equal(result.calls.some(call => call.key.includes('/branches/')), false);
});

test('snapshot reports head availability for same-repo, fork and deleted-fork pull requests', t => {
  const forked = pull({ head: { sha: SHA, ref: BRANCH, repo: { full_name: 'someone/widgets' } } });
  const deletedFork = pull({ head: { sha: SHA, ref: BRANCH, repo: null } });
  const gone = succeeds(invoke(t, 'snapshot', snapshotInput(), base({ [`GET ${REPO}/branches/${BRANCH}`]: httpError(404, 'Branch not found') })));
  assert.equal(gone.decision, 'report_failure');
  assert.equal(gone.nextState.hold.reason, 'head_unavailable');
  assert.match(gone.notice, /head branch is unavailable/);
  assert.match(gone.noticeTarget, /^notice:\d+$/);

  const fork = invoke(t, 'snapshot', snapshotInput(), base({ [`GET ${REPO}/pulls/7`]: ok(forked) }));
  assert.equal(succeeds(fork).decision, 'idle');
  assert.equal(fork.calls.some(call => call.key.includes('/branches/')), false);

  const deleted = invoke(t, 'snapshot', snapshotInput(), base({ [`GET ${REPO}/pulls/7`]: ok(deletedFork) }));
  assert.equal(succeeds(deleted).decision, 'report_failure');
  assert.equal(deleted.calls.some(call => call.key.includes('/branches/')), false);

  // Any other branch lookup failure is an outage, not a deleted branch.
  fails(invoke(t, 'snapshot', snapshotInput(), base({ [`GET ${REPO}/branches/${BRANCH}`]: httpError(500, 'Server Error') })), 'github_unavailable');
});

test('only failure, timed_out and startup_failure conclusions count as failing checks', t => {
  const runs = [
    job(1, { conclusion: 'failure', app: { slug: 'other' } }), job(2, { conclusion: 'timed_out', app: { slug: 'other' } }), job(3, { conclusion: 'startup_failure', app: { slug: 'other' } }),
    job(4, { conclusion: 'cancelled', app: { slug: 'other' } }), job(5, { conclusion: 'action_required', app: { slug: 'other' } }),
    job(6, { conclusion: 'success' }), job(7, { conclusion: 'neutral' }), job(8, { conclusion: 'skipped' }),
    job(9, { status: 'in_progress', conclusion: null }), job(10, { conclusion: 'stale' }),
  ];
  const { failingChecks } = succeeds(invoke(t, 'collect', collectInput(), { [`GET ${REPO}/commits/${HEAD}/check-runs`]: checkRuns(runs) }));
  assert.deepEqual(failingChecks.map(check => [check.name, check.conclusion]), [['job-1', 'failure'], ['job-2', 'timed_out'], ['job-3', 'startup_failure']]);
  assert.deepEqual(failingChecks[0], { name: 'job-1', conclusion: 'failure', url: 'https://github.com/acme/widgets/actions/runs/9/job/1', logExcerpt: '' });
  const data = succeeds(invoke(t, 'snapshot', snapshotInput(), base({ [`GET ${REPO}/commits/${SHA}/check-runs`]: checkRuns(runs) })));
  assert.equal(data.decision, 'dispatch');
  assert.equal(data.nextState.inFlight.checkFix, true);
  // A cancelled or approval-gated check is nothing the session can fix, so on its own it starts no round.
  for (const conclusion of ['cancelled', 'action_required']) {
    const settled = succeeds(invoke(t, 'snapshot', snapshotInput(), base({ [`GET ${REPO}/commits/${SHA}/check-runs`]: checkRuns([job(1, { conclusion, app: { slug: 'other' } }), job(2, { conclusion: 'success' })]) })));
    assert.equal(settled.decision, 'idle', conclusion);
  }
});

test('snapshot treats a head with no check runs as pending', t => {
  const settled = { ...emptyState(), checkFix: { lastSha: 'older-sha', attempts: 1 } };
  const none = succeeds(invoke(t, 'snapshot', snapshotInput({ state: settled }), base()));
  assert.equal(none.decision, 'idle', 'CI may not have registered yet, so earlier check-fix attempts still count');
  assert.deepEqual(none.nextState.checkFix, settled.checkFix);
  const running = succeeds(invoke(t, 'snapshot', snapshotInput({ state: settled }), base({ [`GET ${REPO}/commits/${SHA}/check-runs`]: checkRuns([job(1, { status: 'in_progress', conclusion: null }), job(2, { conclusion: 'success' })]) })));
  assert.equal(running.decision, 'idle');
  const green = succeeds(invoke(t, 'snapshot', snapshotInput({ state: settled }), base({ [`GET ${REPO}/commits/${SHA}/check-runs`]: checkRuns([job(1, { conclusion: 'success' })]) })));
  assert.equal(green.decision, 'save');
  assert.equal(green.nextState.checkFix.attempts, 0);
});

test('collect returns at most ten failing checks and excerpts only the first three', t => {
  const runs = Array.from({ length: 12 }, (_, index) => job(index + 1));
  const logs = Object.fromEntries([1, 2, 3, 4].map(id => [`GET ${REPO}/actions/jobs/${id}/logs`, text(`failure in job ${id}\n`)]));
  const result = invoke(t, 'collect', collectInput(), { [`GET ${REPO}/commits/${HEAD}/check-runs`]: checkRuns(runs), ...logs });
  const { failingChecks } = succeeds(result);
  assert.deepEqual(failingChecks.map(check => check.name), Array.from({ length: 10 }, (_, index) => `job-${index + 1}`));
  assert.deepEqual(failingChecks.map(check => check.logExcerpt), ['failure in job 1', 'failure in job 2', 'failure in job 3', ...Array(7).fill('')]);
  assert.equal(result.calls.filter(call => call.key.includes('/actions/jobs/')).length, 3);
});

test('collect excerpts at most 8192 bytes of failing job logs', t => {
  const long = lines(1000, n => `line ${n} ${'x'.repeat(100)}`);
  const short = lines(200, n => `short ${n}`).replaceAll('\n', '\r\n');
  const euros = lines(120, () => '€'.repeat(100));
  const fixtures = {
    [`GET ${REPO}/commits/${HEAD}/check-runs`]: checkRuns([job(501), job(502), job(503), job(504), job(600, { app: { slug: 'circleci' } }), job(700, { conclusion: 'success' })]),
    [`GET ${REPO}/actions/jobs/501/logs`]: text(long),
    [`GET ${REPO}/actions/jobs/502/logs`]: text(short),
    [`GET ${REPO}/actions/jobs/503/logs`]: text(euros),
  };
  const result = invoke(t, 'collect', collectInput(), fixtures);
  const { failingChecks } = succeeds(result);
  assert.deepEqual(failingChecks.map(check => check.name), ['job-501', 'job-502', 'job-503', 'job-504', 'job-600']);

  const [first, second, third, fourth, fifth] = failingChecks.map(check => check.logExcerpt);
  const lastHundredTwenty = long.trimEnd().split('\n').slice(-120).join('\n');
  assert.ok(Buffer.byteLength(first) <= 8192);
  assert.ok(Buffer.byteLength(first) > 8000, 'keeps as much of the tail as fits');
  assert.ok(lastHundredTwenty.endsWith(first), 'a suffix of the last 120 lines');
  assert.ok(first.endsWith(`line 1000 ${'x'.repeat(100)}`));

  assert.equal(second.includes('\r'), false);
  assert.equal(second.split('\n').length, 120);
  assert.ok(second.startsWith('short 81\n') && second.endsWith('short 200'));

  assert.ok(Buffer.byteLength(third) <= 8192);
  assert.equal(third.includes('�'), false, 'cuts on a character boundary');
  assert.ok(third.endsWith('€'.repeat(100)));

  assert.equal(fourth, '', 'only the first three failing checks are excerpted');
  assert.equal(fifth, '', 'non-Actions checks have no log');
  assert.deepEqual(result.calls.filter(call => call.key.includes('/actions/jobs/')).map(call => call.key), [501, 502, 503].map(id => `GET ${REPO}/actions/jobs/${id}/logs`));
});

test('snapshot stays under the result limit with a thousand large qualifying comments', t => {
  const many = Array.from({ length: 1000 }, (_, index) => comment(index + 1, { body: `${'x'.repeat(8000)} ${index + 1}` }));
  const result = invoke(t, 'snapshot', snapshotInput(), base({ [`GET ${REPO}/issues/7/comments`]: pages(many) }));
  const data = succeeds(result);
  assert.ok(Buffer.byteLength(result.stdout) < 1048576, `${Buffer.byteLength(result.stdout)} bytes`);
  assert.equal(data.itemCount, 1000);
  assert.equal(Object.hasOwn(data, 'items'), false);
  assert.equal(Object.hasOwn(data, 'roundFeedback'), false);
  assert.equal(data.decision, 'dispatch');
  assert.equal(data.nextState.inFlight.itemIds.length, feedback.MAX_ROUND_ITEMS);
});

// collect -------------------------------------------------------------------------------------------------
test('collect returns bounded items in itemIds order and drops missing ids', t => {
  const long = 'y'.repeat(10000);
  const fixtures = base({
    [`GET ${REPO}/issues/7/comments`]: ok([[comment(1, { body: long }), comment(2), comment(3, { author_association: 'NONE' })], [comment(4, { body: formatAutomationBody('Done.', 'ic:1') })]]),
    [`GET ${REPO}/pulls/7/reviews`]: pages([review(10, { state: 'CHANGES_REQUESTED', body: 'needs work' })]),
    [`GET ${REPO}/pulls/7/comments`]: pages([inline(20), inline(21, { in_reply_to_id: 20 })]),
    [`GET ${REPO}/commits/${HEAD}/check-runs`]: ok([{ total_count: 0, check_runs: [] }]),
  });
  const itemIds = ['rc:21', 'ic:1', 'ic:99', 'rv:10', 'ic:3', 'ic:4', 'ic:1', 'rc:20'];
  const result = invoke(t, 'collect', collectInput({ itemIds }), fixtures);
  const data = succeeds(result);
  assert.deepEqual(Object.keys(data).sort(), ['failingChecks', 'headSha', 'itemIds', 'items', 'questions']);
  assert.deepEqual(data.itemIds, itemIds, 'the requested ids are echoed as given');
  assert.equal(data.headSha, HEAD);
  assert.deepEqual(data.items.map(item => item.id), ['rc:21', 'ic:1', 'rv:10', 'rc:20'], 'requested order; missing, non-qualifying and automation items are absent, repeats appear once');
  assert.equal(data.items[0].inReplyTo, 'rc:20');
  const bounded = data.items[1];
  assert.ok(bounded.body.length < long.length && bounded.body.length <= feedback.MAX_ITEM_BODY_CHARS + 200, `${bounded.body.length} chars`);
  assert.ok(bounded.body.startsWith('y'.repeat(feedback.MAX_ITEM_BODY_CHARS)) && bounded.body.endsWith(`[truncated; full text: ${bounded.url}]`));
  assert.equal(data.items[2].body, 'needs work');
  assert.deepEqual(data.failingChecks, []);
  assert.ok(result.calls.every(call => call.key.startsWith('GET ') && call.headers.includes(ACCEPT)));
  assert.equal(result.calls.some(call => call.key === `GET ${REPO}/pulls/7`), false, 'the pull request itself is not read');
  for (const call of result.calls) assert.ok(call.args.includes('--paginate') && call.args.includes('--slurp'), call.key);
});

test('collect returns failing checks for the given head', t => {
  const fixtures = {
    [`GET ${REPO}/commits/${HEAD}/check-runs`]: checkRuns([job(501), job(502, { app: { slug: 'circleci' } }), job(503, { conclusion: 'success' })]),
    [`GET ${REPO}/actions/jobs/501/logs`]: text(`${lines(500, n => `line ${n} ${'z'.repeat(100)}`)}`),
  };
  const result = invoke(t, 'collect', collectInput({ itemIds: [] }), fixtures);
  const data = succeeds(result);
  assert.deepEqual(data.items, []);
  assert.deepEqual(data.itemIds, []);
  assert.deepEqual(data.failingChecks.map(check => [check.name, check.conclusion]), [['job-501', 'failure'], ['job-502', 'failure']]);
  assert.ok(Buffer.byteLength(data.failingChecks[0].logExcerpt) <= feedback.MAX_LOG_EXCERPT_BYTES && data.failingChecks[0].logExcerpt.endsWith(`line 500 ${'z'.repeat(100)}`));
  assert.equal(data.failingChecks[1].logExcerpt, '');
  assert.deepEqual(result.calls.map(call => call.key), [`GET ${REPO}/commits/${HEAD}/check-runs`, `GET ${REPO}/actions/jobs/501/logs`], 'no feedback is read for an empty itemIds list, and nothing else is');
});

test('collect reads a closed pull request and reports not_found for a missing one', t => {
  const fixtures = base({ [`GET ${REPO}/pulls/7`]: ok(pull({ state: 'closed', merged: true })), [`GET ${REPO}/issues/7/comments`]: pages([comment(1)]), [`GET ${REPO}/commits/${HEAD}/check-runs`]: ok([{ total_count: 0, check_runs: [] }]) });
  assert.deepEqual(succeeds(invoke(t, 'collect', collectInput({ itemIds: ['ic:1'] }), fixtures)).items.map(item => item.id), ['ic:1']);
  fails(invoke(t, 'collect', collectInput({ itemIds: ['ic:1'] }), { [`GET ${REPO}/issues/7/comments`]: httpError(404, 'Not Found') }), 'not_found');
});

test('collect output stays under 1 MiB for 50 maximum-size comments', t => {
  const huge = '中'.repeat(65536);
  const many = Array.from({ length: 60 }, (_, index) => comment(index + 1, { body: `${huge}${index}` }));
  const runs = Array.from({ length: 12 }, (_, index) => job(index + 1));
  const logs = Object.fromEntries([1, 2, 3].map(id => [`GET ${REPO}/actions/jobs/${id}/logs`, text(lines(300, n => `${n} ${'中'.repeat(100)}`))]));
  const fixtures = base({ [`GET ${REPO}/issues/7/comments`]: pages(many), [`GET ${REPO}/commits/${HEAD}/check-runs`]: checkRuns(runs), ...logs });
  const result = invoke(t, 'collect', collectInput({ itemIds: many.slice(0, 50).map(entry => `ic:${entry.id}`) }), fixtures);
  const data = succeeds(result);
  assert.ok(Buffer.byteLength(result.stdout) < 1048576, `${Buffer.byteLength(result.stdout)} bytes`);
  assert.equal(data.items.length, 50);
  assert.ok(data.items.every(item => item.body.length <= feedback.MAX_ITEM_BODY_CHARS + 200));
  assert.equal(data.failingChecks.length, 10);
  assert.ok(data.failingChecks.slice(0, 3).every(check => check.logExcerpt.length > 0 && Buffer.byteLength(check.logExcerpt) <= feedback.MAX_LOG_EXCERPT_BYTES));
});

test('collect keeps a failing check when its log is unavailable', t => {
  const fixtures = {
    [`GET ${REPO}/commits/${HEAD}/check-runs`]: checkRuns([job(501), job(502)]),
    [`GET ${REPO}/actions/jobs/501/logs`]: httpError(410, 'Gone'),
    [`GET ${REPO}/actions/jobs/502/logs`]: text('error: boom\n'),
  };
  const { failingChecks } = succeeds(invoke(t, 'collect', collectInput(), fixtures));
  assert.deepEqual(failingChecks.map(check => check.logExcerpt), ['', 'error: boom']);
});

test('collect redacts token-like strings and configured credentials from log excerpts', t => {
  const fixtures = {
    [`GET ${REPO}/commits/${HEAD}/check-runs`]: checkRuns([job(501)]),
    [`GET ${REPO}/actions/jobs/501/logs`]: text('using ghp_0123456789abcdefghijklmnopqrstuvwxyz1234 to push\ncalled with sentinel-secret-value-98765 now\nerror: boom\n'),
  };
  const { failingChecks } = succeeds(invoke(t, 'collect', collectInput(), fixtures, { GITHUB_TOKEN: 'sentinel-secret-value-98765' }));
  assert.equal(failingChecks[0].logExcerpt, 'using [REDACTED] to push\ncalled with [REDACTED] now\nerror: boom');
});

test('snapshot maps gh auth and rate-limit failures to github_unavailable', t => {
  const classic = 'ghp_0123456789abcdefghijklmnopqrstuvwxyz1234';
  const finegrained = 'github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyz0123456789';
  const configured = 'sentinel-secret-value-98765';
  const cases = [
    { stderr: `gh: Bad credentials (HTTP 401)\nAuthorization: token ${classic}\n`, secrets: [classic] },
    { stderr: `gh: API rate limit exceeded (HTTP 403)\nretry with ${finegrained}\n`, secrets: [finegrained] },
    { stderr: `gh: auth failed for ${configured}\n`, secrets: [configured] },
    { stderr: `gh: To get started with GitHub CLI, please run:  gh auth login\n${'noise '.repeat(5000)}`, secrets: [] },
  ];
  for (const { stderr, secrets } of cases) {
    const result = invoke(t, 'snapshot', snapshotInput(), { [`GET ${REPO}/pulls/7`]: { exitCode: 1, stdout: JSON.stringify({ message: classic }), stderr } }, { GH_TOKEN: configured });
    const error = fails(result, 'github_unavailable');
    assert.ok(error.message.length > 0 && error.message.length <= 400, `message is bounded: ${error.message.length}`);
    for (const secret of [...secrets, classic, finegrained, configured]) assert.equal((result.stdout + result.stderr).includes(secret), false, secret);
  }
  assert.match(fails(invoke(t, 'snapshot', snapshotInput(), { [`GET ${REPO}/pulls/7`]: { exitCode: 1, stdout: '', stderr: 'gh: Bad credentials (HTTP 401)\n' } }), 'github_unavailable').message, /HTTP 401/);
});

test('snapshot maps HTTP 404 to not_found and a missing gh executable to github_unavailable', t => {
  fails(invoke(t, 'snapshot', snapshotInput(), { [`GET ${REPO}/pulls/7`]: httpError(404, 'Not Found') }), 'not_found');
  const empty = mkdtempSync(path.join(tmpdir(), 'pr-feedback-empty-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  const spawned = spawnSync(process.execPath, [runner], { cwd: empty, env: { PATH: empty }, input: JSON.stringify(request('snapshot', snapshotInput())), encoding: 'utf8' });
  assert.equal(spawned.status, 0, spawned.stderr);
  const envelope = JSON.parse(spawned.stdout);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.code, 'github_unavailable');
});

// reply ---------------------------------------------------------------------------------------------------
const replyFixtures = (over = {}) => base({
  [`GET ${REPO}/issues/7/comments`]: pages([comment(100, { body: 'Please rename x.' })]),
  [`GET ${REPO}/pulls/7/reviews`]: pages([review(300, { body: 'Overall notes.' })]),
  [`GET ${REPO}/pulls/7/comments`]: pages([inline(200, { body: 'Rename this.' })]),
  [`POST ${REPO}/pulls/7/comments/200/replies`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#discussion_r900' }),
  [`POST ${REPO}/issues/7/comments`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-901' }),
  ...over,
});

test('reply posts threaded reply for rc and quoted comment for ic', t => {
  const result = invoke(t, 'reply', replyInput([{ itemId: 'rc:200', body: 'Renamed.' }, { itemId: 'ic:100', body: 'Fixed it.' }, { itemId: 'rv:300', body: 'Addressed.' }]), replyFixtures());
  assert.deepEqual(succeeds(result).results, [
    { itemId: 'rc:200', outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#discussion_r900' },
    { itemId: 'ic:100', outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#issuecomment-901' },
    { itemId: 'rv:300', outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#issuecomment-901' },
  ]);
  const written = posts(result.calls);
  assert.deepEqual(written.map(call => call.key), [`POST ${REPO}/pulls/7/comments/200/replies`, `POST ${REPO}/issues/7/comments`, `POST ${REPO}/issues/7/comments`]);
  for (const call of written) {
    assert.ok(call.args.includes('--method') && call.args.includes('POST'));
    assert.ok(call.headers.includes(ACCEPT));
    assert.deepEqual(Object.keys(call.fields), ['body']);
    assert.ok(call.fields.body.startsWith(`${HEADER}\n\n`));
  }
  const [rc, ic, rv] = written.map(call => call.fields.body);
  assert.equal(rc, formatAutomationBody('Renamed.', 'rc:200'));
  assert.ok(rc.endsWith('<!-- valdr-automation:v1 target=rc:200 -->'));
  assert.equal(ic, formatAutomationBody('> Re: https://github.com/acme/widgets/pull/7#issuecomment-100\n\nFixed it.', 'ic:100'));
  assert.ok(ic.endsWith('<!-- valdr-automation:v1 target=ic:100 -->'));
  assert.equal(rv, formatAutomationBody('> Re: https://github.com/acme/widgets/pull/7#pullrequestreview-300\n\nAddressed.', 'rv:300'));
});

test('reply returns existing when a marked reply for the target exists', t => {
  const fixtures = replyFixtures({
    [`GET ${REPO}/issues/7/comments`]: pages([comment(100), comment(101, { user: person('automation'), body: formatAutomationBody('> Re: x\n\nFixed it.', 'ic:100') })]),
    [`GET ${REPO}/pulls/7/comments`]: pages([inline(200), inline(201, { user: person('automation'), body: formatAutomationBody('Renamed.', 'rc:200') })]),
  });
  const result = invoke(t, 'reply', replyInput([{ itemId: 'ic:100', body: 'Fixed it.' }, { itemId: 'rc:200', body: 'Renamed.' }, { itemId: 'ic:100', body: 'Again.' }]), fixtures);
  assert.deepEqual(succeeds(result).results, [
    { itemId: 'ic:100', outcome: 'existing', url: 'https://github.com/acme/widgets/pull/7#issuecomment-101' },
    { itemId: 'rc:200', outcome: 'existing', url: 'https://github.com/acme/widgets/pull/7#discussion_r201' },
    { itemId: 'ic:100', outcome: 'existing', url: 'https://github.com/acme/widgets/pull/7#issuecomment-101' },
  ]);
  assert.deepEqual(posts(result.calls), []);
});

test('reply does not repeat a target within one request', t => {
  const result = invoke(t, 'reply', replyInput([{ itemId: 'rc:200', body: 'Renamed.' }, { itemId: 'rc:200', body: 'Renamed again.' }]), replyFixtures());
  assert.deepEqual(succeeds(result).results.map(entry => entry.outcome), ['posted', 'existing']);
  assert.equal(posts(result.calls).length, 1);
});

test('reply reports missing for a deleted target', t => {
  const fixtures = replyFixtures({
    [`GET ${REPO}/pulls/7/comments`]: pages([inline(200), inline(300)]),
    [`POST ${REPO}/pulls/7/comments/300/replies`]: httpError(404, 'Not Found'),
  });
  const result = invoke(t, 'reply', replyInput([{ itemId: 'rc:300', body: 'Gone.' }, { itemId: 'ic:999', body: 'Also gone.' }, { itemId: 'rc:200', body: 'Renamed.' }]), fixtures);
  assert.deepEqual(succeeds(result).results, [
    { itemId: 'rc:300', outcome: 'missing', url: '' },
    { itemId: 'ic:999', outcome: 'missing', url: '' },
    { itemId: 'rc:200', outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#discussion_r900' },
  ]);
  assert.deepEqual(posts(result.calls).map(call => call.key), [`POST ${REPO}/pulls/7/comments/300/replies`, `POST ${REPO}/pulls/7/comments/200/replies`]);
});

test('reply to a follow-up in a thread posts to the root comment id', t => {
  const fixtures = replyFixtures({
    [`GET ${REPO}/pulls/7/comments`]: pages([
      inline(200), inline(250, { in_reply_to_id: 200 }), inline(260, { in_reply_to_id: 200 }),
      inline(270, { user: person('automation'), in_reply_to_id: 200, body: formatAutomationBody('Done.', 'rc:260') }),
    ]),
  });
  const result = invoke(t, 'reply', replyInput([{ itemId: 'rc:250', body: 'Thanks.' }, { itemId: 'rc:260', body: 'Done.' }, { itemId: 'rc:200', body: 'Root.' }]), fixtures);
  assert.deepEqual(succeeds(result).results.map(entry => [entry.itemId, entry.outcome]), [['rc:250', 'posted'], ['rc:260', 'existing'], ['rc:200', 'posted']]);
  const written = posts(result.calls);
  assert.deepEqual(written.map(call => call.key), [`POST ${REPO}/pulls/7/comments/200/replies`, `POST ${REPO}/pulls/7/comments/200/replies`]);
  assert.equal(result.calls.some(call => call.key.includes('/comments/250/')), false);
  // The marker still names the feedback item, so reconciliation stays per item.
  assert.equal(written[0].fields.body, formatAutomationBody('Thanks.', 'rc:250'));
  assert.equal(written[1].fields.body, formatAutomationBody('Root.', 'rc:200'));
});

test('reply to a follow-up reports missing when the thread root is gone', t => {
  const fixtures = replyFixtures({
    [`GET ${REPO}/pulls/7/comments`]: pages([inline(250, { in_reply_to_id: 200 })]),
    [`POST ${REPO}/pulls/7/comments/200/replies`]: httpError(404, 'Not Found'),
  });
  const result = invoke(t, 'reply', replyInput([{ itemId: 'rc:250', body: 'Thanks.' }]), fixtures);
  assert.deepEqual(succeeds(result).results, [{ itemId: 'rc:250', outcome: 'missing', url: '' }]);
});

test('reply ignores a spoofed marker from another author and posts', t => {
  const forged = (target, over) => ({ user: person('mallory'), author_association: 'NONE', body: formatAutomationBody('Done.', target), ...over });
  const fixtures = replyFixtures({
    [`GET ${REPO}/issues/7/comments`]: pages([comment(100), comment(101, forged('ic:100'))]),
    [`GET ${REPO}/pulls/7/comments`]: pages([inline(200), inline(201, forged('rc:200')), inline(202, { user: person('Automation'), body: formatAutomationBody('Renamed.', 'rc:200') }), inline(210), inline(211, forged('rc:210'))]),
    [`POST ${REPO}/pulls/7/comments/210/replies`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#discussion_r910' }),
  });
  const result = invoke(t, 'reply', replyInput([{ itemId: 'ic:100', body: 'Fixed it.' }, { itemId: 'rc:200', body: 'Renamed.' }, { itemId: 'rc:210', body: 'Tidied.' }]), fixtures);
  assert.deepEqual(succeeds(result).results, [
    { itemId: 'ic:100', outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#issuecomment-901' },
    { itemId: 'rc:200', outcome: 'existing', url: 'https://github.com/acme/widgets/pull/7#discussion_r202' },
    { itemId: 'rc:210', outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#discussion_r910' },
  ]);
  assert.deepEqual(posts(result.calls).map(call => call.key), [`POST ${REPO}/issues/7/comments`, `POST ${REPO}/pulls/7/comments/210/replies`]);
  assert.equal(result.calls.filter(call => call.key === 'GET user').length, 1, 'the account is looked up once per invocation');
});

test('reply and comment fail closed when the authenticated account cannot be read', t => {
  const denied = { 'GET user': httpError(403, 'Resource not accessible by integration') };
  const reply = invoke(t, 'reply', replyInput([{ itemId: 'rc:200', body: 'Renamed.' }]), replyFixtures(denied));
  fails(reply, 'github_unavailable');
  assert.deepEqual(posts(reply.calls), []);
  const posted = invoke(t, 'comment', commentInput(), base({ ...denied, [`POST ${REPO}/issues/7/comments`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-50' }) }));
  fails(posted, 'github_unavailable');
  assert.deepEqual(posts(posted.calls), []);
});

test('reply with no items is a no-op and calls gh zero times', t => {
  const result = invoke(t, 'reply', replyInput([]), {});
  assert.deepEqual(succeeds(result), { results: [] });
  assert.deepEqual(result.calls, []);
});

test('reply fails as a whole when GitHub is unavailable while posting', t => {
  const result = invoke(t, 'reply', replyInput([{ itemId: 'rc:200', body: 'Renamed.' }]), replyFixtures({ [`POST ${REPO}/pulls/7/comments/200/replies`]: { exitCode: 1, stdout: '', stderr: 'gh: Server Error (HTTP 502)\n' } }));
  fails(result, 'github_unavailable');
});

// comment -------------------------------------------------------------------------------------------------
test('comment is idempotent by target marker', t => {
  const fixtures = base({ [`POST ${REPO}/issues/7/comments`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-50' }) });
  const first = invoke(t, 'comment', commentInput(), fixtures);
  assert.deepEqual(succeeds(first), { outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#issuecomment-50' });
  const written = posts(first.calls);
  assert.equal(written.length, 1);
  assert.equal(written[0].key, `POST ${REPO}/issues/7/comments`);
  assert.equal(written[0].fields.body, formatAutomationBody('Checks look green.', 'pr:7'));
  assert.ok(written[0].fields.body.startsWith(HEADER) && written[0].fields.body.endsWith('<!-- valdr-automation:v1 target=pr:7 -->'));

  const marked = comment(50, { user: person('automation'), body: formatAutomationBody('Checks look green.', 'pr:7') });
  const second = invoke(t, 'comment', commentInput({ body: 'Different words.' }), base({ [`GET ${REPO}/issues/7/comments`]: pages([comment(1), marked]) }));
  assert.deepEqual(succeeds(second), { outcome: 'existing', url: marked.html_url });
  assert.deepEqual(posts(second.calls), []);

  const inReview = inline(60, { user: person('automation'), body: formatAutomationBody('Checks look green.', 'pr:7') });
  const third = invoke(t, 'comment', commentInput(), base({ [`GET ${REPO}/pulls/7/comments`]: pages([inReview]) }));
  assert.deepEqual(succeeds(third), { outcome: 'existing', url: inReview.html_url });

  const other = invoke(t, 'comment', commentInput({ target: 'pr:8', body: 'Other.' }), { ...fixtures, [`GET ${REPO}/issues/7/comments`]: pages([marked]), [`GET ${REPO}/pulls/7/comments`]: pages([]) });
  assert.equal(succeeds(other).outcome, 'posted');
});

test('comment ignores a spoofed marker from another author and posts', t => {
  const forged = comment(50, { user: person('mallory'), author_association: 'NONE', body: formatAutomationBody('Checks look green.', 'pr:7') });
  const result = invoke(t, 'comment', commentInput(), base({ [`GET ${REPO}/issues/7/comments`]: pages([forged]), [`POST ${REPO}/issues/7/comments`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-51' }) }));
  assert.deepEqual(succeeds(result), { outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#issuecomment-51' });
  assert.equal(posts(result.calls).length, 1);
});

test('comment accepts a notice target and is idempotent on it', t => {
  const created = { [`POST ${REPO}/issues/7/comments`]: ok({ html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-52' }) };
  const first = invoke(t, 'comment', commentInput({ target: 'notice:2', body: 'Automation paused this follow-up.' }), base(created));
  assert.deepEqual(succeeds(first), { outcome: 'posted', url: 'https://github.com/acme/widgets/pull/7#issuecomment-52' });
  const body = posts(first.calls)[0].fields.body;
  assert.equal(body, formatAutomationBody('Automation paused this follow-up.', 'notice:2'));
  assert.ok(body.endsWith('<!-- valdr-automation:v1 target=notice:2 -->'));

  const marked = comment(52, { user: person('automation'), body });
  const second = invoke(t, 'comment', commentInput({ target: 'notice:2', body: 'Again.' }), base({ ...created, [`GET ${REPO}/issues/7/comments`]: pages([marked]) }));
  assert.deepEqual(succeeds(second), { outcome: 'existing', url: marked.html_url });
  assert.deepEqual(posts(second.calls), []);

  const next = invoke(t, 'comment', commentInput({ target: 'notice:3', body: 'Next.' }), base({ ...created, [`GET ${REPO}/issues/7/comments`]: pages([marked]) }));
  assert.equal(succeeds(next).outcome, 'posted');
});

// manifest ------------------------------------------------------------------------------------------------
const manifestPath = fileURLToPath(new URL('../../tools/pr-feedback/pr-feedback.tool.yaml', import.meta.url));
const bun = spawnSync('bun', ['--version'], { encoding: 'utf8' });

test('manifest matches the runner contract', { skip: bun.status !== 0 && 'bun is required to parse YAML' }, () => {
  const parsed = spawnSync('bun', ['-e', 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))', manifestPath], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr);
  const manifest = JSON.parse(parsed.stdout);
  assert.equal(manifest.id, TOOL_ID);
  assert.equal(manifest.revision, TOOL_REVISION);
  assert.deepEqual({ ...manifest.process, inheritEnv: [...manifest.process.inheritEnv].sort() }, { executable: 'node', args: ['runner.mjs'], inheritEnv: ['GH_CONFIG_DIR', 'GH_ENTERPRISE_TOKEN', 'GH_HOST', 'GH_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GITHUB_TOKEN'] });
  assert.deepEqual(manifest.limits, { timeoutSeconds: 60, maxInputBytes: 1048576, maxResultBytes: 1048576, maxLogBytes: 4096 });
  const directory = path.dirname(manifestPath);
  assert.deepEqual(manifest.files.map(file => file.path), ['runner.mjs', 'contract.mjs', 'feedback.mjs', 'github.mjs', 'session.mjs', 'coordination.mjs', 'publish.mjs']);
  for (const file of manifest.files) assert.ok(existsSync(path.join(directory, file.path)), file.path);
  assert.deepEqual(Object.fromEntries(manifest.actions.map(action => [action.id, [action.sideEffects, action.retry]])), {
    observe: ['read', 'idempotent'], identify: ['read', 'idempotent'], snapshot: ['read', 'idempotent'], collect: ['read', 'idempotent'],
    // The writes reconcile by marker before posting, so a retry never posts twice; `manual` would turn any failure into a blocked step.
    reply: ['write', 'idempotent'], comment: ['write', 'idempotent'],
    review_candidates: ['read', 'idempotent'], bind_reviewers: ['read', 'idempotent'], advance: ['read', 'idempotent'],
    read_result: ['read', 'idempotent'], publish: ['write', 'manual'],
  });
  for (const action of manifest.actions) {
    assert.equal(action.execution, 'supported');
    assert.equal(action.inputSchema.additionalProperties, false, `${action.id} input`);
    assert.equal(action.outputSchema.additionalProperties, false, `${action.id} output`);
  }
  const snapshot = manifest.actions.find(action => action.id === 'snapshot').outputSchema.properties;
  assert.deepEqual(snapshot.decision.enum, ['idle', 'closed', 'complete', 'save', 'report_failure', 'dispatch', 'review', 'revise', 'publish']);
  assert.deepEqual(snapshot.cancelRound.enum, ['yes', 'no']);
  assert.equal(snapshot.noticeTarget.type, 'string');
  assert.equal(snapshot.itemCount.type, 'integer');
  assert.equal(Object.hasOwn(snapshot, 'items'), false, 'the full item list is not part of the result');
  assert.equal(Object.hasOwn(snapshot, 'roundFeedback'), false, 'a round collects its own content');
  const snapshotOutput = manifest.actions.find(action => action.id === 'snapshot').outputSchema;
  assert.ok(!snapshotOutput.required.includes('roundFeedback'));
  assert.deepEqual(Object.keys(snapshotOutput.$defs).sort(), ['hold', 'inFlight', 'question', 'state'], 'checkpoint definitions stay self-contained');
  const { state, inFlight, hold } = manifest.actions.find(action => action.id === 'snapshot').inputSchema.$defs;
  assert.deepEqual(Object.keys(state.properties).sort(), [...Object.keys(emptyState()), 'questions'].sort(), 'state schema lists every checkpoint field');
  assert.deepEqual([...state.required].sort(), Object.keys(emptyState()).filter(key => key !== 'notices').sort(), 'notices stays optional for older checkpoints');
  assert.deepEqual(Object.keys(inFlight.properties).sort(), Object.keys({ requestId: 0, runUlid: 0, itemIds: 0, headSha: 0, checkFix: 0, failureReported: 0, dispatchedAt: 0, questions: 0, sessionProgress: 0, coordination: 0 }).sort());
  assert.deepEqual(inFlight.properties.dispatchedAt, { type: 'string' });
  assert.ok(!inFlight.required.includes('dispatchedAt'), 'dispatchedAt stays optional for rounds recorded before it existed');
  assert.deepEqual(Object.keys(hold.properties).sort(), ['reason', 'since', 'sinceHeadSha']);
  const copies = {};
  for (const action of manifest.actions) for (const schema of [action.inputSchema, action.outputSchema]) for (const [name, def] of Object.entries(schema.$defs ?? {})) (copies[name] ??= []).push({ action: action.id, def });
  assert.ok(copies.state.length > 1 && copies.inFlight.length === copies.state.length && copies.hold.length === copies.state.length);
  for (const [name, list] of Object.entries(copies)) for (const copy of list) assert.deepEqual(copy.def, list[0].def, `$defs.${name} in ${copy.action} differs from the copy in ${list[0].action}`);
  const reply = manifest.actions.find(action => action.id === 'reply').inputSchema.properties.replies.items.properties;
  const itemId = new RegExp(reply.itemId.pattern);
  assert.equal(manifest.actions.find(action => action.id === 'reply').inputSchema.properties.replies.minItems, undefined, 'an empty reply list is allowed');
  for (const id of ['ic:1', 'rv:20', 'rc:0', `rc:${'9'.repeat(20)}`]) assert.match(id, itemId);
  for (const id of ['rc:01', 'ic:', 'pr:1', 'notice:1', `rc:${'1'.repeat(21)}`]) assert.doesNotMatch(id, itemId);
  for (const body of [reply.body, manifest.actions.find(action => action.id === 'comment').inputSchema.properties.body]) {
    assert.equal(body.not.pattern, FORBIDDEN_BODY_PATTERN, 'the schema and the runner reject the same text');
    const forbidden = new RegExp(body.not.pattern);
    assert.match(feedback.MARKER_PREFIX, forbidden, 'bodies may not carry the automation marker');
    for (const text of ['/Users/a/b', '/home/a', '/private/var/x', '/private/tmp/x', 'C:\\Users\\a', '01ARZ3NDEKTSV4RRFFQ69G5FAV']) assert.match(text, forbidden);
    for (const text of ['`/Users/a`', '(/private/tmp/a)', 'dir:/home/a', 'file:///Users/a', '**/Users/a**', '_/home/a_', '|/home/a|', '~/private/tmp/a', '*/private/var/a*']) assert.match(text, forbidden);
    for (const text of ['a94a8fe5ccb19ba61c4c0873d391e987982fbbd3 https://github.com/acme/widgets/pull/7', 'https://example.com/home/x', 'https://example.com/Users/x', 'docs/private/tmp/x', '**https://example.com/Users/x**', '|https://example.com/home/x|', 'https://example.com/~user/home/x']) assert.doesNotMatch(text, forbidden);
  }
  const allowedItemIds = manifest.actions.find(action => action.id === 'reply').inputSchema.properties.allowedItemIds;
  assert.equal(allowedItemIds.maxItems, 50);
  assert.equal(allowedItemIds.items.pattern, reply.itemId.pattern);
  assert.deepEqual(manifest.actions.find(action => action.id === 'reply').inputSchema.required, ['owner', 'repo', 'number', 'replies']);
  const commentTarget = new RegExp(manifest.actions.find(action => action.id === 'comment').inputSchema.properties.target.pattern);
  for (const target of ['ic:1', 'rv:1', 'rc:1', 'pr:1', 'notice:12']) assert.match(target, commentTarget);
  for (const target of ['notice:', 'notice:x', 'xx:1', 'pr:00', 'notice:01']) assert.doesNotMatch(target, commentTarget);
  assert.equal(new Set(manifest.actions.map(action => action.path.join('/'))).size, manifest.actions.length);
});


test('an uncertain dispatch is reported instead of automatically repeated', t => {
  const state = { ...emptyState(), inFlight: { requestId: 'saved', itemIds: ['ic:1'], headSha: SHA, checkFix: false, failureReported: false } };
  const data = succeeds(invoke(t, 'snapshot', snapshotInput({ state }), base()));
  assert.equal(data.decision, 'report_failure');
  assert.equal(data.nextState.hold.reason, 'round_uncertain');
});

test('closed PR cancels pending work without reading feedback', t => {
  const state = { ...emptyState(), inFlight: { requestId: 'saved', itemIds: ['ic:1'], headSha: SHA, checkFix: false, failureReported: false } };
  const result = invoke(t, 'snapshot', snapshotInput({ state, roundStatus: 'pending' }), base({ [`GET ${REPO}/pulls/7`]: ok(pull({ state: 'closed', merged: false })) }));
  assert.equal(succeeds(result).decision, 'closed');
  assert.equal(succeeds(result).cancelRound, 'yes');
  assert.equal(result.calls.length, 1);
});
