import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandFor } from '../valdr-packs/valdr-tools/tools/maven/runner.mjs';

const tool = fileURLToPath(new URL('../valdr-packs/valdr-tools/tools/maven/', import.meta.url));
const runner = path.join(tool, 'runner.mjs');
const request = (action, input) => ({ protocolVersion: 1, toolId: 'valdr-tools.user.maven', toolRevision: '1.1.1', action, input, operationId: 'maven-test-operation', attemptId: 'maven-test-attempt' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fakeMaven = `#!${process.execPath}
const fs=require('node:fs'); const {spawn}=require('node:child_process');
const fixture=JSON.parse(fs.readFileSync('fixture.json','utf8'));
fs.writeFileSync('receipt.json',JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2),javaHome:process.env.JAVA_HOME,executable:process.argv[1]}));
if(process.argv.includes('--version')) {console.log('Apache Maven fake-4.0');process.exit(0);}
if(fixture.mode==='hang') {
 const child=spawn(process.execPath,['-e',"const fs=require('node:fs');process.on('SIGTERM',()=>{});setInterval(()=>fs.appendFileSync('heartbeat','x'),20);"],{stdio:'ignore'});
 fs.writeFileSync('pids.json',JSON.stringify([process.pid,child.pid]));
 process.on('SIGTERM',()=>{});setInterval(()=>{},1000);
} else if(fixture.mode==='failure') {
 console.log('[INFO] BUILD SUCCESS');
 console.error('[ERROR] /project/src/App.java:[1,2] cannot find symbol token='+process.env.TEST_TOKEN);
 process.exitCode=7;
} else if(fixture.mode==='compile') {
 console.log(['[INFO] Compiling 2 source files','[ERROR] COMPILATION ERROR : ','[INFO] -------------------------------------------------------------','[ERROR] /work/src/main/java/App.java:[3,5] cannot find symbol','  symbol:   class Foo','  location: class App','[ERROR] /work/src/main/java/App.java:[4,5] cannot find symbol','  symbol:   class Bar','  location: class App','[INFO] 2 errors ','[INFO] BUILD FAILURE','[ERROR] Failed to execute goal org.apache.maven.plugins:maven-compiler-plugin:3.13.0:compile (default-compile) on project app: Compilation failure: Compilation failure: ','[ERROR] /work/src/main/java/App.java:[3,5] cannot find symbol','[ERROR]   symbol:   class Foo','[ERROR]   location: class App','[ERROR] /work/src/main/java/App.java:[4,5] cannot find symbol','[ERROR]   symbol:   class Bar','[ERROR]   location: class App','[ERROR] -> [Help 1]','[ERROR] ','[ERROR] To see the full stack trace of the errors, re-run Maven with the -e switch.','[ERROR] Re-run Maven using the -X switch to enable full debug logging.','[ERROR] ','[ERROR] For more information about the errors and possible solutions, please read the following articles:','[ERROR] [Help 1] http://cwiki.apache.org/confluence/display/MAVEN/MojoFailureException'].join('\\n'));
 process.exitCode=1;
} else if(fixture.mode==='surefire') {
 console.log(['[INFO] Running com.example.AppTest','[ERROR] Tests run: 2, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 0.05 s <<< FAILURE! -- in com.example.AppTest','[ERROR] com.example.AppTest.testAdd -- Time elapsed: 0.01 s <<< FAILURE!','org.opentest4j.AssertionFailedError: expected: <3> but was: <4>','[INFO] Results:','[ERROR] Failures: ','[ERROR]   AppTest.testAdd:15 expected: <3> but was: <4>','[ERROR] Tests run: 2, Failures: 1, Errors: 0, Skipped: 0','[INFO] BUILD FAILURE','[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.2.5:test (default-test) on project app: There are test failures.','[ERROR] ','[ERROR] Please refer to /work/target/surefire-reports for the individual test results.','[ERROR] Please refer to dump files (if any exist) [date].dump, [date]-jvmRun[N].dump and [date].dumpstream.','[ERROR] -> [Help 1]','[ERROR] ','[ERROR] After correcting the problems, you can resume the build with the command','[ERROR]   mvn <args> -rf :app'].join('\\n'));
 process.exitCode=1;
} else if(fixture.mode==='silent') {
 process.exitCode=1;
} else if(fixture.mode==='cr-secret') {
 console.error('[ERROR] value: pa\\rsswordvalue123');process.exitCode=1;
} else if(fixture.mode==='flag') {
 console.log('[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 1');
 console.error('[ERROR] expected: <true> but was: <false> after 1 retry');process.exitCode=1;
} else if(fixture.mode==='killed') {
 console.log('[INFO] Building');process.kill(process.pid,'SIGKILL');
} else if(fixture.mode==='plain-failure') {
 console.error('Unrecognized VM option: InvalidOption token='+process.env.TEST_TOKEN);process.exitCode=1;
} else if(fixture.mode==='multiline') {
 const value=process.argv.find(arg=>arg.startsWith('-Dpassword=')).slice('-Dpassword='.length);
 for(const line of value.split(/\\r?\\n/)) console.error('[ERROR] '+line);
 process.exitCode=7;
} else if(fixture.mode==='large') {
 console.log('X'.repeat(8100)+process.env.TEST_TOKEN+' tail');
 console.log('UNSAFE_PARTIAL_LINE'+process.env.TEST_TOKEN+'Z'.repeat(100000));
 for(let i=0;i<500;i++) console.log('line-'+i+' '+'.'.repeat(6000));
 console.log('[INFO] BUILD SUCCESS');
} else {
 console.log('[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 1');
 console.log('[INFO] BUILD SUCCESS');
}
`;
function fixture(t, mode = 'success') {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'maven-tool-test-')));
  const bin = path.join(root, 'bin'); mkdirSync(bin);
  writeFileSync(path.join(bin, 'mvn'), fakeMaven, { mode: 0o755 });
  writeFileSync(path.join(root, 'fixture.json'), JSON.stringify({ mode }));
  const logs = new Set();
  t.after(() => {
    if (existsSync(path.join(root, 'pids.json'))) for (const pid of JSON.parse(readFileSync(path.join(root, 'pids.json')))) { try { process.kill(pid, 'SIGKILL'); } catch {} }
    for (const log of logs) rmSync(path.dirname(log), { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });
  const env = { ...process.env, PATH: bin, TEST_TOKEN: 'private-secret-without-known-prefix', TEST_AUTH_FLAG: '1' };
  const remember = result => { const log = result.data?.logPath ?? /Build log: (.+)/.exec(result.error?.message ?? '')?.[1]; if (log) logs.add(log); return result; };
  const run = (action = 'build', input = {}, envelope = request(action, input)) => {
    const child = spawnSync(process.execPath, [runner], { cwd: root, env, input: JSON.stringify(envelope), encoding: 'utf8', timeout: 5000 });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stderr, '');
    assert.ok(Buffer.byteLength(child.stdout) < 5000);
    return remember(JSON.parse(child.stdout));
  };
  return { root, bin, env, run, remember };
}

