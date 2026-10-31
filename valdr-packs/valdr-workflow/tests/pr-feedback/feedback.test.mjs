import assert from 'node:assert/strict';
import test from 'node:test';
import { PrFeedbackError } from '../../tools/pr-feedback/contract.mjs';
import {
  HEADER, MARKER_PREFIX, MAX_ITEM_BODY_CHARS, MAX_LOG_EXCERPT_BYTES, MAX_ROUND_ITEMS, MAX_ROUND_MS, decide, emptyState, formatAutomationBody, boundedItem, boundedCheck, isQualifying,
  markHandled, markerTarget, normalizeState, toItems,
} from '../../tools/pr-feedback/feedback.mjs';

const at = minute => new Date(Date.UTC(2026, 9, 1, 0, minute)).toISOString();
const user = (login = 'dev', type = 'User') => ({ login, type });
const rawComment = (id, over = {}) => ({ id, user: user(), author_association: 'MEMBER', body: `comment ${id}`, html_url: `https://github.com/acme/widgets/pull/7#issuecomment-${id}`, created_at: at(id), ...over });
const rawReview = (id, over = {}) => ({ id, user: user(), author_association: 'MEMBER', body: `review ${id}`, html_url: `https://github.com/acme/widgets/pull/7#pullrequestreview-${id}`, submitted_at: at(id), state: 'COMMENTED', ...over });
const rawInline = (id, over = {}) => ({ id, user: user(), author_association: 'MEMBER', body: `inline ${id}`, html_url: `https://github.com/acme/widgets/pull/7#discussion_r${id}`, created_at: at(id), path: 'src/a.js', line: 12, ...over });

const item = (n, over = {}) => ({ id: `ic:${n}`, kind: 'issue_comment', author: 'dev', body: `comment ${n}`, url: `https://github.com/acme/widgets/pull/7#issuecomment-${n}`, createdAt: at(n), ...over });
const pr = (over = {}) => ({ state: 'open', merged: false, headSha: 'sha1', headAvailable: true, ...over });
const failing = { name: 'build', conclusion: 'failure', url: 'https://github.com/acme/widgets/actions/runs/1', logExcerpt: 'error: boom' };
const inFlight = (over = {}) => ({ requestId: 'req-old', runUlid: 'run-1', itemIds: ['ic:1'], headSha: 'sha1', checkFix: false, failureReported: false, ...over });
const stateWith = over => ({ ...emptyState(), ...over });
const NOW = '2026-10-01T12:00:00.000Z';
const afterNow = ms => new Date(Date.parse(NOW) + ms).toISOString();
const tick = (over = {}) => decide({ state: emptyState(), pr: pr(), items: [], checks: { pending: false, failing: [] }, freshRequestId: 'req-fresh', now: NOW, ...over });
const deepFreeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; };

test('formatAutomationBody prefixes header and appends marker', () => {
  assert.equal(HEADER, '🤖 Valdr workflow automation');
  assert.equal(MARKER_PREFIX, '<!-- valdr-automation:v1');
  assert.equal(formatAutomationBody('Fixed.', 'rc:42'), '🤖 Valdr workflow automation\n\nFixed.\n\n<!-- valdr-automation:v1 target=rc:42 -->');
  for (const target of ['ic:1', 'rv:9', 'pr:12', 'notice:3']) assert.match(formatAutomationBody('x', target), new RegExp(`target=${target} -->$`));
  for (const target of ['', 'xx:1', 'rc:', 'rc:1a', 'rc:1 -->', 'ic:-1', 'prr:1', 'notice:', 'notice:x', 'notices:1', 7, undefined]) {
    assert.throws(() => formatAutomationBody('x', target), { name: 'PrFeedbackError', code: 'invalid_target' });
  }
});

test('markerTarget reads the target and ignores bodies without a marker', () => {
  assert.equal(markerTarget(formatAutomationBody('Fixed.', 'rc:42')), 'rc:42');
  assert.equal(markerTarget(formatAutomationBody('Checks look green.', 'pr:7')), 'pr:7');
  assert.equal(markerTarget(formatAutomationBody('Paused.', 'notice:3')), 'notice:3');
  assert.equal(markerTarget('plain review comment'), null);
  assert.equal(markerTarget('<!-- valdr-automation:v1 -->'), null);
  assert.equal(markerTarget('<!-- valdr-automation:v1 target=nope -->'), null);
  assert.equal(markerTarget(''), null);
  assert.equal(markerTarget(undefined), null);
});

test('isQualifying drops [bot] logins, automation bodies, and deleted users', () => {
  assert.equal(isQualifying(rawComment(1, { author_association: 'OWNER' })), true);
  assert.equal(isQualifying(rawComment(1, { user: user('dependabot[bot]', 'User') })), false);
  assert.equal(isQualifying(rawComment(1, { user: user('someone', 'Bot') })), false);
  assert.equal(isQualifying(rawComment(1, { body: formatAutomationBody('ok', 'ic:1') })), false);
  assert.equal(isQualifying(rawComment(1, { body: 'quoted <!-- valdr-automation:v1 target=ic:1 --> text' })), false);
  assert.equal(isQualifying(rawComment(1, { user: null })), false);
  assert.equal(isQualifying(rawComment(1, { author_association: undefined })), false);
  assert.equal(isQualifying(rawComment(1, { author_association: 'FIRST_TIME_CONTRIBUTOR' })), false);
});

test('toItems keeps owner/member/collaborator and drops contributor, none, bots, and automation bodies', () => {
  const items = toItems({
    issueComments: [
      rawComment(1, { author_association: 'OWNER' }),
      rawComment(4, { author_association: 'CONTRIBUTOR' }),
      rawComment(5, { author_association: 'NONE' }),
      rawComment(7, { body: formatAutomationBody('Done.', 'ic:1') }),
    ],
    reviews: [rawReview(2, { author_association: 'MEMBER' })],
    reviewComments: [
      rawInline(3, { author_association: 'COLLABORATOR' }),
      rawInline(6, { user: user('ci[bot]', 'Bot') }),
    ],
  });
  assert.deepEqual(items.map(i => i.id), ['ic:1', 'rv:2', 'rc:3']);
  assert.deepEqual(items.map(i => i.kind), ['issue_comment', 'review', 'review_comment']);
});

