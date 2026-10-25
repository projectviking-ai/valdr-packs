import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRetentionArgs } from './retention.mjs';
import { loadConfiguration, selectProfile } from './config.mjs';

const packsRepo = fileURLToPath(new URL('../../', import.meta.url));
import { suiteNames } from '../suites/registry.mjs';
function parseOfflineArgs(args) {
  const mode=args[0], inputs=[];
  const options={mode,json:false,format:'text'};
  for(let index=1;index<args.length;index++) {
    const arg=args[index];
    if(arg==='--help'||arg==='-h'){options.help=true;continue;}
    if(arg==='--json'){options.json=true;continue;}
    if(arg==='--format'||arg==='--output') {
      const value=args[++index];
      if(!value||value.startsWith('-'))throw new Error(`${arg} requires a value.`);
      options[arg==='--format'?'format':'outputPath']=value;
    } else if(arg.startsWith('-')) throw new Error(`Unsupported ${mode} option ${arg}. Use --help for offline command usage.`);
    else inputs.push(path.resolve(arg));
  }
  if(!options.help && inputs.length!==(mode==='compare'?2:1))throw new Error(`${mode} requires ${mode==='compare'?'baseline and candidate runs':'a saved run directory or summary.json'}.`);
  if(!['text','html'].includes(options.format))throw new Error('--format must be text or html.');
  if(options.format==='html'&&!options.outputPath&&!options.help)throw new Error('HTML requires --output file.html.');
  if(options.outputPath) {
    options.outputPath=path.resolve(options.outputPath);
    if(path.extname(options.outputPath)!==(options.format==='html'?'.html':'.txt'))throw new Error(`Use a .${options.format==='html'?'html':'txt'} output file; source evidence cannot be replaced.`);
  }
  options.inputs=inputs;
  return options;
}

export function parseArgs(args, environment = process.env) {
  if (!args.length || ['--help', '-h'].includes(args[0])) return { help: true };
  if (['runs','prune'].includes(args[0])) return parseRetentionArgs(args);
  if (['report','compare'].includes(args[0])) return parseOfflineArgs(args);
  args = [...args];
  const command = args.shift();
  if (!['list', 'doctor', 'run', 'replay'].includes(command)) throw new Error(`Unknown command ${command}. Run bun evals/run.mjs --help for usage.`);
  const overrides = {};
  let positionalSuite = false;
  const fields = { '--suite': 'suite', '--agent': 'agentPath', '--tier': 'tier', '--profile': 'profile', '--scenario': 'scenario',
    '--max-repairs': 'maxRepairs', '--timeout-ms': 'timeoutMs', '--valdr-bin': 'valdrBin', '--packs-root': 'packsRoot',
    '--evidence-root': 'evidenceRoot', '--round': 'round', '--bundle': 'bundlePath', '--config': 'configPath' };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (['--help', '-h'].includes(flag)) { overrides.help = true; continue; }
    if (flag === '--json') { overrides.json = true; continue; }
    if (flag === '--dry-run') { overrides.dryRun = true; continue; }
    if (!flag.startsWith('-') && !positionalSuite) { overrides.suite = flag; positionalSuite = true; continue; }
    if (!fields[flag]) throw new Error(`Unknown option ${flag}. Run bun evals/run.mjs --help for usage.`);
    const value = args[++index];
    if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value.`);
    overrides[fields[flag]] = value;
  }
  const config = loadConfiguration(overrides.configPath);
  const defaults = { ...config.defaults };
  if (overrides.configPath) overrides.configPath = path.resolve(overrides.configPath);
  const configDir = overrides.configPath ? path.dirname(overrides.configPath) : process.cwd();
  for (const key of ['packsRoot', 'evidenceRoot']) if (defaults[key] !== undefined) defaults[key] = path.resolve(configDir, defaults[key]);
  const options = { mode: command, suite: 'workflow-authoring', scenario: 'all', maxRepairs: 0,
    timeoutMs: 600000, profile: 'sol-high', tier: 'sovereign', round: 'baseline',
    valdrBin: environment.VALDR_BIN || 'valdr', packsRoot: packsRepo, json: false, dryRun: false, ...defaults, ...overrides };
  for (const key of ['suite', 'scenario', 'tier', 'profile', 'round', 'valdrBin', 'packsRoot']) if (typeof options[key] !== 'string' || !options[key].trim()) throw new Error(`${key} must be a nonblank string.`);
  if (!suiteNames.includes(options.suite)) throw new Error(`Unknown suite ${options.suite}. Choose ${suiteNames.join(' or ')}.`);
  if (!['raider', 'vanguard', 'sovereign'].includes(options.tier)) throw new Error('tier must be raider, vanguard, or sovereign');
  if (options.agentPath !== undefined && (typeof options.agentPath !== 'string' || !options.agentPath.trim() || path.isAbsolute(options.agentPath) || options.agentPath.split(/[\\/]/).includes('..'))) throw new Error('agent must be a relative manifest path inside the public valdr-packs tree');
  for (const key of ['maxRepairs', 'timeoutMs']) {
    if (!/^\d+$/.test(String(options[key]))) throw new Error(`${key} must be an integer`);
    options[key] = Number(options[key]);
  }
  if (options.maxRepairs > 2) throw new Error('maxRepairs must be between 0 and 2');
  if (options.timeoutMs < 1000 || options.timeoutMs > 1200000) throw new Error('timeoutMs must be between 1000 and 1200000');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(options.round)) throw new Error('round must be a simple lowercase label');
  options.packsRoot = path.resolve(options.packsRoot);
  options.evidenceRoot = path.resolve(options.evidenceRoot ?? path.join(options.packsRoot, '.valdr-evals'));
  if (options.bundlePath) {
    if (options.suite !== 'workflow-authoring') throw new Error('--bundle replay is only supported by the workflow-authoring suite');
    if (options.mode !== 'replay' || options.scenario === 'all' || options.scenario.includes(',')) throw new Error('--bundle requires replay with exactly one --scenario');
    options.bundlePath = path.resolve(options.bundlePath);
  }
  if (options.mode === 'replay' && !options.bundlePath) throw new Error('replay requires --bundle and exactly one --scenario.');
  if (options.dryRun && options.mode !== 'run') throw new Error('--dry-run is available for run only.');
  options.profileName = options.profile;
  options.profile = selectProfile(options.profileName, config.profiles);
  return options;
}
