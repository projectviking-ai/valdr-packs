import { bearerHeaders, requestJson } from '../http.mjs';
import { toSystemOne, fromSystemOne } from '../systemone.mjs';

/** @returns {Promise<import('../contract.mjs').ProviderResult>} */
export async function decide(input, { env, fetchImpl, signal }) {
  const { body, requestId } = await requestJson(new URL('https://api.typesafe.ai/v1/systemone'), { body: toSystemOne(input), headers: bearerHeaders(env.TYPESAFE_API_KEY), fetchImpl, signal });
  return { ...fromSystemOne(body, input.questions), ...(requestId ? { requestId } : {}) };
}
