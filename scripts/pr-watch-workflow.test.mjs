import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { emptyState } from '../valdr-packs/valdr-workflow/tools/pr-feedback/feedback.mjs';

const root = new URL('../valdr-packs/valdr-workflow/', import.meta.url);
const path = name => fileURLToPath(new URL(name, root));
const deliveryPath = path('workflows/task/valdr-workflow.workflow.task-delivery.workflow.yaml');
const checkPath = path('workflows/git/valdr-workflow.workflow.pull-request-check.workflow.yaml');
const watchPath = path('workflows/git/valdr-workflow.workflow.pull-request-watch.workflow.yaml');
const publishPath = path('workflows/task/valdr-workflow.workflow.task-prepare-deliver-and-publish.workflow.yaml');
const manifestPath = path('tools/pr-feedback/pr-feedback.tool.yaml');
const parseYaml = filename => JSON.parse(execFileSync('bun', ['-e',
  'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))', filename], { encoding: 'utf8' }));
const check = parseYaml(checkPath).workflow;
const watch = parseYaml(watchPath).workflow;
const publish = parseYaml(publishPath).workflow;
const manifest = parseYaml(manifestPath);
const children = Object.fromEntries(['observe', 'decide', 'settle', 'dispatch'].map(name =>
  [name, parseYaml(path(`workflows/git/valdr-workflow.workflow.pull-request-${name}.workflow.yaml`)).workflow]));
const shared = Object.fromEntries(['find-reviewers', 'session-identity', 'send-review'].map(name =>
  [name, parseYaml(path(`workflows/task/valdr-workflow.workflow.task-${name}.workflow.yaml`)).workflow]));
const followupWorkflows = [check, watch, ...Object.values(children), ...Object.values(shared)];
const workflowsByKey = new Map(followupWorkflows.map(workflow => [workflow.key, workflow]));
const stepMap = workflow => new Map(workflow.steps.map(step => [step.key, step]));
const steps = stepMap(check);
const watchSteps = stepMap(watch);
const ref = name => `\${workflow.inputs.${name}}`;
const output = (step, name) => `\${steps.${step}.outputs.${name}}`;
const hasWhen = (step, value, expected) => (step.when ?? []).some(condition =>
  condition.value === value && (condition.equals === expected || condition.allowed?.includes(expected)));
const ancestors = (map, key, found = new Set()) => {
  for (const dependency of map.get(key)?.needs ?? []) {
    assert.ok(map.has(dependency), `${key} refers to a missing step ${dependency}`);
    if (!found.has(dependency)) {
      found.add(dependency);
      ancestors(map, dependency, found);
    }
  }
  return found;
};
const after = (map, key, dependency) => assert.ok(ancestors(map, key).has(dependency), `${key} must follow ${dependency}`);

test('delivery uses the current definition and redundant round definitions are gone', () => {
  assert.equal(parseYaml(deliveryPath).workflow.version, '0.11.3');
  assert.equal(existsSync(path('workflows/task/valdr-workflow.workflow.task-delivery-0.12.0.workflow.yaml')), false);
  assert.equal(existsSync(path('workflows/git/valdr-workflow.workflow.pull-request-round.workflow.yaml')), false);
});

test('the follow-up workflows reuse sessions without launching sessions or another round workflow', () => {
  assert.equal(check.version, '0.3.7');
  assert.equal(watch.version, '0.3.7');
  for (const workflow of followupWorkflows) {
    assert.equal(workflow.pack, 'valdr-workflow');
    assert.ok(!('routerLauncherConfigKey' in workflow.inputs));
    assert.ok(!('executorLauncherConfigKey' in workflow.inputs));
    for (const step of workflow.steps) {
      if (step.kind === 'subworkflow') {
        const child = workflowsByKey.get(step.workflow.key);
        assert.ok(child, `${step.key} composes only a declared focused or shared child`);
        assert.deepEqual(step.workflow, { key: child.key, version: child.version });
      }
      if (step.session) assert.equal(step.session.action, 'input', `${step.key} only reuses a session`);
      if (step.tool?.id === 'pm_workflow') assert.equal(step.tool.action, 'get_run', `${step.key} only reads an existing run`);
      if (step.tool?.id === 'pm_session') assert.ok(['list', 'get', 'config', 'abort'].includes(step.tool.action), `${step.key} does not launch a session`);
    }
    assert.ok(!JSON.stringify(workflow).includes('valdr-pm'));
    assert.ok(!JSON.stringify(workflow).includes('valdr-workflow.pull-request.round'));
  }
});

