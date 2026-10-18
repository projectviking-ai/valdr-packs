import { DecisionError, isRecord, requireResponse } from '../contract.mjs';
import { endpointFromBase, bearerHeaders, requestJson } from '../http.mjs';
import { toSystemOne, fromSystemOne } from '../systemone.mjs';

/** @returns {Promise<import('../contract.mjs').ProviderResult>} */
export async function decide(input, { env, fetchImpl, signal }) {
  if (!['english', 'multilingual', 'typed-decisions'].includes(input.engine.model)) throw new DecisionError('invalid_input', 'Laya requires english, multilingual, or typed-decisions as the explicit checkpoint.');
  if (input.questions.some(q => q.type === 'choice' && q.options.some(item => /^(yes|no|true|false)$/i.test(item.id)))) throw new DecisionError('invalid_input', 'Use semantic choice IDs or a predicate instead of boolean-looking Laya choices.');
  const url = endpointFromBase(env.LAYA_URL ?? 'http://127.0.0.1:8000', 'v1/systemone');
  const { body, requestId } = await requestJson(url, { body: toSystemOne(input), headers: bearerHeaders(env.LAYA_API_KEY, false), fetchImpl, signal });
  const result = fromSystemOne(body, input.questions);
  // The root model is a decision-head name, not the checkpoint that answered.
  delete result.resolvedModel;
  if (Object.hasOwn(body, 'routing')) {
    requireResponse(isRecord(body.routing) && body.routing.model === input.engine.model);
    result.resolvedModel = body.routing.model;
  }
  const usage = body.usage;
  if (usage) {
    requireResponse(!Object.hasOwn(usage, 'truncated') || usage.truncated === false);
    requireResponse(!Object.hasOwn(usage, 'state_tokens_dropped') || usage.state_tokens_dropped === 0);
    requireResponse(!Object.hasOwn(usage, 'truncated_questions') || (Array.isArray(usage.truncated_questions) && usage.truncated_questions.length === 0));
    if (Object.hasOwn(usage, 'options')) {
      requireResponse(isRecord(usage.options));
      for (const value of Object.values(usage.options)) requireResponse(isRecord(value) && Number.isSafeInteger(value.total) && value.total === value.distinct);
    }
  }
  return { ...result, ...(requestId ? { requestId } : {}) };
}