test('toItems maps fields and sorts by createdAt then id', () => {
  const items = toItems({
    issueComments: [rawComment(10, { created_at: at(5) }), rawComment(9, { created_at: at(5) })],
    reviews: [rawReview(2, { submitted_at: at(1), state: 'APPROVED', body: 'LGTM' })],
    reviewComments: [rawInline(30, { created_at: at(5), in_reply_to_id: 3, line: null, original_line: 8 }), rawInline(3, { created_at: at(2) })],
  });
  assert.deepEqual(items.map(i => i.id), ['rv:2', 'rc:3', 'ic:9', 'ic:10', 'rc:30']);
  assert.deepEqual(items[0], { id: 'rv:2', kind: 'review', author: 'dev', body: 'LGTM', url: 'https://github.com/acme/widgets/pull/7#pullrequestreview-2', createdAt: at(1) });
  assert.deepEqual(items[1], { id: 'rc:3', kind: 'review_comment', author: 'dev', body: 'inline 3', url: 'https://github.com/acme/widgets/pull/7#discussion_r3', createdAt: at(2), path: 'src/a.js', line: 12 });
  assert.deepEqual(items[4], { id: 'rc:30', kind: 'review_comment', author: 'dev', body: 'inline 30', url: 'https://github.com/acme/widgets/pull/7#discussion_r30', createdAt: at(5), path: 'src/a.js', line: 8, inReplyTo: 'rc:3' });
});

test('toItems drops empty approved reviews but keeps empty changes-requested reviews', () => {
  const items = toItems({
    issueComments: [],
    reviews: [
      rawReview(1, { body: '', state: 'APPROVED' }),
      rawReview(2, { body: '   ', state: 'COMMENTED' }),
      rawReview(3, { body: '', state: 'CHANGES_REQUESTED' }),
      rawReview(4, { body: null, state: 'CHANGES_REQUESTED' }),
      rawReview(5, { body: 'Looks good', state: 'APPROVED' }),
    ],
    reviewComments: [],
  });
  assert.deepEqual(items.map(i => i.id), ['rv:3', 'rv:4', 'rv:5']);
  assert.equal(items[0].body, '');
  assert.equal(items[1].body, '');
});

test('normalizeState returns emptyState for null and rejects malformed state with invalid_state', () => {
  assert.deepEqual(emptyState(), { v: 1, handled: [], floor: null, checkFix: { lastSha: null, attempts: 0 }, inFlight: null, hold: null, notices: 0 });
  assert.notEqual(emptyState().handled, emptyState().handled);
  assert.deepEqual(normalizeState(null), emptyState());
  assert.deepEqual(normalizeState(undefined), emptyState());

  const full = stateWith({ handled: ['ic:1'], floor: at(1), checkFix: { lastSha: 'sha0', attempts: 2 }, inFlight: inFlight(), hold: { reason: 'round_failed', sinceHeadSha: 'sha1', since: at(1) }, notices: 4 });
  const copy = normalizeState(full);
  assert.deepEqual(copy, full);
  assert.notEqual(copy, full);
  assert.notEqual(copy.handled, full.handled);
  const { notices, ...legacy } = full;
  assert.deepEqual(normalizeState(legacy), { ...full, notices: 0 });
  const dated = stateWith({ inFlight: inFlight({ dispatchedAt: NOW }) });
  assert.deepEqual(normalizeState(dated), dated, 'dispatchedAt is kept');
  assert.equal(Object.hasOwn(normalizeState(full).inFlight, 'dispatchedAt'), false, 'an older in-flight round without dispatchedAt stays without it');

  const bad = [
    'state', 7, [], {}, { v: 2 },
    { ...emptyState(), v: 2 },
    { ...emptyState(), handled: 'ic:1' },
    { ...emptyState(), handled: [1] },
    { ...emptyState(), floor: 5 },
    { ...emptyState(), checkFix: null },
    { ...emptyState(), checkFix: { lastSha: null, attempts: -1 } },
    { ...emptyState(), checkFix: { lastSha: null, attempts: 1.5 } },
    { ...emptyState(), checkFix: { lastSha: 4, attempts: 0 } },
    { ...emptyState(), inFlight: {} },
    { ...emptyState(), inFlight: inFlight({ itemIds: 'ic:1' }) },
    { ...emptyState(), inFlight: inFlight({ checkFix: 'no' }) },
    { ...emptyState(), inFlight: inFlight({ runUlid: null }) },
    { ...emptyState(), inFlight: inFlight({ dispatchedAt: 5 }) },
    { ...emptyState(), inFlight: inFlight({ dispatchedAt: null }) },
    { ...emptyState(), inFlight: inFlight({ dispatchedAt: 'yesterday' }) },
    { ...emptyState(), hold: { reason: 'x' } },
    { ...emptyState(), hold: 'held' },
    { ...emptyState(), notices: -1 },
    { ...emptyState(), notices: 1.5 },
    { ...emptyState(), notices: '1' },
    { ...emptyState(), notices: null },
  ];
  for (const raw of bad) assert.throws(() => normalizeState(raw), error => error instanceof PrFeedbackError && error.code === 'invalid_state', JSON.stringify(raw));
});

test('markHandled appends without duplicates and does not mutate its input', () => {
  const state = deepFreeze(stateWith({ handled: ['ic:1'] }));
  const next = markHandled(state, ['ic:2', 'ic:1', 'ic:2'], [item(1), item(2)]);
  assert.deepEqual(next.handled, ['ic:1', 'ic:2']);
  assert.equal(next.floor, null);
  assert.deepEqual(state.handled, ['ic:1']);
});

