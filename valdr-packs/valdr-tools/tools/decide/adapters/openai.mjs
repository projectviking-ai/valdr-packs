import { isRecord, requireResponse, providerMetadata } from '../contract.mjs';
import { bearerHeaders, requestJson } from '../http.mjs';

/** @returns {Promise<import('../contract.mjs').ProviderResult>} */
export async function decide(input, { env, fetchImpl, signal }) {
  const request = { model: input.engine.model, input: input.text, questions: input.questions.map(q => ({
    name: q.id, type: q.type, instructions: q.instructions,
    ...(q.type === 'choice' ? { choices: q.options.map(item => ({ value: item.id, description: item.description })) } : q.type === 'score' ? { levels: q.levels.map(item => ({ label: item.id, description: item.description })) } : {}),
  })) };
  const { body, requestId } = await requestJson(new URL('https://api.openai.com/v1/decisions'), { body: request, headers: bearerHeaders(env.OPENAI_API_KEY), fetchImpl, signal });
  const metadata = providerMetadata(body);
  requireResponse(Array.isArray(body.answers) && body.answers.length === input.questions.length);
  const questions = new Map(input.questions.map(q => [q.id, q])); const seen = new Set();
  const answers = Object.fromEntries(body.answers.map(a => {
    requireResponse(isRecord(a) && questions.has(a.name) && !seen.has(a.name));
    seen.add(a.name); const q = questions.get(a.name);
    if (a.type === 'refusal') return [q.id, { type: q.type, refused: true }];
    requireResponse(a.type === q.type);
    if (q.type === 'predicate') return [q.id, { type: q.type, probabilityTrue: a.probability }];
    const items = q.type === 'choice' ? q.options : q.levels;
    requireResponse(Array.isArray(a.probabilities) && a.probabilities.length === items.length);
    const values = new Set();
    const probabilities = Object.fromEntries(a.probabilities.map(entry => {
      requireResponse(isRecord(entry) && !values.has(entry.value)); values.add(entry.value);
      if (q.type === 'choice') {
        requireResponse(typeof entry.value === 'string' && items.some(item => item.id === entry.value));
        return [entry.value, entry.probability];
      }
      requireResponse(Number.isInteger(entry.value) && entry.value >= 0 && entry.value < items.length && entry.label === items[entry.value].id);
      return [items[entry.value].id, entry.probability];
    }));
    requireResponse(q.type === 'choice' ? typeof a.choice === 'string' : Number.isFinite(a.score));
    return [q.id, { type: q.type, probabilities,
      ...(q.type === 'choice' ? { providerSelected: a.choice } : { providerExpectedIndex: a.score }),
      ...(Object.hasOwn(a, 'confidence') ? { providerConfidence: a.confidence } : {}),
    }];
  }));
  return { answers, ...metadata, ...(requestId ? { requestId } : {}) };
}