test('check composes observe, decide, settle and dispatch through declared typed boundaries', () => {
  assert.deepEqual(check.steps.map(step => step.key), ['observe', 'decide', 'settle', 'dispatch']);
  const contracts = {
    observe: {
      inputs: { automationKey: 'string', taskKey: 'string', implementationSessionUlid: 'string' },
      outputs: { activationId: 'string', roundStatus: 'string', activeSessionUlid: 'string', hasActive: 'string', stateVersion: 'integer', state: 'object' },
    },
    decide: {
      inputs: { owner: 'string', repo: 'string', roundStatus: 'string', hasActive: 'string', prNumber: 'integer', state: 'object' },
      outputs: { decision: 'string', cancelRound: 'string', prOutcome: 'string', notice: 'string', noticeTarget: 'string', requestId: 'string', nextState: 'object' },
    },
    settle: {
      inputs: { automationKey: 'string', activationId: 'string', stateVersion: 'integer', nextState: 'object', owner: 'string', repo: 'string', taskKey: 'string', decision: 'string', cancelRound: 'string', prOutcome: 'string', notice: 'string', noticeTarget: 'string', activeSessionUlid: 'string', hasActive: 'string', prNumber: 'integer' },
      outputs: { decision: 'string' },
    },
    dispatch: {
      inputs: { automationKey: 'string', activationId: 'string', stateVersion: 'integer', nextState: 'object', owner: 'string', repo: 'string', remoteName: 'string', headBranch: 'string', taskKey: 'string', implementationSessionUlid: 'string', prNumber: 'integer', decision: 'string', taskContext: 'string' },
      outputs: { decision: 'string' },
    },
  };
  for (const [name, child] of Object.entries(children)) {
    const call = steps.get(name);
    assert.equal(child.key, `valdr-workflow.pull-request.${name}`);
    assert.equal(child.version, name === 'dispatch' ? '0.2.2' : '0.1.5');
    assert.equal(child.source.capabilityKey, `valdr-workflow.workflow.pull-request-${name}`);
    assert.deepEqual(child.start, { mode: 'manual' });
    assert.equal(call.kind, 'subworkflow');
    assert.deepEqual(call.workflow, { key: child.key, version: child.version });
    for (const kind of ['inputs', 'outputs']) {
      assert.deepEqual(Object.fromEntries(Object.entries(child[kind]).map(([field, descriptor]) => [field, descriptor.type])), contracts[name][kind]);
      for (const [field, descriptor] of Object.entries(child[kind])) assert.equal(descriptor.required, true, `${name} ${kind}.${field} is required`);
    }
    assert.deepEqual(Object.keys(call.inputs).sort(), Object.keys(child.inputs).sort());
    assert.deepEqual(Object.keys(child.outputMappings).sort(), Object.keys(child.outputs).sort());
    for (const [field, mapping] of Object.entries(call.outputs ?? {})) {
      assert.ok(field in child.outputs, `${name}.${field} is a declared child output`);
      assert.equal(mapping, `$.normalized.child.outputs.${field}`);
    }
    for (const [field, mapping] of Object.entries(call.inputs)) {
      const input = /^\$\{workflow\.inputs\.(\w+)\}$/.exec(mapping);
      const upstream = /^\$\{steps\.(\w+)\.outputs\.(\w+)\}$/.exec(mapping);
      const taskContext = name === 'dispatch' && field === 'taskContext';
      if (taskContext) assert.equal(mapping, `TASK-${ref('taskKey')}`);
      const source = taskContext ? check.inputs.taskKey : input ? check.inputs[input[1]] : children[upstream?.[1]]?.outputs[upstream?.[2]];
      assert.ok(source, `${name}.${field} comes from a declared parent input or child output`);
      assert.equal(source.type, child.inputs[field].type, `${name}.${field} keeps its boundary type`);
      if (upstream) {
        assert.ok(upstream[2] in steps.get(upstream[1]).outputs, `${name}.${field} reads a mapped output`);
        after(steps, name, upstream[1]);
      }
    }
  }
  assert.deepEqual(steps.get('observe').inputs, Object.fromEntries(Object.keys(children.observe.inputs).map(name => [name, ref(name)])));
  assert.deepEqual(steps.get('decide').inputs, {
    owner: ref('owner'), repo: ref('repo'), roundStatus: output('observe', 'roundStatus'), hasActive: output('observe', 'hasActive'),
    prNumber: ref('prNumber'), state: output('observe', 'state'),
  });
  for (const name of ['settle', 'dispatch']) {
    const fromObservation = ['activationId', 'stateVersion', 'activeSessionUlid', 'hasActive'];
    const fromDecision = ['nextState', 'decision', 'cancelRound', 'prOutcome', 'notice', 'noticeTarget'];
    assert.deepEqual(steps.get(name).inputs, Object.fromEntries(Object.keys(children[name].inputs).map(field =>
      [field, field === 'taskContext' ? `TASK-${ref('taskKey')}` : fromObservation.includes(field) ? output('observe', field) : fromDecision.includes(field) ? output('decide', field) : ref(field)])));
  }
  for (const name of ['observe', 'decide']) {
    assert.deepEqual(steps.get(name).outputs, Object.fromEntries(Object.keys(children[name].outputs).map(field =>
      [field, `$.normalized.child.outputs.${field}`])));
  }
  assert.deepEqual(children.observe.outputMappings, {
    activationId: output('rule', 'activationId'), stateVersion: output('state', 'stateVersion'), state: output('observe', 'state'),
    roundStatus: output('observe', 'roundStatus'), activeSessionUlid: output('observe', 'sessionUlid'), hasActive: output('observe', 'hasActive'),
  });
  assert.deepEqual(children.decide.outputMappings, Object.fromEntries(Object.keys(children.decide.outputs).map(field => [field, output('snapshot', field)])));
  assert.deepEqual(children.settle.outputMappings, { decision: ref('decision') });
  assert.equal(steps.get('observe').when, undefined);
  assert.equal(steps.get('decide').when, undefined);
  assert.equal(steps.get('settle').when, undefined, 'settle must also run before a dispatch decision');
  assert.deepEqual(steps.get('dispatch').when, [{ kind: 'value_in', value: output('decide', 'decision'), allowed: ['dispatch', 'review', 'revise', 'publish'] }]);
  after(steps, 'dispatch', 'settle');
  assert.equal(check.outputMappings.decision, output('decide', 'decision'));
});

