import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { scenarios, authorContract } from './scenarios.mjs';
import { businessAuthorContract } from './business-scenarios.mjs';
import { evaluateBundle, EVALUATOR_VERSION } from './evaluate.mjs';
import { seedRuntimeFixtures, seedWorkflowFixtures } from './fixtures.mjs';
import { authorRequestAllowed } from './policy.mjs';
import { writeEvidence } from '../../core/evidence.mjs';
import { authorRequestSafety } from '../../core/results.mjs';

export async function checkWorkflowFixtures(environment, seed = seedRuntimeFixtures) {
  await seed(environment);
  for (const [tool, key, field, keyField] of [['pm_project', 'BENCH', 'project', 'key'], ['pm_task', 'BENCH-1', 'task', 'taskKey']]) {
    const response = await environment.call(tool, { action: 'get', [keyField]: key });
    const data = response?.structuredContent?.data ?? response?.structuredContent ?? {};
    if (data[field]?.key !== key) throw new Error(`Installed Valdr did not return the isolated ${key} fixture`);
  }
}

export const workflowAuthoringSuite = {
  id: 'workflow-authoring', version: EVALUATOR_VERSION, stopOnSafetyRejection: true,
  defaultAgent: 'valdr-workflow/orchestrator/verdandi/verdandi.agent.yaml',
  requiredTools: ['pm_health', 'pm_generate_ulid', 'pm_agent', 'pm_project', 'pm_task', 'pm_workflow', 'pm_prompt', 'pm_capability'],
  scenarios, submissionFile: 'bundle.json',
  policy: () => authorRequestAllowed,
  check: environment => checkWorkflowFixtures(environment),
  async prepare(environment, { packsRoot }) {
    return await seedWorkflowFixtures(environment, { packsRoot });
  },
  prompt: ({ environment, scenario, agent }) => [
    `Author the following workflow as ${agent.handle} using your installed capability prompts and the isolated Valdr MCP tools.`,
    `Write ${path.join(environment.repoRoot, 'bundle.json')} as strict JSON: {"definitions":[<complete WorkflowDefinition objects>],"entryWorkflowKey":"<root key>"}.`,
    scenario.briefStyle === 'business' ? businessAuthorContract : authorContract,
    'This is an isolated authoring assessment. The evaluator will run the bundle in separate disposable PM homes after you submit it.',
    'You may inspect help and validate drafts. Do not start/test workflow runs or launch other agents in this authoring environment.',
    scenario.briefStyle === 'business'
      ? 'Do not inspect benchmark implementation, scenario oracles, other candidate submissions, or evidence directories. Use only the public brief and capability/tool documentation. Choose your own workflow and step names.'
      : 'Do not inspect benchmark implementation, scenario oracles, other candidate submissions, or evidence directories. Use only the public brief and capability/tool documentation. Preserve all required observable step names.',
    scenario.brief,
    scenario.briefStyle === 'business' ? null : `The evaluator will exercise these inputs: ${JSON.stringify(scenario.variants.map(({ id, inputs }) => ({ id, inputs })))}`,
  ].filter(item => item !== null).join('\n\n'),
  async evaluate({ environment, submission, scenario, valdrBin, outputDir, lifecycle }) {
    const safety = authorRequestSafety(environment?.broker?.requests);
    if (!safety.safe) {
      const evaluation = { evaluatorVersion: EVALUATOR_VERSION, scenarioId: scenario.id, title: scenario.title,
        ok: false, validation: [], variants: [], safety };
      writeEvidence(path.join(outputDir, 'evaluation.json'), evaluation);
      return evaluation;
    }
    return evaluateBundle({ bundle: submission, scenario, valdrBin, outputDir, lifecycle });
  },
  feedback: evaluation => `${feedbackFor(evaluation)}\nRewrite bundle.json with the complete repaired bundle; the evaluator will execute it.`,
  async replay({ options, scenario, directory, binary }) {
    const bytes = fs.readFileSync(options.bundlePath);
    fs.writeFileSync(path.join(directory, 'bundle.json'), bytes, { flag: 'wx', mode: 0o444 });
    const evaluation = await evaluateBundle({ bundle: JSON.parse(bytes.toString('utf8')), scenario,
      valdrBin: options.valdrBin, lifecycle: options.lifecycle, outputDir: path.join(directory, 'execution') });
    return { schemaVersion: 1, outcome: evaluation.ok ? 'passed' : evaluation.safety?.safe === false ? 'policy_rejected' : 'candidate_failed', ok: evaluation.ok, evaluationOnly: true, scenarioId: scenario.id,
      bundleSha256: crypto.createHash('sha256').update(bytes).digest('hex'), binary, directory, evaluation };
  },
};
export function feedbackFor(evaluation) {
  // Expose actual diagnostics, never evaluator input/expected-output fixtures.
  const diagnostics = {
    validation: evaluation.validation?.map(item => ({
      workflowKey: item.workflowKey, variantId: item.variantId, valid: item.valid,
      errors: item.errors, warnings: item.warnings,
    })).filter(item => item.valid === false || item.errors?.length || item.warnings?.length),
    safety: evaluation.safety,
    error: evaluation.error,
    variants: evaluation.variants?.filter(variant => !variant.ok).map(variant => ({
      id: variant.id, error: variant.error, actualStatus: variant.actualStatus,
      stoppedSteps: variant.execution?.steps?.filter(step => ['blocked', 'failed'].includes(step.status))
        .map(step => ({ stepKey: step.stepKey, status: step.status, outputJson: step.outputJson })),
      assertions: variant.assertions?.filter(item => item.pass === false)
        .map(item => ({ message: item.message, actual: item.actual })),
    })),
  };
  return `The independent evaluator rejected this candidate. Repair the workflow bundle using these observed diagnostics. Keep the original requirements and output file contract.\n${JSON.stringify(diagnostics, null, 2)}`;
}

