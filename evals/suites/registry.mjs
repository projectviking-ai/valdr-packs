// Metadata stays provider-free so discovery and comparison can run offline.
const suiteModules = {
  'workflow-authoring': ['index','business-scenarios','business-score','command-safety','evaluate','execution','fixtures','policy','scenarios'],
  'task-repair': ['index','scenarios','state','fixtures','policy','evaluate'],
};
export const suiteNames = Object.freeze(Object.keys(suiteModules));
export async function getSuite(id) {
  if (id === 'workflow-authoring') return (await import('./workflow-authoring/index.mjs')).workflowAuthoringSuite;
  if (id === 'task-repair') return (await import('./task-repair/index.mjs')).taskRepairSuite;
  throw new Error(`Unknown suite ${id}`);
}
export function sourceRequirements(id) {
  if (!Object.hasOwn(suiteModules,id)) return null;
  return {
    runnerFiles: ['run.mjs','suites/registry.mjs',
      ...['agents','arguments','author','binary','evidence','harness','lifecycle','mcp','proxy','results','runner'].map(name=>`core/${name}.mjs`),
      ...suiteModules[id].map(name=>`suites/${id}/${name}.mjs`)],
    promptFiles: id === 'workflow-authoring' ? ['ensure-ready','readiness-review','review-all','code-review']
      .map(name=>`valdr-workflow/workflows/task/valdr-workflow.workflow.task-${name}.workflow.yaml`) : [],
  };
}
