import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput, normalizeAnswers } from '../../tools/decide/contract.mjs';

const items = ['code', 'documentation'].map(id => ({ id, description: id }));
const choice = () => ({ id: 'workKind', type: 'choice', instructions: 'Classify this work.', options: structuredClone(items), acceptance: { minSelectedProbability: 0.8 } });
const score = () => ({ id: 'size', type: 'score', instructions: 'Estimate size.', levels: ['small', 'medium', 'large'].map(id => ({ id, description: id })), acceptance: { minSelectedProbability: 0.4 } });
const predicate = () => ({ id: 'ready', type: 'predicate', instructions: 'Is this ready?', acceptance: { noAtMost: 0.2, yesAtLeast: 0.8 } });
const input = () => ({ engine: { provider: 'ollama', model: 'clef-flash:9b' }, text: 'Write a guide.', questions: [choice()] });
const invalid = value => assert.throws(() => validateInput(value), { code: 'invalid_input' });
const answer = (probabilities = { code: 0.8, documentation: 0.2 }) => ({ type: 'choice', providerSelected: 'code', probabilities });
const normalize = value => normalizeAnswers([choice()], { workKind: value }).workKind;
const invalidAnswer = value => assert.throws(() => normalize(value), { code: 'invalid_response' });

test('strict input requires explicit engine and policies and preserves caller data', () => {
  const value = input(); const before = structuredClone(value);
  assert.equal(validateInput(value), value); assert.deepEqual(value, before);
  for (const value of [null, [], 0, 'input', {}, { ...input(), url: 'http://localhost' }]) invalid(value);
  for (const key of ['provider', 'model']) { const value = input(); delete value.engine[key]; invalid(value); }
  for (const provider of ['unknown', 'constructor', null]) invalid({ ...input(), engine: { provider, model: 'test' } });
  for (const mutate of [
    v => v.engine.key = 'secret', v => v.questions[0].extra = true,
    v => v.questions[0].options[0].extra = true, v => v.questions[0].acceptance.extra = true,
    v => delete v.questions[0].acceptance, v => v.questions[0].levels = items,
    v => v.questions[0].type = 'other', v => v.engine = [],
  ]) { const value = input(); mutate(value); invalid(value); }
});

test('required strings reject blank values without trimming valid content', () => {
  for (const bad of ['', '  ', 12, null]) for (const mutate of [
    v => v.text = bad, v => v.engine.model = bad, v => v.questions[0].instructions = bad,
    v => v.questions[0].options[0].description = bad,
  ]) { const value = input(); mutate(value); invalid(value); }
  const value = input(); value.text = '  keep whitespace\n'; assert.equal(validateInput(value).text, value.text);
});

test('portable question/item limits accept boundaries and reject overflow', () => {
  for (const count of [1, 20]) { const value = input(); value.questions = Array.from({ length: count }, (_, n) => ({ ...choice(), id: `q${n}` })); validateInput(value); }
  for (const count of [0, 21]) { const value = input(); value.questions = Array.from({ length: count }, (_, n) => ({ ...choice(), id: `q${n}` })); invalid(value); }
  for (const [question, key, max] of [[choice(), 'options', 26], [score(), 'levels', 10]]) {
    for (const count of [2, max, 1, max + 1]) {
      const value = input(); value.questions = [{ ...question, [key]: Array.from({ length: count }, (_, n) => ({ id: `v${n}`, description: 'item' })) }];
      if (count < 2 || count > max) invalid(value); else validateInput(value);
    }
  }
});

test('identifiers are bounded unique and reserve uncertain/refused option names', () => {
  for (const id of ['', '_bad', '1bad', 'a.b', 'é', 'a'.repeat(65)]) { const value = input(); value.questions[0].id = id; invalid(value); }
  const value = input(); value.questions[0].id = 'a'.repeat(64); validateInput(value);
  value.questions.push(structuredClone(value.questions[0])); invalid(value);
  for (const bad of ['code', 'unsure', 'refused', 'not-valid']) { const value = input(); value.questions[0].options[1].id = bad; invalid(value); }
  for (const bad of ['small', 'unsure', 'refused']) { const value = input(); const q = score(); q.levels[1].id = bad; value.questions = [q]; invalid(value); }
});

test('policies require finite probabilities and strictly ordered predicate thresholds', () => {
  for (const threshold of [0, 1]) { const value = input(); value.questions[0].acceptance.minSelectedProbability = threshold; validateInput(value); }
  for (const threshold of [-0.1, 1.1, NaN, Infinity, '0.8']) { const value = input(); value.questions[0].acceptance.minSelectedProbability = threshold; invalid(value); }
  for (const acceptance of [{ noAtMost: 0, yesAtLeast: 1 }, { noAtMost: 0.2, yesAtLeast: 0.8 }]) validateInput({ ...input(), questions: [{ ...predicate(), acceptance }] });
  for (const acceptance of [{ noAtMost: 0.8, yesAtLeast: 0.2 }, { noAtMost: 0.5, yesAtLeast: 0.5 }, { noAtMost: 0, yesAtLeast: NaN }, { noAtMost: -1, yesAtLeast: 1 }, { yesAtLeast: 0.8 }]) invalid({ ...input(), questions: [{ ...predicate(), acceptance }] });
});

