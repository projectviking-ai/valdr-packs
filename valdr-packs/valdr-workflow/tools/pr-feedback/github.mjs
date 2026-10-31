import { spawnSync } from 'node:child_process';
import { PrFeedbackError, redact, safeMessage, secretValues } from './contract.mjs';
import { formatAutomationBody, markerTarget } from './feedback.mjs';

const ACCEPT = 'Accept: application/vnd.github+json';
// Same non-interactive settings as the generated gh starter tool.
const GH_ENVIRONMENT = { GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_NO_EXTENSION_UPDATE_NOTIFIER: '1', GH_TELEMETRY: '0', GH_PAGER: 'cat', PAGER: 'cat', NO_COLOR: '1' };
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_BUFFER = 64 * 1024 * 1024;
// Only conclusions a code change can fix; a cancelled or approval-gated check is not something a round can address.
const FAILING_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure']);
const MAX_FAILING_CHECKS = 10;
const MAX_EXCERPTED_CHECKS = 3;
const LOG_EXCERPT_LINES = 120;
const LOG_EXCERPT_BYTES = 8192;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const text = value => (isString(value) ? value : '');
const unexpected = () => new PrFeedbackError('github_unavailable', 'GitHub returned an unexpected response.');
const repoPath = (owner, repo) => `repos/${owner}/${repo}`;
const encodeRef = ref => ref.split('/').map(encodeURIComponent).join('/');

/**
 * Run `gh api <args>` with no shell and return stdout. HTTP 404 becomes `not_found`; every other failure becomes
 * `github_unavailable` with a redacted, bounded message that never echoes stdout.
 * @param {string[]} args @param {{env?: NodeJS.ProcessEnv, timeoutMs?: number, deadline?: number}} [options]
 */
function runGh(args, { env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, deadline } = {}) {
  const remaining = deadline === undefined ? Infinity : deadline - Date.now();
  if (remaining <= 0) throw new PrFeedbackError('github_unavailable', 'The request ran out of time before GitHub could be queried.');
  const result = spawnSync('gh', ['api', '-H', ACCEPT, ...args], {
    encoding: 'utf8', shell: false, stdio: ['ignore', 'pipe', 'pipe'], timeout: Math.min(timeoutMs, remaining), maxBuffer: MAX_BUFFER, env: { ...env, ...GH_ENVIRONMENT },
  });
  if (result.error) throw new PrFeedbackError('github_unavailable', `The gh CLI could not run (${result.error.code ?? 'error'}).`);
  if (result.status !== 0) {
    const stderr = text(result.stderr);
    if (/\bHTTP 404\b/.test(stderr)) throw new PrFeedbackError('not_found', 'The requested GitHub resource was not found.');
    throw new PrFeedbackError('github_unavailable', `gh api failed (${result.status ?? result.signal}): ${safeMessage(stderr, secretValues(env))}`);
  }
  return text(result.stdout);
}

/** @param {string[]} args @param {{env?: NodeJS.ProcessEnv, timeoutMs?: number, deadline?: number}} [options] @returns {unknown} */
export function ghJson(args, options) {
  const stdout = runGh(args, options);
  if (stdout.trim() === '') return null;
  try { return JSON.parse(stdout); } catch { throw unexpected(); }
}

/** All pages of a list endpoint. `--slurp` wraps the pages in one array; `flat` also accepts a single unwrapped page. */
function listAll(endpoint, options) {
  const pages = ghJson([`${endpoint}?per_page=100`, '--paginate', '--slurp'], options);
  if (!Array.isArray(pages)) throw unexpected();
  return pages.flat();
}

function listCheckRuns(endpoint, options) {
  const pages = ghJson([`${endpoint}?per_page=100`, '--paginate', '--slurp'], options);
  const list = Array.isArray(pages) ? pages : [pages];
  if (!list.every(page => isRecord(page) && Array.isArray(page.check_runs))) throw unexpected();
  return list.flatMap(page => page.check_runs);
}