test('feedback is sent once to the existing implementation session without occupying the check', () => {
  const steps = stepMap(children.dispatch);
  const address = steps.get('send');
  assert.equal(address.kind, 'session');
  assert.equal(address.session.action, 'input');
  assert.equal(address.session.sessionUlid, ref('implementationSessionUlid'));
  assert.equal(address.session.expectTaskKey, ref('taskKey'));
  assert.equal(address.session.expectAgentHandle, output('load_task', 'assigneeHandle'));
  assert.equal(address.detached, true);
  assert.equal(address.waitsFor, undefined);
  assert.equal(address.gates, undefined);
  assert.deepEqual(address.outputs, {
    turnClientRequestId: '$.normalized.input.turnClientRequestId',
    baselineSeq: '$.normalized.input.baselineSeq',
  });
  assert.deepEqual(address.when, [{ kind: 'value_in', value: ref('decision'), allowed: ['dispatch', 'revise'] }]);
  assert.equal(children.dispatch.steps.filter(step => step.kind === 'session').length, 1);
  for (const step of followupWorkflows.flatMap(workflow => workflow.steps).filter(step => step.kind === 'session')) {
    assert.equal(step.detached, true, `${step.key} must not occupy the check`);
    assert.equal(step.waitsFor, undefined);
  }
});

