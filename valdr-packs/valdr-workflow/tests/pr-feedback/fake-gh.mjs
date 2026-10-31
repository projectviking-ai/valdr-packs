#!/usr/bin/env node
// Test double for `gh api`. It replays canned responses from FAKE_GH_FIXTURE, appends one JSON line per
// invocation to FAKE_GH_LOG, and never touches the network or a real login.
//
// FAKE_GH_FIXTURE is a JSON file that maps "<METHOD> <endpoint without leading slash or query>" to
// { exitCode, stdout, stderr }. A request without a fixture exits 1 so a missed call fails loudly.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const VALUE_FLAGS = new Set(['-H', '--header', '-X', '--method', '-f', '--raw-field', '-F', '--field', '--input', '-q', '--jq', '-t', '--template', '--hostname', '--cache', '-p', '--preview']);
const SWITCH_FLAGS = new Set(['--paginate', '--slurp', '--silent', '-i', '--include', '--verbose']);

const args = process.argv.slice(2);
const fail = message => { process.stderr.write(`fake-gh: ${message}\n`); process.exit(2); };
if (args[0] !== 'api') fail(`only "gh api" is supported, got ${JSON.stringify(args[0])}`);
if (!process.env.FAKE_GH_FIXTURE || !process.env.FAKE_GH_LOG) fail('FAKE_GH_FIXTURE and FAKE_GH_LOG are required');

let endpoint;
let method;
const headers = [];
const fields = {};
for (let index = 1; index < args.length; index++) {
  const arg = args[index];
  if (VALUE_FLAGS.has(arg)) {
    const value = args[++index];
    if (value === undefined) fail(`${arg} needs a value`);
    if (arg === '-X' || arg === '--method') method = value;
    else if (arg === '-H' || arg === '--header') headers.push(value);
    else if (arg === '-f' || arg === '--raw-field' || arg === '-F' || arg === '--field') {
      const split = value.indexOf('=');
      if (split < 1) fail(`${arg} needs key=value`);
      fields[value.slice(0, split)] = value.slice(split + 1);
    }
  } else if (SWITCH_FLAGS.has(arg)) continue;
  else if (arg.startsWith('-')) fail(`unsupported flag ${arg}`);
  else if (endpoint === undefined) endpoint = arg;
  else fail(`unexpected argument ${arg}`);
}
if (endpoint === undefined) fail('missing endpoint');

const key = `${(method ?? (Object.keys(fields).length > 0 ? 'POST' : 'GET')).toUpperCase()} ${endpoint.replace(/^\//, '').replace(/\?.*$/, '')}`;
appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify({ key, args, headers, fields })}\n`);

const fixtures = JSON.parse(readFileSync(process.env.FAKE_GH_FIXTURE, 'utf8'));
const response = fixtures[key] ?? { exitCode: 1, stdout: '', stderr: `fake-gh: no fixture for ${key}` };
if (response.after) writeFileSync(process.env.FAKE_GH_FIXTURE, JSON.stringify({ ...fixtures, ...response.after }));
process.stdout.write(response.stdout ?? '');
process.stderr.write(response.stderr ?? '');
process.exitCode = response.exitCode ?? 0;
