import { isIP } from 'node:net';
import { DecisionError } from '../contract.mjs';
import { endpointFromBase, requestJson } from '../http.mjs';
import { toSystemOne, fromSystemOne } from '../systemone.mjs';

/** @returns {Promise<import('../contract.mjs').ProviderResult>} */
export async function decide(input, { env, fetchImpl, signal }) {
  const url = endpointFromBase(env.OLLAMA_URL ?? 'http://127.0.0.1:11434', 'v1/systemone');
  const host = url.hostname;
  if (!(host === 'localhost' || host === '[::1]' || (isIP(host) === 4 && host.startsWith('127.')))) throw new DecisionError('invalid_config', 'Ollama requires a loopback endpoint.');
  if (input.engine.model !== 'clef-flash:9b') throw new DecisionError('invalid_input', 'The supported local Ollama model tag is clef-flash:9b.');
  const { body, requestId } = await requestJson(url, { body: toSystemOne(input), headers: {}, fetchImpl, signal });
  return { ...fromSystemOne(body, input.questions), ...(requestId ? { requestId } : {}) };
}