test('feedback reopens the task before resuming implementation and requires fresh review state', () => {
  const steps = stepMap(children.dispatch);
  const reopen = steps.get('mark_in_progress');
  assert.deepEqual(reopen.tool, { id: 'pm_task', action: 'change_status' });
  assert.equal(reopen.inputs.taskKey, ref('taskKey'));
  assert.equal(reopen.inputs.to, 'in_progress');
  assert.deepEqual(reopen.when, [{ kind: 'value_in', value: ref('decision'), allowed: ['dispatch', 'revise'] }]);
  after(steps, 'mark_in_progress', 'load_task');
  after(steps, 'send', 'mark_in_progress');

  const reviewer = stepMap(shared['send-review']);
  assert.equal(reviewer.get('reset').tool.action, 'update_assignment');
  assert.equal(reviewer.get('reset').inputs.status, 'pending');
  after(reviewer, 'review', 'reset');
  assert.equal(steps.get('mark_in_review').inputs.to, 'in_review');
  after(steps, 'send_reviewers', 'mark_in_review');
  assert.equal(steps.get('mark_verified').inputs.to, 'verified');
  after(steps, 'mark_verified', 'publish');
});

test('dispatch checkpoints before reading feedback and preserves answered question context', () => {
  const steps = stepMap(children.dispatch);
  assert.equal(steps.get('save_dispatch').inputs.params.state, output('prepare_dispatch', 'state'));
  assert.equal(steps.get('prepare_dispatch').inputs.state, ref('nextState'));
  after(steps, 'feedback', 'save_dispatch');
  after(steps, 'send', 'feedback');
  assert.equal(steps.get('feedback').inputs.state, ref('nextState'));
  assert.equal(steps.get('feedback').outputs.questions, '$.normalized.data.questions');
  assert.ok(steps.get('send').session.prompt.includes(output('feedback', 'questions')));
});

test('later checks observe lifecycle and preserve checkpoint state without reading transcripts', () => {
  const steps = stepMap(children.observe);
  const observe = steps.get('observe');
  assert.equal(observe.tool.action, 'observe');
  assert.equal(observe.inputs.state, output('state', 'state'));
  assert.equal(observe.inputs.sessions, output('sessions', 'sessions'));
  after(steps, 'observe', 'sessions');
  assert.equal(children.observe.outputMappings.state, output('observe', 'state'));
  assert.equal(children.observe.outputMappings.roundStatus, output('observe', 'roundStatus'));
  assert.ok(!children.observe.steps.some(step => ['events', 'get_run'].includes(step.tool.action)));
  const snapshot = stepMap(children.decide).get('snapshot');
  assert.equal(snapshot.inputs.state, ref('state'));
  assert.equal(snapshot.inputs.roundStatus, ref('roundStatus'));
  assert.equal(snapshot.inputs.hasActive, ref('hasActive'));
  assert.equal(snapshot.inputs.freshRequestId, output('request_id', 'ulid'));
});

