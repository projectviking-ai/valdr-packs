import { DecisionError, MAX_RESPONSE_BYTES, nonempty } from './contract.mjs';

export function endpointFromBase(value, route) {
  try {
    if (!nonempty(value)) throw Error();
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error();
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${route}`;
    return url;
  } catch { throw new DecisionError('invalid_config', 'Expected an HTTP(S) base URL without credentials, query, or fragment.'); }
}

export function bearerHeaders(key, required = true) {
  if (!required && (key === undefined || key === '')) return {};
  if (typeof key !== 'string' || !/^[\x21-\x7e]+$/.test(key)) throw new DecisionError('invalid_config', 'The selected engine requires a valid API key in its configured environment variable.');
  return { authorization: `Bearer ${key}` };
}

/** One POST; the caller's signal covers connection, headers and response body. */
export async function requestJson(url, { body, headers, fetchImpl, signal }) {
  let reader;
  try {
    signal.throwIfAborted();
    const response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), redirect: 'error', signal });
    if (!response.ok) {
      await response.body?.cancel();
      const status = response.status;
      const code = status === 401 || status === 403 ? 'authentication_failed' : status === 429 ? 'rate_limited' : status >= 500 ? 'engine_unavailable' : 'request_rejected';
      throw new DecisionError(code, `The decision engine rejected the request (HTTP ${status}).`);
    }
    if (!response.body) throw new DecisionError('invalid_response', 'The decision engine returned an empty response.');
    reader = response.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new DecisionError('invalid_response', 'The decision engine response exceeded the byte limit.');
      chunks.push(value);
    }
    signal.throwIfAborted();
    let parsed;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new DecisionError('invalid_response', 'The decision engine returned malformed JSON.'); }
    const requestId = response.headers.get('x-request-id');
    return { body: parsed, ...(requestId ? { requestId } : {}) };
  } catch (error) {
    if (signal.aborted) throw signal.reason instanceof DecisionError ? signal.reason : new DecisionError('cancelled', 'The decision request was cancelled.');
    if (error instanceof DecisionError) throw error;
    throw new DecisionError('engine_unavailable', 'The decision engine could not complete the request.');
  } finally {
    if (reader) { try { await reader.cancel(); } catch { /* Connection may already be aborted. */ } reader.releaseLock(); }
  }
}
