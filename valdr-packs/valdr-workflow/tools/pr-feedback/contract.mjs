export const TOOL_ID = 'valdr-workflow.user.pr-feedback';
export const TOOL_REVISION = '1.2.1';
export const MAX_INPUT_BYTES = 1048576;
export const MAX_RESULT_BYTES = 1048576;
export const MAX_BODY_CHARS = 30000;
export const ROUND_STATUSES = ['pending', 'running', 'waiting', 'blocked', 'failed', 'completed', 'cancelled', 'ready_review', 'ready_revise', 'ready_publish'];
export const ACTIONS = ['identify', 'observe', 'snapshot', 'collect', 'reply', 'comment', 'review_candidates', 'bind_reviewers', 'advance', 'read_result', 'publish'];

export class PrFeedbackError extends Error {
  constructor(code, message) { super(message); this.name = 'PrFeedbackError'; this.code = code; }
}

export const SECRET_VARIABLES = ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN'];
/** The credential values present in `env`, for scrubbing from anything that may leave the process. */
export const secretValues = (env = process.env) => SECRET_VARIABLES.map(name => env[name]).filter(value => typeof value === 'string' && value !== '');

const GITHUB_TOKEN = /(?:gh[pousr]|github_pat)_\w+/g;
const BEARER_VALUE = /\b(?:bearer|token)\s+[A-Za-z0-9._~+/=-]{16,}/gi;
const MESSAGE_LIMIT = 300;

/** Scrubs GitHub tokens, bearer values, and any known secret values from text that may leave the process. */
export function redact(text, secrets = []) {
  let scrubbed = String(text);
  for (const secret of secrets) if (typeof secret === 'string' && secret.length >= 4) scrubbed = scrubbed.split(secret).join('[REDACTED]');
  return scrubbed.replace(BEARER_VALUE, '[REDACTED]').replace(GITHUB_TOKEN, '[REDACTED]');
}

/** A redacted, single-line, length-bounded rendering of untrusted text for error messages. */
export const safeMessage = (text, secrets = []) => redact(text, secrets).replace(/\s+/g, ' ').trim().slice(0, MESSAGE_LIMIT);

export function boundedEnvelope(envelope) {
  if (Buffer.byteLength(`${JSON.stringify(envelope)}\n`) <= MAX_RESULT_BYTES) return envelope;
  return { ok: false, error: { code: 'result_limit', message: 'The pr-feedback result exceeded the byte limit.' } };
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const nonblank = value => isString(value) && value.trim().length > 0;
const hasKeys = (value, required, optional = []) => isRecord(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));

const OWNER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,38}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
// Ids are canonical decimal numbers: no leading zeros, so one comment has exactly one target spelling.
const ITEM_ID = /^(?:ic|rv|rc):(?:0|[1-9]\d{0,19})$/;
const TARGET = /^(?:ic|rv|rc|pr|notice):(?:0|[1-9]\d{0,19})$/;
/**
 * Text that must never appear in a posted body, as one regular expression (also the manifest's `not.pattern`):
 * an automation marker (reconciliation reads the first marker in a comment; same text as feedback.mjs MARKER_PREFIX,
 * which this module cannot import, so a test pins them together), a local absolute path, or a ULID-shaped token.
 * A path prefix only counts where a path token starts (start of the body, whitespace, a quote, an opening bracket,
 * `=`, `:`, Markdown emphasis or table characters `*`, `_` and `|`, a home-directory `~`, or `file://`), so
 * `https://example.com/home/x` passes. A leading group is used instead of a lookbehind to keep the pattern plain ECMA
 * for the host validator.
 */
export const FORBIDDEN_BODY_PATTERN = [
  '<!-- valdr-automation:v1',
  '(^|[\\s"\'`(\\[<=:*_|~]|file://)(/Users/|/home/|/private/var/|/private/tmp/|C:\\\\Users\\\\)',
  '\\b[0-7][0-9A-HJKMNP-TV-Z]{25}\\b',
].join('|');
const FORBIDDEN_BODY = new RegExp(FORBIDDEN_BODY_PATTERN);
const isPositiveInteger = value => Number.isSafeInteger(value) && value >= 1;
const isBody = value => nonblank(value) && value.length <= MAX_BODY_CHARS && !value.includes('\0') && !FORBIDDEN_BODY.test(value);

/** Optional published questions supplied by the consuming workflow, including who may answer. */
export function validQuestions(value) {
  return Array.isArray(value) && value.length <= 10 && Buffer.byteLength(JSON.stringify(value)) <= 16384
    && new Set(value.map(q => q?.url)).size === value.length
    && value.every(q => hasKeys(q, ['body', 'url', 'createdAt', 'headSha', 'itemIds', 'answerAuthors', 'checkFix'], ['threadRootId'])
      && nonblank(q.body) && q.body.length <= 1000 && isString(q.url) && /^https:\/\/[^\s]+$/.test(q.url) && q.url.length <= 2048
      && isString(q.createdAt) && Number.isFinite(Date.parse(q.createdAt)) && /^[0-9a-f]{40}$/.test(q.headSha)
      && Array.isArray(q.itemIds) && q.itemIds.length <= 50 && q.itemIds.every(id => isString(id) && ITEM_ID.test(id))
      && Array.isArray(q.answerAuthors) && q.answerAuthors.length > 0 && q.answerAuthors.length <= 20 && q.answerAuthors.every(author => nonblank(author) && author.length <= 100)
      && typeof q.checkFix === 'boolean' && (q.threadRootId === undefined || (isString(q.threadRootId) && /^rc:(?:0|[1-9]\d{0,19})$/.test(q.threadRootId))));
}