test('decide closes merged PR and cancels an active round', () => {
  const state = stateWith({ inFlight: inFlight() });
  const merged = tick({ state, pr: pr({ state: 'closed', merged: true }), round: { status: 'running' } });
  assert.deepEqual({ decision: merged.decision, prOutcome: merged.prOutcome, cancelRound: merged.cancelRound }, { decision: 'closed', prOutcome: 'merged', cancelRound: 'yes' });
  assert.equal(Object.hasOwn(merged, 'roundFeedback'), false);
  assert.equal(merged.notice, '');
  assert.equal(merged.requestId, '');

  for (const status of ['pending', 'running', 'waiting', 'blocked']) {
    assert.equal(tick({ state, pr: pr({ state: 'closed' }), round: { status } }).cancelRound, 'yes', status);
  }
  for (const round of [undefined, { status: 'completed' }, { status: 'failed' }, { status: 'cancelled' }]) {
    const closed = tick({ state, pr: pr({ state: 'closed' }), round });
    assert.deepEqual({ decision: closed.decision, prOutcome: closed.prOutcome, cancelRound: closed.cancelRound }, { decision: 'closed', prOutcome: 'closed', cancelRound: 'no' });
  }
});

test('decide idles while a round is running', () => {
  const state = stateWith({ inFlight: inFlight() });
  for (const status of ['pending', 'running', 'waiting']) {
    const result = tick({ state, round: { status }, items: [item(1)], checks: { pending: false, failing: [failing] } });
    assert.deepEqual(result, { decision: 'idle', cancelRound: 'no', prOutcome: 'open', nextState: state, notice: '', noticeTarget: '', requestId: '' });
  }
});

test('a stalled round is cancelled and reported once', () => {
  assert.equal(MAX_ROUND_MS, 8 * 60 * 60 * 1000);
  const started = stateWith({ inFlight: inFlight({ runUlid: 'run-1', dispatchedAt: NOW }) });
  const late = afterNow(MAX_ROUND_MS + 1);
  for (const status of ['pending', 'running', 'waiting']) {
    const stalled = tick({ state: deepFreeze(structuredClone(started)), round: { status }, now: late, items: [item(1)], checks: { pending: false, failing: [failing] } });
    assert.equal(stalled.decision, 'report_failure', status);
    assert.equal(stalled.cancelRound, 'yes', 'the stalled round is cancelled');
    assert.equal(stalled.prOutcome, 'open');
    assert.equal(stalled.notice, "Automation paused this PR's follow-up: the last round could not finish (round_stalled). Comment on the PR to retry.");
    assert.equal(stalled.noticeTarget, 'notice:1');
    assert.deepEqual(stalled.nextState, { ...started, notices: 1, hold: { reason: 'round_stalled', sinceHeadSha: 'sha1', since: late }, inFlight: { ...started.inFlight, failureReported: true } });
    assert.equal(Object.hasOwn(stalled, 'roundFeedback'), false);
    assert.equal(stalled.requestId, '');

    // Reported once: while the cancel lands, later ticks idle without a second notice.
    const again = tick({ state: stalled.nextState, round: { status }, now: afterNow(2 * MAX_ROUND_MS), items: [item(1), item(2)] });
    assert.deepEqual(again, { decision: 'idle', cancelRound: 'yes', prOutcome: 'open', nextState: stalled.nextState, notice: '', noticeTarget: '', requestId: '' });
  }

  // Once cancelled the round is not reported again; the hold waits for a new comment, which starts a fresh, freshly dated round.
  const stalled = tick({ state: started, round: { status: 'running' }, now: late, items: [item(1)] });
  assert.equal(tick({ state: stalled.nextState, round: { status: 'cancelled' }, now: late, items: [item(1)] }).decision, 'idle');
  const retry = tick({ state: stalled.nextState, round: { status: 'cancelled' }, now: late, items: [item(1), item(2, { createdAt: afterNow(MAX_ROUND_MS + 2) })] });
  assert.equal(retry.decision, 'dispatch');
  assert.equal(retry.cancelRound, 'no');
  assert.equal(retry.nextState.hold, null);
  assert.equal(retry.nextState.inFlight.dispatchedAt, late);
  assert.equal(retry.nextState.inFlight.failureReported, false);
});

test('a slow round under the stall threshold idles', () => {
  const started = stateWith({ inFlight: inFlight({ runUlid: 'run-1', dispatchedAt: NOW }) });
  for (const elapsed of [0, 60 * 60 * 1000, MAX_ROUND_MS - 1, MAX_ROUND_MS]) {
    const result = tick({ state: started, round: { status: 'running' }, now: afterNow(elapsed), items: [item(1), item(2)] });
    assert.equal(result.decision, 'idle', `${elapsed} ms`);
    assert.equal(result.cancelRound, 'no');
    assert.deepEqual(result.nextState, started);
  }
  // A round recorded before rounds were dated is never treated as stalled.
  const undated = stateWith({ inFlight: inFlight({ runUlid: 'run-1' }) });
  assert.equal(tick({ state: undated, round: { status: 'running' }, now: afterNow(100 * MAX_ROUND_MS) }).decision, 'idle');
  // A blocked round is reported as blocked, not as stalled.
  const blocked = tick({ state: started, round: { status: 'blocked' }, now: afterNow(MAX_ROUND_MS + 1) });
  assert.equal(blocked.nextState.hold.reason, 'round_blocked');
  assert.equal(blocked.cancelRound, 'no');
});

test('every fresh dispatch is dated and recording preserves its original date', () => {
  const dispatched = tick({ items: [item(1)] });
  assert.equal(dispatched.nextState.inFlight.dispatchedAt, NOW);
  const recorded = normalizeState(dispatched.nextState);
  assert.equal(recorded.inFlight.dispatchedAt, NOW);
  assert.deepEqual(normalizeState(recorded), recorded);
  assert.equal(tick({ checks: { pending: false, failing: [failing] } }).nextState.inFlight.dispatchedAt, NOW);
  const uncertain = tick({ state: dispatched.nextState, now: afterNow(MAX_ROUND_MS) });
  assert.equal(uncertain.decision, 'report_failure');
  assert.equal(uncertain.nextState.hold.reason, 'round_uncertain');
  assert.equal(uncertain.nextState.inFlight.dispatchedAt, NOW);
});