test('session cancellation is restricted to the implementation and its existing reviewers', () => {
  const steps = stepMap(children.observe);
  const sessions = steps.get('sessions');
  assert.deepEqual(sessions.tool, { id: 'pm_session', action: 'list' });
  assert.equal(sessions.inputs.contextRef, 'TASK-${workflow.inputs.taskKey}');
  const active = steps.get('observe');
  assert.equal(active.tool.action, 'observe');
  assert.equal(active.inputs.sessions, output('sessions', 'sessions'));
  assert.equal(active.inputs.implementationSessionUlid, ref('implementationSessionUlid'));
  assert.equal(active.inputs.taskKey, ref('taskKey'));
  const cancel = stepMap(children.settle).get('cancel_session');
  assert.deepEqual(cancel.tool, { id: 'pm_session', action: 'abort' });
  assert.equal(children.observe.outputMappings.activeSessionUlid, output('observe', 'sessionUlid'));
  assert.equal(stepMap(check).get('settle').inputs.activeSessionUlid, output('observe', 'activeSessionUlid'));
  assert.equal(cancel.inputs.sessionUlid, ref('activeSessionUlid'));
  assert.deepEqual(cancel.when, [
    { kind: 'value_in', value: ref('cancelRound'), allowed: ['yes'] },
    { kind: 'value_in', value: ref('hasActive'), allowed: ['yes'] },
  ], 'cancellation must not exclude dispatch decisions');
});

test('closed pull requests keep the watch until linked sessions stop, then mark the task done and remove it', () => {
  const steps = stepMap(children.settle);
  for (const key of ['mark_done', 'remove']) {
    const step = steps.get(key);
    assert.ok(hasWhen(step, ref('decision'), 'closed'), key);
    assert.ok(hasWhen(step, ref('hasActive'), 'no'), `${key} waits until the sessions are stopped`);
    after(steps, key, 'cancel_session');
  }
  const done = steps.get('mark_done');
  assert.deepEqual(done.tool, { id: 'pm_task', action: 'change_status' });
  assert.equal(done.inputs.taskKey, ref('taskKey'));
  assert.equal(done.inputs.to, 'done');
  assert.ok((done.when ?? []).some(condition => condition.value === output('load_task', 'status') &&
    condition.kind === 'value_in' && condition.allowed.length > 0 && !condition.allowed.includes('done')),
    'retrying removal must not attempt done -> done');
  assert.equal(steps.get('remove').tool.action, 'remove');
  after(steps, 'remove', 'mark_done');
});

test('all check exits are finite and checkpoint writes are activation- and version-scoped', () => {
  for (const workflow of [check, ...Object.values(children), ...Object.values(shared)]) for (const step of workflow.steps) {
    assert.deepEqual(step.onFailure, { action: 'fail' }, `${step.key} cannot freeze the automation by blocking`);
    assert.equal(step.waitsFor, undefined, `${step.key} does not wait for agent work`);
    if (step.tool?.id !== 'pm_automation' || !['checkpoint', 'remove'].includes(step.tool.action)) continue;
    const params = step.inputs.params;
    assert.equal(params.key, ref('automationKey'));
    assert.equal(params.expectedActivationId, ref('activationId'));
    const idStep = /^\$\{steps\.(\w+)\.outputs\.ulid\}$/.exec(params.clientRequestId)?.[1];
    assert.ok(idStep, `${step.key} needs a generated request identity`);
    const map = stepMap(workflow);
    assert.deepEqual(map.get(idStep).tool, { id: 'pm_generate_ulid', action: 'call' });
    after(map, step.key, idStep);
    if (step.tool.action === 'checkpoint') {
      assert.equal(params.expectedStateVersion, step.key === 'save_published' ? output('save_publication', 'stateVersion') : ref('stateVersion'));
      if (step.key === 'save_published') after(map, step.key, 'save_publication');
    }
  }
  const steps = stepMap(children.settle);
  after(steps, 'save_state', 'cancel_session');
  after(steps, 'save_state', 'notify');
  const decisions = { remove: ['closed'], save_state: ['complete', 'report_failure', 'save'] };
  const writes = children.settle.steps.filter(step => step.tool.id === 'pm_automation');
  assert.deepEqual(writes.map(step => step.key).sort(), Object.keys(decisions).sort());
  for (const step of writes) {
    assert.deepEqual(step.when.find(condition => condition.value === ref('decision')),
      { kind: 'value_in', value: ref('decision'), allowed: decisions[step.key] },
      `${step.key} must leave the dispatch checkpoint untouched`);
    if (step.tool.action === 'checkpoint') assert.equal(step.inputs.params.state, ref('nextState'));
  }
  for (const step of children.observe.steps) {
    assert.ok(['get', 'get_state', 'list', 'observe'].includes(step.tool.action), `${step.key} is read-only`);
  }
  for (const step of children.decide.steps) assert.ok(['call', 'snapshot'].includes(step.tool.action), `${step.key} cannot write a checkpoint`);
});

