import { pathToFileURL } from 'node:url';
import { DecisionError, TOOL_ID, TOOL_REVISION, HTTP_TIMEOUT_MS, MAX_INPUT_BYTES, MAX_RESULT_BYTES, isRecord, nonempty, requireResponse, validateInput, normalizeAnswers } from './contract.mjs';
import * as laya from './adapters/laya.mjs';
import * as ollama from './adapters/ollama.mjs';
import * as jev from './adapters/jev.mjs';
import * as openai from './adapters/openai.mjs';

const adapters = { laya, ollama, jev, openai };
const failure = (code, message) => ({ ok: false, error: { code, message } });
const cancelled = () => new DecisionError('cancelled', 'The decision request was cancelled.');
const safeFailure = error => error instanceof DecisionError ? failure(error.code, error.message) : failure('invalid_request', 'The decision request could not be processed.');

function boundedEnvelope(envelope) {
  return Buffer.byteLength(JSON.stringify(envelope) + '\n') <= MAX_RESULT_BYTES ? envelope : failure('result_limit', 'The decision result exceeded the byte limit.');
}

/** One validated Valdr request. Dependency/deadline injection is only for in-process tests. */
export async function runRequest(request, { env = process.env, fetchImpl = fetch, signal, timeoutMs = HTTP_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(cancelled());
  let timer;
  try {
    if (signal?.aborted) throw cancelled();
    signal?.addEventListener('abort', onAbort, { once: true });
    if (!isRecord(request) || request.protocolVersion !== 1 || request.toolId !== TOOL_ID || request.toolRevision !== TOOL_REVISION || request.action !== 'decide' || !nonempty(request.operationId) || !nonempty(request.attemptId)) throw new DecisionError('invalid_request', 'Expected a version 1 decide request with matching tool identity and operation/attempt IDs.');
    const input = validateInput(request.input);
    timer = setTimeout(() => controller.abort(new DecisionError('timeout', 'The decision engine exceeded the HTTP deadline.')), timeoutMs);
    const started = performance.now();
    const result = await adapters[input.engine.provider].decide(input, { env, fetchImpl, signal: controller.signal });
    controller.signal.throwIfAborted();
    const answers = normalizeAnswers(input.questions, result.answers);
    const engine = { provider: input.engine.provider, requestedModel: input.engine.model };
    for (const key of ['resolvedModel', 'modelDigest', 'requestId']) {
      if (Object.hasOwn(result, key)) { requireResponse(nonempty(result[key])); engine[key] = result[key]; }
    }
    const data = { engine, answers, latencyMs: Math.max(0, performance.now() - started), ...(result.usage ? { usage: result.usage } : {}) };
    return boundedEnvelope({ ok: true, data });
  } catch (error) { return boundedEnvelope(safeFailure(error)); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}

async function main() {
  const controller = new AbortController();
  const onSignal = () => { controller.abort(); process.stdin.destroy(); };
  process.once('SIGTERM', onSignal); process.once('SIGINT', onSignal);
  let result;
  try {
    const chunks = []; let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.byteLength;
      if (size > MAX_INPUT_BYTES) throw new DecisionError('input_limit', 'The decision request exceeded the input byte limit.');
      chunks.push(chunk);
    }
    if (controller.signal.aborted) throw cancelled();
    let request;
    try { request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new DecisionError('invalid_request', 'Expected one UTF-8 JSON request on stdin.'); }
    result = await runRequest(request, { signal: controller.signal });
  } catch (error) { result = safeFailure(controller.signal.aborted ? cancelled() : error); }
  finally { process.removeListener('SIGTERM', onSignal); process.removeListener('SIGINT', onSignal); }
  process.stdout.write(JSON.stringify(boundedEnvelope(result)) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