const SHAPES = {
  identify: { required: ['owner', 'repo', 'number', 'headBranch'], optional: [] },
  observe: { required: ['state', 'sessions', 'implementationSessionUlid', 'taskKey'], optional: ['review'] },
  snapshot: { required: ['owner', 'repo', 'number', 'state', 'freshRequestId'], optional: ['roundStatus', 'hasActive'] },
  collect: { required: ['owner', 'repo', 'number', 'itemIds', 'headSha'], optional: ['state'] },
  reply: { required: ['owner', 'repo', 'number', 'replies'], optional: ['allowedItemIds'] },
  comment: { required: ['owner', 'repo', 'number', 'target', 'body'], optional: [] },
  review_candidates: { required: ['sessions', 'taskKey', 'implementationSessionUlid'], optional: [] },
  bind_reviewers: { required: ['assignments', 'identities'], optional: [] },
  advance: { required: ['state', 'phase'], optional: ['reviewId', 'reviewers', 'snapshot', 'result'] },
  read_result: { required: ['requestId', 'itemIds'], optional: ['since'] },
  publish: { required: ['owner', 'repo', 'number', 'remoteName', 'headBranch', 'expectedHeadSha', 'expectedTreeSha', 'paths'], optional: [] },
};

/**
 * Shape-check one action's input and return it unchanged. Owner, repo, and number reach GitHub paths, so they are
 * pinned to GitHub's own character sets. A stored `state` is only checked to be an object here; `normalizeState` owns
 * its structure.
 * @param {string} action @param {unknown} input
 */
export function validateInput(action, input) {
  const requireInput = condition => { if (!condition) throw new PrFeedbackError('invalid_input', `Invalid ${action} input; see the action's input schema.`); };
  const shape = Object.hasOwn(SHAPES, action) ? SHAPES[action] : undefined;
  requireInput(shape !== undefined && hasKeys(input, shape.required, shape.optional));
  if ('owner' in input) requireInput(isString(input.owner) && OWNER.test(input.owner) && isString(input.repo) && REPO.test(input.repo) && input.repo !== '.' && input.repo !== '..' && isPositiveInteger(input.number));
  if ('state' in input) requireInput(isRecord(input.state));
  if (action === 'review_candidates') requireInput(Array.isArray(input.sessions) && input.sessions.length <= 1000 && nonblank(input.taskKey) && nonblank(input.implementationSessionUlid));
  if (action === 'bind_reviewers') requireInput(Array.isArray(input.assignments) && input.assignments.length <= 50 && input.assignments.every(isRecord) && Array.isArray(input.identities) && input.identities.length <= 1000 && input.identities.every(isRecord));
  if (action === 'advance') requireInput(['implementing', 'reviewing', 'publishing', 'published', 'blocked'].includes(input.phase));
  if (action === 'read_result') requireInput(nonblank(input.requestId) && Array.isArray(input.itemIds) && input.itemIds.length <= 50 && input.itemIds.every(id => isString(id) && ITEM_ID.test(id)));
  if (action === 'publish') requireInput(nonblank(input.remoteName) && nonblank(input.headBranch) && /^[0-9a-f]{40}$/.test(input.expectedHeadSha) && /^[0-9a-f]{40}$/.test(input.expectedTreeSha) && Array.isArray(input.paths) && input.paths.length <= 1000 && input.paths.every(nonblank));
  if (action === 'observe') requireInput(Array.isArray(input.sessions) && input.sessions.length <= 1000 && nonblank(input.implementationSessionUlid) && nonblank(input.taskKey));
  if (action === 'identify') requireInput(nonblank(input.headBranch) && input.headBranch.length <= 255);
  if (action === 'snapshot') {
    requireInput(input.hasActive === undefined || ['yes', 'no'].includes(input.hasActive));
    requireInput(nonblank(input.freshRequestId) && input.freshRequestId.length <= 128);
    requireInput(input.roundStatus === undefined || input.roundStatus === '' || ROUND_STATUSES.includes(input.roundStatus));
  }
  if (action === 'collect') {
    requireInput(Array.isArray(input.itemIds) && input.itemIds.length <= 50 && input.itemIds.every(id => isString(id) && ITEM_ID.test(id)));
    requireInput(isString(input.headSha) && /^[0-9a-f]{40}$/.test(input.headSha));
  }
  if (action === 'reply') {
    requireInput(Array.isArray(input.replies) && input.replies.length <= 50);
    for (const entry of input.replies) requireInput(hasKeys(entry, ['itemId', 'body'], ['target']) && (entry.target === undefined || (isString(entry.target) && TARGET.test(entry.target))) && isString(entry.itemId) && ITEM_ID.test(entry.itemId) && isBody(entry.body));
    // The caller's own list of the items it means to answer, checked before anything is read or posted.
    const allowed = input.allowedItemIds;
    requireInput(allowed === undefined || (Array.isArray(allowed) && allowed.length <= 50 && allowed.every(id => isString(id) && ITEM_ID.test(id))));
    requireInput(allowed === undefined || input.replies.every(entry => allowed.includes(entry.itemId)));
  }
  if (action === 'comment') requireInput(isString(input.target) && TARGET.test(input.target) && isBody(input.body));
  return input;
}