test('Maven uses literal goals/options and validates its request contract', t => {
  assert.deepEqual(commandFor('build', { goals: ['clean', 'verify', 'dependency:tree'], properties: { skipTests: true, test: 'ExampleTest#works', value: '--help $(touch /tmp/no)' }, modules: ['api', 'services/core'], profiles: ['ci'], alsoMake: true }), ['-B', '-ntp', '-Dstyle.color=never', 'clean', 'verify', 'dependency:tree', '-DskipTests=true', '-Dtest=ExampleTest#works', '-Dvalue=--help $(touch /tmp/no)', '-pl', 'api,services/core', '-P', 'ci', '-am']);
  assert.deepEqual(commandFor('build', {}), ['-B', '-ntp', '-Dstyle.color=never', 'package']);
  for (const input of [{ goals: [] }, { goals: ['--help'] }, { goals: ['test;rm'] }, { properties: { '-bad': 'x' } }, { properties: { key: {} } }, { modules: ['--file'] }, { timeoutSeconds: 271 }, { javaHome: 'relative' }, { command: 'anything' }]) assert.throws(() => commandFor('build', input));
  const f = fixture(t);
  assert.equal(f.run('build', {}, { ...request('build', {}), toolRevision: 'old' }).error.code, 'invalid_request');
  assert.equal(f.run('version', { goals: ['test'] }).error.code, 'invalid_request');
  assert.deepEqual(readFileSync(path.join(tool, 'redaction.mjs')), readFileSync(new URL('./lib/user-tool-redaction.mjs', import.meta.url)));
});

