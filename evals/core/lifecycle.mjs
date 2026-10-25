export class EvaluationInfrastructureError extends Error {
  constructor(message, options) { super(message, options); this.name = 'EvaluationInfrastructureError'; this.code = 'VALDR_EVAL_INFRASTRUCTURE'; }
}
export class EvaluationCancelledError extends Error {
  constructor(reason = 'Cancelled') { super(String(reason)); this.name = 'EvaluationCancelledError'; this.code = 'VALDR_EVAL_CANCELLED'; }
}

export function createLifecycle({ cleanupTimeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const entries = [];
  const closeEntry = entry => entry.promise ??= (async () => {
    let timer;
    try {
      const receipt = await Promise.race([Promise.resolve().then(entry.close), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Owned resource cleanup timed out.')), cleanupTimeoutMs);
      })]);
      if (receipt?.ok === false) throw new Error(receipt.error ?? 'Owned resource cleanup was not verified.');
    } catch (error) { entry.error = error.message; }
    finally { clearTimeout(timer); }
  })();
  const close = async () => {
    let count;
    do { count = entries.length; await Promise.all(entries.map(closeEntry)); } while (entries.length !== count);
    const errors = entries.flatMap(entry => entry.error ? [entry.error] : []);
    return { ok: errors.length === 0, errors };
  };
  return {
    signal: controller.signal,
    register(resourceClose) {
      const entry = { close: resourceClose };
      entries.push(entry);
      if (controller.signal.aborted) return closeEntry(entry);
    },
    cancel(reason = 'Cancelled') {
      if (!controller.signal.aborted) controller.abort(new EvaluationCancelledError(reason));
      return close();
    },
    close,
    throwIfCancelled() { if (controller.signal.aborted) throw controller.signal.reason; },
  };
}

export function installSignalHandlers(lifecycle, target = process) {
  const handlers = new Map(['SIGINT', 'SIGTERM'].map(signal => [signal, () => {
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    void lifecycle.cancel(signal);
  }]));
  for (const [signal, handler] of handlers) target.on(signal, handler);
  return () => { for (const [signal, handler] of handlers) target.removeListener(signal, handler); };
}
