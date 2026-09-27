#!/usr/bin/env bun
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const usage = 'Usage: bun skills/valdr-workflow-tools/scripts/discover-cli.mjs <gh|aws|gcloud|acli> <output-directory>';

export function parseGhReference(text) {
  const commands = [];
  for (const section of text.split(/(?=^#{2,} gh )/m)) {
    const heading = /^#{2,} gh (.+)$/m.exec(section)?.[1];
    if (!heading) continue;
    const commandPath = heading.split(/\s+(?=[<\[{])/)[0].split(/\s+/);
    const aliases = /\nAliases\n\n([^\n]+)/.exec(section)?.[1].split(', ').map(alias => alias.replace(/^gh /, '').split(' ')) ?? [];
    commands.push({ path: commandPath, kind: heading.includes('<command>') ? 'group' : 'command', aliases });
  }
  for (const command of commands) {
    if (commands.some(other => other.path.length > command.path.length && command.path.every((part, index) => other.path[index] === part))) command.kind = 'group';
  }
  return commands;
}

export function coverageStatus(failures, gaps) {
  return failures.length || gaps.some(gap => /failed|unavailable|not inspected|extensions are present/i.test(gap)) ? 'INCOMPLETE' : 'PASS';
}

export function parseCobraHelp(text) {
  const lines = text.split('\n');
  const children = [];
  let inCommands = false;
  for (const line of lines) {
    if (/^(?:Available|Additional) Commands:?$/.test(line.trim())) { inCommands = true; continue; }
    if (!line.trim()) { inCommands = false; continue; }
    if (inCommands) {
      const name = /^\s{2}([a-z0-9][a-z0-9-]*)\s+/.exec(line)?.[1];
      if (name) children.push(name);
    }
  }
  const aliases = /\nAliases:\n\s+([^\n]+)/.exec(text)?.[1].split(/,\s*/) ?? [];
  return { children, aliases };
}

export function classify(commands, manifest) {
  const rows = new Map(commands.map(command => [command.path.join(' '), command]));
  // --version is a flag in some CLIs, but a reviewed action in every adapter.
  for (const action of manifest.actions) if (!rows.has(action.path.join(' '))) rows.set(action.path.join(' '), { path: action.path, kind: 'command', aliases: [], source: 'reviewed manifest action; may be a CLI flag' });
  return [...rows.values()].sort((a, b) => a.path.join(' ').localeCompare(b.path.join(' '))).map(command => {
    const action = manifest.actions.find(action => action.path.join(' ') === command.path.join(' '));
    return { ...command, aliases: command.aliases ?? [], execution: action?.execution ?? 'unsupported',
      ...(action ? { actionId: action.id, schemaConfidence: 'reviewed-manifest', ...(action.execution === 'unsupported' ? { unsupportedReason: action.unsupportedReason } : {}) } : { unsupportedReason: command.kind === 'group' ? 'Command group; select a reviewed leaf action.' : 'No reviewed input/output contract and dispatcher mapping.', schemaConfidence: 'inventory-only' }) };
  });
}

function executable(name) {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const file = path.join(directory, name);
    try { fs.accessSync(file, fs.constants.X_OK); if (fs.statSync(file).isFile()) return fs.realpathSync(file); } catch { /* Next PATH entry. */ }
  }
  throw new Error(`${name} is not installed on PATH.`);
}

export function discover(cli, output) {
  if (!['gh', 'aws', 'gcloud', 'acli'].includes(cli) || !output) throw new Error(usage);
  const binary = executable(cli);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-cli-discovery-'));
  const env = { ...process.env, NO_COLOR: '1', PAGER: 'cat', GH_PAGER: 'cat', GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_NO_EXTENSION_UPDATE_NOTIFIER: '1',
    AWS_CONFIG_FILE: path.join(temporary, 'aws-config'), AWS_SHARED_CREDENTIALS_FILE: path.join(temporary, 'aws-credentials'), AWS_EC2_METADATA_DISABLED: 'true', AWS_PAGER: '',
    CLOUDSDK_CONFIG: path.join(temporary, 'gcloud'), CLOUDSDK_CORE_DISABLE_PROMPTS: '1', CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: 'true' };
  delete env.AWS_PROFILE;
  delete env.AWS_DEFAULT_PROFILE;
  delete env.AWS_DATA_PATH;
  delete env.PYTHONPATH;
  delete env.CLOUDSDK_ACTIVE_CONFIG_NAME;
  const run = (program, args, timeout = 60_000) => {
    const result = spawnSync(program, args, { encoding: 'utf8', env, shell: false, timeout, maxBuffer: 32 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      const missingModule = /No module named ['"]([a-zA-Z0-9_.-]+)['"]/.exec(result.stderr ?? '')?.[1];
      throw new Error(`${path.basename(program)} ${args[0] ?? ''}: ${result.error?.code ?? `exit ${result.status}`}${missingModule ? `; missing module ${missingModule}` : ''}`);
    }
    return result.stdout;
  };
  const gaps = [];
  const failures = [];
  let commands = [];
  let method;
  try {
    const version = run(binary, cli === 'gcloud' ? ['version'] : ['--version']).trim();
    if (cli === 'gh') {
      method = 'gh help reference';
      commands = parseGhReference(run(binary, ['help', 'reference']));
      const extensions = run(binary, ['extension', 'list']).trim();
      if (extensions) gaps.push('Installed extensions are present; their code/help was not executed. Inventory each extension separately before claiming extension coverage.');
      // Preserve names, never user-defined alias bodies (which can contain secrets).
      for (const line of run(binary, ['alias', 'list']).split('\n')) {
        const name = /^([a-zA-Z0-9_-]+):/.exec(line)?.[1];
        if (name) { commands.push({ path: [name], kind: 'command', source: 'local alias name; body omitted' }); gaps.push(`User alias ${name}: target not inspected or executed.`); }
      }
    } else if (cli === 'acli') {
      method = 'recursive acli <path> --help; groups and leaves only';
      const visit = commandPath => {
        if (commands.length > 5000 || commandPath.length > 12) throw new Error('CLI tree exceeded bounded help discovery limits.');
        if (commandPath.length === 1 && ['guard', 'rovodev'].includes(commandPath[0])) {
          commands.push({ path: commandPath, kind: 'group', availability: 'external-plugin-not-inspected' });
          gaps.push(`acli ${commandPath[0]}: external plugin subtree not inspected; plugin help may install or launch separate code.`);
          return;
        }
        let parsed;
        try { parsed = parseCobraHelp(run(binary, [...commandPath, '--help'], 15_000)); }
        catch (error) { commands.push({ path: commandPath, kind: 'unknown', availability: 'help-unavailable' }); failures.push(`${['acli', ...commandPath].join(' ')} help unavailable: ${error.message}`); return; }
        if (commandPath.length) commands.push({ path: commandPath, kind: parsed.children.length ? 'group' : 'command', aliases: parsed.aliases.map(alias => [...commandPath.slice(0, -1), alias]) });
        for (const child of parsed.children) visit([...commandPath, child]);
      };
      visit([]);
      gaps.push('Only commands exposed by installed CLI help are inventoried; hidden commands and future plugins are outside this discovery scope.');
    } else if (cli === 'aws') {
      method = 'installed awscli native subcommand_table metadata, including custom commands and waiters';
      const shebang = fs.readFileSync(binary, 'utf8').split('\n')[0];
      const python = /^#!(\/\S*python[^\s]*)$/.exec(shebang)?.[1];
      if (!python) throw new Error('AWS installation does not expose its Python interpreter; metadata discovery is incomplete (do not install or replace it automatically).');
      const result = JSON.parse(run(python, ['-c', `
import json, sys
def no_network(event, args):
 if event in ('socket.connect', 'socket.getaddrinfo'): raise RuntimeError('Network access is forbidden during metadata discovery')
sys.addaudithook(no_network)
from awscli.clidriver import create_clidriver
rows=[]
failures=[]
def walk(table, prefix=()):
 if len(prefix)>12: raise RuntimeError('Command tree exceeds 12 levels')
 for name, command in sorted(table.items()):
  if name=='help': continue
  p=prefix+(name,)
  try: children=getattr(command, 'subcommand_table', None)
  except Exception as error: failures.append(' '.join(p)+': '+type(error).__name__); children={}
  rows.append({'path':p,'kind':'group' if children else 'command'})
  if children: walk(children,p)
walk(create_clidriver().subcommand_table)
print(json.dumps({'commands':rows,'failures':failures}))
`], 120_000));
      commands = result.commands;
      failures.push(...result.failures);
      gaps.push('User-configured AWS plugins and aliases are deliberately excluded by the isolated empty configuration; help pseudo-commands are omitted.');
    } else {
      method = 'gcloud meta list-commands --hidden';
      try {
        const paths = run(binary, ['meta', 'list-commands', '--hidden'], 120_000).split('\n').map(line => line.trim().split(/\s+/)).filter(parts => parts[0] === 'gcloud' && parts.length > 1).map(parts => parts.slice(1));
        commands = paths.map(parts => ({ path: parts, kind: paths.some(other => other.length > parts.length && parts.every((part, i) => other[i] === part)) ? 'group' : 'command' }));
      } catch (error) {
        method = 'installed SDK surface source inventory (runtime tree enumeration failed)';
        failures.push(`Native command-tree enumeration failed (${error.message}); source candidates below do not prove loadable commands or installed release-track/component availability.`);
        const surface = path.resolve(path.dirname(binary), '../lib/surface');
        const visit = directory => {
          for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, item.name);
            if (item.isDirectory() && item.name !== '__pycache__') visit(file);
            else if (item.isFile() && /\.(py|yaml)$/.test(item.name)) {
              const relative = path.relative(surface, file).replaceAll(path.sep, '/');
              const parts = relative.replace(/\.(py|yaml)$/, '').split('/');
              const kind = parts.at(-1) === '__init__' ? 'group' : 'command';
              if (kind === 'group') parts.pop();
              if (!parts.length) continue;
              commands.push({ path: parts.map(part => part.replaceAll('_', '-')), kind, source: `lib/surface/${relative}`, availability: 'unverified-source-candidate' });
            }
          }
        };
        visit(surface);
      }
      gaps.push('Optional components, plugins, hidden/track aliases and source candidates require separate availability checks; no component installs were attempted.');
    }
    const packRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const manifest = Bun.YAML.parse(fs.readFileSync(path.join(packRoot, `valdr-packs/valdr-tools/tools/${cli}/${cli}.tool.yaml`), 'utf8'));
    commands = classify(commands, manifest);
    const inventory = { schemaVersion: 1, cli, version, executable: { name: cli, sha256: createHash('sha256').update(fs.readFileSync(binary)).digest('hex') },
      capturedAt: new Date().toISOString(), method, toolId: manifest.id, toolRevision: manifest.revision, commands };
    const coverage = { schemaVersion: 1, cli, version, scope: method,
      status: coverageStatus(failures, gaps), failures,
      discovered: commands.length, supported: commands.filter(command => command.execution === 'supported').length,
      unsupported: commands.filter(command => command.execution === 'unsupported').length, gaps,
      executionEvidence: 'Inventory only. Supported means a reviewed starter dispatcher action exists; no network action was executed by discovery.' };
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'inventory.json'), `${JSON.stringify(inventory)}\n`);
    fs.writeFileSync(path.join(output, 'coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`);
    return coverage;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length === 3 && process.argv[2] === '--help') console.log(usage);
    else {
      if (process.argv.length !== 4) throw new Error(usage);
      console.log(JSON.stringify(discover(...process.argv.slice(2)), null, 2));
    }
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