test('Maven returns compact success/version results and prefers the project wrapper', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.ok, true);
  assert.equal(result.data.result, 'passed');
  assert.equal(result.data.errorExcerpt, '');
  assert.equal(result.data.exitCode, 0);
  assert.equal(result.data.testSummary, '[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 1', 'a short secret-named flag (TEST_AUTH_FLAG=1) must not redact "1"');
  assert.ok(result.data.durationMs >= 0);
  assert.equal(statSync(result.data.logPath).mode & 0o777, 0o600);
  assert.match(readFileSync(result.data.logPath, 'utf8'), /Skipped: 1\n\[INFO\] BUILD SUCCESS/);
  assert.equal(f.run('version').data.version, 'Apache Maven fake-4.0');
  writeFileSync(path.join(f.root, 'mvnw'), fakeMaven, { mode: 0o755 });
  const javaHome = path.join(f.root, 'jdk'); mkdirSync(path.join(javaHome, 'bin'), { recursive: true }); writeFileSync(path.join(javaHome, 'bin', 'java'), '', { mode: 0o755 });
  assert.equal(f.run('build', { goals: ['test'], javaHome }).ok, true);
  const receipt = JSON.parse(readFileSync(path.join(f.root, 'receipt.json')));
  assert.equal(receipt.cwd, f.root);
  assert.equal(receipt.javaHome, javaHome);
  assert.equal(receipt.executable, path.join(f.root, 'mvnw'));
});

test('Maven build failures are routable results with compiler errors and exit status, without secrets', t => {
  const f = fixture(t, 'failure');
  const result = f.run();
  assert.equal(result.ok, true, 'a completed build that exits nonzero is a result, not a tool failure');
  assert.equal(result.data.result, 'failed', 'BUILD SUCCESS text must not override the child exit');
  assert.equal(result.data.exitCode, 7);
  assert.match(result.data.summary, /failed \(exit 7\)/);
  assert.match(result.data.errorExcerpt, /cannot find symbol/);
  assert.ok(result.data.errorExcerpt.length <= 2000);
  assert.ok(!result.data.errorExcerpt.includes(f.env.TEST_TOKEN));
  assert.ok(!readFileSync(result.data.logPath, 'utf8').includes(f.env.TEST_TOKEN));
});

test('Maven retains plain Java or wrapper stderr when formatted build errors are absent', t => {
  const f = fixture(t, 'plain-failure');
  const result = f.run();
  assert.equal(result.data.result, 'failed');
  assert.equal(result.data.exitCode, 1);
  assert.match(result.data.errorExcerpt, /Unrecognized VM option: InvalidOption/);
  assert.ok(!result.data.errorExcerpt.includes(f.env.TEST_TOKEN));
});

test('Maven redacts multiline property secrets from separate log lines', t => {
  const f = fixture(t, 'multiline');
  const result = f.run('build', { properties: { password: 'first-secret-line\nsecond-secret-line' } });
  assert.equal(result.data.result, 'failed');
  for (const value of ['first-secret-line', 'second-secret-line']) {
    assert.ok(!result.data.errorExcerpt.includes(value));
    assert.ok(!readFileSync(result.data.logPath, 'utf8').includes(value));
  }
});

