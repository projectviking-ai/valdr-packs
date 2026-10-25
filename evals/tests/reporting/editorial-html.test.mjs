import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceFixture } from './fixtures.mjs';
import { loadEvidence } from '../../reporting/evidence.mjs';
import { buildReport } from '../../reporting/report.mjs';
import { compareEvidence } from '../../reporting/compare.mjs';
import { renderHtmlReport, renderHtmlComparison } from '../../reporting/html.mjs';

const plainText = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function elementAt(html, start, tag) {
  const tags = new RegExp(`</?${tag}\\b[^>]*>`, 'g');
  tags.lastIndex = start;
  let depth = 0;
  for (let match; (match = tags.exec(html));) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  assert.fail(`Missing closing ${tag}`);
}
function evidenceLedger(html) {
  const link = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .find(match => /inspect evidence/i.test(plainText(match[2])));
  assert.ok(link, 'The primary action should inspect the embedded evidence');
  const fragment = link[1].match(/href="#([^"]+)"/)?.[1];
  assert.ok(fragment, 'Inspect evidence should target a section in this report');
  const start = html.search(new RegExp(`<section\\b[^>]*\\bid="${fragment}"[^>]*>`));
  assert.ok(start >= 0, 'The primary action needs a matching evidence section');
  const ledger = elementAt(html, start, 'section');
  assert.ok([...ledger.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)]
    .some(match => plainText(match[1]) === 'What we tested'));
  assert.doesNotMatch(ledger.slice(0, ledger.indexOf('>')), /\bhidden(?:\s|=|>)/i);
  return ledger;
}
function variantDetails(ledger, id) {
  for (const match of ledger.matchAll(/<details\b[^>]*>/g)) {
    if (!match[0].includes(`data-variant="${id}"`)) continue;
    const details = elementAt(ledger, match.index, 'details');
    const summary = details.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? '';
    return { details, summary: plainText(summary) };
  }
  assert.fail(`Missing expandable evidence for variant ${id}`);
}
function editorialFixture(t, mutate = () => {}) {
  return evidenceFixture(t, evidence => {
    evidence.scenarios[0].brief = 'Produce the expected output and safely decline the unsafe input.';
    evidence.scenarios[1].brief = 'Correct a stale result using the permitted repair.';
    evidence.summary.results[0].attempts[0].evaluation = { ok: true, variants: [
      { id: 'nominal', ok: true, actualStatus: 'completed', assertions: [{ pass: true, message: 'Nominal output was persisted', actual: 'alpha-ready', expected: 'alpha-ready' }] },
      { id: 'expected-blocked', ok: true, actualStatus: 'blocked', assertions: [{ pass: true, message: 'Unsafe input was declined', actual: 'blocked', expected: 'blocked' }] },
    ] };
    evidence.summary.results[1].attempts[0].evaluation = { ok: false, variants: [{ id: 'obsolete-first-variant', ok: false,
      assertions: [{ pass: false, message: 'Obsolete first attempt check', actual: 'stale', expected: 'ready' }] }] };
    evidence.summary.results[1].attempts[1].author.finalMessage = 'Verified the final beta response.';
    evidence.summary.results[1].attempts[1].evaluation = { ok: true, variants: [{ id: 'final-pass', ok: true, actualStatus: 'completed', assertions: [
      { pass: true, message: 'Replacement was persisted', actual: 'beta-ready', expected: 'beta-ready' },
      { pass: true, message: 'Unrelated content was preserved', actual: 'unchanged', expected: 'unchanged' },
    ] }] };
    mutate(evidence);
  });
}
const render = fixture => renderHtmlReport(buildReport(loadEvidence(fixture.directory)));

test('editorial report separates accurate final-run facts and links directly to the evidence ledger', t => {
  const html = render(editorialFixture(t));
  const layout = html.search(/<(?:main|div)\b[^>]*class="[^"]*\breport-layout\b[^"]*"/);
  assert.ok(layout >= 0, 'The report needs the editorial content and facts layout');
  const asideStart = html.indexOf('<aside', layout);
  assert.ok(asideStart > layout, 'Run facts should be in a semantic aside');
  const facts = plainText(elementAt(html, asideStart, 'aside'));
  assert.match(facts, /example\/agent\.agent\.yaml/);
  assert.match(facts, /fixture-model/);
  assert.match(facts, /2026/);
  assert.match(facts, /10-16|Oct(?:ober)?\s+16|16\s+Oct/i);
  assert.match(facts, /passed/i);
  assert.match(facts, /final.{0,30}(?:checks|assertions)|(?:checks|assertions).{0,30}final/i);
  assert.match(facts, /4\s*\/\s*4/);
  assert.doesNotMatch(facts, /4\s*\/\s*5/);
  evidenceLedger(html);
});

test('the ledger exposes each final variant and its expected and actual assertion evidence inline', t => {
  const ledger = evidenceLedger(render(editorialFixture(t)));
  const nominal = variantDetails(ledger, 'nominal');
  assert.match(nominal.summary, /1\s*\/\s*1/);
  assert.match(nominal.summary, /pass/i);
  assert.match(nominal.details, /<th\b[^>]*>Actual<\/th>/i);
  assert.match(nominal.details, /<th\b[^>]*>Expected<\/th>/i);
  assert.match(nominal.details, /Nominal output was persisted/);
  assert.match(nominal.details, /alpha-ready/);
  const repaired = variantDetails(ledger, 'final-pass');
  assert.match(repaired.summary, /2\s*\/\s*2/);
  assert.match(repaired.details, /Replacement was persisted/);
  assert.match(repaired.details, /beta-ready/);
});

