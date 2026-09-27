// Optional installed-runtime check. Only version/help and local AWS metadata are read.
// Run outside the sandbox when host CLI access requires it; never logs in or calls APIs.
import assert from 'node:assert/strict';
import { accessSync, constants, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = mkdtempSync(path.join(tmpdir(), 'valdr-cli-help-'));
const env = { ...process.env, CLOUDSDK_CONFIG: directory, CLOUDSDK_CORE_DISABLE_PROMPTS: '1', CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: 'true', PAGER: 'cat', GH_PAGER: 'cat', GH_NO_UPDATE_NOTIFIER: '1', AWS_PAGER: '', AWS_EC2_METADATA_DISABLED: 'true', AWS_CONFIG_FILE: path.join(directory, 'config'), AWS_SHARED_CREDENTIALS_FILE: path.join(directory, 'credentials') };
delete env.AWS_PROFILE;
delete env.AWS_DEFAULT_PROFILE;
delete env.AWS_DATA_PATH;
delete env.PYTHONPATH;
const run = (binary, args, input) => {
  const result = spawnSync(binary, args, { env, input, encoding: 'utf8', timeout: 30000, maxBuffer: 2 ** 20 });
  assert.equal(result.status, 0, `${path.basename(binary)} ${args[0] ?? ''}: ${result.error?.code ?? result.status}`);
  return result.stdout;
};
try {
  let checked = 0;
  for (const cli of ['gh', 'aws', 'gcloud', 'acli']) {
    const { commands } = await import(new URL(`../valdr-packs/valdr-tools/tools/${cli}/runner.mjs`, import.meta.url));
    const version = run(cli, commands.version.argv).trim().split('\n')[0];
    checked++;
    if (cli === 'aws') {
      const executable = (process.env.PATH ?? '').split(path.delimiter).map(dir => path.join(dir, 'aws')).find(file => { try { accessSync(file, constants.X_OK); return true; } catch { return false; } });
      const python = /^#!(\/\S*python[^\s]*)$/m.exec(readFileSync(realpathSync(executable), 'utf8'))?.[1];
      assert.ok(python, 'This AWS installation does not expose Python metadata; installed verification is incomplete.');
      const specs = Object.entries(commands).filter(([id]) => id !== 'version').map(([id, spec]) => ({ id, path: spec.path, flags: spec.argv.filter(x => x.flag).map(x => x.flag.slice(2)) }));
      const results = JSON.parse(run(python, ['-c', `
import json,sys
# AWS metadata must not resolve credentials or connect to any service.
def audit(event,args):
 if event in ('socket.connect','socket.getaddrinfo'): raise RuntimeError('Network forbidden during metadata verification')
sys.addaudithook(audit)
from awscli.clidriver import create_clidriver
cli=create_clidriver()
results=[]
for spec in json.load(sys.stdin):
 command=cli.subcommand_table[spec['path'][0]].subcommand_table[spec['path'][1]]
 flags=set(command.arg_table)|set(cli.arg_table)
 missing=set(spec['flags'])-flags
 assert not missing, (spec['id'], sorted(missing))
 if 'max-items' in spec['flags']:
  model=command._operation_model
  paginators=cli.session.get_paginator_model(model._service_model.service_name)._paginator_config
  assert model.name in paginators, spec['id']
 results.append(spec['id'])
print(json.dumps(results))
`], JSON.stringify(specs)));
      checked += results.length;
    } else {
      for (const [id, spec] of Object.entries(commands)) {
        if (id === 'version') continue;
        // Catalog paths can differ from the CLI command (e.g. jira workitem keys); argv's leading literals name the real command.
        const command = spec.argv.slice(0, spec.argv.findIndex(part => typeof part !== 'string' || part.startsWith('-')));
        const help = run(cli, [...command, '--help']);
        for (const binding of spec.argv.filter(x => x.flag)) {
          // gcloud lists --project under its shared GCLOUD_WIDE_FLAG section.
          if (cli === 'gcloud' && binding.flag === '--project') { assert.ok(help.includes('GCLOUD_WIDE_FLAG')); continue; }
          assert.ok(help.includes(binding.flag), `${cli} ${id}: ${binding.flag} absent from help`);
        }
        const json = spec.argv.indexOf('--json');
        if (cli === 'gh' && json >= 0) for (const field of spec.argv[json + 1].split(',')) assert.ok(new RegExp(`\\b${field}\\b`).test(help), `${cli} ${id}: JSON field ${field} absent from help`);
        checked++;
      }
    }
    console.log(`${cli}: ${Object.keys(commands).length} version/help/model checks passed (${version})`);
  }
  console.log(`${checked} installed contracts passed. Authenticated execution was not tested.`);
} finally { rmSync(directory, { recursive: true, force: true }); }
