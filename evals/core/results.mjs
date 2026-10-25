import { argumentsOf } from './arguments.mjs';
import { EvaluationInfrastructureError } from './lifecycle.mjs';

export function authorRequestSafety(requests) {
  if (!Array.isArray(requests) || requests.some(request => !request || typeof request.allowed !== 'boolean' || request.completed !== true)) {
    throw new EvaluationInfrastructureError('The author broker request audit is missing or incomplete.');
  }
  const errors = requests.filter(request => !request.allowed).map(request =>
    `Author request outside suite policy: ${request.params?.name ?? request.method}/${argumentsOf(request.params?.arguments)?.action ?? ''}.`);
  return { safe: errors.length === 0, errors };
}

export function evaluationOutcome(results, { cancelled = false } = {}) {
  if (cancelled || results.some(result => result.cancelled)) return 'cancelled';
  if (results.some(result => result.attempts.some(attempt => attempt.infrastructureError) || result.cleanup?.ok === false)) return 'infrastructure_incomplete';
  if (results.some(result => result.attempts.some(attempt => attempt.submissionIncomplete))) return 'submission_incomplete';
  if (results.length && results.every(result => result.attempts.some(attempt => attempt.evaluation?.ok))) return 'passed';
  if (results.some(result => !result.attempts.some(attempt => attempt.evaluation?.ok) && result.attempts.at(-1)?.evaluation?.safety?.safe === false)) return 'policy_rejected';
  return 'candidate_failed';
}

export function summarizeAttempts(results) {
  const evaluated = results.filter(result => result.attempts.some(attempt => attempt.evaluation));
  return {
    scenarios: results.length,
    authorScenariosEvaluated: evaluated.length,
    firstCandidatePassed: results.filter(result => result.attempts[0]?.evaluation?.ok).length,
    eventuallyPassed: results.filter(result => result.attempts.some(attempt => attempt.evaluation?.ok)).length,
    infrastructureIncomplete: results.filter(result => result.attempts.some(attempt => attempt.infrastructureError) || (result.cleanup && result.cleanup.ok !== true)).length,
    submissionIncomplete: results.filter(result => result.attempts.some(attempt => attempt.submissionIncomplete)).length,
    safetyRejected: results.filter(result => result.attempts.some(attempt => attempt.evaluation?.safety?.safe === false)).length,
    repairsUsed: results.reduce((total, result) => total + Math.max(0, result.attempts.length - 1), 0),
  };
}

export function classifySubmissionFailure(error, expectedPath) {
  if (error.code !== 'ENOENT' || error.path !== expectedPath) return null;
  return { reason: 'missing_submission', cause: 'undetermined' };
}

