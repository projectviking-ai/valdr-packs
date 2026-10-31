import { pathToFileURL } from 'node:url';
import { ACTIONS, MAX_INPUT_BYTES, PrFeedbackError, TOOL_ID, TOOL_REVISION, boundedEnvelope, safeMessage, secretValues, validateInput } from './contract.mjs';
import { advanceCoordination, answersQuestion, boundedCheck, boundedItem, decide, normalizeState, sanitizeBody, toItems } from './feedback.mjs';
import { observeSessions } from './session.mjs';
import { bindReviewers, readImplementationResult, reviewCandidates } from './coordination.mjs';
import { publishReviewed } from './publish.mjs';
import * as github from './github.mjs';

// The host kills the tool at 60 seconds, so GitHub calls share a smaller budget and fail cleanly instead.
const CALL_TIMEOUT_MS = 20000;
const REQUEST_BUDGET_MS = 50000;

const failure = (code, message) => ({ ok: false, error: { code, message } });
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const automationKey = (owner, repo, number) => `valdr-workflow.pr-watch:${owner}.${repo}.${number}`.toLowerCase().replace(/[^a-z0-9._:-]/g, '-').slice(0, 200);

function safeFailure(error, env = process.env) {
  if (error instanceof PrFeedbackError) return failure(error.code, error.message);
  process.stderr.write(`${safeMessage(error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error', secretValues(env))}\n`);
  return failure('internal_error', 'The pr-feedback request could not be processed.');
}

const handlers = {
  review_candidates: reviewCandidates,
  bind_reviewers: bindReviewers,
  advance: input => advanceCoordination(input),
  read_result: input => readImplementationResult(input),
  publish: (input, gh) => publishReviewed(input, { env: gh.env }),
  observe: input => observeSessions(input),
  /** A fork's head branch is not one the round can push to, so a fork pull request is a mismatch like a wrong branch. */
  identify({ owner, repo, number, headBranch }, gh) {
    const pr = github.readPr(owner, repo, number, gh);
    const outcome = pr.state === 'closed' ? 'not_open' : pr.headRef !== headBranch || !pr.sameRepo ? 'mismatch' : 'watchable';
    return { outcome, owner, repo, automationKey: automationKey(owner, repo, number), resourceKey: `${owner}/${repo}#${number}`, prState: pr.state };
  },

  /**
   * The content of one round, read fresh: the requested feedback items (in the requested order; ones that vanished or no
   * longer qualify are absent) and the failing checks for the head, bounded for the implementation prompt.
   * The round start only carries ids and a sha, so replaying it never depends on live GitHub data.
   */
  collect({ owner, repo, number, itemIds, headSha, state }, gh) {
    const current = normalizeState(state);
    const present = new Map(itemIds.length === 0 ? [] : toItems(github.readFeedbackRaw(owner, repo, number, gh)).map(item => [item.id, item]));
    const items = [...new Set(itemIds)].filter(id => present.has(id)).map(id => boundedItem(present.get(id)));
    const { failing } = github.readChecks(owner, repo, headSha, { ...gh, includeLogs: true });
    const questions = current.inFlight?.questions ?? [];
    return { itemIds: [...itemIds], items, failingChecks: failing.map(boundedCheck), headSha,
      questions: questions.map(q => ({ body: sanitizeBody(q.body), url: q.url, answerIds: items.filter(item => answersQuestion(q, item, questions)).map(item => item.id) })) };
  },

  /**
   * A closed pull request is reported without reading its branch, feedback or checks, so it can always be wound down.
   * No feedback or check content is returned (it can outgrow the result limit and would be stored with every run): a
   * dispatched round reads its own content with `collect`.
   */
  snapshot({ owner, repo, number, state, roundStatus, hasActive, freshRequestId }, gh) {
    const current = normalizeState(state);
    const pr = github.readPr(owner, repo, number, gh);
    const open = pr.state === 'open';
    const items = open ? toItems(github.readFeedbackRaw(owner, repo, number, gh)) : [];
    const checks = open ? github.readChecks(owner, repo, pr.headSha, gh) : { pending: false, failing: [] };
    const status = hasActive === 'yes' ? 'running' : roundStatus;
    const round = current.inFlight && status ? { status } : undefined;
    const decision = decide({ state: current, pr: { state: pr.state, merged: pr.merged, headSha: pr.headSha, headAvailable: pr.headAvailable }, items, checks, round, freshRequestId, now: new Date().toISOString() });
    // A live linked session prevents overlapping feedback; close still drains it before removing the watch.
    if (hasActive === 'yes') {
      if (decision.decision === 'closed') decision.cancelRound = 'yes';
      else if (decision.decision === 'dispatch') {
        decision.decision = 'idle';
        decision.nextState = current;
        decision.requestId = '';
      }
    }
    return { ...decision, headSha: pr.headSha, prState: pr.state, itemCount: items.length, mergeEvidence: pr.mergeEvidence };
  },

  /** Reconciles by marker before posting, so a repeated request returns `existing` instead of a second reply. */
  reply({ owner, repo, number, replies }, gh) {
    // A round that only fixed checks has no feedback to answer; workflows cannot skip the step, so an empty list is a no-op.
    if (replies.length === 0) return { results: [] };
    const raw = github.readFeedbackRaw(owner, repo, number, gh);
    const login = github.readLogin(gh);
    const posted = new Map();
    const results = [];
    for (const { itemId, body, target = itemId } of replies) {
      const known = posted.get(target) ?? github.findMarkedIn(raw, target, login);
      if (known !== null) { results.push({ itemId, outcome: 'existing', url: known }); continue; }
      const item = github.findItem(raw, itemId);
      if (item === null) { results.push({ itemId, outcome: 'missing', url: '' }); continue; }
      try {
        const url = github.postReply(owner, repo, number, { ...item, target }, body, gh);
        posted.set(target, url);
        results.push({ itemId, outcome: 'posted', url });
      } catch (error) {
        // Only an inline reply can 404 on its own parent; any other 404 means the pull request itself is gone.
        if (!(error instanceof PrFeedbackError && error.code === 'not_found' && itemId.startsWith('rc:'))) throw error;
        results.push({ itemId, outcome: 'missing', url: '' });
      }
    }
    return { results };
  },

  comment({ owner, repo, number, target, body }, gh) {
    const existing = github.findMarked(owner, repo, number, target, github.readLogin(gh), gh);
    return existing === null ? { outcome: 'posted', url: github.postComment(owner, repo, number, target, body, gh) } : { outcome: 'existing', url: existing };
  },
};

