import { spawn } from 'node:child_process';
import { accessSync, closeSync, constants, existsSync, mkdtempSync, openSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { redactSensitiveText } from './redaction.mjs';

const goal = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const secretName = /api[_-]?key|access[_-]?key|private[_-]?key|token|secret|authorization|auth|password|passwd|credential/i;
const name = /^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/;
// Same 8-character minimum Valdr applies to saved input. Short values on secret-named variables are
// flags such as `..._AUTH=1`; redacting them would garble every matching character in the log and excerpt.
const secrets = () => Object.entries(process.env).filter(([key]) => secretName.test(key)).map(([, value]) => value).filter(value => value && value.length >= 8);
// Maven's closing boilerplate crowds out the errors an agent needs to fix the build.
const errorNoise = /To see the full stack|Re-run Maven|For more information|After correcting|http.*cwiki\.apache|-> \[Help \d+\]|Please refer to |-rf :|mvn <args>/;
const excerptOf = lines => {
  let excerpt = '';
  for (const line of lines) {
    const next = excerpt ? `${excerpt}\n${line}` : line;
    if (next.length > 2000) break;
    excerpt = next;
  }
  return excerpt;
};
const fail = (code, message, termination = {}) => ({ ok: false, error: { code, message, ...termination } });

export function commandFor(action, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Input must be an object.');
  const keys = ['goals', 'properties', 'modules', 'profiles', 'alsoMake', 'javaHome', 'timeoutSeconds'];
  if (!['version', 'build'].includes(action) || Object.keys(input).some(key => !keys.includes(key) || (action === 'version' && key !== 'javaHome'))) throw new Error('Unsupported action or input field.');
  if (input.goals !== undefined && (!Array.isArray(input.goals) || input.goals.length < 1 || input.goals.length > 20 || input.goals.some(value => typeof value !== 'string' || value.length > 128 || !goal.test(value)))) throw new Error('goals must contain 1 to 20 literal Maven phase or plugin goal names.');
  if (input.alsoMake !== undefined && typeof input.alsoMake !== 'boolean') throw new Error('alsoMake must be boolean.');
  if (input.properties !== undefined && (!input.properties || typeof input.properties !== 'object' || Array.isArray(input.properties) || Object.keys(input.properties).length > 30 || Object.entries(input.properties).some(([key, value]) => !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(key) || !['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value)) || (typeof value === 'string' && (value.length > 2048 || value.includes('\0')))))) throw new Error('properties must contain up to 30 named scalar Maven properties.');
  for (const key of ['modules', 'profiles']) if (input[key] !== undefined && (!Array.isArray(input[key]) || input[key].length > 20 || input[key].some(value => typeof value !== 'string' || value.length > 128 || !name.test(value)))) throw new Error(`${key} must contain up to 20 literal Maven names.`);
  if (input.javaHome !== undefined && (typeof input.javaHome !== 'string' || input.javaHome.length > 2048 || input.javaHome.includes('\0') || !path.isAbsolute(input.javaHome))) throw new Error('javaHome must be an absolute path.');
  if (input.timeoutSeconds !== undefined && (!Number.isInteger(input.timeoutSeconds) || input.timeoutSeconds < 1 || input.timeoutSeconds > 270)) throw new Error('timeoutSeconds must be an integer from 1 to 270.');
  const args = ['-B', '-ntp', '-Dstyle.color=never'];
  if (action === 'version') args.push('--version');
  else {
    args.push(...(input.goals ?? ['package']));
    for (const [key, value] of Object.entries(input.properties ?? {})) args.push(`-D${key}=${value}`);
    if (input.modules?.length) args.push('-pl', input.modules.join(','));
    if (input.profiles?.length) args.push('-P', input.profiles.join(','));
    if (input.alsoMake) args.push('-am');
  }
  return args;
}

export async function main() {
  let input = Buffer.alloc(0);
  let oversized = false;
  for await (const chunk of process.stdin) {
    if (input.length + chunk.length > 65536) oversized = true;
    if (!oversized) input = Buffer.concat([input, chunk]);
  }
  if (oversized) return fail('invalid_request', 'Request exceeds 65536 bytes.');
  let request, args;
  try {
    request = JSON.parse(input.toString('utf8'));
    const allowed = ['protocolVersion', 'toolId', 'toolRevision', 'action', 'input', 'operationId', 'attemptId'];
    if (!request || request.protocolVersion !== 1 || request.toolId !== 'valdr-tools.user.maven' || request.toolRevision !== '1.1.1' || !['operationId', 'attemptId'].every(key => typeof request[key] === 'string' && request[key].length) || Object.keys(request).some(key => !allowed.includes(key))) throw new Error('Invalid Maven tool request envelope.');
    args = commandFor(request.action, request.input);
  } catch (error) { return fail('invalid_request', error instanceof SyntaxError ? 'Request must be JSON.' : error.message); }
  // Only string property values can be credentials; `skipAuthTests: true` must not redact every "true".
  // Longest first, so a secret that contains a shorter one is replaced whole.
  const knownSecrets = [...secrets(), ...Object.entries(request.input.properties ?? {}).filter(([key, value]) => secretName.test(key) && typeof value === 'string').map(([, value]) => value)].flatMap(value => [value, ...value.split(/[\r\n]+/)]).filter(Boolean).sort((a, b) => b.length - a.length);
  const redact = text => redactSensitiveText(text, knownSecrets);
  const wrapper = path.resolve('mvnw');
  let executable = 'mvn';
  try {
    if (existsSync(wrapper)) { accessSync(wrapper, constants.X_OK); executable = wrapper; }
    if (request.input.javaHome) accessSync(path.join(request.input.javaHome, 'bin', 'java'), constants.X_OK);
  } catch { return fail('runtime_missing', 'The project mvnw or selected javaHome/bin/java is not executable.'); }
  let fd, logPath;
  try {
    logPath = path.join(mkdtempSync(path.join(tmpdir(), 'valdr-maven-')), 'build.log');
    fd = openSync(logPath, 'wx', 0o600);
  } catch { return fail('log_failed', 'Unable to create a local Maven build log.'); }
  const started = Date.now();
  let loggedBytes = 0, logTruncated = false;
  let testSummary, version;
  const errors = [], stderrTail = [];
  const record = (original, isStderr = false) => {
    // Redact complete lines before shortening them. Oversized unfinished lines are discarded below.
    // Strip carriage returns before redacting so a secret split by \r can't reassemble in the log.
    const line = redact(original.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, ''));
    if (isStderr && line.trim()) { stderrTail.push(line.slice(0, 240)); if (stderrTail.length > 6) stderrTail.shift(); }
    if (request.action === 'version' && !version && /Apache Maven/.test(line)) version = line.slice(0, 1000);
    if (/Tests run:\s*\d+,\s*Failures:\s*\d+,\s*Errors:\s*\d+,\s*Skipped:\s*\d+/.test(line)) testSummary = line.slice(0, 500);
    // Keep the first distinct error lines: the root cause comes first, and Maven repeats compiler errors.
    if ((/^\[ERROR\]/.test(line) || /FAILURE!|COMPILATION ERROR|There are test failures/.test(line)) && !/^\[ERROR\]\s*$/.test(line) && !errorNoise.test(line)) {
      const clipped = line.slice(0, 320);
      if (errors.length < 10 && !errors.includes(clipped)) errors.push(clipped);
    }
    const shortened = line.length > 8192 ? `${line.slice(0, 8192)}… [line truncated]` : line;
    const bytes = Buffer.from(`${shortened}\n`);
    if (line.length > 8192) logTruncated = true;
    if (loggedBytes + bytes.length <= 2 * 1024 * 1024) {
      try { writeSync(fd, bytes); loggedBytes += bytes.length; } catch { logTruncated = true; }
    } else logTruncated = true;
  };
  const attach = (stream, isStderr = false) => {
    const decoder = new StringDecoder('utf8');
    let pending = '', dropping = false;
    const consume = chunk => {
      const parts = chunk.split('\n');
      for (let index = 0; index < parts.length; index++) {
        if (!dropping) {
          pending += parts[index];
          if (pending.length > 65536) { pending = ''; dropping = true; logTruncated = true; }
        }
        if (index < parts.length - 1) {
          if (dropping) record('[output line exceeded capture limit and was omitted]', isStderr); else record(pending, isStderr);
          pending = ''; dropping = false;
        }
      }
    };
    stream.on('data', chunk => consume(decoder.write(chunk)));
    stream.on('end', () => { consume(decoder.end()); if (dropping) record('[output line exceeded capture limit and was omitted]', isStderr); else if (pending) record(pending, isStderr); });
  };
  let timer, timedOut = false, interruptedSignal;
  let termination, terminate, onTerm, onInt;
  try {
    const env = { ...process.env, ...(request.input.javaHome ? { JAVA_HOME: request.input.javaHome } : {}) };
    // Own the Maven group so timeout and forwarded host cancellation also stop plugin children.
    const child = spawn(executable, args, { env, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const signalGroup = signal => { if (child.pid) { try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') child.kill(signal); } } };
    terminate = signal => {
      if (termination) return;
      signalGroup(signal);
      termination = new Promise(resolve => setTimeout(() => { signalGroup('SIGKILL'); resolve(); }, 150));
    };
    onTerm = () => { interruptedSignal = 'SIGTERM'; terminate('SIGTERM'); };
    onInt = () => { interruptedSignal = 'SIGINT'; terminate('SIGINT'); };
    process.once('SIGTERM', onTerm); process.once('SIGINT', onInt);
    attach(child.stdout); attach(child.stderr, true);
    timer = setTimeout(() => { timedOut = true; terminate('SIGTERM'); }, (request.action === 'version' ? 20 : request.input.timeoutSeconds ?? 240) * 1000);
    const result = await new Promise(resolve => {
      child.once('error', error => resolve({ error, exitCode: null, signal: null }));
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
    });
    if (termination) await termination;
    // A build that ran to completion and exited nonzero is a result, not a tool failure: workflows
    // route on `result` (for example back to the agent that made the change). Maven that could not
    // start, timed out, was cancelled, or died from a signal stays a tool failure.
    if (request.action === 'build' && !result.error && !timedOut && !interruptedSignal && Number.isInteger(result.exitCode) && result.exitCode !== 0) {
      return { ok: true, data: { result: 'failed', summary: `Maven ${(request.input.goals ?? ['package']).join(' ')} failed (exit ${result.exitCode}).`, errorExcerpt: excerptOf((errors.length ? errors : stderrTail).map(redact)), durationMs: Date.now() - started, exitCode: result.exitCode, logPath, logTruncated, ...(testSummary ? { testSummary } : {}) } };
    }
    if (result.error || timedOut || interruptedSignal || result.exitCode !== 0) {
      const code = result.error?.code === 'ENOENT' ? 'runtime_missing' : timedOut ? 'timeout' : interruptedSignal ? 'cancelled' : 'maven_failed';
      const summary = interruptedSignal ? `Maven interrupted (${interruptedSignal}).` : timedOut ? 'Maven timed out.' : result.error ? `Maven could not start (${result.error.code ?? 'spawn_failed'}).` : `Maven ${request.action} failed (exit ${result.exitCode ?? result.signal}).`;
      return fail(code, redact([summary, ...(errors.length ? errors : stderrTail), `Build log: ${logPath}`].join('\n')).slice(0, 2000), { exitCode: result.exitCode, signal: result.signal });
    }
    return { ok: true, data: { ...(request.action === 'version' ? { version: version ?? 'Maven version command completed.' } : { result: 'passed', errorExcerpt: '' }), summary: request.action === 'version' ? version ?? 'Maven version command completed.' : `Maven ${(request.input.goals ?? ['package']).join(' ')} completed successfully.`, durationMs: Date.now() - started, exitCode: 0, logPath, logTruncated, ...(testSummary ? { testSummary } : {}) } };
  } catch (error) { return fail('maven_failed', redact(`Maven execution failed: ${error.message}\nBuild log: ${logPath}`).slice(0, 2000)); }
  finally { clearTimeout(timer); if (onTerm) process.removeListener('SIGTERM', onTerm); if (onInt) process.removeListener('SIGINT', onInt); closeSync(fd); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(`${JSON.stringify(await main())}\n`);