test('decide completes a reported round and marks items handled', () => {
  const state = stateWith({ handled: ['ic:0'], checkFix: { lastSha: 'sha0', attempts: 2 }, inFlight: inFlight({ itemIds: ['ic:1'] }) });
  const done = tick({ state: deepFreeze(structuredClone(state)), round: { status: 'completed' }, items: [item(1)] });
  assert.equal(done.decision, 'complete');
  assert.equal(done.cancelRound, 'no');
  assert.equal(done.prOutcome, 'open');
  assert.deepEqual(done.nextState, { v: 1, handled: ['ic:0', 'ic:1'], floor: null, checkFix: { lastSha: 'sha0', attempts: 0 }, inFlight: null, hold: null, notices: 0 });
  assert.equal(done.noticeTarget, '');
  assert.equal(done.notice, '');
  assert.equal(Object.hasOwn(done, 'roundFeedback'), false);
  assert.equal(done.requestId, '');

  const fixed = tick({ state: stateWith({ checkFix: { lastSha: 'sha0', attempts: 1 }, inFlight: inFlight({ itemIds: [], headSha: 'sha2', checkFix: true }) }), round: { status: 'completed' } });
  assert.equal(fixed.decision, 'complete');
  assert.deepEqual(fixed.nextState.checkFix, { lastSha: 'sha2', attempts: 2 });
  assert.equal(fixed.nextState.inFlight, null);
});

test('decide reports a failed round once then holds', () => {
  const state = stateWith({ inFlight: inFlight() });
  const first = tick({ state: deepFreeze(structuredClone(state)), round: { status: 'failed' } });
  assert.equal(first.decision, 'report_failure');
  assert.equal(first.cancelRound, 'no');
  assert.equal(first.notice, "Automation paused this PR's follow-up: the last round could not finish (round_failed). Comment on the PR to retry.");
  assert.equal(first.noticeTarget, 'notice:1');
  assert.equal(first.nextState.notices, 1);
  assert.deepEqual(first.nextState.hold, { reason: 'round_failed', sinceHeadSha: 'sha1', since: NOW });
  assert.equal(first.nextState.inFlight.failureReported, true);
  assert.equal(Object.hasOwn(first, 'roundFeedback'), false);
  assert.equal(first.requestId, '');

  const second = tick({ state: first.nextState, round: { status: 'failed' }, items: [item(1)] });
  assert.equal(second.decision, 'idle');
  assert.deepEqual(second.nextState, first.nextState);
  assert.equal(second.notice, '');
  assert.equal(second.noticeTarget, '');

  for (const status of ['cancelled', 'blocked']) {
    const result = tick({ state, round: { status } });
    assert.equal(result.decision, 'report_failure', status);
    assert.match(result.notice, new RegExp(`\\(round_${status}\\)`));
    assert.equal(result.nextState.hold.reason, `round_${status}`);
  }
});

test('decide holds when the head branch is unavailable', () => {
  const first = tick({ pr: pr({ headAvailable: false }) });
  assert.equal(first.decision, 'report_failure');
  assert.equal(first.notice, "Automation can't update this PR: its head branch is unavailable.");
  assert.deepEqual(first.nextState.hold, { reason: 'head_unavailable', sinceHeadSha: 'sha1', since: NOW });

  const second = tick({ state: first.nextState, pr: pr({ headAvailable: false }), checks: { pending: false, failing: [failing] } });
  assert.equal(second.decision, 'idle');
  assert.deepEqual(second.nextState, first.nextState);

  const retry = tick({ state: first.nextState, pr: pr({ headAvailable: true }), items: [item(1, { createdAt: afterNow(1) })] });
  assert.equal(retry.decision, 'dispatch');
  assert.equal(retry.nextState.hold, null);
});

test('decide dispatches new comments and failing checks together with one requestId', () => {
  const result = tick({ state: deepFreeze(emptyState()), items: [item(1), item(2)], checks: { pending: false, failing: [failing] } });
  assert.equal(result.decision, 'dispatch');
  assert.equal(result.cancelRound, 'no');
  assert.equal(result.prOutcome, 'open');
  assert.equal(result.notice, '');
  assert.equal(result.requestId, 'req-fresh');
  assert.equal(Object.hasOwn(result, 'roundFeedback'), false);
  assert.deepEqual(result.nextState.inFlight, { requestId: 'req-fresh', itemIds: ['ic:1', 'ic:2'], headSha: 'sha1', checkFix: false, failureReported: false, dispatchedAt: NOW });
  assert.equal(result.nextState.hold, null);
  assert.deepEqual(result.nextState.handled, []);

  const checksOnly = tick({ checks: { pending: false, failing: [failing] } });
  assert.equal(checksOnly.decision, 'dispatch');
  assert.equal(Object.hasOwn(checksOnly, 'roundFeedback'), false);
  assert.equal(checksOnly.nextState.inFlight.checkFix, true);

  const commentsOnly = tick({ items: [item(1)] });
  assert.equal(Object.hasOwn(commentsOnly, 'roundFeedback'), false);
  assert.equal(commentsOnly.nextState.inFlight.checkFix, false);
});

test('decide skips handled, in-flight, and stale items and does not retry checks already fixed on this head', () => {
  const held = stateWith({ handled: ['ic:1'], floor: at(2), inFlight: inFlight({ itemIds: ['ic:3'], failureReported: true }), hold: { reason: 'round_failed', sinceHeadSha: 'sha1', since: at(1) } });
  assert.equal(tick({ state: held, round: { status: 'failed' }, items: [item(1), item(2), item(3)] }).decision, 'idle');
  const retried = tick({ state: held, round: { status: 'failed' }, items: [item(1), item(2), item(3), item(4)] });
  assert.equal(retried.decision, 'dispatch');
  assert.deepEqual(retried.nextState.inFlight.itemIds, ['ic:3', 'ic:4']);

  const settled = tick({ state: stateWith({ handled: ['ic:1'], floor: at(2), checkFix: { lastSha: 'sha1', attempts: 1 } }), items: [item(1), item(2)], checks: { pending: false, failing: [failing] } });
  assert.equal(settled.decision, 'idle');
});

test('a missing durable dispatch reports uncertainty instead of replaying an unbound turn', () => {
  for (const runUlid of ['', 'run-1']) {
    const state = stateWith({ inFlight: inFlight({ runUlid }) });
    const result = tick({ state, items: [item(1), item(2)] });
    assert.equal(result.decision, 'report_failure');
    assert.equal(result.nextState.hold.reason, 'round_uncertain');
    assert.equal(result.requestId, '');
    assert.equal(result.nextState.inFlight.requestId, 'req-old');
    assert.equal(result.nextState.inFlight.runUlid, runUlid);
  }
});