/** One validated Valdr request. Synchronous because every GitHub call is a blocking `gh` process. */
export function runRequest(request, { env = process.env } = {}) {
  try {
    if (!isRecord(request) || request.protocolVersion !== 1 || request.toolId !== TOOL_ID || request.toolRevision !== TOOL_REVISION || !ACTIONS.includes(request.action) || !nonempty(request.operationId) || !nonempty(request.attemptId)) {
      throw new PrFeedbackError('invalid_request', 'Expected a version 1 pr-feedback request with matching tool identity, a supported action, and operation and attempt IDs.');
    }
    const input = validateInput(request.action, request.input);
    const gh = { env, timeoutMs: CALL_TIMEOUT_MS, deadline: Date.now() + REQUEST_BUDGET_MS };
    return boundedEnvelope({ ok: true, data: handlers[request.action](input, gh) });
  } catch (error) { return boundedEnvelope(safeFailure(error, env)); }
}

async function main() {
  let result;
  try {
    const chunks = [];
    let size = 0;
    // Oversized input is drained rather than abandoned, so the host never sees a broken pipe.
    for await (const chunk of process.stdin) {
      size += chunk.byteLength;
      if (size <= MAX_INPUT_BYTES) chunks.push(chunk);
    }
    if (size > MAX_INPUT_BYTES) throw new PrFeedbackError('input_limit', 'The pr-feedback request exceeded the input byte limit.');
    let request;
    try { request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new PrFeedbackError('invalid_request', 'Expected one UTF-8 JSON request on stdin.'); }
    result = runRequest(request);
  } catch (error) { result = safeFailure(error); }
  process.stdout.write(`${JSON.stringify(boundedEnvelope(result))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
