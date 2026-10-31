import { normalizeState } from './feedback.mjs';

const DISPATCH_GRACE_MS = 2 * 60 * 1000;

/** Observe compact lifecycle fields; idle/closed completion is best effort, not proof of publication. */
export function observeSessions({ state, sessions = [], implementationSessionUlid, taskKey, review, now = Date.now() }) {
  const next = normalizeState(state);
  const owned = sessions.filter(session => session?.contextRef === `TASK-${taskKey}`);
  const implementation = owned.find(session => session.sessionUlid === implementationSessionUlid);
  const live = session => session?.isLive === true || session?.canAbort === true;
  const active = live(implementation) ? implementation : owned.find(session => live(session)
    && session.role === 'reviewer' && session.launchReason === `review-from:${implementationSessionUlid}`);
  let roundStatus = '';
  if (next.inFlight) {
    const coordination = next.inFlight.coordination;
    const dispatchedAt = Date.parse(coordination?.stageAt ?? next.inFlight.dispatchedAt);
    // shortcut: lifecycle cannot identify queued turns; after this grace period require a new comment to retry.
    const unclear = () => now - dispatchedAt < DISPATCH_GRACE_MS ? 'pending' : 'failed';
    const status = session => live(session) ? 'running'
      : typeof session?.endedAt === 'number' && session.endedAt >= dispatchedAt && ['idle', 'closed', 'failed'].includes(session.status)
        ? session.status === 'failed' ? 'failed' : 'completed' : unclear();
    if (coordination?.phase === 'published') roundStatus = 'completed';
    else if (['publishing', 'blocked'].includes(coordination?.phase)) roundStatus = 'failed';
    else if (coordination?.phase === 'reviewing') {
      const statuses = coordination.reviewers.map(reviewer => status(owned.find(session => session.sessionUlid === reviewer.sessionUlid
        && session.role === 'reviewer' && session.launchReason === `review-from:${implementationSessionUlid}`)));
      if (statuses.includes('failed')) roundStatus = 'failed';
      else if (statuses.includes('running')) roundStatus = 'running';
      else if (statuses.includes('pending')) roundStatus = 'pending';
      else {
        const published = Array.isArray(review?.assignments) ? review.assignments : [];
        const assignments = coordination.reviewers.map(reviewer => published.find(assignment => assignment?.id === reviewer.assignmentId));
        const fresh = review?.id === coordination.reviewId && published.length === coordination.reviewers.length && assignments.every(assignment => typeof assignment?.completedAt === 'number'
          && assignment.completedAt >= dispatchedAt && ['approved', 'changes_requested'].includes(assignment.status));
        roundStatus = fresh ? assignments.some(assignment => assignment.status === 'changes_requested') ? 'ready_revise' : 'ready_publish' : unclear();
      }
    } else {
      roundStatus = status(implementation);
      if (coordination && roundStatus === 'completed') roundStatus = 'ready_review';
    }
  }
  return { state: next, roundStatus, sessionUlid: active?.sessionUlid ?? '', hasActive: active ? 'yes' : 'no' };
}
