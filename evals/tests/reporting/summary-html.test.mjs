import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceFixture } from './fixtures.mjs';
import { loadEvidence } from '../../reporting/evidence.mjs';
import { buildReport } from '../../reporting/report.mjs';
import { renderHtmlReport } from '../../reporting/html.mjs';

const plainText = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function section(html, heading) {
  const start = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)]
    .find(match => plainText(match[1]) === heading)?.index;
  assert.notEqual(start, undefined, `The report needs a ${heading} section`);
  return html.slice(start, html.indexOf('</section>', start));
}
function caseRow(ledger, title) {
  const group = [...ledger.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)]
    .map(match => match[1]).find(value => plainText(value.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '') === title);
  assert.ok(group, `The evidence ledger needs a case group for ${title}`);
  const variantsStart = group.indexOf('<details');
  return plainText(variantsStart < 0 ? group : group.slice(0, variantsStart));
}
function reportHtml(t, mutate = () => {}) {
  const fixture = evidenceFixture(t, mutate);
  return renderHtmlReport(buildReport(loadEvidence(fixture.directory)));
}
const assertions = (passed, total) => Array.from({ length: total }, (_, index) => ({
  pass: index < passed, message: `Check ${index + 1}`, actual: index < passed ? 'ready' : 'old', expected: 'ready',
}));

test('the report starts with a plain-language summary and an actionable next step before technical evidence', t => {
  const html = reportHtml(t);
  const summary = plainText(section(html, 'Run summary'));
  for (const label of ['What was tested', 'What happened', 'Next step']) assert.ok(summary.includes(label), label);
  assert.ok(html.indexOf('Run summary') < html.indexOf('Run context'));
  assert.ok(html.indexOf('Run summary') < html.indexOf('Execution configuration'));
  assert.match(summary, /task-repair/);
  assert.match(summary, /2\s+(?:selected\s+)?(?:cases|scenarios)|(?:cases|scenarios)[^.!?]{0,25}\b2\b/i);
  assert.match(summary, /first[- ]attempt|first try/i);
  assert.match(summary, /repair/i);
  const nextStep = summary.slice(summary.indexOf('Next step') + 'Next step'.length);
  assert.match(nextStep, /review|compare|repeat|expand|broader|more scenarios|more cases|baseline|repair/i);
});

test('final assertion counts do not include checks from an unsuccessful earlier attempt', t => {
  const html = reportHtml(t, evidence => {
    evidence.summary.results[0].attempts[0].evaluation.variants = [{ id: 'alpha', ok: true, assertions: assertions(2, 2) }];
    evidence.summary.results[1].attempts[0].evaluation.variants = [{ id: 'beta', ok: false, assertions: assertions(1, 2) }];
    evidence.summary.results[1].attempts[1].evaluation.variants = [{ id: 'beta', ok: true, assertions: assertions(2, 2) }];
  });
  const summary = plainText(section(html, 'Run summary'));
  assert.match(summary, /final[- ]attempt assertions/i);
  assert.match(summary, /4\s*\/\s*4/);
  assert.doesNotMatch(summary, /5\s*\/\s*6/);
  const breakdown = section(html, 'What we tested');
  assert.match(caseRow(breakdown, 'First case'), /2\s*\/\s*2/);
  assert.match(caseRow(breakdown, 'Second case'), /2\s*\/\s*2/);
});

test('case ledger distinguishes a first pass, a repaired pass, a failed candidate, and an unscored case', t => {
  const html = reportHtml(t, evidence => {
    evidence.scenarios.push({ id: 'gamma', title: 'Failed candidate' }, { id: 'delta', title: 'Interrupted candidate' });
    evidence.summary.results.push(
      { scenarioId: 'gamma', title: 'Failed candidate', cleanup: { ok: true }, attempts: [{ attempt: 1, author: { durationMs: 50 }, evaluation: { ok: false, variants: [{ id: 'gamma', ok: false, assertions: assertions(0, 1) }] } }] },
      { scenarioId: 'delta', title: 'Interrupted candidate', cleanup: { ok: true }, attempts: [{ attempt: 1, infrastructureError: 'Provider connection ended' }] },
    );
    evidence.summary.ok = false;
    evidence.summary.outcome = 'infrastructure_incomplete';
  });
  const breakdown = section(html, 'What we tested');
  assert.match(caseRow(breakdown, 'First case'), /passed.*first|first.*pass/i);
  assert.match(caseRow(breakdown, 'Second case'), /passed.*(?:after|repair).*1|passed.*1.*repair|repaired/i);
  assert.match(caseRow(breakdown, 'Failed candidate'), /needs a fix|did not pass|failed/i);
  const interrupted = caseRow(breakdown, 'Interrupted candidate');
  assert.match(interrupted, /not scored|unscored|incomplete|not evaluated/i);
  assert.doesNotMatch(interrupted, /needs a fix|candidate failed|did not pass/i);
});