test('a blocked runtime status is a passing ledger variant when its canonical expectations passed', t => {
  const ledger = evidenceLedger(render(editorialFixture(t)));
  const blocked = variantDetails(ledger, 'expected-blocked');
  assert.match(blocked.summary, /1\s*\/\s*1/);
  assert.match(blocked.summary, /pass/i);
  assert.doesNotMatch(blocked.summary, /failed|needs a fix|blocked by policy|not scored/i);
  assert.match(blocked.details, /Unsafe input was declined/);
});

test('final ledgers keep separate case groups and preserve earlier attempts in supporting evidence', t => {
  const html = render(editorialFixture(t));
  const ledger = evidenceLedger(html);
  const first = ledger.indexOf('First case'), second = ledger.indexOf('Second case');
  assert.ok(first >= 0 && second > first, 'Every selected case needs its own named ledger group');
  assert.ok(ledger.indexOf('nominal') > first && ledger.indexOf('nominal') < second);
  assert.ok(ledger.indexOf('final-pass') > second);
  assert.doesNotMatch(ledger, /obsolete-first-variant|Obsolete first attempt check/);
  assert.match(html, /obsolete-first-variant/);
  assert.match(html, /Obsolete first attempt check/);
  assert.match(html, /Verified the final beta response\./);
});

test('absent checks and incomplete final attempts remain unscored rather than showing invented zero scores', t => {
  const html = render(editorialFixture(t, evidence => {
    evidence.summary.results[0].attempts[0].evaluation = { ok: true, variants: [{ id: 'no-check-receipt', ok: true, assertions: [] }] };
    evidence.summary.results[1].attempts[1] = { attempt: 2, infrastructureError: 'No final evaluation receipt' };
    evidence.summary.ok = false;
    evidence.summary.outcome = 'infrastructure_incomplete';
  }));
  const ledger = evidenceLedger(html);
  assert.match(plainText(ledger), /not scored|not recorded|no recorded assertions|no assertion|unavailable/i);
  assert.doesNotMatch(plainText(ledger), /0\s*\/\s*0|obsolete-first-variant/);
  assert.doesNotMatch(variantDetails(ledger, 'no-check-receipt').summary, /0\s*\/\s*0/);
});

test('editorial reports stay standalone while permitting bundled data icons', t => {
  const html = render(editorialFixture(t));
  assert.doesNotMatch(html, /<script\b|<iframe\b|<link\b/i);
  assert.doesNotMatch(html, /href="[^"]*\.json(?:[?#][^"]*)?"/i);
  assert.doesNotMatch(html, /(?:href|src)="https?:\/\//i);
  assert.doesNotMatch(html, /@import|url\(\s*["']?https?:\/\//i);
  for (const image of html.matchAll(/<img\b([^>]*)>/g)) {
    assert.match(image[1], /src="data:image\/(?:svg\+xml|png|webp);/i);
    assert.match(image[1], /\balt="/i);
  }
  assert.match(html, /Content-Security-Policy/);
});

test('comparison reports retain baseline and candidate measurements and supporting evidence', t => {
  const baseline = editorialFixture(t), candidate = editorialFixture(t);
  const comparison = compareEvidence(loadEvidence(baseline.directory), loadEvidence(candidate.directory));
  const html = renderHtmlComparison(comparison);
  assert.match(html, /Baseline/);
  assert.match(html, /Candidate/);
  assert.match(html, /unchanged/i);
  assert.match(html, /First: Pass/);
  assert.match(html, /Eventual: Pass/);
  assert.equal(html.split('Verified the final beta response.').length - 1, 2);
  assert.match(html, /Obsolete first attempt check/);
  assert.doesNotMatch(html, /href="[^"]*\.json(?:[?#][^"]*)?"/i);
});

for (const [shape, definitions] of [
  ['suite-specific metadata', { note: 'Suite-specific variant metadata' }],
  ['an array with an absent definition', [null, { id: 'nominal', expectedStatus: 'completed' }]],
]) test(`optional scenario variants containing ${shape} do not prevent rendering canonical results`, t => {
  const html = render(editorialFixture(t, evidence => {
    evidence.scenarios[0].variants = definitions;
  }));
  const nominal = variantDetails(evidenceLedger(html), 'nominal');
  assert.match(nominal.summary, /1\s*\/\s*1/);
  assert.match(nominal.summary, /pass/i);
  assert.match(nominal.details, /Nominal output was persisted/);
  assert.match(nominal.details, /alpha-ready/);
});

test('a replay interrupted before assertions labels the missing checks instead of showing a zero-score ratio', t => {
  const html = render(editorialFixture(t, evidence => {
    evidence.charter.mode = 'replay';
    delete evidence.summary.results;
    evidence.summary.ok = false;
    evidence.summary.outcome = 'candidate_failed';
    evidence.summary.evaluation = { ok: false, variants: [{
      id: 'runtime-disconnected', ok: false, assertions: [], error: 'Runtime disconnected before checks',
    }] };
  }));
  const ledger = plainText(evidenceLedger(html));
  assert.match(ledger, /Runtime disconnected before checks/);
  assert.match(ledger, /no recorded assertions|no assertion receipt|assertions not recorded/i);
  assert.doesNotMatch(ledger, /0\s*\/\s*0/);
});

test('run facts describe entirely unscored cases without displaying zero-score ratios', t => {
  const html = render(editorialFixture(t, evidence => {
    for (const result of evidence.summary.results) {
      result.attempts = [{ attempt: 1, infrastructureError: 'No evaluation receipt' }];
    }
    evidence.summary.ok = false;
    evidence.summary.outcome = 'infrastructure_incomplete';
  }));
  const facts = plainText(elementAt(html, html.indexOf('<aside'), 'aside'));
  assert.match(facts, /First attempt Not scored/);
  assert.match(facts, /Final result Not scored/);
  assert.doesNotMatch(facts, /0\s*\/\s*0/);
});