/** Whether the head branch lives in the base repository; a fork's head, or a deleted fork's, does not. */
function isSameRepo(owner, repo, pr) {
  const headRepo = pr.head.repo;
  const baseName = isString(pr.base?.repo?.full_name) ? pr.base.repo.full_name : `${owner}/${repo}`;
  return isRecord(headRepo) && isString(headRepo.full_name) && headRepo.full_name.toLowerCase() === baseName.toLowerCase();
}

/** Head is unavailable when its fork is gone, or when an open pull request's same-repo branch has been deleted. */
function headAvailable(owner, repo, pr, options) {
  if (!isRecord(pr.head.repo)) return false;
  // Nothing acts on a closed pull request's head, so skip the lookup that could stall winding it down.
  if (pr.state === 'closed') return true;
  if (!isSameRepo(owner, repo, pr)) return true;
  try { ghJson([`${repoPath(owner, repo)}/branches/${encodeRef(pr.head.ref)}`], options); return true; }
  catch (error) { if (error instanceof PrFeedbackError && error.code === 'not_found') return false; throw error; }
}

/** Return GitHub evidence; the consuming workflow decides what a merge completes. */
export function readPr(owner, repo, number, options) {
  const pr = ghJson([`${repoPath(owner, repo)}/pulls/${number}`], options);
  if (!isRecord(pr) || !['open', 'closed'].includes(pr.state) || !isRecord(pr.head) || !isString(pr.head.sha) || !isString(pr.head.ref)
    || !isString(pr.base?.ref) || !pr.base.ref || !isString(pr.base?.repo?.full_name)
    || pr.base.repo.full_name.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) throw unexpected();
  const merged = pr.merged === true;
  if (merged && (pr.state !== 'closed' || !/^[0-9a-f]{40}$/.test(pr.merge_commit_sha) || !isString(pr.merged_at) || !Number.isFinite(Date.parse(pr.merged_at)))) throw unexpected();
  return { state: pr.state, merged, headSha: pr.head.sha, headRef: pr.head.ref,
    sameRepo: isSameRepo(owner, repo, pr), headAvailable: headAvailable(owner, repo, pr, options),
    mergeEvidence: merged ? { repository: pr.base.repo.full_name, baseBranch: pr.base.ref, headBranch: pr.head.ref, headSha: pr.head.sha, mergeCommitSha: pr.merge_commit_sha, mergedAt: pr.merged_at } : null };
}

/** Raw REST objects, unchanged, for `toItems`. */
export function readFeedbackRaw(owner, repo, number, options) {
  const root = repoPath(owner, repo);
  return {
    issueComments: listAll(`${root}/issues/${number}/comments`, options),
    reviews: listAll(`${root}/pulls/${number}/reviews`, options),
    reviewComments: listAll(`${root}/pulls/${number}/comments`, options),
  };
}

/** The last lines of a job log, redacted and cut on a character boundary to the byte limit. */
function logExcerpt(log, secrets) {
  const lines = log.split(/\r?\n/);
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  const tail = redact(lines.slice(-LOG_EXCERPT_LINES).join('\n'), secrets);
  const bytes = Buffer.from(tail, 'utf8');
  if (bytes.length <= LOG_EXCERPT_BYTES) return tail;
  let start = bytes.length - LOG_EXCERPT_BYTES;
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start++;
  return bytes.subarray(start).toString('utf8');
}

/** An excerpt is a nicety: a log that is expired, forbidden, or too large leaves the check without one. */
function jobLogExcerpt(owner, repo, jobId, options) {
  try { return logExcerpt(runGh([`${repoPath(owner, repo)}/actions/jobs/${jobId}/logs`], options), secretValues(options?.env)); }
  catch (error) { if (error instanceof PrFeedbackError) return ''; throw error; }
}

/**
 * Check runs for a commit. With includeLogs, at most three Actions jobs are excerpted. At most ten failing checks
 * are returned. A head with no check runs yet counts as pending, because CI may not have registered.
 * @returns {{pending: boolean, failing: {name: string, conclusion: string, url: string, logExcerpt: string}[]}}
 */
