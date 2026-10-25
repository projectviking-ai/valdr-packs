export const TOOL_ID = 'valdr-tools.user.decide';
export const TOOL_REVISION = '1.0.0';
export const HTTP_TIMEOUT_MS = 50000;
export const MAX_INPUT_BYTES = 65536;
export const MAX_RESULT_BYTES = 65536;
export const MAX_RESPONSE_BYTES = 65536;
export const MAX_LOG_BYTES = 8192;
export const PROBABILITY_TOLERANCE = 0.01;

/** @typedef {'laya'|'ollama'|'jev'|'openai'} Provider */
/** @typedef {{id: string, description: string}} Item */
/** @typedef {{id: string, type: 'choice', instructions: string, options: Item[], acceptance: {minSelectedProbability: number}} | {id: string, type: 'predicate', instructions: string, acceptance: {noAtMost: number, yesAtLeast: number}} | {id: string, type: 'score', instructions: string, levels: Item[], acceptance: {minSelectedProbability: number}}} Question */
/** @typedef {{engine: {provider: Provider, model: string}, text: string, questions: Question[]}} DecisionInput */
/** @typedef {{type: 'choice', probabilities: Record<string, number>, providerSelected?: string, providerConfidence?: number} | {type: 'predicate', probabilityTrue: number} | {type: 'score', probabilities: Record<string, number>, providerExpectedIndex?: number, providerConfidence?: number} | {type: 'choice'|'predicate'|'score', refused: true}} CanonicalAnswer */
/** @typedef {{answers: Record<string, CanonicalAnswer>, resolvedModel?: string, modelDigest?: string, requestId?: string, usage?: {inputTokens?: number, outputTokens?: number}}} ProviderResult */