test('predicate outcomes include threshold endpoints', () => {
  for (const [probabilityTrue, outcome, status] of [[0.2, 'no', 'accepted'], [0.8, 'yes', 'accepted'], [0.5, 'unsure', 'uncertain']]) {
    assert.deepEqual(normalizeAnswers([predicate()], { ready: { type: 'predicate', probabilityTrue } }).ready, { type: 'predicate', status, outcome, probabilityTrue });
  }
  assert.throws(() => normalizeAnswers([predicate()], { ready: { type: 'predicate', probabilityTrue: NaN } }), { code: 'invalid_response' });
});

test('choice uses selected probability rather than provider confidence', () => {
  const result = normalize({ ...answer({ code: 0.79, documentation: 0.21 }), providerConfidence: 0.99 });
  assert.equal(result.outcome, 'unsure'); assert.equal(result.status, 'uncertain');
  assert.equal(result.selected, 'code'); assert.equal(result.selectedProbability, 0.79); assert.equal(result.providerConfidence, 0.99);
  assert.equal(normalize(answer()).outcome, 'code');
  assert.equal(Object.hasOwn(normalize(answer()), 'providerConfidence'), false);
  invalidAnswer({ ...answer(), providerConfidence: NaN });
});

test('ties stay uncertain at zero threshold and inconsistent provider selections fail', () => {
  const q = choice(); q.acceptance.minSelectedProbability = 0;
  assert.deepEqual(normalizeAnswers([q], { workKind: { ...answer({ code: 0.5, documentation: 0.5 }), providerSelected: 'documentation' } }).workKind,
    { type: 'choice', status: 'uncertain', outcome: 'unsure', selected: 'code', selectedProbability: 0.5, probabilities: { code: 0.5, documentation: 0.5 } });
  invalidAnswer({ ...answer(), providerSelected: 'documentation' }); invalidAnswer({ ...answer(), providerSelected: 'missing' });
});

test('score uses argmax rather than rounded expectation and validates supplied means', () => {
  const q = score();
  for (const [probabilities, expectedIndex, status] of [[{ small: 0.45, medium: 0.1, large: 0.45 }, 1, 'uncertain'], [{ small: 0.45, medium: 0.3, large: 0.25 }, 0.8, 'accepted']]) {
    const result = normalizeAnswers([q], { size: { type: 'score', probabilities, providerExpectedIndex: expectedIndex } }).size;
    assert.equal(result.selected, 'small'); assert.equal(result.selectedIndex, 0); assert.equal(result.selectedProbability, 0.45);
    assert.equal(result.expectedIndex, expectedIndex); assert.equal(result.status, status);
    assert.equal(result.outcome, status === 'accepted' ? 'small' : 'unsure');
  }
  const probabilities = { small: 0.45, medium: 0.3, large: 0.25 };
  normalizeAnswers([q], { size: { type: 'score', probabilities, providerExpectedIndex: 0.809 } });
  for (const providerExpectedIndex of [0.811, NaN, Infinity, '0.8']) assert.throws(() => normalizeAnswers([q], { size: { type: 'score', probabilities, providerExpectedIndex } }), { code: 'invalid_response' });
});

test('distributions require exact finite keys and preserve tolerated rounding', () => {
  for (const probabilities of [{ code: 0.8 }, { code: 0.8, documentation: 0.2, extra: 0 }, { code: -0.1, documentation: 1.1 }, { code: NaN, documentation: 1 }, { code: Infinity, documentation: 0 }, { code: '0.8', documentation: 0.2 }, { code: 0.8, documentation: 0.18 }, { code: 0.8, documentation: 0.22 }, null, []]) invalidAnswer({ ...answer(), probabilities });
  for (const last of [0.19, 0.195, 0.205, 0.21]) {
    const probabilities = { code: 0.8, documentation: last };
    assert.deepEqual(normalize(answer(probabilities)).probabilities, probabilities);
  }
});

test('answers require exact IDs and types and refusals contain no prediction', () => {
  for (const answers of [{}, { workKind: answer(), extra: answer() }, { workKind: { type: 'predicate', probabilityTrue: 1 } }, null, []]) assert.throws(() => normalizeAnswers([choice()], answers), { code: 'invalid_response' });
  const result = normalizeAnswers([choice(), predicate()], { workKind: { type: 'choice', refused: true }, ready: { type: 'predicate', probabilityTrue: 0.9 } });
  assert.deepEqual(result.workKind, { type: 'choice', status: 'refused', outcome: 'refused' }); assert.equal(result.ready.outcome, 'yes');
  invalidAnswer({ type: 'choice', refused: true, probabilities: { code: 1, documentation: 0 } });
});

test('constructor and toString are ordinary own question and option keys', () => {
  const q = choice(); q.id = 'constructor'; q.options = ['constructor', 'toString'].map(id => ({ id, description: id }));
  validateInput({ ...input(), questions: [q] });
  const result = normalizeAnswers([q], { constructor: { type: 'choice', providerSelected: 'constructor', probabilities: { constructor: 0.9, toString: 0.1 } } });
  assert.equal(result.constructor.outcome, 'constructor');
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(result)).constructor.probabilities, 'toString'), true);
});