test('an incomplete latest attempt cannot present an earlier attempt as final checks', t => {
  const html = reportHtml(t, evidence => {
    evidence.summary.ok = false;
    evidence.summary.outcome = 'infrastructure_incomplete';
    evidence.summary.results[1].attempts = [
      { attempt: 1, evaluation: { ok: false, variants: [{ id: 'beta', ok: false, assertions: assertions(1, 2) }] } },
      { attempt: 2, infrastructureError: 'No result receipt' },
    ];
  });
  const row = caseRow(section(html, 'What we tested'), 'Second case');
  assert.match(row, /not scored|unscored|incomplete|not evaluated|unknown|not recorded/i);
  assert.doesNotMatch(row, /1\s*\/\s*2/);
});

test('cleanup problems take priority in the recommended next action even when candidates passed', t => {
  const html = reportHtml(t, evidence => {
    evidence.summary.results[1].cleanup = { ok: false, error: 'Project still exists' };
    evidence.summary.outcome = 'infrastructure_incomplete';
    evidence.summary.ok = false;
  });
  const summary = plainText(section(html, 'Run summary'));
  const nextStep = summary.slice(summary.indexOf('Next step') + 'Next step'.length);
  assert.match(nextStep.slice(0, 220), /cleanup|clean up|temporary resources|isolated resources/i);
  assert.match(nextStep, /before|stop|resolve|verify|inspect|review/i);
});

for (const mode of ['check', 'replay']) test(`${mode} summary explains its evidence without claiming a new measured agent run`, t => {
  const html = reportHtml(t, evidence => {
    evidence.charter.mode = mode;
    delete evidence.summary.results;
    evidence.summary.cleanup = { ok: true };
    if (mode === 'check') evidence.summary.tools = ['pm_task', 'pm_health'];
    else evidence.summary.evaluation = { ok: true, variants: [{ id: 'replayed', ok: true, assertions: assertions(2, 2) }] };
  });
  const summary = plainText(section(html, 'Run summary'));
  assert.match(summary, mode === 'check' ? /check|preflight|compatibility/i : /replay|saved candidate|saved submission/i);
  assert.match(summary, /no (?:new )?(?:author|agent|provider|model) (?:run|turn|call|session)|not (?:an? )?(?:author|agent) performance|not a measured agent performance/i);
  assert.doesNotMatch(summary, /passed on (?:the )?first attempt|passed after \d+ repair|first[- ]attempt pass rate/i);
  assert.ok(summary.includes('Next step'));
});

test('a complete candidate failure recommends fixing the mismatch and rerunning the failed case', t => {
  const html = reportHtml(t, evidence => {
    evidence.scenarios = evidence.scenarios.slice(0, 1);
    evidence.summary.results = evidence.summary.results.slice(0, 1);
    evidence.summary.results[0].attempts[0].evaluation = { ok: false, variants: [{ id: 'alpha', ok: false, assertions: assertions(0, 1) }] };
    evidence.summary.outcome = 'candidate_failed';
    evidence.summary.ok = false;
  });
  const summary = plainText(section(html, 'Run summary'));
  const nextStep = summary.slice(summary.indexOf('Next step') + 'Next step'.length);
  assert.match(summary, /0 of 1 cases passed|1 (?:case )?(?:failed|did not pass|needs? a fix)/i);
  assert.match(nextStep, /expected.*actual|actual.*expected|mismatch/i);
  assert.match(nextStep, /fix|correct|revise/i);
  assert.match(nextStep, /rerun|run again/i);
  assert.doesNotMatch(nextStep, /missing evidence|runtime.*problem/i);
  assert.match(caseRow(section(html, 'What we tested'), 'First case'), /needs a fix|failed|did not pass/i);
});

