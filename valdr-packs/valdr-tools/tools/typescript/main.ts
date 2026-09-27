import { readFileSync } from 'node:fs';

try {
  const request = JSON.parse(readFileSync(0, 'utf8'));
  if (request?.protocolVersion !== 1 || request.toolId !== 'valdr-tools.user.typescript' ||
      request.toolRevision !== '1.0.3' || request.action !== 'summarize' ||
      typeof request.operationId !== 'string' || typeof request.attemptId !== 'string' ||
      !request.input || Object.keys(request.input).length !== 1 || typeof request.input.text !== 'string') {
    throw new Error('Invalid request');
  }
  const text: string = request.input.text;
  process.stdout.write(JSON.stringify({ ok: true, data: {
    characters: [...text].length,
    words: text.split(/[ \t\r\n\f\v]+/u).filter(Boolean).length,
    lines: text === '' ? 0 : text.split('\n').length,
  } }) + '\n');
} catch {
  process.stdout.write(JSON.stringify({ ok: false, error: {
    code: 'invalid_request', message: 'Expected a version 1 summarize request with input {text: string}.',
  } }) + '\n');
}