test('uncertain dispatch retries only after a new comment and uses a fresh request identity', () => {
  const failed = tick({ state: stateWith({ inFlight: inFlight({ runUlid: '' }) }), items: [item(1), item(2)] });
  assert.equal(tick({ state: failed.nextState, items: [item(1), item(2)] }).decision, 'idle');
  const retry = tick({ state: failed.nextState, items: [item(1), item(2), item(3, { createdAt: afterNow(1) })], freshRequestId: 'retry' });
  assert.equal(retry.decision, 'dispatch');
  assert.equal(retry.requestId, 'retry');
  assert.equal(retry.nextState.hold, null);
  assert.deepEqual(retry.nextState.inFlight.itemIds, ['ic:1', 'ic:2', 'ic:3']);
  assert.equal(Object.hasOwn(retry.nextState.inFlight, 'runUlid'), false);
});

test('an uncertain checkpoint retains its original batch and head until explicit retry', () => {
  const state = stateWith({ inFlight: inFlight({ runUlid: '', itemIds: ['ic:1', 'ic:2'] }) });
  const result = tick({ state, pr: pr({ headSha: 'sha2' }), items: [item(2), item(3)], checks: { pending: false, failing: [failing] } });
  assert.equal(result.decision, 'report_failure');
  assert.deepEqual(result.nextState.inFlight, { ...state.inFlight, failureReported: true });
  const retry = tick({ state: result.nextState, pr: pr({ headSha: 'sha2' }), items: [item(2), item(3, { createdAt: afterNow(1) })] });
  assert.equal(retry.decision, 'dispatch');
  assert.deepEqual(retry.nextState.inFlight.itemIds, ['ic:2', 'ic:3']);
  assert.equal(retry.nextState.inFlight.headSha, 'sha2');
});

test('legacy undated holds acquire a timestamp before they can accept a retry', () => {
  const held = stateWith({ inFlight: inFlight({ failureReported: true }), hold: { reason: 'round_failed', sinceHeadSha: 'sha1' } });
  const saved = tick({ state: held, round: { status: 'failed' }, items: [item(1), item(2)] });
  assert.equal(saved.decision, 'save');
  assert.equal(saved.nextState.hold.since, NOW);
  assert.equal(tick({ state: saved.nextState, round: { status: 'failed' }, items: [item(1), item(2)] }).decision, 'idle');
});

test('closed PR wins and an unavailable head cannot replay an uncertain batch', () => {
  const state = stateWith({ inFlight: inFlight({ requestId: 'req-old', runUlid: '', itemIds: ['ic:1'] }) });
  assert.equal(tick({ state, pr: pr({ state: 'closed' }), items: [item(1)] }).decision, 'closed');
  assert.equal(tick({ state, pr: pr({ headAvailable: false }), items: [item(1)] }).decision, 'report_failure');
});

test('dispatch checkpoints contain detached IDs rather than feedback bodies or logs', () => {
  const input = deepFreeze({ state: emptyState(), pr: pr(), items: [item(1)], checks: { pending: false, failing: [failing] }, freshRequestId: 'req-fresh', now: NOW });
  const snapshot = structuredClone(input);
  const result = decide(input);
  assert.equal(result.decision, 'dispatch');
  assert.equal(Object.hasOwn(result, 'roundFeedback'), false);
  assert.deepEqual(result.nextState.inFlight.itemIds, ['ic:1']);
  result.nextState.inFlight.itemIds.push('ic:99');
  assert.deepEqual(input, snapshot);
  const copy = boundedItem(input.items[0]); copy.body = 'changed';
  const log = boundedCheck(input.checks.failing[0]); log.name = 'changed';
  assert.deepEqual(input, snapshot);
});

test('decide stops fixing checks after three attempts', () => {
  const state = stateWith({ checkFix: { lastSha: 'sha0', attempts: 3 } });
  const result = tick({ state, checks: { pending: false, failing: [failing] } });
  assert.equal(result.decision, 'report_failure');
  assert.equal(result.notice, 'Automation stopped fixing checks after 3 attempts. Comment on the PR to retry.');
  assert.deepEqual(result.nextState.hold, { reason: 'checks_unresolved', sinceHeadSha: 'sha1', since: NOW });
  assert.equal(Object.hasOwn(result, 'roundFeedback'), false);
  assert.equal(result.requestId, '');

  const again = tick({ state: result.nextState, checks: { pending: false, failing: [failing] } });
  assert.equal(again.decision, 'idle');

  const lastTry = tick({ state: stateWith({ checkFix: { lastSha: 'sha0', attempts: 2 } }), checks: { pending: false, failing: [failing] } });
  assert.equal(lastTry.decision, 'dispatch');
});

test('decide waits while checks are pending', () => {
  const result = tick({ checks: { pending: true, failing: [] } });
  assert.equal(result.decision, 'idle');
  assert.deepEqual(result.nextState, emptyState());
  assert.equal(tick().decision, 'idle');
});

test('comment on hold retries and cancels a blocked round', () => {
  const held = stateWith({ inFlight: inFlight({ itemIds: ['ic:1'], failureReported: true }), hold: { reason: 'round_blocked', sinceHeadSha: 'sha1', since: at(1) } });
  const result = tick({ state: deepFreeze(structuredClone(held)), round: { status: 'blocked' }, items: [item(1), item(2)] });
  assert.equal(result.decision, 'dispatch');
  assert.equal(result.cancelRound, 'yes');
  assert.equal(result.nextState.hold, null);
  assert.equal(result.requestId, 'req-fresh');
  assert.deepEqual(result.nextState.inFlight.itemIds, ['ic:1', 'ic:2']);
  assert.deepEqual(result.nextState.inFlight, { requestId: 'req-fresh', itemIds: ['ic:1', 'ic:2'], headSha: 'sha1', checkFix: false, failureReported: false, dispatchedAt: NOW });

  const failedRound = tick({ state: held, round: { status: 'failed' }, items: [item(1), item(2)] });
  assert.equal(failedRound.decision, 'dispatch');
  assert.equal(failedRound.cancelRound, 'no');

  const noComment = tick({ state: held, round: { status: 'blocked' }, items: [item(1)] });
  assert.equal(noComment.decision, 'idle');
  assert.equal(noComment.cancelRound, 'no');
});