test('a policy rejection recommends correcting the blocked action within the allowed policy', t => {
  const html = reportHtml(t, evidence => {
    evidence.scenarios = evidence.scenarios.slice(0, 1);
    evidence.summary.results = evidence.summary.results.slice(0, 1);
    evidence.summary.results[0].attempts[0].evaluation = {
      ok: false, safety: { safe: false, errors: ['An unauthorized tool call was attempted'] },
      variants: [{ id: 'alpha', ok: false, assertions: assertions(0, 1) }],
    };
    evidence.summary.outcome = 'policy_rejected';
    evidence.summary.ok = false;
  });
  const summary = plainText(section(html, 'Run summary'));
  const nextStep = summary.slice(summary.indexOf('Next step') + 'Next step'.length);
  assert.match(summary, /policy/i);
  assert.match(nextStep, /safety|blocked action|unauthorized/i);
  assert.match(nextStep, /allowed policy|permitted|within.*policy/i);
  assert.match(nextStep, /correct|fix|revise/i);
  assert.match(caseRow(section(html, 'What we tested'), 'First case'), /blocked by policy|policy rejected/i);
});

for (const actualStatus of ['blocked', 'refused']) test(`an expected ${actualStatus} execution status still counts as a passed case`, t => {
  const html = reportHtml(t, evidence => {
    evidence.scenarios = evidence.scenarios.slice(0, 1);
    evidence.summary.results = evidence.summary.results.slice(0, 1);
    evidence.summary.results[0].attempts[0].evaluation = {
      ok: true, variants: [{ id: 'alpha', ok: true, actualStatus,
        assertions: [{ pass: true, message: 'The unsafe request was declined', actual: actualStatus, expected: actualStatus }] }],
    };
  });
  const summary = plainText(section(html, 'Run summary'));
  const row = caseRow(section(html, 'What we tested'), 'First case');
  assert.match(summary, /1 of 1 cases passed|all selected cases passed|passed every selected case/i);
  assert.match(row, /passed.*first/i);
  assert.match(row, /1\s*\/\s*1/);
  assert.doesNotMatch(summary, /needs? a fix|blocked by policy|policy rejected/i);
  assert.doesNotMatch(row, /not scored|needs? a fix|blocked by policy/i);
});

test('missing cleanup evidence recommends verifying resources before another run', t => {
  const html = reportHtml(t, evidence => {
    delete evidence.summary.results[0].cleanup;
    evidence.summary.outcome = 'infrastructure_incomplete';
    evidence.summary.ok = false;
  });
  const summary = plainText(section(html, 'Run summary'));
  const nextStep = summary.slice(summary.indexOf('Next step') + 'Next step'.length);
  assert.match(summary, /cleanup.*(?:not verified|no verified|not recorded)|cleanup has no verified receipt/i);
  assert.match(nextStep, /cleanup|temporary resources/i);
  assert.match(nextStep, /verify.*before|before.*(?:rerun|another run|starting)/i);
});

test('a selected case that never started stays unscored in the case ledger', t => {
  const html = reportHtml(t, evidence => {
    evidence.summary.results = evidence.summary.results.slice(0, 1);
    evidence.summary.outcome = 'cancelled';
    evidence.summary.ok = false;
  });
  const row = caseRow(section(html, 'What we tested'), 'Second case');
  assert.match(row, /not scored|unscored|not started|not evaluated/i);
  assert.doesNotMatch(row, /needs a fix|passed|failed|\d+\s*\/\s*\d+/i);
  const summary = plainText(section(html, 'Run summary'));
  const nextStep = summary.slice(summary.indexOf('Next step') + 'Next step'.length);
  assert.match(nextStep, /unfinished|not started|remaining|unscored/i);
  assert.match(nextStep, /rerun|run/i);
  assert.doesNotMatch(nextStep, /cleanup/i);
});
