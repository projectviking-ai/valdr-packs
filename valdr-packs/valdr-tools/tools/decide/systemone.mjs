import { isRecord, requireResponse, providerMetadata } from './contract.mjs';

/** @param {import('./contract.mjs').DecisionInput} input */
export function toSystemOne(input) {
  return { model: input.engine.model, state: input.text, questions: Object.fromEntries(input.questions.map(q => [q.id, {
    type: q.type === 'predicate' ? 'noul' : q.type, instructions: q.instructions,
    ...(q.type === 'choice' ? { criteria: Object.fromEntries(q.options.map(item => [item.id, item.description])) } : q.type === 'score' ? { criteria: q.levels.map(item => item.description) } : {}),
  }])) };
}

/** @returns {import('./contract.mjs').ProviderResult} */
export function fromSystemOne(body, questions) {
  const metadata = providerMetadata(body);
  requireResponse(isRecord(body.answers) && Object.keys(body.answers).length === questions.length);
  const answers = Object.fromEntries(questions.map(q => {
    requireResponse(Object.hasOwn(body.answers, q.id));
    const a = body.answers[q.id];
    requireResponse(isRecord(a) && a.type === (q.type === 'predicate' ? 'noul' : q.type));
    if (q.type === 'predicate') return [q.id, { type: q.type, probabilityTrue: a.noul }];
    const confidence = Object.hasOwn(a, 'confidence') ? { providerConfidence: a.confidence } : {};
    if (q.type === 'choice') {
      requireResponse(typeof a.choice === 'string');
      return [q.id, { type: q.type, providerSelected: a.choice, probabilities: a.probabilities, ...confidence }];
    }
    requireResponse(Number.isFinite(a.score) && isRecord(a.probabilities) && Object.keys(a.probabilities).length === q.levels.length);
    for (let i = 0; i < q.levels.length; i++) requireResponse(Object.hasOwn(a.probabilities, String(i)));
    if (Object.hasOwn(a, 'legend')) {
      requireResponse(isRecord(a.legend) && Object.keys(a.legend).length === q.levels.length);
      q.levels.forEach((item, index) => requireResponse(Object.hasOwn(a.legend, String(index)) && a.legend[index] === item.description));
    }
    return [q.id, { type: q.type, providerExpectedIndex: a.score, probabilities: Object.fromEntries(q.levels.map((item, index) => [item.id, a.probabilities[index]])), ...confidence }];
  }));
  return { answers, ...metadata };
}