test('comment arriving mid-round is dispatched after completion', () => {
  const first = item(1);
  const second = item(2);

  const t1 = tick({ items: [first] });
  assert.equal(t1.decision, 'dispatch');
  const started = normalizeState(t1.nextState);

  const t2 = tick({ state: started, round: { status: 'running' }, items: [first, second] });
  assert.equal(t2.decision, 'idle');
  assert.deepEqual(t2.nextState, started);

  const t3 = tick({ state: t2.nextState, round: { status: 'completed' }, items: [first, second] });
  assert.equal(t3.decision, 'complete');
  assert.deepEqual(t3.nextState.handled, ['ic:1']);
  assert.equal(t3.nextState.inFlight, null);

  const t4 = tick({ state: t3.nextState, items: [first, second], freshRequestId: 'req-next' });
  assert.equal(t4.decision, 'dispatch');
  assert.equal(t4.requestId, 'req-next');
  assert.deepEqual(t4.nextState.inFlight.itemIds, ['ic:2']);
});

test('checkpoint stays under 64 KiB after 5000 handled items', () => {
  const items = Array.from({ length: 5000 }, (_, n) => item(1000000000 + n, { createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString() }));
  const state = markHandled(emptyState(), items.map(i => i.id), items);
  assert.ok(Buffer.byteLength(JSON.stringify(state)) <= 65536);
  assert.equal(state.handled.length, 2000);
  assert.deepEqual(state.handled, items.slice(3000).map(i => i.id));
  assert.equal(state.floor, items[2999].createdAt);

  const stale = tick({ state, items: [items[10]] });
  assert.equal(stale.decision, 'idle');
  const boundary = tick({ state, items: [items[2999]] });
  assert.equal(boundary.decision, 'idle');
  const handled = tick({ state, items: [items[4999]] });
  assert.equal(handled.decision, 'idle');
  const fresh = tick({ state, items: [item(1000005000, { createdAt: new Date(Date.UTC(2026, 0, 1, 0, 5000)).toISOString() })] });
  assert.equal(fresh.decision, 'dispatch');

  const newer = item(2000000000, { createdAt: '2026-06-01T00:00:00.000Z' });
  const later = markHandled(state, [newer.id], [...items, newer]);
  assert.equal(later.handled.length, 2000);
  assert.equal(later.handled.at(-1), newer.id);
  assert.equal(later.floor, items[3000].createdAt);
  assert.equal(markHandled(state, [newer.id], [newer]).floor, state.floor);
});

test('markHandled keeps the floor when dropped ids have no known createdAt', () => {
  const ids = Array.from({ length: 2003 }, (_, n) => `ic:${n}`);
  const state = markHandled(stateWith({ floor: at(1) }), ids, []);
  assert.equal(state.handled.length, 2000);
  assert.deepEqual(state.handled, ids.slice(3));
  assert.equal(state.floor, at(1));
});

test('decide does not mutate its input', () => {
  const input = deepFreeze({
    state: stateWith({ handled: ['ic:0'], inFlight: inFlight({ runUlid: '' }), hold: { reason: 'round_failed', sinceHeadSha: 'sha1', since: at(1) } }),
    pr: pr(), items: [item(1), item(2)], checks: { pending: false, failing: [failing] }, round: { status: 'failed' }, freshRequestId: 'req-fresh', now: NOW,
  });
  const snapshot = structuredClone(input);
  const result = decide(input);
  assert.deepEqual(input, snapshot);
  assert.notEqual(result.nextState, input.state);
});

test('decide rejects malformed input and state', () => {
  assert.throws(() => decide({ state: { v: 9 }, pr: pr(), items: [], checks: { pending: false, failing: [] }, freshRequestId: 'r', now: NOW }), { name: 'PrFeedbackError', code: 'invalid_state' });
  assert.throws(() => decide({ state: emptyState(), pr: pr(), items: 'nope', checks: { pending: false, failing: [] }, freshRequestId: 'r', now: NOW }), { name: 'PrFeedbackError', code: 'invalid_input' });
  assert.throws(() => decide({ state: emptyState(), pr: null, items: [], checks: { pending: false, failing: [] }, freshRequestId: 'r', now: NOW }), { name: 'PrFeedbackError', code: 'invalid_input' });
  assert.throws(() => decide({ state: emptyState(), pr: pr(), items: [], checks: { pending: false, failing: [] }, freshRequestId: '', now: NOW }), { name: 'PrFeedbackError', code: 'invalid_input' });
  // The current time is required: it dates each dispatched round and detects a stalled one.
  for (const now of [undefined, '', 'soon', 1767225600000, null]) {
    assert.throws(() => decide({ state: emptyState(), pr: pr(), items: [], checks: { pending: false, failing: [] }, freshRequestId: 'r', now }), { name: 'PrFeedbackError', code: 'invalid_input' }, String(now));
  }
});

const bytes = value => Buffer.byteLength(JSON.stringify(value));
const LIMIT = 65536;
const wide = (n, over = {}) => item(n, { id: `rc:${12345678901 + n}`, kind: 'review_comment', ...over });

