import { PrFeedbackError, validQuestions } from './contract.mjs';

export const HEADER = '🤖 Valdr workflow automation';
export const MARKER_PREFIX = '<!-- valdr-automation:v1';
export const MAX_HANDLED = 2000;
export const MAX_CHECK_FIX_ATTEMPTS = 3;
/** A round still pending, running or waiting this long after it was dispatched has stalled: it is cancelled and reported. */
export const MAX_ROUND_MS = 8 * 60 * 60 * 1000;
/** A round carries at most this many items so the checkpoint (itemIds) stays far below its size limit. */
export const MAX_ROUND_ITEMS = 50;
/** Round feedback is bounded: it flows into workflow inputs, an agent prompt, and a 1 MiB tool result. */
export const MAX_ITEM_BODY_CHARS = 4000;
export const MAX_LOG_EXCERPT_BYTES = 8192;

/** @typedef {{id: string, kind: 'issue_comment'|'review'|'review_comment', author: string, body: string, url: string, createdAt: string, path?: string, line?: number, inReplyTo?: string}} FeedbackItem */
/** @typedef {{name: string, conclusion: string, url: string, logExcerpt: string}} FailingCheck */
/** @typedef {{requestId: string, itemIds: string[], headSha: string, checkFix: boolean, failureReported: boolean, dispatchedAt?: string}} InFlight */
/** @typedef {{v: 1, handled: string[], floor: string|null, checkFix: {lastSha: string|null, attempts: number}, inFlight: InFlight|null, hold: {reason: string, sinceHeadSha: string, since?: string}|null, notices: number}} State */
/** @typedef {{decision: 'idle'|'closed'|'complete'|'save'|'report_failure'|'dispatch'|'review'|'revise'|'publish', cancelRound: 'yes'|'no', prOutcome: 'merged'|'closed'|'open', nextState: State, notice: string, noticeTarget: string, requestId: string}} Decision */

const TARGET = /^(ic|rv|rc):\d+$|^(pr|notice):\d+$/;
const MARKER = /<!-- valdr-automation:v1 target=((?:ic|rv|rc|pr|notice):\d+) -->/;
const QUALIFYING_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const ACTIVE = new Set(['pending', 'running', 'waiting']);
const FAILED = new Set(['failed', 'cancelled', 'blocked']);
const READY = new Set(['ready_review', 'ready_revise', 'ready_publish']);
const ROUND_STATUSES = new Set([...ACTIVE, ...FAILED, ...READY, 'completed']);

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** Unparseable timestamps sort first and never count as known. */
const stamp = value => { const t = Date.parse(value); return Number.isNaN(t) ? -Infinity : t; };
const isTimestamp = value => isString(value) && !Number.isNaN(Date.parse(value));
const nonblank = value => isString(value) && value.trim() !== '';
const validCoordination = value => isRecord(value)
  && Object.keys(value).every(key => ['phase', 'stageAt', 'pass', 'reviewId', 'reviewers', 'snapshot', 'result'].includes(key))
  && ['implementing', 'reviewing', 'publishing', 'published', 'blocked'].includes(value.phase)
  && isTimestamp(value.stageAt) && Number.isInteger(value.pass) && value.pass >= 1 && value.pass <= 3
  && nonblank(value.reviewId) && Array.isArray(value.reviewers) && value.reviewers.length > 0 && value.reviewers.length <= 1000
  && value.reviewers.every(reviewer => isRecord(reviewer)
    && Object.keys(reviewer).length === 3
    && ['sessionUlid', 'assignmentId', 'reviewerHandle'].every(key => nonblank(reviewer[key])))
  && new Set(value.reviewers.map(reviewer => reviewer.sessionUlid)).size === value.reviewers.length
  && new Set(value.reviewers.map(reviewer => reviewer.assignmentId)).size === value.reviewers.length
  && (value.snapshot === undefined || isRecord(value.snapshot))
  && (value.result === undefined || (isRecord(value.result) && Object.keys(value.result).length === 2
    && ['implemented', 'blocked'].includes(value.result.status) && Array.isArray(value.result.replies)
    && value.result.replies.length <= MAX_ROUND_ITEMS && Buffer.byteLength(JSON.stringify(value.result)) <= 16384
    && value.result.replies.every(reply => isRecord(reply) && Object.keys(reply).length === 2 && nonblank(reply.itemId) && nonblank(reply.body))
    && new Set(value.result.replies.map(reply => reply.itemId)).size === value.result.replies.length));

