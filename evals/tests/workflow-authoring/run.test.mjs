import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarizeAttempts, classifySubmissionFailure } from '../../core/results.mjs';
import { checkSuite, runTrials } from '../../core/runner.mjs';
import { workflowAuthoringSuite, checkWorkflowFixtures, feedbackFor } from '../../suites/workflow-authoring/index.mjs';

test('workflow author denials stop evaluation and remain rejected after later allowed calls', async t => {
  const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-author-policy-'));
  t.after(()=>fs.rmSync(outputDir,{recursive:true,force:true}));
  for (const [name,action] of [['pm_workflow','start'],['pm_workflow','test_definition'],['pm_task','create']]) {
    const environment={broker:{requests:[
      {method:'tools/call',params:{name,arguments:{action}},allowed:false,completed:true},
      {method:'tools/call',params:{name:'pm_workflow',arguments:{action:'validate'}},allowed:true,completed:true},
    ]}};
    const result=await workflowAuthoringSuite.evaluate({environment,submission:null,scenario:{id:'policy',title:'Policy rejection',variants:[]},outputDir});
    assert.equal(result.ok,false);
    assert.equal(result.safety.safe,false);
    assert.ok(result.safety.errors.some(message=>message.includes(`${name}/${action}`)));
    assert.deepEqual(result.variants,[],'Denied authors must not execute their candidate.');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir,'evaluation.json'))),result);
  }
});