test('dispatch caps a round at 50 items and leaves the rest for later rounds', () => {
  assert.equal(MAX_ROUND_ITEMS, 50);
  const items = Array.from({ length: 120 }, (_, n) => item(n + 1));
  const ids = items.map(i => i.id);
  let state = emptyState();
  const rounds = [];
  for (let guard = 0; guard < 10; guard += 1) {
    const result = tick({ state, items, freshRequestId: `req-${guard}` });
    if (result.decision !== 'dispatch') { assert.equal(result.decision, 'idle'); break; }
    rounds.push(result.nextState.inFlight.itemIds);
    assert.deepEqual(result.nextState.inFlight.itemIds, result.nextState.inFlight.itemIds);
    assert.equal(Object.hasOwn(result, 'roundFeedback'), false);
    const started = normalizeState(result.nextState);
    state = tick({ state: started, round: { status: 'completed' }, items }).nextState;
  }
  assert.deepEqual(rounds.map(r => r.length), [50, 50, 20]);
  assert.deepEqual(rounds[0], ids.slice(0, 50));
  assert.deepEqual(rounds[1], ids.slice(50, 100));
  assert.deepEqual(rounds[2], ids.slice(100));
  assert.deepEqual(state.handled, ids);
  assert.equal(state.inFlight, null);

  // Items held by an earlier round are kept ahead of newer ones when a retry would exceed the cap.
  const carried = items.slice(0, 50).map(i => i.id);
  const held = stateWith({ inFlight: inFlight({ itemIds: carried, failureReported: true }), hold: { reason: 'round_failed', sinceHeadSha: 'sha1', since: at(1) } });
  const retry = tick({ state: held, round: { status: 'failed' }, items: items.slice(0, 60) });
  assert.equal(retry.decision, 'dispatch');
  assert.deepEqual(retry.nextState.inFlight.itemIds, carried);
  const next = tick({ state: tick({ state: normalizeState(retry.nextState), round: { status: 'completed' }, items: items.slice(0, 60) }).nextState, items: items.slice(0, 60) });
  assert.equal(next.decision, 'dispatch');
  assert.deepEqual(next.nextState.inFlight.itemIds, items.slice(50, 60).map(i => i.id));
});

test('every nextState stays under 64 KiB with 5000 pending items', () => {
  const settled = Array.from({ length: 2000 }, (_, n) => wide(n));
  const pending = Array.from({ length: 5000 }, (_, n) => wide(2000 + n));
  const items = [...settled, ...pending];
  const base = stateWith({ handled: settled.map(i => i.id) });
  assert.ok(bytes(base) < LIMIT);

  // Drain every pending item round by round; each checkpoint must stay under the limit.
  let state = base;
  let rounds = 0;
  for (; rounds < 200; rounds += 1) {
    const dispatched = tick({ state, items });
    if (dispatched.decision !== 'dispatch') { assert.equal(dispatched.decision, 'idle'); break; }
    assert.ok(dispatched.nextState.inFlight.itemIds.length <= MAX_ROUND_ITEMS);
    assert.ok(bytes(dispatched.nextState) <= LIMIT, `dispatch round ${rounds}`);
    const started = normalizeState(dispatched.nextState);
    assert.ok(bytes(started) <= LIMIT);
    const completed = tick({ state: started, round: { status: 'completed' }, items });
    assert.equal(completed.decision, 'complete');
    assert.ok(bytes(completed.nextState) <= LIMIT, `complete round ${rounds}`);
    assert.ok(completed.nextState.handled.length <= MAX_ROUND_ITEMS + 2000);
    state = completed.nextState;
  }
  assert.equal(rounds, 100);
  assert.equal(state.handled.length, 2000);
  assert.ok(state.floor !== null);

  // Failure paths with a full handled set and a full round in flight.
  const full = stateWith({ handled: settled.map(i => i.id), inFlight: inFlight({ itemIds: pending.slice(0, 50).map(i => i.id) }) });
  const failed = tick({ state: full, round: { status: 'failed' }, items });
  assert.equal(failed.decision, 'report_failure');
  assert.ok(bytes(failed.nextState) <= LIMIT);
  const unavailable = tick({ state: base, pr: pr({ headAvailable: false }), items });
  assert.equal(unavailable.decision, 'report_failure');
  assert.ok(bytes(unavailable.nextState) <= LIMIT);
  const unresolved = tick({ state: stateWith({ handled: base.handled, checkFix: { lastSha: 'sha0', attempts: 3 } }), checks: { pending: false, failing: [failing] } });
  assert.equal(unresolved.decision, 'report_failure');
  assert.ok(bytes(unresolved.nextState) <= LIMIT);
  const held = tick({ state: failed.nextState, round: { status: 'failed' }, items });
  assert.ok(bytes(held.nextState) <= LIMIT);
});

test('settled green checks reset check-fix attempts via save', () => {
  const state = stateWith({ handled: ['ic:1'], checkFix: { lastSha: 'sha0', attempts: 3 } });
  const saved = tick({ state: deepFreeze(structuredClone(state)) });
  assert.equal(saved.decision, 'save');
  assert.deepEqual(saved.nextState, { ...state, checkFix: { lastSha: 'sha0', attempts: 0 } });
  assert.deepEqual({ cancelRound: saved.cancelRound, prOutcome: saved.prOutcome, notice: saved.notice, noticeTarget: saved.noticeTarget, requestId: saved.requestId }, { cancelRound: 'no', prOutcome: 'open', notice: '', noticeTarget: '', requestId: '' });

  // The reset is real: a later unrelated failure is fixed again instead of reported as unresolved.
  const later = tick({ state: saved.nextState, pr: pr({ headSha: 'sha2' }), checks: { pending: false, failing: [failing] } });
  assert.equal(later.decision, 'dispatch');

  // Once reset there is nothing left to save.
  assert.equal(tick({ state: saved.nextState }).decision, 'idle');

  // New feedback still dispatches first; a hold or an in-flight round blocks the reset.
  assert.equal(tick({ state, items: [item(2)] }).decision, 'dispatch');
  assert.equal(tick({ state: stateWith({ ...state, hold: { reason: 'round_failed', sinceHeadSha: 'sha1', since: at(1) } }) }).decision, 'idle');
  assert.equal(tick({ state: stateWith({ ...state, inFlight: inFlight() }), round: { status: 'running' } }).decision, 'idle');
  assert.equal(tick({ state, checks: { pending: false, failing: [failing] } }).decision, 'report_failure');
  const startedNoRound = tick({ state: stateWith({ ...state, inFlight: inFlight({ itemIds: ['ic:1'] }) }), items: [item(1)] });
  assert.equal(startedNoRound.decision, 'report_failure');
  assert.equal(startedNoRound.nextState.hold.reason, 'round_uncertain');
  assert.equal(startedNoRound.nextState.checkFix.attempts, 3);

  // End to end: a checks-only round that completes, then green checks, restores the full budget.
  const dispatched = tick({ state: stateWith({ checkFix: { lastSha: null, attempts: 0 } }), checks: { pending: false, failing: [failing] } });
  const done = tick({ state: normalizeState(dispatched.nextState), round: { status: 'completed' } });
  assert.deepEqual(done.nextState.checkFix, { lastSha: 'sha1', attempts: 1 });
  const green = tick({ state: done.nextState, pr: pr({ headSha: 'sha2' }) });
  assert.equal(green.decision, 'save');
  assert.deepEqual(green.nextState.checkFix, { lastSha: 'sha1', attempts: 0 });
});

