import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../valdr-packs/valdr-tools/tools/', import.meta.url));
const names = ['gh', 'aws', 'gcloud', 'acli'];
// gh/aws/gcloud stay pinned at 1.0.5 by existing workflows; only acli changed.
const revisions = { gh: '1.0.5', aws: '1.0.5', gcloud: '1.0.5', acli: '1.0.6' };
const request = (cli, action, input) => ({ protocolVersion: 1, toolId: `valdr-tools.user.${cli}`, toolRevision: revisions[cli], action, input, operationId: 'test-operation', attemptId: 'test-attempt' });
const run = (cli, action, input, env, envelope = request(cli, action, input)) => {
  const result = spawnSync(process.execPath, [path.join(root, cli, 'runner.mjs')], { cwd: root, input: JSON.stringify(envelope), encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
const example = (key, schema) => schema.type === 'integer' ? 7 : schema.enum?.[0] ?? ({ repo: 'org/repo', key: 'DEMO-1', project: 'demo-project', region: 'us-east-1', zone: 'us-central1-a' }[key] ?? 'example');

test('every starter action dispatches through independent typed CLI metadata', async () => {
  const bin = mkdtempSync(path.join(tmpdir(), 'valdr-cli-test-'));
  try {
    for (const cli of names) {
      const { commands, commandFor, transformOutput } = await import(pathToFileURL(path.join(root, cli, 'runner.mjs')));
      // Paginated key reads return an array; everything else echoes argv in an object. The argv file covers transformed actions.
      const argvFile = path.join(bin, 'argv.json');
      writeFileSync(path.join(bin, cli), `#!${process.execPath}\nconst argv = process.argv.slice(2);\nrequire('node:fs').writeFileSync(process.env.FAKE_ARGV_FILE, JSON.stringify(argv));\nprocess.stdout.write(JSON.stringify(argv.includes('--paginate') ? [{ key: 'DEMO-1', argv }] : { key: 'DEMO-1', fields: { summary: 'Demo' }, argv }));\n`, { mode: 0o755 });
      const env = { ...process.env, PATH: bin, FAKE_ARGV_FILE: argvFile };
      const parsed = spawnSync('bun', ['-e', 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))', path.join(root, cli, `${cli}.tool.yaml`)], { encoding: 'utf8' });
      assert.equal(parsed.status, 0, parsed.stderr);
      const manifest = JSON.parse(parsed.stdout);
      assert.equal(manifest.id, `valdr-tools.user.${cli}`);
      assert.equal(manifest.revision, revisions[cli]);
      assert.deepEqual(manifest.files, [{ path: 'runner.mjs' }]);
      assert.deepEqual(manifest.actions.map(x => x.id), Object.keys(commands));
      const source = readFileSync(path.join(root, cli, 'runner.mjs'), 'utf8');
      for (const other of names.filter(x => x !== cli)) {
        assert.ok(!source.includes(`valdr-tools.user.${other}`));
        assert.equal(run(cli, 'version', {}, env, request(other, 'version', {})).error.code, 'invalid_request');
      }
      for (const prefix of ['GH_', 'AWS_', 'CLOUDSDK_'].filter(prefix => prefix !== { gh: 'GH_', aws: 'AWS_', gcloud: 'CLOUDSDK_' }[cli])) assert.ok(!source.includes(prefix));
      for (const [id, spec] of Object.entries(commands)) {
        const action = manifest.actions.find(x => x.id === id);
        assert.equal(action.execution, 'supported');
        assert.equal(action.sideEffects, 'read');
        assert.equal(action.retry, 'idempotent');
        assert.deepEqual(action.inputSchema.properties, spec.properties);
        const minimal = Object.fromEntries(spec.required.map(key => [key, example(key, spec.properties[key])]));
        // Project keys differ from work-item keys.
        if (id === 'jira-project-view') minimal.key = 'DEMO';
        const full = Object.fromEntries(Object.entries(spec.properties).map(([key, schema]) => [key, example(key, schema)]));
        if (id === 'jira-project-view') full.key = 'DEMO';
        for (const input of [minimal, full]) {
          const command = commandFor(id, input);
          const result = run(cli, id, input, env);
          assert.equal(result.ok, true, `${cli} ${id}: ${JSON.stringify(result)}`);
          const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
          assert.deepEqual(argv, command.args);
          if (spec.transform) assert.deepEqual(result.data, transformOutput(id, JSON.parse(spawnSync(cli, command.args, { env, encoding: 'utf8' }).stdout)));
          else assert.deepEqual(id === 'version' ? JSON.parse(result.data.version).argv : result.data.argv, argv);
          // Only the explicit all-keys read may paginate.
          assert.equal(argv.includes('--paginate'), id === 'jira-workitem-keys');
        }
        assert.throws(() => commandFor(id, { ...minimal, args: ['auth', 'login'] }));
        for (const key of spec.required) { const input = { ...minimal }; delete input[key]; assert.throws(() => commandFor(id, input)); }
        for (const [key, schema] of Object.entries(spec.properties)) {
          const invalid = schema.type === 'integer' ? [0, 101, 1.5, '7'].filter(x => x !== 101 || schema.maximum === 100) : ['\0', 123, ...(schema.enum ? ['invalid-enum'] : [])];
          for (const value of invalid) assert.throws(() => commandFor(id, { ...minimal, [key]: value }), `${cli} ${id} ${key} rejects ${JSON.stringify(value)}`);
        }
      }
      assert.throws(() => commandFor('unknown', {}));
      assert.equal(run(cli, 'version', {}, env, { ...request(cli, 'version', {}), toolRevision: '1.0.2' }).error.code, 'invalid_request');
      writeFileSync(path.join(bin, cli), `#!${process.execPath}\nprocess.stderr.write('Permission denied token=PRIVATE_TOKEN');process.exit(2);\n`, { mode: 0o755 });
      const failed = run(cli, 'version', {}, env);
      assert.equal(failed.error.code, 'cli_failed');
      assert.equal(failed.error.exitCode, 2);
      assert.equal(failed.error.signal, null);
      assert.ok(!JSON.stringify(failed).includes('PRIVATE_TOKEN'));
      writeFileSync(path.join(bin, cli), `#!${process.execPath}\nprocess.kill(process.pid, 'SIGTERM');\n`, { mode: 0o755 });
      const signaled = run(cli, 'version', {}, env);
      assert.equal(signaled.error.code, 'cli_failed');
      assert.equal(signaled.error.exitCode, null);
      assert.equal(signaled.error.signal, 'SIGTERM');
      writeFileSync(path.join(bin, cli), `#!${process.execPath}\nprocess.stdout.write('not JSON');\n`, { mode: 0o755 });
      const firstRead = Object.entries(commands).find(([id]) => id !== 'version');
      const input = Object.fromEntries(firstRead[1].required.map(key => [key, example(key, firstRead[1].properties[key])]));
      assert.equal(run(cli, firstRead[0], input, env).error.code, 'invalid_output');
      assert.equal(run(cli, 'version', {}, { ...env, PATH: '/nonexistent' }).error.code, 'runtime_missing');
    }
  } finally { rmSync(bin, { recursive: true, force: true }); }
});

test('argv contracts preserve cwd fallback, bounds and literal free text', async () => {
  const adapters = Object.fromEntries(await Promise.all(names.map(async cli => [cli, await import(pathToFileURL(path.join(root, cli, 'runner.mjs')))])));
  assert.deepEqual(adapters.gh.commandFor('pr-view', { number: 12, repo: 'org/repo' }).args, ['pr', 'view', '12', '--repo=org/repo', '--json', 'number,title,state,url,headRefName,baseRefName,body,author,mergeable']);
  assert.deepEqual(adapters.gh.commandFor('repo-view', {}).args.slice(0, 3), ['repo', 'view', '--json']);
  assert.throws(() => adapters.gh.commandFor('repo-view', { repo: '--help' }));
  assert.deepEqual(adapters.aws.commandFor('ec2-describe-instances', { limit: 7, region: 'us-east-1' }).args, ['ec2', 'describe-instances', '--max-items=7', '--output', 'json', '--no-cli-pager', '--region=us-east-1']);
  assert.deepEqual(adapters.gcloud.commandFor('compute-instances-describe', { instance: 'worker', zone: 'us-central1-a' }).args, ['compute', 'instances', 'describe', 'worker', '--zone=us-central1-a', '--format=json', '--quiet']);
  const literal = '--web $(touch /tmp/never)';
  assert.deepEqual(adapters.acli.commandFor('jira-workitem-search', { jql: literal, limit: 5 }).args, ['jira', 'workitem', 'search', `--jql=${literal}`, '--limit=5', '--json']);
});

test('CLI failures retain bounded redacted stderr and only failed Jira actions probe authentication', async () => {
  const bin = mkdtempSync(path.join(tmpdir(), 'valdr-cli-diagnostics-'));
  try {
    const calls = path.join(bin, 'calls');
    for (const cli of names) writeFileSync(path.join(bin, cli), `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(process.env.FAKE_CALLS_FILE, JSON.stringify(process.argv.slice(2)) + '\\n');
const probe = process.argv.slice(2).join(' ') === 'jira auth status';
if (probe) { process.stdout.write(process.env.FAKE_PROBE_OUT || ''); process.stderr.write(process.env.FAKE_PROBE_ERROR || ''); process.exit(Number(process.env.FAKE_PROBE_CODE || 0)); }
if (process.env.FAKE_RESULT === 'success') { process.stdout.write('{}'); process.exit(0); }
if (process.env.FAKE_RESULT === 'overflow') { fs.writeSync(2, 'unsafe-prefix-' + 'Z'.repeat(600000)); process.exit(1); }
process.stderr.write(process.env.FAKE_STDERR || ''); process.exit(1);
`, { mode: 0o755 });
    const env = { ...process.env, PATH: bin, FAKE_CALLS_FILE: calls, FAKE_STDERR: 'Error: permission denied', FAKE_PROBE_OUT: 'PRIVATE_AUTH_SUCCESS', FAKE_PROBE_CODE: '0' };
    for (const cli of names) {
      const result = run(cli, 'version', {}, env);
      assert.match(result.error.message, /Error: permission denied/);
      assert.equal(result.error.exitCode, 1);
      const secret = 'private-value-without-special-prefix';
      const sensitive = run(cli, 'version', {}, { ...env, TEST_API_TOKEN: secret, FAKE_STDERR: `Permission denied ${secret}; Bearer bearer-value-must-not-leak` });
      assert.match(sensitive.error.message, /Permission denied/);
      assert.ok(!sensitive.error.message.includes(secret));
      assert.ok(!sensitive.error.message.includes('bearer-value-must-not-leak'));
      assert.match(sensitive.error.message, /\[REDACTED\]/);
      const longSecret = 'Q'.repeat(4000);
      const long = run(cli, 'version', {}, { ...env, TEST_API_TOKEN: longSecret, FAKE_STDERR: 'X'.repeat(1150) + longSecret + ' Bearer ' + 'B'.repeat(4000) + ' trailing '.repeat(1000) });
      assert.ok(long.error.message.length <= 2000);
      assert.ok(!long.error.message.includes('QQ'));
      assert.ok(!long.error.message.includes('BB'));
      assert.match(long.error.message, /truncated/);
      const bearerBoundary = run(cli, 'version', {}, { ...env, FAKE_STDERR: 'X'.repeat(1150) + ' Bearer ' + 'B'.repeat(4000) + ' trailing '.repeat(1000) });
      assert.ok(!bearerBoundary.error.message.includes('BB'));
      assert.ok(bearerBoundary.error.message.length <= 2000);
      const overflow = run(cli, 'version', {}, { ...env, FAKE_RESULT: 'overflow' });
      assert.match(overflow.error.message, /ENOBUFS/);
      assert.ok(!overflow.error.message.includes('unsafe-prefix'));
    }
    const call = (action, extra = {}) => { writeFileSync(calls, ''); const result = run('acli', action, {}, { ...env, ...extra }); return { result, calls: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }; };
    assert.equal(call('version', { FAKE_PROBE_CODE: '1' }).calls.length, 1);
    assert.equal(call('jira-project-list', { FAKE_RESULT: 'success' }).calls.length, 1);
    const healthyAuth = call('jira-project-list');
    assert.equal(healthyAuth.calls.length, 2);
    assert.ok(!healthyAuth.result.error.message.includes('PRIVATE_AUTH_SUCCESS'));
    assert.ok(!healthyAuth.result.error.message.includes('Authentication diagnostic'));
    const expired = call('jira-project-list', { FAKE_PROBE_CODE: '1', FAKE_PROBE_ERROR: "Error: unauthorized: use 'acli jira auth login' to authenticate", FAKE_STDERR: 'X'.repeat(10000) });
    assert.deepEqual(expired.calls[1], ['jira', 'auth', 'status']);
    assert.match(expired.result.error.message, /unauthorized: use 'acli jira auth login'/);
    assert.ok(expired.result.error.message.length <= 2000);
    assert.ok(expired.result.error.message.indexOf('unauthorized') < expired.result.error.message.indexOf('XXX'));
    const probeSecret = 'Q'.repeat(4000);
    const probeBoundary = call('jira-project-list', { TEST_API_TOKEN: probeSecret, FAKE_PROBE_CODE: '1', FAKE_PROBE_ERROR: 'D'.repeat(550) + probeSecret + ' trailing '.repeat(1000) });
    assert.ok(!probeBoundary.result.error.message.includes('QQ'));
    assert.ok(probeBoundary.result.error.message.length <= 2000);
    assert.equal(call('jira-project-list', { FAKE_RESULT: 'overflow' }).calls.length, 1);
  } finally { rmSync(bin, { recursive: true, force: true }); }
});

const acli = () => import(pathToFileURL(path.join(root, 'acli', 'runner.mjs')));
const acliManifest = () => {
  const parsed = spawnSync('bun', ['-e', 'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))', path.join(root, 'acli', 'acli.tool.yaml')], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr);
  return JSON.parse(parsed.stdout);
};
const workitem = (fields, key = 'VALDR-1') => ({ key, id: '10013', fields });

test('acli import actions bind fixed argv and publish strict output schemas', async () => {
  const { commandFor } = await acli();
  const jql = '--web project = VALDR ORDER BY key ASC';
  assert.deepEqual(commandFor('jira-workitem-keys', { jql }).args, ['jira', 'workitem', 'search', `--jql=${jql}`, '--paginate', '--fields', 'key,summary', '--json']);
  assert.deepEqual(commandFor('jira-workitem-import', { key: 'VALDR-12' }).args, ['jira', 'workitem', 'view', 'VALDR-12', '--fields', 'summary,issuetype,priority,labels,description,status', '--json']);
  for (const input of [{}, { jql: '' }, { jql, limit: 5 }]) assert.throws(() => commandFor('jira-workitem-keys', input));
  for (const input of [{}, { key: 'valdr-1' }, { key: '--help' }, { key: 'VALDR-1', fields: '*all' }]) assert.throws(() => commandFor('jira-workitem-import', input));
  const manifest = acliManifest();
  const actions = Object.fromEntries(manifest.actions.map(action => [action.id, action]));
  // Catalog paths are unique per manifest; argv still names the real acli command.
  assert.equal(new Set(manifest.actions.map(action => JSON.stringify(action.path))).size, manifest.actions.length);
  assert.deepEqual(actions['jira-workitem-keys'].path, ['jira', 'workitem', 'keys']);
  assert.deepEqual(actions['jira-workitem-import'].path, ['jira', 'workitem', 'import']);
  assert.equal(actions['jira-workitem-keys'].description, 'Read the keys of every work item matching JQL, paginating through all results.');
  assert.deepEqual(actions['jira-workitem-keys'].inputSchema, { type: 'object', properties: { jql: { type: 'string', minLength: 1, maxLength: 4096 } }, required: ['jql'], additionalProperties: false });
  assert.deepEqual(actions['jira-workitem-keys'].outputSchema, { type: 'object', properties: { keys: { type: 'array', items: { type: 'string', pattern: '^[A-Z][A-Z0-9_]*-[0-9]+$' } } }, required: ['keys'], additionalProperties: false });
  assert.deepEqual(actions['jira-workitem-import'].inputSchema, actions['jira-workitem-view'].inputSchema);
  const output = actions['jira-workitem-import'].outputSchema;
  assert.equal(output.additionalProperties, false);
  assert.deepEqual(output.required, ['key', 'title', 'type', 'jiraType', 'priority', 'jiraPriority', 'labels', 'status', 'descriptionMarkdown']);
  assert.deepEqual(Object.keys(output.properties), output.required);
  assert.deepEqual(output.properties.type, { type: 'string', enum: ['task', 'bug', 'story', 'epic', 'spike'] });
  assert.deepEqual(output.properties.priority, { type: ['integer', 'null'], minimum: 1, maximum: 5 });
  for (const field of ['jiraType', 'jiraPriority', 'status']) assert.deepEqual(output.properties[field], { type: ['string', 'null'] });
  // Untransformed actions keep the permissive passthrough schema.
  assert.equal(actions['jira-workitem-view'].outputSchema, true);
});

test('jira-workitem-keys returns every key in CLI order and rejects unusable output', async () => {
  const { transformOutput } = await acli();
  assert.deepEqual(transformOutput('jira-workitem-keys', [{ key: 'VALDR-2', fields: { summary: 'b' } }, { key: 'VALDR-10' }, { key: 'VALDR-1' }]), { keys: ['VALDR-2', 'VALDR-10', 'VALDR-1'] });
  assert.deepEqual(transformOutput('jira-workitem-keys', []), { keys: [] });
  // acli emits null items when only `key` is requested; fail loudly rather than return an empty import.
  for (const data of [[null, null], [{ fields: {} }], [{ key: 7 }], { key: 'VALDR-1' }, null]) assert.throws(() => transformOutput('jira-workitem-keys', data));
  assert.deepEqual(transformOutput('jira-workitem-search', { passthrough: true }), { passthrough: true });
});

test('jira-workitem-import normalizes type, priority, labels, status and description', async () => {
  const { transformOutput } = await acli();
  const imported = fields => transformOutput('jira-workitem-import', workitem(fields));
  const adf = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fixture. ' }, { type: 'text', text: 'Safe', marks: [{ type: 'strong' }] }] }] };
  assert.deepEqual(imported({ summary: 'Add health timeout', issuetype: { name: 'Bug' }, priority: { name: 'High' }, labels: ['valdr-qa', 'api'], status: { name: 'In Progress' }, description: adf }), {
    key: 'VALDR-1', title: 'Add health timeout', type: 'bug', jiraType: 'Bug', priority: 2, jiraPriority: 'High', labels: ['valdr-qa', 'api'], status: 'In Progress', descriptionMarkdown: 'Fixture. **Safe**',
  });
  for (const [name, type] of [['Story', 'story'], ['EPIC', 'epic'], ['spike', 'spike'], ['Task', 'task'], ['Sub-task', 'task'], ['Improvement', 'task']]) assert.equal(imported({ summary: 's', issuetype: { name } }).type, type);
  for (const [name, priority] of [['Highest', 1], ['high', 2], ['MEDIUM', 3], ['Low', 4], ['Lowest', 5], ['Blocker', null], ['constructor', null]]) {
    const result = imported({ summary: 's', priority: { name } });
    assert.equal(result.priority, priority, name);
    assert.equal(result.jiraPriority, name);
  }
  assert.deepEqual(imported({ summary: 'Bare' }), { key: 'VALDR-1', title: 'Bare', type: 'task', jiraType: null, priority: null, jiraPriority: null, labels: [], status: null, descriptionMarkdown: '' });
  assert.deepEqual(imported({ summary: 'Nulls', issuetype: null, priority: null, labels: null, status: null, description: null }), { key: 'VALDR-1', title: 'Nulls', type: 'task', jiraType: null, priority: null, jiraPriority: null, labels: [], status: null, descriptionMarkdown: '' });
  assert.equal(imported({ summary: 's', description: '  *Already* markdown\n\n' }).descriptionMarkdown, '*Already* markdown');
  for (const data of [null, [], { key: 'VALDR-1' }, { fields: { summary: 's' } }, workitem({ summary: 7 })]) assert.throws(() => transformOutput('jira-workitem-import', data));
});

test('the acli runner applies transforms to real-shaped CLI output end to end', async () => {
  const bin = mkdtempSync(path.join(tmpdir(), 'valdr-acli-transform-'));
  try {
    // A file carries the payload: large outputs exceed environment size limits.
    const output = path.join(bin, 'stdout.json');
    writeFileSync(path.join(bin, 'acli'), `#!${process.execPath}\nprocess.stdout.write(require('node:fs').readFileSync(process.env.FAKE_STDOUT_FILE));\n`, { mode: 0o755 });
    const env = stdout => { writeFileSync(output, stdout); return { ...process.env, PATH: bin, FAKE_STDOUT_FILE: output }; };
    const keys = run('acli', 'jira-workitem-keys', { jql: 'project = VALDR' }, env(JSON.stringify([{ key: 'VALDR-1', fields: { summary: 'a' } }, { key: 'VALDR-2', fields: { summary: 'b' } }])));
    assert.deepEqual(keys, { ok: true, data: { keys: ['VALDR-1', 'VALDR-2'] } });
    assert.equal(run('acli', 'jira-workitem-keys', { jql: 'project = VALDR' }, env('[null,null]')).error.code, 'invalid_output');
    // Paginated reads buffer every page: ~1.2 MiB of items exceeds the default 512 KiB capture but not the keys action's limit.
    const many = Array.from({ length: 2000 }, (_, index) => ({ key: `VALDR-${index + 1}`, fields: { summary: 'S'.repeat(600) } }));
    const large = run('acli', 'jira-workitem-keys', { jql: 'project = VALDR' }, env(JSON.stringify(many)));
    assert.equal(large.ok, true, JSON.stringify(large.error));
    assert.deepEqual(large.data.keys.slice(-2), ['VALDR-1999', 'VALDR-2000']);
    assert.match(run('acli', 'jira-workitem-search', { jql: 'project = VALDR' }, env(JSON.stringify(many))).error.message, /ENOBUFS/);
    const view = run('acli', 'jira-workitem-import', { key: 'VALDR-2' }, env(JSON.stringify(workitem({ summary: 'Renders twice', issuetype: { name: 'Bug' }, priority: { name: 'Medium' }, labels: ['valdr-qa'], status: { name: 'Canceled' }, description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }] } }, 'VALDR-2'))));
    assert.deepEqual(view, { ok: true, data: { key: 'VALDR-2', title: 'Renders twice', type: 'bug', jiraType: 'Bug', priority: 3, jiraPriority: 'Medium', labels: ['valdr-qa'], status: 'Canceled', descriptionMarkdown: 'Body' } });
    // Untransformed actions still return CLI JSON unchanged.
    assert.deepEqual(run('acli', 'jira-workitem-view', { key: 'VALDR-2' }, env('{"key":"VALDR-2","fields":{}}')), { ok: true, data: { key: 'VALDR-2', fields: {} } });
  } finally { rmSync(bin, { recursive: true, force: true }); }
});