export function readChecks(owner, repo, sha, options) {
  const runs = listCheckRuns(`${repoPath(owner, repo)}/commits/${encodeURIComponent(sha)}/check-runs`, options);
  const failing = [];
  let excerpted = 0;
  for (const run of runs) {
    if (failing.length >= MAX_FAILING_CHECKS) break;
    if (!FAILING_CONCLUSIONS.has(run?.conclusion)) continue;
    const check = { name: text(run.name), conclusion: run.conclusion, url: text(run.html_url), logExcerpt: '' };
    if (options?.includeLogs && excerpted < MAX_EXCERPTED_CHECKS && run.app?.slug === 'github-actions' && Number.isSafeInteger(run.id)) {
      excerpted++;
      check.logExcerpt = jobLogExcerpt(owner, repo, run.id, options);
    }
    failing.push(check);
  }
  return { pending: runs.length === 0 || runs.some(run => run?.status !== 'completed'), failing };
}

/** The login of the authenticated account. Only its marker comments count as this tool's own. */
export function readLogin(options) {
  const user = ghJson(['user'], options);
  if (!isRecord(user) || !isString(user.login) || user.login === '') throw unexpected();
  return user.login;
}

/** The html_url of the first issue or review comment by `login` that carries the marker for `target`, else null. */
export function findMarkedIn({ issueComments, reviewComments }, target, login) {
  const own = entry => isString(entry?.user?.login) && entry.user.login.toLowerCase() === login.toLowerCase();
  for (const entry of [...issueComments, ...reviewComments]) if (own(entry) && markerTarget(entry.body) === target) return text(entry.html_url);
  return null;
}

export function findMarked(owner, repo, number, target, login, options) {
  const root = repoPath(owner, repo);
  return findMarkedIn({ issueComments: listAll(`${root}/issues/${number}/comments`, options), reviewComments: listAll(`${root}/pulls/${number}/comments`, options) }, target, login);
}

/**
 * What a reply needs to know about `itemId`. Inline replies carry the thread root, because GitHub rejects a reply to a
 * reply; a follow-up names the root in `in_reply_to_id`. A comment missing from the list is replied to by its own id,
 * so a vanished one surfaces as a 404 on post.
 */
export function findItem(raw, itemId) {
  const id = itemId.slice(3);
  if (itemId.startsWith('rc:')) {
    const parent = raw.reviewComments.find(entry => String(entry?.id) === id)?.in_reply_to_id;
    return { id: itemId, url: '', rootId: /^\d+$/.test(String(parent)) ? String(parent) : id };
  }
  const found = (itemId.startsWith('ic:') ? raw.issueComments : raw.reviews).find(entry => String(entry?.id) === id);
  return found === undefined ? null : { id: itemId, url: text(found.html_url) };
}

const createdUrl = created => text(isRecord(created) ? created.html_url : undefined);

function postIssueComment(owner, repo, number, body, options) {
  const created = ghJson([`${repoPath(owner, repo)}/issues/${number}/comments`, '--method', 'POST', '-f', `body=${body}`], options);
  return createdUrl(created);
}

/**
 * Reply to a feedback item: a threaded reply on the thread root for `rc:`, otherwise a conversation comment that quotes
 * the item's url. Either way the marker targets the item itself, so reconciliation is per item. A missing inline
 * parent surfaces as `not_found`.
 * @param {{id: string, url: string, rootId?: string}} item @returns {string} the posted comment's url
 */
export function postReply(owner, repo, number, item, body, options) {
  if (!item.id.startsWith('rc:')) return postIssueComment(owner, repo, number, formatAutomationBody(`> Re: ${item.url}\n\n${body}`, item.target ?? item.id), options);
  const created = ghJson([`${repoPath(owner, repo)}/pulls/${number}/comments/${item.rootId ?? item.id.slice(3)}/replies`, '--method', 'POST', '-f', `body=${formatAutomationBody(body, item.target ?? item.id)}`], options);
  return createdUrl(created);
}

/** A conversation comment carrying the marker for `target`. @returns {string} the posted comment's url */
export function postComment(owner, repo, number, target, body, options) {
  return postIssueComment(owner, repo, number, formatAutomationBody(body, target), options);
}