test('pending checks do not reset attempts', () => {
  const state = stateWith({ checkFix: { lastSha: 'sha0', attempts: 2 } });
  const waiting = tick({ state, checks: { pending: true, failing: [] } });
  assert.equal(waiting.decision, 'idle');
  assert.deepEqual(waiting.nextState.checkFix, { lastSha: 'sha0', attempts: 2 });
  assert.deepEqual(waiting.nextState, state);
});

test('each failure episode gets a distinct notice target', () => {
  const first = item(1);
  const second = item(2, { createdAt: afterNow(1) });
  const dispatched = tick({ items: [first] });
  assert.equal(dispatched.noticeTarget, '');

  const f1 = tick({ state: normalizeState(dispatched.nextState), round: { status: 'failed' }, items: [first] });
  assert.equal(f1.decision, 'report_failure');
  assert.equal(f1.noticeTarget, 'notice:1');
  assert.equal(f1.nextState.notices, 1);
  assert.equal(tick({ state: f1.nextState, round: { status: 'failed' }, items: [first] }).noticeTarget, '');

  const retry = tick({ state: f1.nextState, round: { status: 'failed' }, items: [first, second] });
  assert.equal(retry.decision, 'dispatch');
  assert.equal(retry.noticeTarget, '');
  assert.equal(retry.nextState.notices, 1);

  const f2 = tick({ state: normalizeState(retry.nextState, 'run-2'), round: { status: 'blocked' }, items: [first, second] });
  assert.equal(f2.decision, 'report_failure');
  assert.equal(f2.noticeTarget, 'notice:2');

  const exhausted = tick({ state: stateWith({ notices: f2.nextState.notices, checkFix: { lastSha: 'sha0', attempts: 3 } }), checks: { pending: false, failing: [failing] } });
  assert.equal(exhausted.decision, 'report_failure');
  assert.equal(exhausted.noticeTarget, 'notice:3');

  const unavailable = tick({ state: stateWith({ notices: 3 }), pr: pr({ headAvailable: false }) });
  assert.equal(unavailable.noticeTarget, 'notice:4');

  const targets = [f1.noticeTarget, f2.noticeTarget, exhausted.noticeTarget, unavailable.noticeTarget];
  assert.equal(new Set(targets).size, 4);
  for (const target of targets) assert.equal(markerTarget(formatAutomationBody('x', target)), target);

  for (const result of [tick(), tick({ pr: pr({ state: 'closed' }) }), tick({ items: [first] })]) assert.equal(result.noticeTarget, '');
});

test('decide rejects checks without a boolean pending', () => {
  const run = checks => decide({ state: emptyState(), pr: pr(), items: [], checks, freshRequestId: 'req-fresh', now: NOW });
  for (const checks of [{ failing: [] }, { pending: 'no', failing: [] }, { pending: null, failing: [] }, { pending: 0, failing: [] }]) {
    assert.throws(() => run(checks), { name: 'PrFeedbackError', code: 'invalid_input' }, JSON.stringify(checks));
  }
  assert.equal(run({ pending: false, failing: [] }).decision, 'idle');
});

test('collected feedback helpers truncate bodies and logs without changing their inputs', () => {
  assert.equal(MAX_ITEM_BODY_CHARS, 4000);
  assert.equal(MAX_LOG_EXCERPT_BYTES, 8192);
  const long = item(1, { body: 'x'.repeat(4001) }), exact = item(2, { body: 'y'.repeat(4000) }), short = item(3);
  const first = boundedItem(deepFreeze(long));
  assert.equal(first.body, `${'x'.repeat(4000)}\n\n[truncated; full text: ${long.url}]`);
  assert.deepEqual({ ...first, body: '' }, { ...long, body: '' });
  assert.deepEqual(boundedItem(exact), exact);
  assert.deepEqual(boundedItem(short), short);
  assert.equal(long.body.length, 4001);
  const emoji = item(4, { body: `${'a'.repeat(3999)}\u{1F600}tail` });
  const cut = boundedItem(emoji).body;
  assert.ok(cut.isWellFormed());
  assert.equal(cut, `${'a'.repeat(3999)}\n\n[truncated; full text: ${emoji.url}]`);
  const ascii = { ...failing, logExcerpt: 'e'.repeat(9000) }, euro = { ...failing, logExcerpt: '\u20ac'.repeat(5000) }, small = { ...failing, logExcerpt: 'ok' };
  assert.equal(boundedCheck(ascii).logExcerpt, 'e'.repeat(8192));
  assert.equal(boundedCheck(euro).logExcerpt, '\u20ac'.repeat(2730));
  assert.ok(Buffer.byteLength(boundedCheck(euro).logExcerpt) <= 8192);
  assert.deepEqual(boundedCheck(small), small);
  assert.equal(ascii.logExcerpt.length, 9000);
});

test('maximum-size comments leave the dispatch decision small and collected content bounded', () => {
  const fills = ['a', '\u6f22', '"', '\u{1F600}'];
  const items = Array.from({ length: 60 }, (_, n) => item(n + 1, { body: fills[n % 4].repeat(65536 / fills[n % 4].length) }));
  const logs = Array.from({ length: 10 }, (_, n) => ({ ...failing, name: `job-${n}`, logExcerpt: 'l'.repeat(20000) }));
  const result = tick({ items, checks: { pending: false, failing: logs } });
  assert.equal(result.decision, 'dispatch');
  assert.equal(result.nextState.inFlight.itemIds.length, 50);
  assert.equal(Object.hasOwn(result, 'roundFeedback'), false);
  assert.ok(bytes(result) < 65536);
  const collected = { items: items.slice(0, 50).map(boundedItem), failingChecks: logs.map(boundedCheck) };
  assert.ok(collected.items.every(i => i.body.length <= 4000 + `\n\n[truncated; full text: ${i.url}]`.length));
  assert.ok(bytes(collected) < 1048576);
});
