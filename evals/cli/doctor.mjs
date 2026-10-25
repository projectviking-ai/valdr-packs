import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getBinaryInfo } from '../core/binary.mjs';
import { loadAgentSource } from '../core/agents.mjs';

export async function runDoctor(options, { suite, preflight } = {}) {
  const report = { schemaVersion: 1, ok: false, outcome: 'infrastructure_incomplete', suite: options.suite, providerCalls: 0, liveAuthoringAvailable: true, authorReadiness: 'not_checked', checks: [] };
  const check = async (id, fix, probe) => {
    try { report.checks.push({ id, ok: true, message: String(await probe()) }); }
    catch (error) { report.checks.push({ id, ok: false, message: error.message, fix }); }
  };
  await check('bun', 'Install Bun 1.4.3 or later.', () => {
    const version = globalThis.Bun?.version;
    const [major, minor, patch] = (version ?? '0.0.0').split('.').map(Number);
    if (!(major > 1 || major === 1 && (minor > 4 || minor === 4 && patch >= 3))) throw new Error('Bun 1.4.3+ with YAML support is required.');
    return version;
  });
  await check('platform', 'Run the harness on macOS or Linux.', () => {
    if (!['darwin', 'linux'].includes(process.platform)) throw new Error('The harness supports macOS and Linux.');
    return process.platform;
  });
  await check('git', 'Install Git and add it to PATH.', () => execFileSync('git', ['--version'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim());
  await check('valdr', 'Install the valdr CLI or pass --valdr-bin /absolute/path/to/valdr.', () => {
    report.binary = getBinaryInfo(options.valdrBin);
    return report.binary.version;
  });
  await check('agent', 'Check --packs-root, --agent and --tier; use the public packs repository.', () => {
    const agent = loadAgentSource({ packsRoot: path.join(options.packsRoot, 'valdr-packs'), agentPath: options.agentPath ?? suite.defaultAgent, tier: options.tier });
    return `${agent.handle}: ${agent.capabilities.length} capability bindings`;
  });
  if (report.checks.filter(item => ['bun', 'platform', 'git', 'valdr', 'agent'].includes(item.id)).every(item => item.ok)) {
    await check('fixtures', 'Inspect the preflight evidence and verify the installed valdr CLI setup.', async () => {
      const result = await preflight();
      report.directory = result.directory;
      report.cleanup = result.cleanup;
      if (!result.ok) throw new Error(result.error ?? 'Isolated preflight did not verify cleanup.');
      return 'Public tools, selected persona, fixture readback and authority cleanup verified.';
    });
  }
  report.ok = report.checks.every(item => item.ok);
  if (report.ok) report.outcome = 'passed';
  if (options.lifecycle?.signal.aborted) { report.ok = false; report.outcome = 'cancelled'; }
  return report;
}
