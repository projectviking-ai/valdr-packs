#!/usr/bin/env bun
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { redactEvidence, writeEvidence } from './core/evidence.mjs';
import { runTrials, checkSuite } from './core/runner.mjs';

import { markActive, inventoryRuns, planPrune, applyPrune } from './retention/runs.mjs';
import { renderRetentionResult } from './cli/retention.mjs';
import { parseArgs } from './cli/args.mjs';
import { HELP, renderPreview, renderResult } from './cli/output.mjs';
import { runDoctor } from './cli/doctor.mjs';
import { createLifecycle, installSignalHandlers } from './core/lifecycle.mjs';
import { getSuite } from './suites/registry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const terminalText = value => stripVTControlCharacters(redactEvidence(String(value))).replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
const terminalJson = (value, indent) => JSON.stringify(redactEvidence(value), null, indent).replace(/[\x7f-\x9f]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);

export function snapshotSource(options, directory, binary) {
  const snapshotRoot = path.join(directory, 'prompt-source');
  fs.mkdirSync(snapshotRoot, { recursive: true });
  const licenseReference = path.join(os.homedir(), '.valdr', 'valdr.lic');
  let licenseTarget;
  try { licenseTarget = fs.realpathSync(licenseReference); } catch {}
  const filter = source => {
    if (/^\.env(?:\.|$)/.test(path.basename(source)) || path.resolve(source) === licenseReference) return false;
    if (!licenseTarget) return true;
    let target;
    try { target = fs.realpathSync(source); } catch { return true; }
    return target !== licenseTarget && !(fs.lstatSync(source).isSymbolicLink() && licenseTarget.startsWith(path.join(target, path.sep)));
  };
  fs.cpSync(here, path.join(directory, 'eval-source'), { recursive: true, filter });
  fs.cpSync(path.join(options.packsRoot, 'valdr-packs'), path.join(snapshotRoot, 'valdr-packs'), { recursive: true, filter });
  function scan(root, relative = '') {
    return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
      const rel = path.join(relative, entry.name);
      return entry.isDirectory() ? scan(path.join(root, entry.name), rel)
        : entry.isFile() ? [{ path: rel, sha256: hash(fs.readFileSync(path.join(root, entry.name))) }] : [];
    });
  }
  const optionalGit = (...args) => {
    try { return execFileSync('git', args, { cwd: options.packsRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd(); }
    catch { return null; }
  };
  writeEvidence(path.join(directory, 'source-manifest.json'), { binary,
    packsCommit: optionalGit('rev-parse', 'HEAD'), packsWorkingTree: optionalGit('status', '--short'),
    promptFiles: scan(path.join(snapshotRoot, 'valdr-packs')),
    runnerFiles: scan(path.join(directory, 'eval-source')) });
  return snapshotRoot;
}

async function runOfflineCommand(options) {
  const { loadEvidence } = await import('./reporting/evidence.mjs');
  const { buildReport, renderTextReport } = await import('./reporting/report.mjs');
  const { compareEvidence, renderTextComparison } = await import('./reporting/compare.mjs');
  const { renderHtmlReport, renderHtmlComparison } = await import('./reporting/html.mjs');
  const loaded=options.inputs.map(loadEvidence);
  const result=options.mode==='report'?buildReport(loaded[0]):compareEvidence(loaded[0],loaded[1]);
  const text=options.mode==='report'?renderTextReport(result):renderTextComparison(result);
  if (options.outputPath) {
    const content=options.format==='html' ? options.mode==='report'?renderHtmlReport(result):renderHtmlComparison(result) : text+'\n';
    try { fs.writeFileSync(options.outputPath,content,{flag:'wx',mode:0o600}); }
    catch(error) { throw new Error(error.code==='EEXIST' ? `${options.outputPath}: already exists; refusing to overwrite.` : `${options.outputPath}: cannot save report. ${error.message}`); }
    result.outputPath=options.outputPath;
  }
  return result;
}

export async function runEvaluation(options) {
  if (options.mode==='runs') return inventoryRuns(options.evidenceRoot);
  if (options.mode==='prune') {
    const plan=planPrune(inventoryRuns(options.evidenceRoot),options);
    return options.apply?applyPrune(plan):plan;
  }
  if (['report','compare'].includes(options.mode)) return runOfflineCommand(options);
  options.lifecycle?.throwIfCancelled();
  const suite = await getSuite(options.suite);
  const selected = options.scenario === 'all' ? suite.scenarios : suite.scenarios.filter(scenario => options.scenario.split(',').includes(scenario.id));
  if (!selected.length || (options.scenario !== 'all' && selected.length !== new Set(options.scenario.split(',')).size)) throw new Error('Unknown scenario selection');
  if (options.mode === 'list') return selected.map(({ id, title, features, evaluationUnavailable }) => ({ id, title, features, evaluationUnavailable }));
  const profile = { ...options.profile, sandboxMode: suite.submissionFile ? 'workspace-write' : 'read-only' };
  const preview = { dryRun: Boolean(options.dryRun), liveAuthoringAvailable: true, suite: suite.id, profileName: options.profileName, profile,
    agentPath: options.agentPath ?? suite.defaultAgent, scenarios: selected.map(({ id, title, evaluationUnavailable }) => ({ id, title, evaluationUnavailable })),
    maxRepairs: options.maxRepairs, maximumAuthorTurns: selected.length * (options.maxRepairs + 1) };
  if (options.dryRun) return preview;
  if (options.mode === 'doctor') return runDoctor(options, { suite,
    preflight: () => runEvaluation({ ...options, mode: 'check' }) });
  if (options.mode === 'run') process.stderr.write(`${terminalText(renderPreview(preview))}\n`);
  const { getBinaryInfo, getCodexBinaryInfo, resolveValdrBinary } = await import('./core/binary.mjs');
  options = { ...options, valdrBin: resolveValdrBinary(options.valdrBin) };
  const binary = getBinaryInfo(options.valdrBin);
  const authorBinary = options.mode === 'run' ? getCodexBinaryInfo() : undefined;
  const directory = path.join(options.evidenceRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-${options.round}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(directory, { recursive: true });
  const releaseActive = markActive(directory);
  try {
    const snapshotRoot = snapshotSource(options, directory, binary);
    const packsRoot = path.join(snapshotRoot, 'valdr-packs');
    const { lifecycle, onProgress, ...savedOptions } = options;
    const charter = { ...savedOptions, suiteVersion: suite.version, profile, binary, authorBinary, directory,
      agentPath: options.agentPath ?? suite.defaultAgent, startedAt: new Date().toISOString(),
      maximumAuthorTurns: options.mode === 'run' ? selected.length * (options.maxRepairs + 1) : 0,
      repairPolicy: 'Continue the same session and disposable fixture; preserve each attempt before feedback.',
      isolation: 'Fresh disposable evaluation directories and scratch repository per scenario.',
      claim: 'Pack agent evaluation through public Codex CLI and Valdr MCP interfaces.' };
    writeEvidence(path.join(directory, 'charter.json'), charter);
    writeEvidence(path.join(directory, 'scenario-snapshot.json'), selected);
    let result;
    try {
      if (options.mode === 'check') result = await checkSuite({ valdrBin: options.valdrBin, directory, binary, suite, packsRoot, profile,
        agentPath: options.agentPath ?? suite.defaultAgent, tier: options.tier, lifecycle });
      else if (options.mode === 'replay') result = await suite.replay({ options, scenario: selected[0], directory, binary });
      else result = await runTrials({ options, suite, selected, directory, packsRoot, profile, authorBinary });
    } catch (error) {
      result = { schemaVersion: 1, ok: false, outcome: lifecycle?.signal.aborted ? 'cancelled' : 'infrastructure_incomplete',
        suite: suite.id, directory, error: error.message };
    }
    if (lifecycle?.signal.aborted) result = { ...result, schemaVersion: 1, ok: false, outcome: 'cancelled' };
    result = { ...result, suite: suite.id, suiteVersion: suite.version, completedAt: result.completedAt ?? new Date().toISOString() };
    writeEvidence(path.join(directory, 'summary.json'), result);
    return result;
  } finally { releaseActive(); }
}

export async function main(args = process.argv.slice(2)) {
  let options;
  const lifecycle = createLifecycle();
  const disposeSignals = installSignalHandlers(lifecycle);
  try {
    options = { ...parseArgs(args), lifecycle };
    if (options.help) { console.log(terminalText(HELP)); return; }
    options.onProgress = event => process.stderr.write(
      options.json ? `${terminalJson(event)}\n` : `${terminalText(`${event.scenario}: ${event.phase}${event.attempt ? ` (attempt ${event.attempt})` : ''}${event.message ? ` — ${event.message}` : ''}`)}\n`);
    const result = await runEvaluation(options);
    if (options.json) console.log(terminalJson(result, 2));
    else if (['runs','prune'].includes(options.mode)) console.log(terminalText(renderRetentionResult(options,result)));
    else if (options.mode==='report') { const { renderTextReport }=await import('./reporting/report.mjs'); console.log(terminalText(renderTextReport(result)+(result.outputPath?`\nSaved: ${result.outputPath}`:''))); }
    else if (options.mode==='compare') { const { renderTextComparison }=await import('./reporting/compare.mjs'); console.log(terminalText(renderTextComparison(result)+(result.outputPath?`\nSaved: ${result.outputPath}`:''))); }
    else console.log(terminalText(renderResult(options, result)));
    if (!['list','report'].includes(options.mode) && !result.ok && !result.dryRun && !lifecycle.signal.aborted) process.exitCode = 1;
  } catch (error) {
    if (options?.json || args.includes('--json')) console.log(terminalJson({ schemaVersion: 1, ok: false, outcome: lifecycle.signal.aborted ? 'cancelled' : 'infrastructure_incomplete', error: error.message }));
    else console.error(terminalText(`Evaluation error: ${error.message}\nRun bun evals/run.mjs --help for usage.`));
    if (!lifecycle.signal.aborted) process.exitCode = 1;
  } finally {
    const cleanup = await lifecycle.close();
    if (!cleanup.ok) { process.stderr.write(`${terminalText(`Cleanup needs attention: ${cleanup.errors.join('; ')}`)}\n`); if (!lifecycle.signal.aborted) process.exitCode = 1; }
    disposeSignals();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