test('implementation stays focused while workflows own review and safe publication', () => {
  const steps = stepMap(children.dispatch);
  const prompt = steps.get('send').session.prompt;
  for (const value of [ref('taskKey'), ref('headBranch'), output('feedback', 'items')]) assert.ok(prompt.includes(value), value);
  assert.match(prompt, /Do not coordinate reviews, poll sessions, change task status, commit, push, or post replies/);
  assert.match(prompt, /Leave all changes uncommitted and unstaged/);
  assert.match(prompt, /stop blocked on mismatch or unrelated changes/);
  assert.match(prompt, /local paths/i);
  assert.doesNotMatch(prompt, /provider_turn_completed|pm_session events/);
  const reviewPrompt = stepMap(shared['send-review']).get('review').session.prompt;
  assert.match(reviewPrompt, /Do not send a message or pm_session input to the implementation session/);
  assert.match(reviewPrompt, /fresh PM review decision/);
  const publication = steps.get('publish');
  assert.equal(publication.tool.action, 'publish');
  assert.equal(publication.inputs.remoteName, ref('remoteName'));
  assert.equal(publication.inputs.expectedHeadSha, ref('nextState.inFlight.headSha'));
  assert.equal(publication.inputs.expectedTreeSha, ref('nextState.inFlight.coordination.snapshot.candidateTreeSha'));
  assert.equal(steps.get('reply').inputs.allowedItemIds, ref('nextState.inFlight.itemIds'));
  after(steps, 'reply', 'publish');
});

test('every user-tool call pins the same revision, content and current schemas', () => {
  const hashes = new Set();
  for (const workflow of followupWorkflows) {
    for (const step of workflow.steps.filter(step => step.tool?.id === manifest.id)) {
      const action = manifest.actions.find(action => action.id === step.tool.action);
      assert.ok(action, `${step.key} refers to an existing action`);
      assert.equal(step.tool.revision, manifest.revision);
      assert.match(step.tool.contentHash, /^sha256:[0-9a-f]{64}$/);
      hashes.add(step.tool.contentHash);
      assert.deepEqual(step.tool.inputSchema, action.inputSchema, `${step.key} input schema`);
      assert.deepEqual(step.tool.outputSchema, action.outputSchema, `${step.key} output schema`);
      for (const name of action.inputSchema.required ?? []) assert.ok(name in step.inputs, `${step.key} needs ${name}`);
      for (const name of Object.keys(step.inputs)) assert.ok(name in action.inputSchema.properties, `${step.key} input ${name} is declared`);
      for (const [name, mapping] of Object.entries(step.outputs ?? {})) {
        const segments = /^\$\.normalized\.data\.(.+)$/.exec(mapping)?.[1].split('.');
        assert.ok(segments, `${step.key} output ${name} comes from user-tool data`);
        const resolve = (schema, fields) => {
          if (schema?.$ref) return resolve(schema.$ref.slice(2).split('/').reduce((value, key) => value?.[key], action.outputSchema), fields);
          if (schema?.oneOf) return schema.oneOf.some(branch => resolve(branch, fields));
          return fields.length === 0 || (schema?.properties?.[fields[0]] && resolve(schema.properties[fields[0]], fields.slice(1)));
        };
        assert.ok(resolve(action.outputSchema, segments), `${step.key} output ${name} is declared`);
      }
    }
  }
  assert.equal(hashes.size, 1);
});

