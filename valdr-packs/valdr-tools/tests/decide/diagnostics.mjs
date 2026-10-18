const LIMIT = 8192;
const OMITTED = '[output omitted: diagnostic limit exceeded]';

export function redactDiagnostic(text, secrets) {
  for (const secret of [...new Set(secrets)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    text = text.replaceAll(secret, '[redacted]');
  }
  return Buffer.byteLength(text) <= LIMIT ? text : OMITTED;
}

// Keep bytes intact until reporting so stream and UTF-8 boundaries cannot split
// a credential. On overflow, discard the entire capture instead of exposing a
// truncated credential that no longer matches the redaction list.
export function captureOutput(secrets) {
  let chunks = [];
  let size = 0;
  let overflow = false;
  const text = () => overflow ? OMITTED : Buffer.concat(chunks, size).toString('utf8');
  return {
    append(bytes) {
      if (overflow) return;
      if (bytes.length > LIMIT - size) {
        overflow = true;
        chunks = [];
        size = 0;
        return;
      }
      chunks.push(Buffer.from(bytes));
      size += bytes.length;
    },
    text,
    diagnostic: () => overflow ? OMITTED : redactDiagnostic(text(), secrets),
  };
}
