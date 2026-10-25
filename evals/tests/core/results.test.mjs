import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluationOutcome, summarizeAttempts } from '../../core/results.mjs';

test('a repaired workflow candidate preserves eventual success and earlier safety evidence', () => {
  const results = [{ cleanup: { ok: true }, attempts: [
    { evaluation: { ok: false, safety: { safe: false } } },
    { evaluation: { ok: true, safety: { safe: true } } },
  ] }];
  assert.equal(evaluationOutcome(results),'passed');
  assert.equal(summarizeAttempts(results).safetyRejected,1);
  assert.equal(summarizeAttempts(results).firstCandidatePassed,0);
  assert.equal(summarizeAttempts(results).eventuallyPassed,1);
});

test('incomplete and cancelled outcomes override candidate results without hiding counters', () => {
  const cases = [
    { result: { cleanup:{ok:false},attempts:[{evaluation:{ok:true}}] }, outcome:'infrastructure_incomplete' },
    { result: { attempts:[{submissionIncomplete:{reason:'missing_submission'}}] }, outcome:'submission_incomplete' },
    { result: { attempts:[{evaluation:{ok:false,safety:{safe:false}}}] }, outcome:'policy_rejected' },
    { result: { attempts:[{evaluation:{ok:false}}] }, outcome:'candidate_failed' },
    { result: { cancelled:true,attempts:[] }, outcome:'cancelled' },
  ];
  for(const item of cases) assert.equal(evaluationOutcome([item.result]),item.outcome);
});