test('watch identifies the remote pull request before installing a bounded interval check', () => {
  const observe = watchSteps.get('observe_remote');
  assert.deepEqual(observe.tool, { id: 'git', action: 'remote_status' });
  assert.equal(observe.inputs.remoteName, ref('remoteName'));
  const identify = watchSteps.get('identify');
  assert.equal(identify.inputs.owner, output('observe_remote', 'owner'));
  assert.equal(identify.inputs.repo, output('observe_remote', 'repo'));
  assert.equal(identify.inputs.headBranch, ref('headBranch'));
  const accept = watchSteps.get('accept_identity');
  assert.deepEqual(accept.checks, [{ kind: 'value_in', value: output('identify', 'outcome'), allowed: ['watchable', 'not_open'] }]);
  const apply = watchSteps.get('apply');
  after(watchSteps, 'apply', 'accept_identity');
  assert.ok(hasWhen(apply, output('identify', 'outcome'), 'watchable'));
  const definition = apply.inputs.params.definition;
  assert.equal(definition.schemaVersion, '1.0');
  assert.deepEqual(definition.automation.trigger, { type: 'interval', every: ref('checkEvery') });
  assert.deepEqual(definition.automation.policy, { overlap: 'skip', misfire: 'once' });
  assert.deepEqual(definition.automation.action.workflow, { key: check.key, version: check.version });
  assert.equal(definition.automation.action.type, 'workflow.start');
  assert.equal(watch.inputs.checkEvery.default, '5m');
});

test('watch passes every check input and only seeds a new automation', () => {
  const inputs = watchSteps.get('apply').inputs.params.definition.automation.action.inputs;
  assert.deepEqual(Object.keys(inputs).sort(), Object.keys(check.inputs).sort());
  for (const [name, value] of Object.entries(inputs)) {
    assert.equal(value, ['automationKey', 'owner', 'repo'].includes(name) ? output('identify', name) : ref(name));
  }
  const seed = watchSteps.get('seed_state');
  assert.ok(hasWhen(seed, output('apply', 'stateVersion'), 0));
  assert.ok(hasWhen(seed, output('identify', 'outcome'), 'watchable'));
  assert.equal(seed.inputs.params.expectedStateVersion, 0);
  assert.equal(seed.inputs.params.expectedActivationId, output('apply', 'activationId'));
  assert.deepEqual(seed.inputs.params.state, emptyState());
  assert.notEqual(seed.inputs.params.clientRequestId, watchSteps.get('apply').inputs.params.clientRequestId);
});

test('publication passes the original implementation session and preserves the watch opt-out', () => {
  const publishSteps = stepMap(publish);
  assert.equal(publish.version, '0.4.14');
  assert.equal(publish.inputs.watchPullRequest.default, true);
  const start = publishSteps.get('watch_pr');
  assert.deepEqual(start.workflow, { key: watch.key, version: watch.version });
  assert.equal(start.inputs.implementationSessionUlid, output('deliver_and_closeout', 'implementationSessionUlid'));
  assert.deepEqual(Object.keys(start.inputs).sort(), Object.keys(watch.inputs).sort());
  assert.ok(hasWhen(start, ref('watchPullRequest'), true));
  assert.ok(hasWhen(start, output('publish', 'decision'), 'approved'));
  const done = publishSteps.get('mark_done');
  assert.ok(hasWhen(done, ref('watchPullRequest'), false));
  assert.ok(hasWhen(done, output('publish', 'decision'), 'approved'));
  assert.equal(done.inputs.to, 'done');
  assert.deepEqual(publishSteps.get('reload_task').needs, ['watch_pr', 'mark_done']);
});

test('distributable follow-up workflows contain no private fixture values', () => {
  for (const workflow of followupWorkflows) {
    const text = JSON.stringify({ ...workflow, steps: workflow.steps.map(step => {
      if (!step.tool) return step;
      const { inputSchema, outputSchema, ...tool } = step.tool;
      return { ...step, tool };
    }) });
    assert.doesNotMatch(text, /\/Users\/|\/home\/|VALDR_SOURCE_DIR|valdr-lab/);
    assert.doesNotMatch(text, /\b[0-9A-HJKMNP-TV-Z]{26}\b/);
  }
});