export class DecisionError extends Error {
  constructor(code, message) { super(message); this.name = 'DecisionError'; this.code = code; }
}

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const probability = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const idPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const identifier = value => typeof value === 'string' && idPattern.test(value);
const keysMatch = (value, required, optional = []) => isRecord(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const withinTolerance = (a, b) => Math.abs(a - b) <= PROBABILITY_TOLERANCE + Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 4;

/** Throw only authored messages, never provider bodies or request values. */
export function requireResponse(condition) {
  if (!condition) throw new DecisionError('invalid_response', 'The engine returned an invalid decision response.');
}

/** Translate documented metadata only; absent usage is never reported as zero. */
export function providerMetadata(body) {
  requireResponse(isRecord(body));
  const result = {};
  if (Object.hasOwn(body, 'model')) { requireResponse(nonempty(body.model)); result.resolvedModel = body.model; }
  if (Object.hasOwn(body, 'usage')) {
    requireResponse(isRecord(body.usage));
    const usage = {};
    for (const [wire, key] of [['input_tokens', 'inputTokens'], ['output_tokens', 'outputTokens']]) {
      if (Object.hasOwn(body.usage, wire)) { requireResponse(Number.isSafeInteger(body.usage[wire]) && body.usage[wire] >= 0); usage[key] = body.usage[wire]; }
    }
    if (Object.keys(usage).length) result.usage = usage;
  }
  return result;
}

/** @param {unknown} value @returns {DecisionInput} */
export function validateInput(value) {
  const requireInput = condition => { if (!condition) throw new DecisionError('invalid_input', 'Expected an explicit engine, nonempty text, and valid questions with acceptance policies.'); };
  requireInput(keysMatch(value, ['engine', 'text', 'questions']));
  requireInput(keysMatch(value.engine, ['provider', 'model']) && ['laya', 'ollama', 'jev', 'openai'].includes(value.engine.provider) && nonempty(value.engine.model));
  requireInput(nonempty(value.text) && Array.isArray(value.questions) && value.questions.length >= 1 && value.questions.length <= 20);
  const ids = new Set();
  for (const q of value.questions) {
    requireInput(isRecord(q) && ['choice', 'predicate', 'score'].includes(q.type));
    const itemKey = q.type === 'choice' ? 'options' : 'levels';
    requireInput(keysMatch(q, ['id', 'type', 'instructions', 'acceptance', ...(q.type === 'predicate' ? [] : [itemKey])]));
    requireInput(identifier(q.id) && !ids.has(q.id) && nonempty(q.instructions));
    ids.add(q.id);
    if (q.type === 'predicate') {
      requireInput(keysMatch(q.acceptance, ['noAtMost', 'yesAtLeast']) && probability(q.acceptance.noAtMost) && probability(q.acceptance.yesAtLeast) && q.acceptance.noAtMost < q.acceptance.yesAtLeast);
    } else {
      requireInput(keysMatch(q.acceptance, ['minSelectedProbability']) && probability(q.acceptance.minSelectedProbability));
      const items = q[itemKey]; const itemIds = new Set();
      requireInput(Array.isArray(items) && items.length >= 2 && items.length <= (q.type === 'choice' ? 26 : 10));
      for (const item of items) {
        requireInput(keysMatch(item, ['id', 'description']) && identifier(item.id) && !['unsure', 'refused'].includes(item.id) && !itemIds.has(item.id) && nonempty(item.description));
        itemIds.add(item.id);
      }
    }
  }
  return value;
}

/** @param {Question[]} questions @param {Record<string, CanonicalAnswer>} answers */
export function normalizeAnswers(questions, answers) {
  requireResponse(keysMatch(answers, questions.map(q => q.id)));
  return Object.fromEntries(questions.map(q => {
    const a = answers[q.id];
    requireResponse(isRecord(a) && a.type === q.type);
    if (Object.hasOwn(a, 'refused')) {
      requireResponse(keysMatch(a, ['type', 'refused']) && a.refused === true);
      return [q.id, { type: q.type, status: 'refused', outcome: 'refused' }];
    }
    if (q.type === 'predicate') {
      requireResponse(keysMatch(a, ['type', 'probabilityTrue']) && probability(a.probabilityTrue));
      const outcome = a.probabilityTrue >= q.acceptance.yesAtLeast ? 'yes' : a.probabilityTrue <= q.acceptance.noAtMost ? 'no' : 'unsure';
      return [q.id, { type: q.type, status: outcome === 'unsure' ? 'uncertain' : 'accepted', outcome, probabilityTrue: a.probabilityTrue }];
    }
    requireResponse(keysMatch(a, ['type', 'probabilities'], ['providerConfidence', q.type === 'choice' ? 'providerSelected' : 'providerExpectedIndex']));
    const items = q.type === 'choice' ? q.options : q.levels;
    requireResponse(keysMatch(a.probabilities, items.map(item => item.id)));
    const values = items.map(item => a.probabilities[item.id]);
    requireResponse(values.every(probability) && withinTolerance(values.reduce((sum, p) => sum + p, 0), 1));
    const selectedProbability = Math.max(...values);
    const selectedIndex = values.indexOf(selectedProbability);
    const selected = items[selectedIndex].id;
    if (Object.hasOwn(a, 'providerSelected')) requireResponse(typeof a.providerSelected === 'string' && Object.hasOwn(a.probabilities, a.providerSelected) && a.probabilities[a.providerSelected] === selectedProbability);
    const expectedIndex = values.reduce((sum, p, index) => sum + p * index, 0);
    if (Object.hasOwn(a, 'providerExpectedIndex')) requireResponse(Number.isFinite(a.providerExpectedIndex) && withinTolerance(a.providerExpectedIndex, expectedIndex));
    if (Object.hasOwn(a, 'providerConfidence')) requireResponse(probability(a.providerConfidence));
    const accepted = selectedProbability >= q.acceptance.minSelectedProbability && values.filter(p => p === selectedProbability).length === 1;
    return [q.id, {
      type: q.type, status: accepted ? 'accepted' : 'uncertain', outcome: accepted ? selected : 'unsure',
      selected, ...(q.type === 'score' ? { selectedIndex, expectedIndex } : {}), selectedProbability,
      probabilities: Object.fromEntries(items.map((item, index) => [item.id, values[index]])),
      ...(Object.hasOwn(a, 'providerConfidence') ? { providerConfidence: a.providerConfidence } : {}),
    }];
  }));
}
