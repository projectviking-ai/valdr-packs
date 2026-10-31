import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyState } from '../../tools/pr-feedback/feedback.mjs';
import { observeSessions } from '../../tools/pr-feedback/session.mjs';
const now = Date.parse('2026-01-01T00:00:00Z');
const state = { ...emptyState(), inFlight: { requestId: 'r', itemIds: [], headSha: 'head', checkFix: true, failureReported: false, dispatchedAt: new Date(now).toISOString() } };
const inspect = (sessions, extra = {}) => observeSessions({ state, sessions, taskKey: 'example-1', implementationSessionUlid: 'impl', now: now + 1000, ...extra });
const implementation = { sessionUlid: 'impl', contextRef: 'TASK-example-1', role: 'executor', isLive: true };
test('observes live owned sessions without using unrelated sessions', () => {
  assert.equal(inspect([implementation]).roundStatus, 'running');
  assert.equal(inspect([{ ...implementation, contextRef: 'TASK-other' }]).hasActive, 'no');
  const reviewer = { sessionUlid: 'reviewer', contextRef: 'TASK-example-1', role: 'reviewer', launchReason: 'review-from:impl', canAbort: true };
  assert.equal(inspect([reviewer]).sessionUlid, 'reviewer');
  assert.equal(inspect([{ ...reviewer, launchReason: 'review-from:other' }]).hasActive, 'no');
});
test('inactive lifecycle status counts only after the recorded dispatch', () => {
  for (const status of ['idle', 'closed', 'failed']) {
    assert.equal(inspect([{ ...implementation, isLive: false, status, endedAt: now + 1 }]).roundStatus, status === 'failed' ? 'failed' : 'completed');
    assert.equal(inspect([{ ...implementation, isLive: false, status, endedAt: now - 1 }]).roundStatus, 'pending');
  }
});
test('uncertain work expires after the dispatch grace period', () => {
  assert.equal(inspect([]).roundStatus, 'pending');
  assert.equal(inspect([], { now: now + 120001 }).roundStatus, 'failed');
  assert.deepEqual(inspect([], { state: emptyState() }), { state: emptyState(), roundStatus: '', sessionUlid: '', hasActive: 'no' });
});