test('ADF descriptions convert to readable markdown', async () => {
  const { adfToMarkdown } = await acli();
  const t = (text, ...marks) => ({ type: 'text', text, ...(marks.length ? { marks } : {}) });
  const p = (...content) => ({ type: 'paragraph', content });
  const li = (...content) => ({ type: 'listItem', content });
  const doc = (...content) => ({ type: 'doc', version: 1, content });
  assert.equal(adfToMarkdown(null), '');
  assert.equal(adfToMarkdown(undefined), '');
  assert.equal(adfToMarkdown('  plain  '), 'plain');
  assert.equal(adfToMarkdown(doc()), '');
  assert.equal(adfToMarkdown(doc(
    { type: 'heading', attrs: { level: 1 }, content: [t('Title')] },
    { type: 'heading', attrs: { level: 3 }, content: [t('Sub')] },
    p(t('a '), t('bold', { type: 'strong' }), t(' '), t('it', { type: 'em' }), t(' '), t('code', { type: 'code' }), t(' '), t('gone', { type: 'strike' }), t(' '), t('site', { type: 'link', attrs: { href: 'https://example.com' } }), { type: 'hardBreak' }, t('next')),
    p(t('both', { type: 'link', attrs: { href: 'https://x.test' } }, { type: 'strong' })),
  )), '# Title\n\n### Sub\n\na **bold** *it* `code` ~~gone~~ [site](https://example.com)\nnext\n\n[**both**](https://x.test)');
  assert.equal(adfToMarkdown(doc(
    { type: 'bulletList', content: [li(p(t('one')), { type: 'bulletList', content: [li(p(t('nested')), { type: 'orderedList', content: [li(p(t('deep')))] })] }), li(p(t('two')))] },
    { type: 'orderedList', attrs: { order: 3 }, content: [li(p(t('three'))), li(p(t('four')), { type: 'bulletList', content: [li(p(t('sub')))] })] },
  )), '- one\n  - nested\n    1. deep\n- two\n\n3. three\n4. four\n   - sub');
  assert.equal(adfToMarkdown(doc(
    { type: 'codeBlock', attrs: { language: 'ts' }, content: [t('const a = 1;\nconst b = 2;')] },
    { type: 'codeBlock', content: [t('plain')] },
    { type: 'blockquote', content: [p(t('quoted')), p(t('more'))] },
    { type: 'rule' },
    { type: 'panel', attrs: { panelType: 'info' }, content: [p(t('note'))] },
  )), '```ts\nconst a = 1;\nconst b = 2;\n```\n\n```\nplain\n```\n\n> quoted\n>\n> more\n\n---\n\n> note');
  assert.equal(adfToMarkdown(doc(
    p(t('hi '), { type: 'mention', attrs: { id: 'x', text: '@Dana' } }, t(' '), { type: 'emoji', attrs: { shortName: ':smile:', text: '😄' } }, { type: 'emoji', attrs: { shortName: ':wave:' } }, t(' '), { type: 'inlineCard', attrs: { url: 'https://jira.test/browse/V-1' } }),
    { type: 'blockCard', attrs: { url: 'https://example.com/card' } },
    { type: 'mediaSingle', content: [{ type: 'media', attrs: { id: 'm', type: 'file' } }] },
    { type: 'futureContainer', content: [p(t('inside unknown'))] },
    p(t('wrapped '), { type: 'futureInline', content: [t('inline')] }),
  )), 'hi @Dana 😄:wave: https://jira.test/browse/V-1\n\nhttps://example.com/card\n\ninside unknown\n\nwrapped inline');
  const cell = (type, ...content) => ({ type, content });
  assert.equal(adfToMarkdown(doc({ type: 'table', content: [
    { type: 'tableRow', content: [cell('tableHeader', p(t('Name'))), cell('tableHeader', p(t('Value', { type: 'strong' })))] },
    { type: 'tableRow', content: [cell('tableCell', p(t('a|b'))), cell('tableCell', p(t('1')), p(t('2')))] },
    { type: 'tableRow', content: [cell('tableCell', p(t('only')))] },
  ] })), '| Name | **Value** |\n| --- | --- |\n| a\\|b | 1 2 |\n| only |  |');
});
