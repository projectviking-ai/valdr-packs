import fs from 'node:fs';
import path from 'node:path';
import { createIsolatedEnvironment } from './harness.mjs';
import { installAgent } from './agents.mjs';
import { runAgentTurn } from './author.mjs';
import { captureSubmission, writeEvidence } from './evidence.mjs';
import { EvaluationInfrastructureError } from './lifecycle.mjs';
import { summarizeAttempts, classifySubmissionFailure, evaluationOutcome, authorRequestSafety } from './results.mjs';

export function requiredToolsFor(suite) {
  return [...new Set([...suite.requiredTools, 'pm_health', 'pm_generate_ulid', 'pm_prompt', 'pm_capability', 'pm_agent'])];
}

export async function runTrials({ options, suite, selected, directory, packsRoot, profile, authorBinary }, dependencies = {}) {
  const core = { createIsolatedEnvironment, installAgent, runAgentTurn, ...dependencies };
  const results = [];
  const lifecycle = options.lifecycle;
  const progress = options.onProgress ?? (event => process.stdout.write(`${JSON.stringify(event)}\n`));
  for (const scenario of selected) {
    if (lifecycle?.signal.aborted) break;
    const scenarioDir = path.join(directory, scenario.id);
    fs.mkdirSync(scenarioDir, { recursive: true });
    const result = { scenarioId: scenario.id, title: scenario.title, attempts: [] };
    results.push(result);
    let environment, context;
    try {
      if (typeof core.runAgentTurn !== 'function') throw new EvaluationInfrastructureError('The author launcher is unavailable.');
      environment = await core.createIsolatedEnvironment({ valdrBin: options.valdrBin,
        evidenceDir: path.join(scenarioDir, 'author'), mode: 'author', label: `${suite.id}:${scenario.id}`,
        requiredTools: requiredToolsFor(suite), profile, lifecycle,
        requestAllowed: (method, params) => context !== undefined && suite.policy(context)(method, params) });
      lifecycle?.throwIfCancelled();
      const agent = await core.installAgent(environment, { packsRoot, agentPath: options.agentPath ?? suite.defaultAgent, tier: options.tier });
      writeEvidence(path.join(scenarioDir, 'agent.json'), agent);
      context = await suite.prepare(environment, { scenario, packsRoot });
      const initialPrompt = suite.prompt({ environment, scenario, context, agent });
      let prompt = initialPrompt, sessionUlid;
      for (let attempt = 0; attempt <= options.maxRepairs; attempt++) {
        lifecycle?.throwIfCancelled();
        const attemptDir = path.join(scenarioDir, `attempt-${attempt + 1}`);
        fs.mkdirSync(attemptDir);
        const record = { attempt: attempt + 1 };
        result.attempts.push(record);
        writeEvidence(path.join(attemptDir, 'request.json'), { prompt });
        const beforeState = await suite.beforeAttempt?.({ environment, context, scenario });
        if (beforeState !== undefined) writeEvidence(path.join(attemptDir, 'before-state.json'), beforeState);
        progress({ phase: 'authoring', suite: suite.id, scenario: scenario.id, attempt: attempt + 1, directory });
        let authored;
        try {
          authored = await core.runAgentTurn(environment, { agent, profile, authorBinary, scenarioId: scenario.id, prompt,
            timeoutMs: options.timeoutMs, sessionUlid, outputDir: attemptDir, submissionFile: suite.submissionFile });
          if (suite.submissionFile && authored.settled === true && !authored.error) {
            try { authored.submission = captureSubmission(path.join(environment.repoRoot, suite.submissionFile), path.join(attemptDir, 'submission.json')); }
            catch (error) { authored.submissionError = { message: error.message, code: error.code, path: error.path }; }
          }
          record.author = authored;
          writeEvidence(path.join(attemptDir, 'author.json'), authored);
        } finally {
          if (suite.captureState) writeEvidence(path.join(attemptDir, 'after-state.json'), await suite.captureState({ environment, context }));
        }
        sessionUlid = authored.sessionUlid;
        writeEvidence(path.join(attemptDir, 'tool-requests.json'), environment.broker?.requests ?? []);
        if (authored.settled !== true || authored.error) throw new Error(`Agent provider did not complete: ${authored.error ?? 'completion was not verified'}`);
        const safety = authorRequestSafety(environment.broker?.requests);
        let submission;
        if (!safety.safe) {
          record.evaluation = { evaluatorVersion: suite.version, scenarioId: scenario.id, title: scenario.title,
            ok: false, safety, variants: [], validation: [] };
          writeEvidence(path.join(attemptDir, 'execution', 'evaluation.json'), record.evaluation);
        } else if (suite.submissionFile) {
          const expected = path.join(environment.repoRoot, suite.submissionFile);
          try {
            if (authored.submissionError) throw Object.assign(new Error(authored.submissionError.message), authored.submissionError);
            if (!authored.submission) throw new Error('Author returned no submission receipt');
            submission = JSON.parse(fs.readFileSync(authored.submission.path, 'utf8'));
          } catch (error) {
            const incomplete = classifySubmissionFailure(error, expected);
            if (incomplete) record.submissionIncomplete = incomplete;
            else if (error instanceof SyntaxError) {
              record.evaluation = { ok: false, error: `Missing or invalid submission: ${error.message}` };
            } else throw error;
          }
        } else {
          submission = authored.finalMessage ?? '';
          fs.writeFileSync(path.join(attemptDir, 'submission.txt'), submission, { flag: 'wx', mode: 0o444 });
        }
        if (!record.submissionIncomplete && !record.evaluation) record.evaluation = await suite.evaluate({
          environment, context, scenario, authored, submission, beforeState,
          outputDir: path.join(attemptDir, 'execution'), valdrBin: options.valdrBin, lifecycle,
        });
        writeEvidence(path.join(attemptDir, 'result.json'), record);
        progress({ phase: record.submissionIncomplete ? 'incomplete' : 'evaluated', suite: suite.id,
          scenario: scenario.id, attempt: attempt + 1, ok: record.evaluation?.ok, submissionIncomplete: record.submissionIncomplete });
        if (record.submissionIncomplete || record.evaluation.ok || (suite.stopOnSafetyRejection && record.evaluation.safety?.safe === false)) break;
        prompt = `${initialPrompt}\n\n${suite.feedback(record.evaluation)}`;
      }
    } catch (error) {
      if (!result.attempts.length) result.attempts.push({ attempt: 1 });
      if (lifecycle?.signal.aborted || error.code === 'VALDR_EVAL_CANCELLED') result.cancelled = true;
      else result.attempts.at(-1).infrastructureError = error.stack ?? error.message;
      progress({ phase: 'incomplete', suite: suite.id, scenario: scenario.id, message: error.message });
    } finally {
      if (environment) {
        try { result.cleanup = await environment.close(); }
        catch (error) { result.cleanup = { ok: false, error: error.message }; }
        if (result.cleanup?.ok !== true) {
          result.cleanup ??= { ok: false, error: 'Missing cleanup receipt' };
          if (!result.attempts.length) result.attempts.push({ attempt: 1 });
          result.attempts.at(-1).infrastructureError ??= 'Owned environment cleanup was not verified';
        }
      }
      if (environment) writeEvidence(path.join(scenarioDir, 'tool-requests.json'), environment.broker?.requests ?? []);
      result.outcome = evaluationOutcome([result]);
      writeEvidence(path.join(scenarioDir, 'result.json'), result);
      writeEvidence(path.join(directory, 'summary.json'), { schemaVersion: 1, ...summarizeAttempts(results), suite: suite.id, directory, results, outcome: evaluationOutcome(results, { cancelled: lifecycle?.signal.aborted }) });
    }
  }
  const summary = { schemaVersion: 1, ...summarizeAttempts(results), outcome: evaluationOutcome(results, { cancelled: lifecycle?.signal.aborted }), suite: suite.id, suiteVersion: suite.version,
    directory, results, completedAt: new Date().toISOString() };
  summary.ok = summary.outcome === 'passed' && summary.eventuallyPassed === selected.length && !summary.infrastructureIncomplete
    && !summary.submissionIncomplete && results.every(result => result.cleanup?.ok === true);
  writeEvidence(path.join(directory, 'summary.json'), summary);
  return summary;
}