test('Maven error excerpts keep the first real errors and drop Maven boilerplate', t => {
  const compile = fixture(t, 'compile').run();
  assert.equal(compile.data.result, 'failed');
  assert.match(compile.data.errorExcerpt, /App\.java:\[3,5\] cannot find symbol/, 'the first error is the root cause');
  assert.match(compile.data.errorExcerpt, /App\.java:\[4,5\] cannot find symbol/);
  assert.match(compile.data.errorExcerpt, /symbol:\s+class Foo/);
  assert.equal(compile.data.errorExcerpt.match(/App\.java:\[3,5\]/g).length, 1, 'repeated compiler errors appear once');
  assert.doesNotMatch(compile.data.errorExcerpt, /Help 1|To see the full stack|Re-run Maven|For more information/);
  const surefire = fixture(t, 'surefire').run();
  assert.equal(surefire.data.result, 'failed');
  assert.match(surefire.data.errorExcerpt, /AppTest\.testAdd:15 expected: <3> but was: <4>/);
  assert.match(surefire.data.errorExcerpt, /There are test failures/);
  assert.doesNotMatch(surefire.data.errorExcerpt, /Please refer to|Help 1|mvn <args>|-rf :/);
  assert.equal(surefire.data.testSummary, '[ERROR] Tests run: 2, Failures: 1, Errors: 0, Skipped: 0');
  for (const result of [compile, surefire]) {
    assert.ok(result.data.errorExcerpt.length <= 2000);
    assert.ok(result.data.errorExcerpt.split('\n').length <= 10);
  }
});

test('Maven failure with no output returns an empty excerpt', t => {
  const result = fixture(t, 'silent').run();
  assert.equal(result.ok, true);
  assert.equal(result.data.result, 'failed');
  assert.equal(result.data.errorExcerpt, '');
});

test('Maven redacts a secret split by a carriage return in the log and excerpt', t => {
  const f = fixture(t, 'cr-secret');
  const result = f.run('build', { properties: { password: 'passwordvalue123' } });
  assert.equal(result.data.result, 'failed');
  assert.ok(!result.data.errorExcerpt.includes('passwordvalue123'));
  assert.ok(!readFileSync(result.data.logPath, 'utf8').includes('passwordvalue123'));
});

test('Maven does not redact boolean or number values of secret-named properties', t => {
  const f = fixture(t, 'flag');
  const result = f.run('build', { properties: { skipAuthTests: true, 'token.ttl': 1 } });
  assert.match(result.data.errorExcerpt, /expected: <true> but was: <false> after 1 retry/);
  assert.match(readFileSync(result.data.logPath, 'utf8'), /Skipped: 1/);
});

test('Maven killed by a signal stays a tool failure', t => {
  const f = fixture(t, 'killed');
  const result = f.run();
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'maven_failed');
  assert.equal(result.error.exitCode, null);
  assert.equal(result.error.signal, 'SIGKILL');
  assert.match(result.error.message, /Build log:/);
});

test('Maven drains large output with bounded redacted logs and discards oversized partial lines', t => {
  const f = fixture(t, 'large');
  f.env.TEST_TOKEN = 'Q'.repeat(4000);
  const result = f.run();
  assert.equal(result.ok, true);
  assert.equal(result.data.logTruncated, true);
  const log = readFileSync(result.data.logPath, 'utf8');
  assert.ok(Buffer.byteLength(log) <= 2 * 1024 * 1024);
  assert.ok(!log.includes('QQ'));
  assert.ok(!log.includes('UNSAFE_PARTIAL_LINE'));
  assert.match(log, /line exceeded capture limit/);
});

test('Maven timeout and forwarded host cancellation stop a hanging grandchild', async t => {
  for (const cancel of [false, true]) {
    const f = fixture(t, 'hang');
    const child = spawn(process.execPath, [runner], { cwd: f.root, env: f.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
    const done = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
    child.stdin.end(JSON.stringify(request('build', { timeoutSeconds: 1 })));
    const deadline = Date.now() + 2000;
    while (!existsSync(path.join(f.root, 'heartbeat')) && Date.now() < deadline) await pause(10);
    assert.ok(existsSync(path.join(f.root, 'heartbeat')), 'grandchild started');
    if (cancel) child.kill('SIGTERM');
    const closed = await Promise.race([done, pause(4000).then(() => { throw new Error('Maven runner did not stop'); })]);
    assert.equal(closed.code, 0, stderr);
    const result = f.remember(JSON.parse(stdout));
    assert.equal(result.error.code, cancel ? 'cancelled' : 'timeout');
    const bytes = statSync(path.join(f.root, 'heartbeat')).size;
    await pause(100);
    assert.equal(statSync(path.join(f.root, 'heartbeat')).size, bytes, 'grandchild stopped');
  }
});