/** @param {string} body @param {string} target */
export function formatAutomationBody(body, target) {
  if (!isString(target) || !TARGET.test(target)) throw new PrFeedbackError('invalid_target', 'Automation target must be ic:<id>, rv:<id>, rc:<id>, pr:<number>, or notice:<number>.');
  return `${HEADER}\n\n${body}\n\n${MARKER_PREFIX} target=${target} -->`;
}

/** @param {string} body @returns {string|null} */
export function markerTarget(body) {
  const match = isString(body) ? MARKER.exec(body) : null;
  return match ? match[1] : null;
}

/** Owner, member, or collaborator humans; never bots or previous automation comments. */
export function isQualifying(raw) {
  const login = raw?.user?.login;
  if (!isString(login) || login === '') return false;
  if (raw.user.type === 'Bot' || login.endsWith('[bot]')) return false;
  if (!QUALIFYING_ASSOCIATIONS.has(raw.author_association)) return false;
  return !(isString(raw.body) && raw.body.includes(MARKER_PREFIX));
}

/** Remove hidden comments and directional/control characters from prompt evidence. */
export const sanitizeBody = value => String(value ?? '').replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');

export function answersQuestion(question, item, questions) {
  if (!question.answerAuthors.some(author => author.toLowerCase() === item.author?.toLowerCase()) || stamp(item.createdAt) <= stamp(question.createdAt)) return false;
  const body = sanitizeBody(item.body);
  const index = body.indexOf(question.url);
  if (index >= 0 && (index + question.url.length === body.length || /[\s)\]>"'.,!?]/.test(body[index + question.url.length]))) return true;
  return !!question.threadRootId && item.inReplyTo === question.threadRootId
    && questions.filter(q => q.threadRootId === question.threadRootId).length === 1;
}

/** Round-feedback copy of an item; only the copy is shortened, never state or the input. */
export const boundedItem = raw => {
  const item = { ...raw, body: sanitizeBody(raw.body) };
  if (!isString(item.body) || item.body.length <= MAX_ITEM_BODY_CHARS) return { ...item };
  let end = MAX_ITEM_BODY_CHARS;
  if (item.body.charCodeAt(end - 1) >= 0xd800 && item.body.charCodeAt(end - 1) <= 0xdbff) end -= 1;
  return { ...item, body: `${item.body.slice(0, end)}\n\n[truncated; full text: ${item.url}]` };
};
/** Round-feedback copy of a failing check, with its log excerpt held to MAX_LOG_EXCERPT_BYTES. */
export const boundedCheck = check => {
  if (!isString(check.logExcerpt) || Buffer.byteLength(check.logExcerpt) <= MAX_LOG_EXCERPT_BYTES) return { ...check };
  const bytes = Buffer.from(check.logExcerpt);
  let end = MAX_LOG_EXCERPT_BYTES;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return { ...check, logExcerpt: bytes.toString('utf8', 0, end) };
};

const idOf = (prefix, raw) => {
  const id = String(raw?.id);
  if (!/^\d+$/.test(id)) throw new PrFeedbackError('invalid_input', 'Feedback entries need a numeric GitHub id.');
  return `${prefix}:${id}`;
};
const idOrder = (a, b) => { const [ak, an] = a.split(':'); const [bk, bn] = b.split(':'); return cmp(ak, bk) || cmp(Number(an), Number(bn)); };
const text = value => (isString(value) ? value : '');

/** @returns {FeedbackItem[]} */
export function toItems({ issueComments = [], reviews = [], reviewComments = [] } = {}) {
  const items = [];
  const base = (prefix, kind, raw, createdAt) => ({ id: idOf(prefix, raw), kind, author: raw.user.login, body: text(raw.body), url: text(raw.html_url), createdAt: text(createdAt) });
  for (const raw of issueComments) if (isQualifying(raw)) items.push(base('ic', 'issue_comment', raw, raw.created_at));
  for (const raw of reviews) {
    if (!isQualifying(raw) || raw.state === 'PENDING') continue;
    if (text(raw.body).trim() === '' && raw.state !== 'CHANGES_REQUESTED') continue;
    items.push(base('rv', 'review', raw, raw.submitted_at ?? raw.created_at));
  }
  for (const raw of reviewComments) {
    if (!isQualifying(raw)) continue;
    const item = base('rc', 'review_comment', raw, raw.created_at);
    if (isString(raw.path)) item.path = raw.path;
    const line = raw.line ?? raw.original_line;
    if (Number.isInteger(line)) item.line = line;
    if (raw.in_reply_to_id !== undefined && raw.in_reply_to_id !== null) item.inReplyTo = idOf('rc', { id: raw.in_reply_to_id });
    items.push(item);
  }
  return items.sort((a, b) => cmp(stamp(a.createdAt), stamp(b.createdAt)) || idOrder(a.id, b.id));
}

/** @returns {State} */
export const emptyState = () => ({ v: 1, handled: [], floor: null, checkFix: { lastSha: null, attempts: 0 }, inFlight: null, hold: null, notices: 0 });

/** Validate a stored checkpoint and return a detached copy. @param {unknown} raw @returns {State} */
export function normalizeState(raw) {
  if (raw === null || raw === undefined) return emptyState();
  const valid = isRecord(raw) && raw.v === 1
    && Array.isArray(raw.handled) && raw.handled.every(isString)
    && (raw.floor === null || isTimestamp(raw.floor))
    && isRecord(raw.checkFix) && (raw.checkFix.lastSha === null || isString(raw.checkFix.lastSha)) && Number.isSafeInteger(raw.checkFix.attempts) && raw.checkFix.attempts >= 0
    && (raw.inFlight === null || (isRecord(raw.inFlight) && isString(raw.inFlight.requestId) && (raw.inFlight.runUlid === undefined || isString(raw.inFlight.runUlid)) && Array.isArray(raw.inFlight.itemIds) && raw.inFlight.itemIds.every(isString) && isString(raw.inFlight.headSha) && typeof raw.inFlight.checkFix === 'boolean' && typeof raw.inFlight.failureReported === 'boolean'
      // Rounds recorded before dispatchedAt existed have none and are never treated as stalled.
      && (raw.inFlight.dispatchedAt === undefined || isTimestamp(raw.inFlight.dispatchedAt))))
    && (raw.hold === null || (isRecord(raw.hold) && isString(raw.hold.reason) && isString(raw.hold.sinceHeadSha) && (raw.hold.since === undefined || isTimestamp(raw.hold.since))))
    && (raw.notices === undefined || (Number.isSafeInteger(raw.notices) && raw.notices >= 0));
  if (!valid || (raw.inFlight?.coordination !== undefined && (!validCoordination(raw.inFlight.coordination) || !isTimestamp(raw.inFlight.dispatchedAt) || stamp(raw.inFlight.coordination.stageAt) < stamp(raw.inFlight.dispatchedAt))) || (raw.questions !== undefined && !validQuestions(raw.questions)) || (raw.inFlight?.questions !== undefined && !validQuestions(raw.inFlight.questions)) || (raw.questions !== undefined && raw.inFlight?.questions !== undefined && !validQuestions([...raw.questions, ...raw.inFlight.questions]))) throw new PrFeedbackError('invalid_state', 'The stored PR follow-up state is invalid.');
  const { requestId, itemIds, headSha, checkFix, failureReported, dispatchedAt } = raw.inFlight ?? {};
  return {
    v: 1,
    handled: [...raw.handled],
    floor: raw.floor,
    checkFix: { lastSha: raw.checkFix.lastSha, attempts: raw.checkFix.attempts },
    inFlight: raw.inFlight === null ? null : { requestId, itemIds: [...itemIds], headSha, checkFix, failureReported, ...(dispatchedAt === undefined ? {} : { dispatchedAt }), ...(raw.inFlight.runUlid === undefined ? {} : { runUlid: raw.inFlight.runUlid }), ...(raw.inFlight.questions === undefined ? {} : { questions: structuredClone(raw.inFlight.questions) }), ...(raw.inFlight.coordination === undefined ? {} : { coordination: structuredClone(raw.inFlight.coordination) }) },
    hold: raw.hold === null ? null : { reason: raw.hold.reason, sinceHeadSha: raw.hold.sinceHeadSha, ...(raw.hold.since === undefined ? {} : { since: raw.hold.since }) },
    notices: raw.notices ?? 0,
    ...(raw.questions === undefined ? {} : { questions: structuredClone(raw.questions) }),
  };
}

/** Prepare the next stage before its workflow-owned effects; never refresh the batch deadline. */
export function advanceCoordination({ state, phase, reviewId, reviewers, snapshot, result, now = new Date().toISOString() }) {
  const next = normalizeState(state);
  const current = next.inFlight?.coordination;
  const allowed = current ? { implementing: ['reviewing', 'blocked'], reviewing: ['implementing', 'publishing'], publishing: ['published'], published: [], blocked: [] }[current.phase] : ['implementing'];
  if (!next.inFlight || next.hold || !isTimestamp(now) || (current && stamp(now) < stamp(current.stageAt)) || !allowed.includes(phase) || (phase === 'implementing' && current?.pass === 3)) {
    throw new PrFeedbackError('invalid_state', 'The PR coordination stage cannot advance.');
  }
  next.inFlight.coordination = {
    phase, stageAt: now,
    pass: current ? current.pass + (phase === 'implementing' ? 1 : 0) : 1,
    reviewId: current?.reviewId ?? reviewId,
    reviewers: current?.reviewers ?? reviewers,
    ...(phase === 'implementing' ? {} : snapshot === undefined ? current?.snapshot === undefined ? {} : { snapshot: current.snapshot } : { snapshot }),
    ...(phase === 'implementing' ? {} : result === undefined ? current?.result === undefined ? {} : { result: current.result } : { result }),
  };
  return { state: normalizeState(next) };
}

/**
 * Append ids to the handled set. Past MAX_HANDLED the oldest ids are dropped and `floor` rises to the newest
 * dropped createdAt, so `decide` still treats everything at or before the floor as handled. Pass the full
 * item list so dropped ids can be dated.
 * @param {State} state @param {string[]} itemIds @param {FeedbackItem[]} items @returns {State}
 */
export function markHandled(state, itemIds, items = []) {
  const next = normalizeState(state);
  const seen = new Set(next.handled);
  for (const id of itemIds) if (!seen.has(id)) { seen.add(id); next.handled.push(id); }
  const excess = next.handled.length - MAX_HANDLED;
  if (excess <= 0) return next;
  const created = new Map(items.map(item => [item.id, item.createdAt]));
  const ranked = next.handled.map((id, index) => ({ id, index, t: stamp(created.get(id)) }));
  const dropped = ranked.sort((a, b) => cmp(a.t, b.t) || a.index - b.index).slice(0, excess);
  const newest = dropped.reduce((best, entry) => (entry.t > best.t ? entry : best), { t: -Infinity });
  if (newest.t > (next.floor === null ? -Infinity : stamp(next.floor))) next.floor = created.get(newest.id);
  const gone = new Set(dropped.map(entry => entry.id));
  next.handled = next.handled.filter(id => !gone.has(id));
  return next;
}

const failureNotice = reason => {
  if (reason === 'head_unavailable') return "Automation can't update this PR: its head branch is unavailable.";
  if (reason === 'checks_unresolved') return `Automation stopped fixing checks after ${MAX_CHECK_FIX_ATTEMPTS} attempts. Comment on the PR to retry.`;
  return `Automation paused this PR's follow-up: the last round could not finish (${reason}). Comment on the PR to retry.`;
};

/**
 * One tick, one decision; the first matching rule wins and nothing is mutated. `now` (an ISO timestamp) dates a
 * dispatched round and decides whether an active round has stalled.
 * @param {{state: State, pr: {state: 'open'|'closed', merged: boolean, headSha: string, headAvailable: boolean}, items: FeedbackItem[], checks: {pending: boolean, failing: FailingCheck[]}, round?: {status: string}, freshRequestId: string, now: string}} input
 * @returns {Decision}
 */
export function decide(input) {
  const requireInput = condition => { if (!condition) throw new PrFeedbackError('invalid_input', 'Expected state, pull request, items, checks, an optional round, a fresh request id, and the current time.'); };
  requireInput(isRecord(input) && isRecord(input.pr) && ['open', 'closed'].includes(input.pr.state) && isString(input.pr.headSha) && typeof input.pr.headAvailable === 'boolean');
  requireInput(Array.isArray(input.items) && isRecord(input.checks) && typeof input.checks.pending === 'boolean' && Array.isArray(input.checks.failing) && isString(input.freshRequestId) && input.freshRequestId !== '');
  requireInput(isTimestamp(input.now));
  requireInput(input.round === undefined || input.round === null || (isRecord(input.round) && ROUND_STATUSES.has(input.round.status)));
  const state = normalizeState(input.state);
  const { pr, items } = input;
  const failing = input.checks.failing;
  const status = input.round?.status;
  const inFlight = state.inFlight;
  const result = (decision, extra = {}) => ({ decision, cancelRound: 'no', prOutcome: 'open', nextState: state, notice: '', noticeTarget: '', requestId: '', ...extra });
  // Each failure episode gets its own target so reconciliation never matches an earlier notice.
  const fail = (reason, nextInFlight = inFlight, cancelRound = 'no') => {
    const notices = state.notices + 1;
    return result('report_failure', { cancelRound, nextState: { ...state, notices, hold: { reason, sinceHeadSha: pr.headSha, since: input.now }, inFlight: nextInFlight }, notice: failureNotice(reason), noticeTarget: `notice:${notices}` });
  };
  // An undated round (recorded before rounds were dated) never stalls.
  const stalled = inFlight !== null && inFlight.dispatchedAt !== undefined && Date.parse(input.now) - Date.parse(inFlight.dispatchedAt) > MAX_ROUND_MS;

  if (pr.state === 'closed') return result('closed', { cancelRound: ACTIVE.has(status) || status === 'blocked' ? 'yes' : 'no', prOutcome: pr.merged ? 'merged' : 'closed' });
  if (READY.has(status) && inFlight && !state.hold) {
    if (stalled) return fail('round_stalled', { ...inFlight, failureReported: true }, 'yes');
    if (!pr.headAvailable) return fail('head_unavailable', { ...inFlight, failureReported: true });
    const expectedPhase = status === 'ready_review' ? 'implementing' : 'reviewing';
    if (inFlight.coordination?.phase !== expectedPhase) return fail('round_uncertain', { ...inFlight, failureReported: true });
    if (status === 'ready_revise' && inFlight.coordination.pass >= 3) return fail('review_limit', { ...inFlight, failureReported: true });
    return result({ ready_review: 'review', ready_revise: 'revise', ready_publish: 'publish' }[status]);
  }
  if (ACTIVE.has(status)) {
    if (stalled) return inFlight.failureReported ? result('idle', { cancelRound: 'yes' }) : fail('round_stalled', { ...inFlight, failureReported: true }, 'yes');
    return result('idle');
  }
  if (status === 'completed' && !state.hold) {
    const pending = state.questions ?? [];
    const nextState = inFlight ? markHandled(state, inFlight.itemIds.filter(id => !pending.some(q => q.itemIds.includes(id))), items) : { ...state };
    if (inFlight && !pending.some(q => q.checkFix && q.headSha === inFlight.headSha)) nextState.checkFix = inFlight.checkFix ? { lastSha: inFlight.headSha, attempts: state.checkFix.attempts + 1 } : { lastSha: state.checkFix.lastSha, attempts: 0 };
    return result('complete', { nextState: { ...nextState, inFlight: null, hold: null } });
  }
  if (FAILED.has(status) && inFlight && !inFlight.failureReported) return fail(`round_${status}`, { ...inFlight, failureReported: true });
  if (inFlight && !status && !inFlight.failureReported) return fail('round_uncertain', { ...inFlight, failureReported: true });
  if (!pr.headAvailable && !state.hold) return fail('head_unavailable');
  if (state.hold && state.hold.since === undefined) return result('save', { nextState: { ...state, hold: { ...state.hold, since: input.now } } });

  const handled = new Set(state.handled);
  const queued = new Set(inFlight?.itemIds);
  const floor = state.floor === null ? null : Date.parse(state.floor);
  const stale = item => floor !== null && Date.parse(item.createdAt) <= floor;
  const questions = state.questions ?? [];
  const waiting = new Set(questions.flatMap(q => q.itemIds));
  const fresh = items.filter(item => !handled.has(item.id) && !queued.has(item.id) && !waiting.has(item.id) && !stale(item));
  const answered = [...(inFlight?.questions ?? []), ...questions.filter(q => fresh.some(item => answersQuestion(q, item, questions)))];
  const reopened = new Set(answered.flatMap(q => q.itemIds));
  const awaitingAnswer = questions.some(q => q.checkFix && q.headSha === pr.headSha && !answered.includes(q));
  const eligible = failing.length > 0 && !awaitingAnswer && state.checkFix.lastSha !== pr.headSha && state.checkFix.attempts < MAX_CHECK_FIX_ATTEMPTS;
  // An explicit retry carries the previous batch along with new unhandled feedback.
  const freshIds = new Set(fresh.map(item => item.id));
  // Oldest first, capped: the rest stay unhandled and go out in later rounds.
  const itemIds = items.filter(item => !handled.has(item.id) && (queued.has(item.id) || freshIds.has(item.id) || reopened.has(item.id))).slice(0, MAX_ROUND_ITEMS).map(item => item.id);
  const dispatch = cancelRound => {
    const next = { requestId: input.freshRequestId, itemIds, headSha: pr.headSha, checkFix: state.questions === undefined ? itemIds.length === 0 : eligible, failureReported: false, dispatchedAt: input.now, ...(answered.length ? { questions: answered } : {}) };
    return result('dispatch', {
      cancelRound,
      nextState: { ...state, hold: null, inFlight: next, ...(state.questions === undefined ? {} : { questions: questions.filter(q => !answered.includes(q)) }) },
      requestId: next.requestId,
    });
  };

  if (state.hold) return fresh.some(item => stamp(item.createdAt) > stamp(state.hold.since)) ? dispatch(status === 'blocked' ? 'yes' : 'no') : result('idle');
  if (fresh.length > 0 || eligible) return dispatch('no');
  if (failing.length > 0 && !awaitingAnswer && state.checkFix.attempts >= MAX_CHECK_FIX_ATTEMPTS) return fail('checks_unresolved');
  // Green and settled with nothing in flight: earlier check-fix attempts no longer count against a later failure.
  if (inFlight === null && failing.length === 0 && !input.checks.pending && state.checkFix.attempts > 0) return result('save', { nextState: { ...state, checkFix: { lastSha: state.checkFix.lastSha, attempts: 0 } } });
  return result('idle');
}