test('workflow author evaluation requires its broker audit and preserves normal bundle validation', async t => {
  const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-author-policy-'));
  t.after(()=>fs.rmSync(outputDir,{recursive:true,force:true}));
  const options={submission:null,scenario:{id:'policy',variants:[]},outputDir};
  await assert.rejects(workflowAuthoringSuite.evaluate(options),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE');
  for (const requests of [[{}],[{allowed:true,completed:false}]]) {
    await assert.rejects(workflowAuthoringSuite.evaluate({...options,environment:{broker:{requests}}}),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE');
  }
  const result=await workflowAuthoringSuite.evaluate({...options,environment:{broker:{requests:[]}}});
  assert.equal(result.safety.safe,false);
  assert.match(result.safety.errors[0],/Bundle requires/);
});

for (const bundle of [JSON.stringify({definitions:[],entryWorkflowKey:'test'}), 'not JSON', null])
test(`workflow author policy rejection stops repairs with ${bundle===null?'missing':bundle==='not JSON'?'malformed':'valid'} submission`, async t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-policy-run-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const repoRoot=path.join(directory,'repo');fs.mkdirSync(repoRoot);
  let turns=0;
  const environment={root:directory,repoRoot,broker:{requests:[{method:'tools/call',params:{name:'pm_task',arguments:{action:'create'}},allowed:false,completed:true}]},close:async()=>({ok:true})};
  const suite={...workflowAuthoringSuite,prepare:async()=>({}),prompt:()=> 'Author the workflow.'};
  const scenario={id:'policy',title:'Policy rejection',variants:[]};
  const result=await runTrials({options:{maxRepairs:2,onProgress:()=>{}},suite,selected:[scenario],directory,packsRoot:directory,profile:{}},{
    createIsolatedEnvironment:async()=>environment,installAgent:async()=>({handle:'test'}),
    runAgentTurn:async()=>{turns++;if(bundle!==null)fs.writeFileSync(path.join(repoRoot,'bundle.json'),bundle);return {settled:true,sessionUlid:'test'};},
  });
  assert.equal(turns,1);
  assert.equal(result.repairsUsed,0);
  assert.equal(result.outcome,'policy_rejected');
});

test('compatibility preflight seeds and reads only disposable fixtures without authoring', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'verdandi-check-test-'));
  const calls = [];
  let closed = false;
  try {
    const result = await checkSuite({ valdrBin: 'valdr', directory, suite: workflowAuthoringSuite }, {
      createIsolatedEnvironment: async options => {
        assert.equal(options.mode, 'runtime');
        assert.equal(options.valdrBin, 'valdr');
        assert.deepEqual(new Set(options.requiredTools), new Set(['pm_health', 'pm_generate_ulid', 'pm_agent', 'pm_project', 'pm_task', 'pm_workflow', 'pm_prompt', 'pm_capability']));
        return {
          root: directory, home: path.join(directory, 'pm'), repoRoot: path.join(directory, 'repo'),
          health: { info: { dataDir: path.join(directory, 'pm') } },
          call: async (tool, args) => {
            calls.push([tool, args.action]);
            assert.deepEqual(args, tool === 'pm_project' ? { action: 'get', key: 'BENCH' } : { action: 'get', taskKey: 'BENCH-1' });
            return { structuredContent: { data: tool === 'pm_project' ? { project: { key: 'BENCH' } } : { task: { key: 'BENCH-1' } } } };
          },
          close: async () => { closed = true; return { ok: true, authorityClosed: true }; },
        };
      },
      check: environment => checkWorkflowFixtures(environment, async () => { calls.push(['fixtures', 'seed']); }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.compatibility, 'compatible');
    assert.equal(result.providerCalls, 0);
    assert.deepEqual(calls, [['fixtures', 'seed'], ['pm_project', 'get'], ['pm_task', 'get']]);
    assert.equal(closed, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('compatibility does not claim success when shutdown evidence is missing', async () => {
  const result = await checkSuite({ valdrBin: 'valdr', directory: 'unused-test-evidence', suite: workflowAuthoringSuite }, {
    createIsolatedEnvironment: async () => ({
      call: async tool => ({ structuredContent: tool === 'pm_project' ? { project: { key: 'BENCH' } } : { task: { key: 'BENCH-1' } } }),
      close: async () => undefined,
    }),
    check: environment => checkWorkflowFixtures(environment, async () => {}),
  });
  assert.equal(result.ok, false);
  assert.equal(result.compatibility, 'incomplete');
});

test('compatibility fixture failure closes its disposable authority before returning diagnostics', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'verdandi-check-test-'));
  let closed = false;
  try {
    const result = await checkSuite({ valdrBin: 'valdr', directory, suite: workflowAuthoringSuite }, {
      createIsolatedEnvironment: async () => ({ close: async () => { closed = true; return { ok: true }; } }),
      check: async () => { throw new Error('Fixture verification failed'); },
    });
    assert.equal(result.ok, false);
    assert.equal(result.compatibility, 'incompatible');
    assert.match(result.error, /Fixture verification failed/);
    assert.equal(closed, true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('first-candidate and repaired scores remain separate and infra is not author failure', () => {
  const result = summarizeAttempts([
    { scenarioId: 'a', attempts: [{ evaluation: { ok: false } }, { evaluation: { ok: true } }] },
    { scenarioId: 'b', attempts: [{ evaluation: { ok: true } }] },
    { scenarioId: 'c', attempts: [{ infrastructureError: 'server did not start' }] },
  ]);
  assert.equal(result.firstCandidatePassed, 1);
  assert.equal(result.eventuallyPassed, 2);
  assert.equal(result.infrastructureIncomplete, 1);
  assert.equal(result.authorScenariosEvaluated, 2);
  assert.equal(result.repairsUsed, 1);
});

test('the exact missing submission is incomplete without guessing why it is absent', () => {
  const expectedPath = path.resolve('scratch/repo/bundle.json');
  const classification = classifySubmissionFailure({ code: 'ENOENT', path: expectedPath }, expectedPath);
  assert.deepEqual(classification, { reason: 'missing_submission', cause: 'undetermined' });
  const result = summarizeAttempts([{ scenarioId: 'unsubmitted', attempts: [{ submissionIncomplete: classification }] }]);
  assert.equal(result.submissionIncomplete, 1);
  assert.equal(result.authorScenariosEvaluated, 0);
  assert.equal(result.infrastructureIncomplete, 0);
  assert.equal(result.repairsUsed, 0);
});

test('submission classification does not hide invalid JSON or evidence access failures', () => {
  const expectedPath = path.resolve('scratch/repo/bundle.json');
  assert.equal(classifySubmissionFailure(new SyntaxError('Invalid JSON'), expectedPath), null);
  assert.equal(classifySubmissionFailure({ code: 'ENOENT', path: path.resolve('saved/submission.json') }, expectedPath), null);
  assert.equal(classifySubmissionFailure({ code: 'EIO', path: expectedPath }, expectedPath), null);
  assert.equal(classifySubmissionFailure({ code: 'EACCES', path: expectedPath }, expectedPath), null);
});

test('feedback contains observed diagnostics without leaking expected oracle outputs', () => {
  const feedback = feedbackFor({ ok: false, validation: [{ errors: ['bad reference'] }], variants: [{ id: 'route-a', ok: false, expectedOutputs: { secret: 'hidden' }, error: 'run blocked', assertions: [{ pass: false, message: 'missing required output' }] }] });
  assert.match(feedback, /bad reference/);
  assert.match(feedback, /run blocked/);
  assert.doesNotMatch(feedback, /hidden/);
});

test('repair feedback identifies the blocked step without exposing expected answers', () => {
  const feedback = feedbackFor({ variants: [{ id: 'valid-input', ok: false, actualStatus: 'blocked',
    execution: { steps: [{ stepKey: 'gate', status: 'blocked' }] },
    expectedOutputs: { answer: 'do-not-send' },
  }] });
  assert.match(feedback, /"stepKey": "gate"/);
  assert.match(feedback, /"status": "blocked"/);
  assert.doesNotMatch(feedback, /do-not-send/);
});
