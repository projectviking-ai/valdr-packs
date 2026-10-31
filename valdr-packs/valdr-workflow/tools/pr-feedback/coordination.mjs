import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrFeedbackError, validateInput } from './contract.mjs';

const fail = message => { throw new PrFeedbackError('coordination_blocked', message); };

export function reviewCandidates({ sessions, taskKey, implementationSessionUlid }) {
  if (sessions.length >= 1000) fail('Session discovery reached its limit.');
  return { candidates: sessions.filter(s => s.contextRef === `TASK-${taskKey}` && s.role === 'reviewer'
    && s.launchReason === `review-from:${implementationSessionUlid}`)
    .map(({ sessionUlid, startedAt }) => ({ sessionUlid, startedAt })) };
}

export function bindReviewers({ assignments, identities }) {
  if (!assignments.length) fail('The task has no staffed review assignments.');
  const handle = value => String(value ?? '').replace(/^@/, '').toLowerCase();
  const reviewers = assignments.map(a => {
    const matches = identities.map(row => row.outputs).filter(s => handle(s?.config?.['launch.targetAgentHandle']) === handle(a.reviewerHandle))
      .sort((a, b) => b.startedAt - a.startedAt || b.sessionUlid.localeCompare(a.sessionUlid));
    if (!matches.length || !a.id || !a.reviewerHandle) fail('An assigned reviewer has no original session.');
    return { sessionUlid: matches[0].sessionUlid, assignmentId: a.id, reviewerHandle: a.reviewerHandle };
  });
  if (new Set(reviewers.map(r => r.sessionUlid)).size !== reviewers.length) fail('Reviewer session bindings are ambiguous.');
  return { reviewers };
}

export function readImplementationResult({ requestId, itemIds, since }, cwd = process.cwd()) {
  if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(requestId)) fail('Invalid feedback batch identity.');
  const directory = path.join(cwd, '.valdr', 'pr-feedback');
  const file = path.join(directory, `${requestId}.json`);
  const blocked = () => ({ phase: 'blocked', result: { status: 'blocked', replies: itemIds.map(itemId => ({ itemId, body: 'The implementation did not provide a valid completion summary. Please review the work before retrying.' })) } });
  let result;
  try {
    if (spawnSync('git', ['check-ignore', '--quiet', '--', file], { cwd, timeout: 5000 }).status !== 0) return blocked();
    const stat = fs.statSync(file);
    if (fs.realpathSync(directory) !== directory || fs.lstatSync(file).isSymbolicLink() || stat.size > 16384
      || (since !== undefined && (!Number.isFinite(Date.parse(since)) || stat.mtimeMs < Date.parse(since)))) throw Error('Invalid file');
    result = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return blocked();
  }
  try {
    if (!result || !['implemented', 'blocked'].includes(result.status) || Object.keys(result).some(k => !['status', 'replies'].includes(k))) return blocked();
    validateInput('reply', { owner: 'validation', repo: 'validation', number: 1, replies: result.replies, allowedItemIds: itemIds });
    if (result.replies.length !== itemIds.length || result.replies.some(r => 'target' in r) || new Set(result.replies.map(r => r.itemId)).size !== itemIds.length) return blocked();
  } catch { return blocked(); }
  return { result, phase: result.status === 'blocked' ? 'blocked' : 'reviewing' };
}