export async function checkSuite({ valdrBin, directory, binary, suite, packsRoot, profile, agentPath, tier, lifecycle }, dependencies = {}) {
  const core = { createIsolatedEnvironment, installAgent, ...dependencies };
  const result = { schemaVersion: 1, outcome: 'infrastructure_incomplete', ok: false, compatibility: 'incompatible', suite: suite.id, binary, providerCalls: 0, directory };
  let environment;
  try {
    environment = await core.createIsolatedEnvironment({ valdrBin, evidenceDir: path.join(directory, 'preflight'), mode: 'runtime',
      label: `${suite.id}:compatibility-check`, requiredTools: requiredToolsFor(suite), profile, lifecycle });
    result.tools = requiredToolsFor(suite);
    result.isolation = { root: environment.root, home: environment.home, repoRoot: environment.repoRoot, authorityDataDir: environment.health?.info?.dataDir };
    if (packsRoot && agentPath) {
      const agent = await core.installAgent(environment, { packsRoot, agentPath, tier });
      writeEvidence(path.join(directory, 'preflight-agent.json'), agent);
      result.agentHandle = agent.handle;
    }
    await (dependencies.check ?? suite.check)(environment, { scenario: suite.scenarios[0], packsRoot });
    result.ok = true;
    result.compatibility = 'compatible';
  } catch (error) { result.error = error.message; }
  finally {
    if (environment) {
      try { result.cleanup = await environment.close(); }
      catch (error) { result.cleanup = { ok: false, error: error.message }; }
      if (result.cleanup?.ok !== true) { result.ok = false; result.compatibility = 'incomplete'; }
    }
  }
  result.outcome = lifecycle?.signal.aborted ? 'cancelled' : result.ok ? 'passed' : 'infrastructure_incomplete';
  return result;
}
