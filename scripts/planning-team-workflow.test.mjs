import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const teamRoot = new URL('../valdr-packs/valdr-workflow/planning-team/', import.meta.url);
const source = fileURLToPath(new URL('workflows/spec-and-plan.workflow.yaml', teamRoot));
const freyaConstraints = ['valdr.planner.freya.schema', 'valdr.planner.freya.tasks'];
const questionFormat = 'valdr-workflow.base.human-gate-questions';

test('spec and plan advance only on orchestrator acceptance and reuse distinct planning sessions', () => {
  const questionFormatSource = readFileSync(fileURLToPath(new URL(`../base/${questionFormat}.md`, teamRoot)), 'utf8');
  assert.ok(questionFormatSource.startsWith(`<!--<capability id="${questionFormat}" pack="valdr-workflow" role="constraints">-->`));
  for (const type of ['yes_no', 'single_choice', 'multiple_choice', 'text']) assert.ok(questionFormatSource.includes('`' + type + '`'));
  assert.ok(existsSync(source), 'Workflow definition must exist');
  const { workflow } = JSON.parse(execFileSync('bun', ['-e',
    'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))', source], { encoding: 'utf8' }));
  const steps = new Map(workflow.steps.map(step => [step.key, step]));
  assert.equal(workflow.version, '0.7.2');
  assert.equal(steps.get('load_task').outputs.projectId, '$.normalized.task.projectId');
  const launches = workflow.steps.filter(step => step.session?.action === 'launch_task');
  assert.equal(launches.length, 7);
  assert.equal(new Set(launches.map(step => step.session.agentHandle)).size, 7);
  assert.ok(workflow.steps.every(step => step.kind !== 'subworkflow'));
  for (const step of workflow.steps.filter(step => step.session?.action === 'input')) {
    assert.ok(step.gates.length > 0, `${step.key} must have a receipt gate`);
    for (const gate of step.gates) assert.equal(gate.source.sessionUlid, step.session.sessionUlid);
  }
  for (const launch of launches) {
    const agentPath = fileURLToPath(new URL(`agents/${launch.session.agentHandle}/${launch.session.agentHandle}.agent.yaml`, teamRoot));
    const definition = JSON.parse(execFileSync('bun', ['-e',
      'console.log(JSON.stringify(Bun.YAML.parse(await Bun.file(process.argv[1]).text())))', agentPath], { encoding: 'utf8' }));
    assert.equal(definition.agent.defaultRole, launch.session.role);
    const planningRole = launch.session.agentHandle === 'planning-team-orchestrator' || launch.session.agentHandle.startsWith('planning-plan-');
    const asksOperator = launch.session.agentHandle === 'planning-team-orchestrator';
    assert.ok(definition.capabilities.every(capability => capability.key.startsWith('valdr-workflow.planning-team.')
      || planningRole && freyaConstraints.includes(capability.key) || asksOperator && capability.key === questionFormat));
    const questionBinding = definition.capabilities.find(capability => capability.key === questionFormat);
    assert.equal(Boolean(questionBinding), asksOperator, 'Only an agent that can ask the operator binds the question format');
    if (questionBinding) assert.deepEqual(questionBinding, { key: questionFormat, role: 'constraints' }, 'The format must be loaded on every turn, not hot-loaded');
    if (planningRole) {
      for (const key of freyaConstraints) {
        const binding = definition.capabilities.find(capability => capability.key === key);
        assert.ok(binding, `${launch.session.agentHandle} must reuse ${key}`);
        assert.equal(binding.role, 'constraints');
        assert.equal(Boolean(binding['hot-load']), launch.session.agentHandle === 'planning-team-orchestrator');
      }
    }
  }
  for (const phase of ['spec', 'plan']) {
    const creator = steps.get(`launch_${phase}_writer`);
    const collaborator = steps.get(`launch_${phase}_collaborator`);
    assert.equal(creator.session.role, 'planner');
    assert.equal(collaborator.session.role, creator.session.role);
    assert.equal(creator.session.launcherConfigKey, '${workflow.inputs.creatorPresetKey}');
    assert.equal(collaborator.session.launcherConfigKey, '${workflow.inputs.collaboratorPresetKey}');
    for (const worker of [creator, collaborator]) {
      assert.equal(worker.session.provider, undefined);
      assert.equal(worker.session.config.model, undefined);
      assert.equal(worker.session.config['model_preferences.reasoning_effort'], undefined);
      assert.equal(worker.session.sourceSessionUlid, '${steps.launch_orchestrator.outputs.sessionUlid}');
    }
    assert.equal(steps.get(`launch_${phase}_reviewer`).session.launcherConfigKey, '${workflow.inputs.reviewerPresetKey}');
    const decision = steps.get(`decide_${phase}`);
    const receipts = steps.get(`validate_${phase}_receipts`);
    assert.equal(receipts.kind, 'condition');
    assert.deepEqual(receipts.needs, [`review_${phase}`]);
    assert.deepEqual(receipts.onFailure, { action: 'block' });
    assert.ok(receipts.outputs.reason.includes('schemaVersion or path'));
    const expectedChecks = [];
    for (const [action, schemaVersion, filename, pathOutput] of [
      ['write', 'planning-write/v1', `${phase}.md`, `${phase}Path`],
      ['collaborate', 'planning-collaboration/v1', `${phase}-collaboration.md`, `${phase}CollaborationPath`],
      ['revise', 'planning-write/v1', `${phase}.md`, `${phase}Path`],
      ['review', 'planning-review/v1', `${phase}-review.md`, `${phase}ReviewPath`],
    ]) {
      const key = `${action}_${phase}`;
      const artifact = steps.get(key);
      assert.equal(artifact.outputs.path, '$.normalized.input.payload.gate.parsed.path');
      assert.equal(artifact.outputs.schemaVersion, '$.normalized.input.payload.gate.parsed.schemaVersion');
      assert.equal(artifact.gates[0].payload.includeParsed, true);
      assert.equal(steps.get('launch_orchestrator').outputs[pathOutput], `projects/\${steps.load_task.outputs.taskKey}/${filename}`);
      expectedChecks.push(
        { kind: 'value_equals', value: `\${steps.${key}.outputs.schemaVersion}`, equals: schemaVersion },
        { kind: 'value_equals', value: `\${steps.${key}.outputs.path}`, equals: `\${steps.launch_orchestrator.outputs.${pathOutput}}` },
      );
    }
    assert.deepEqual(receipts.checks, expectedChecks);
    const focusedReceipts = steps.get(`validate_${phase}_focused_receipts`);
    assert.deepEqual(focusedReceipts.needs, [`validate_${phase}_receipts`]);
    assert.deepEqual(focusedReceipts.onFailure, { action: 'block' });
    assert.deepEqual(focusedReceipts.checks, expectedChecks.filter((_, index) => index < 2 || index > 5));
    const capture = steps.get(`capture_${phase}_collaboration`);
    assert.deepEqual(capture.needs, [`collaborate_${phase}`]);
    assert.equal(capture.when, undefined, 'The route must also be captured when collaboration is skipped');
    assert.equal(capture.outputs.collaborationRoute, `collab:\${steps.collaborate_${phase}.outputs.outcome}`);
    assert.equal(steps.get(`collaborate_${phase}`).outputs.outcome, '$.normalized.input.outcome');
    const collaborationRoute = `\${steps.capture_${phase}_collaboration.outputs.collaborationRoute}`;
    const ready = [{ kind: 'value_equals', value: collaborationRoute, equals: 'collab:ready' }];
    const escalated = [{ kind: 'value_equals', value: collaborationRoute, equals: 'collab:needs_human' }];
    assert.deepEqual(steps.get(`revise_${phase}`).when, ready);
    assert.deepEqual(steps.get(`review_${phase}`).when, [{ kind: 'value_in', value: collaborationRoute, allowed: ['collab:', 'collab:ready'] }]);
    assert.deepEqual(receipts.when, ready);
    const escalationReceipts = steps.get(`validate_${phase}_escalation_receipts`);
    assert.deepEqual(escalationReceipts.needs, [`validate_${phase}_focused_receipts`]);
    assert.deepEqual(escalationReceipts.when, escalated);
    assert.deepEqual(escalationReceipts.onFailure, { action: 'block' });
    assert.deepEqual(escalationReceipts.checks, expectedChecks.slice(0, 4));
    assert.deepEqual(decision.needs, [phase === 'plan' ? 'validate_plan_markdown' : `validate_${phase}_escalation_receipts`]);
    const escalationDecision = steps.get(`validate_${phase}_escalation_decision`);
    assert.deepEqual(escalationDecision.needs, [`validate_${phase}_decision`]);
    assert.deepEqual(escalationDecision.when, escalationReceipts.when);
    assert.deepEqual(escalationDecision.onFailure, { action: 'block' });
    assert.deepEqual(escalationDecision.checks, [{ kind: 'value_in', value: `\${steps.capture_${phase}_decision.outputs.decisionRoute}`, allowed: ['revise:full', 'needs_human:none'] }]);
    assert.equal(decision.outputs.schemaVersion, '$.normalized.input.payload.gate.parsed.schemaVersion');
    assert.equal(decision.outputs.revisionScope, '$.normalized.input.payload.gate.parsed.revisionScope');
    assert.deepEqual(steps.get(`capture_${phase}_decision`).needs, [`decide_${phase}`]);
    assert.deepEqual(steps.get(`validate_${phase}_decision`).needs, [`capture_${phase}_decision`]);
    assert.deepEqual(steps.get(`clarify_${phase}`).needs, [phase === 'plan' ? 'validate_plan_parser_decision' : `validate_${phase}_escalation_decision`]);
    assert.equal(decision.session.sessionUlid, '${steps.launch_orchestrator.outputs.sessionUlid}');
    assert.deepEqual(decision.gates[0].outcomes, { accepted: 'accepted', revise: 'revise', needs_human: 'needs_human' });
    const route = steps.get(`route_${phase}`);
    assert.equal(route.checks[0].value, `\${steps.decide_${phase}.outputs.outcome}`);
    assert.equal(route.checks[0].equals, 'accepted');
    assert.deepEqual(route.onFailure, { action: 'loop_back', to: `write_${phase}`, max: 3, exhausted: 'block' });
    assert.equal(route.outputs.revisionScope, `\${steps.decide_${phase}.outputs.revisionScope}`);
    assert.equal(route.outputs.summary, `\${steps.decide_${phase}.outputs.summary}`);
    assert.deepEqual(steps.get(`review_${phase}`).gates[0].outcomes, { approved: 'review_approved', changes_requested: 'review_changes_requested' });
    assert.equal(steps.get(`review_${phase}`).session.sessionUlid, `\${steps.launch_${phase}_reviewer.outputs.sessionUlid}`);
  }
  assert.equal(steps.get('launch_orchestrator').session.launcherConfigKey, '${workflow.inputs.orchestratorPresetKey}');
  for (const key of ['orchestratorPresetKey', 'creatorPresetKey', 'collaboratorPresetKey', 'reviewerPresetKey']) {
    assert.deepEqual(workflow.inputs[key].type, 'string');
    assert.equal(workflow.inputs[key].required, true);
  }
  assert.ok(steps.get('launch_plan_writer').needs.includes('route_spec'));
  assert.equal(workflow.outputMappings.specPath, 'projects/${steps.load_task.outputs.taskKey}/spec.md');
  assert.equal(workflow.outputMappings.planPath, 'projects/${steps.load_task.outputs.taskKey}/plan.md');
  assert.ok(workflow.steps.every(step => !['pm_review', 'git', 'github'].includes(step.tool?.id)));
  // Clarifications are Questions gates: the orchestrator's questions go to the operator and the answers return to the next pass.
  for (const [phase, decisionKey, target, readers, context] of [
    ['brief', 'brief', 'brief', ['brief'], ['brief']],
    ['spec', 'decide_spec', 'write_spec', ['write_spec', 'collaborate_spec', 'review_spec', 'decide_spec'], ['spec-decision', 'spec']],
    ['plan', 'decide_plan', 'write_plan', ['write_plan', 'collaborate_plan', 'review_plan', 'decide_plan'], ['plan-decision', 'plan', 'spec']],
  ]) {
    assert.equal(steps.get(decisionKey).outputs.questions, '$.normalized.input.payload.gate.parsed.questions');
    const gate = steps.get(`clarify_${phase}`);
    assert.equal(gate.humanGate.questions, `\${steps.${decisionKey}.outputs.questions}`);
    for (const field of ['feedback', 'enabled']) assert.equal(gate.humanGate[field], undefined, `Questions gates cannot use ${field}`);
    assert.deepEqual(gate.humanGate.preview.documents.map(document => document.path), context.map(name => `projects/\${steps.load_task.outputs.taskKey}/${name}.md`), 'The operator sees the documents the questions are about');
    for (const document of gate.humanGate.preview.documents) assert.equal(document.sourceSessionUlid, '${steps.launch_orchestrator.outputs.sessionUlid}');
    assert.ok(!gate.humanGate.prompt.includes('Add your answers to task'));
    assert.deepEqual(gate.waitsFor, { kind: 'workflow_input', expected: ['answered', 'rejected'], authorizedHandles: ['${runtime.actorHandle}'] });
    assert.deepEqual(gate.onFailure, { action: 'block' });
    assert.deepEqual(gate.outputs, { outcome: '$.normalized.input.outcome', questions: '$.normalized.input.questions', answers: '$.normalized.input.payload.answers' });
    assert.deepEqual(gate.when, [{ kind: 'value_equals', value: `\${steps.${decisionKey}.outputs.outcome}`, equals: 'needs_human' }]);
    const route = steps.get(`route_${phase}`);
    assert.equal(route.onFailure.to, target);
    assert.equal(route.outputs.questions, `\${steps.clarify_${phase}.outputs.questions}`);
    assert.equal(route.outputs.answers, `\${steps.clarify_${phase}.outputs.answers}`);
    for (const key of readers) {
      const prompt = steps.get(key).session.prompt;
      assert.ok(prompt.includes('${runtime.loop.previous.outputs.questions}') && prompt.includes('${runtime.loop.previous.outputs.answers}'), `${key} must receive the operator's answers`);
    }
  }
  // The VMP parser checks the exact file inside the plan loop, and an invalid plan cannot be accepted.
  const readPlan = steps.get('read_plan');
  assert.deepEqual(readPlan.needs, ['validate_plan_escalation_receipts'], 'The file is read on every plan pass, after the receipt checks');
  assert.deepEqual(readPlan.tool, { id: 'command', action: 'run' });
  assert.deepEqual(readPlan.inputs, {
    command: 'cat plan.md',
    cwd: 'projects/${steps.load_task.outputs.taskKey}',
    sourceSessionUlid: '${steps.launch_orchestrator.outputs.sessionUlid}',
    timeoutSeconds: 30,
  }, 'The command is fixed text; the task key only selects the directory');
  assert.equal(readPlan.outputs.markdown, '$.normalized.stdout');
  const validatePlan = steps.get('validate_plan_markdown');
  assert.deepEqual(validatePlan.needs, ['read_plan']);
  assert.deepEqual(validatePlan.tool, { id: 'vmp', action: 'validate_markdown' });
  assert.deepEqual(validatePlan.inputs, { markdown: '${steps.read_plan.outputs.markdown}' });
  assert.deepEqual(validatePlan.outputs, { valid: '$.normalized.valid', errors: '$.normalized.errors' });
  const planDecision = steps.get('decide_plan');
  assert.deepEqual(planDecision.needs, ['validate_plan_markdown'], 'The orchestrator decides with the parser result in hand');
  for (const reference of ['${steps.validate_plan_markdown.outputs.valid}', '${steps.validate_plan_markdown.outputs.errors}']) {
    assert.ok(planDecision.session.prompt.includes(reference), 'The parser result reaches the decision turn');
  }
  const parserGuard = steps.get('validate_plan_parser_decision');
  assert.deepEqual(parserGuard.needs, ['validate_plan_escalation_decision']);
  assert.deepEqual(parserGuard.when, [{ kind: 'value_equals', value: '${steps.validate_plan_markdown.outputs.valid}', equals: false }]);
  assert.deepEqual(parserGuard.checks, [{ kind: 'value_in', value: '${steps.capture_plan_decision.outputs.decisionRoute}', allowed: ['revise:focused', 'revise:full', 'needs_human:none'] }], 'An invalid plan cannot be accepted');
  assert.deepEqual(parserGuard.onFailure, { action: 'block' });
  assert.deepEqual(steps.get('clarify_plan').needs, ['validate_plan_parser_decision']);
  for (const key of ['write_plan', 'revise_plan']) assert.ok(steps.get(key).session.prompt.includes('validate_markdown'), `${key} validates its own draft before returning`);
  for (const key of ['collaborate_plan', 'review_plan']) assert.ok(!steps.get(key).session.prompt.includes('call native vmp'), `${key} leaves validation to the creator and the workflow`);
  const approval = steps.get('approve_plan');
  assert.equal(approval.kind, 'human_gate');
  assert.deepEqual(approval.needs, ['route_plan'], 'A human approves only a plan the orchestrator accepted, which the parser guard guarantees is valid');
  assert.equal(approval.humanGate.enabled, true, 'Saving the accepted plan requires operator approval');
  assert.deepEqual(approval.waitsFor, { kind: 'workflow_input', expected: ['approved', 'rejected'], authorizedHandles: ['${runtime.actorHandle}'] });
  assert.deepEqual(approval.onFailure, { action: 'block' });
  assert.deepEqual(approval.humanGate.preview.documents.map(document => document.path), ['plan', 'plan-decision', 'spec', 'spec-decision']
    .map(name => `projects/\${steps.load_task.outputs.taskKey}/${name}.md`));
  for (const document of approval.humanGate.preview.documents) assert.equal(document.sourceSessionUlid, '${steps.launch_orchestrator.outputs.sessionUlid}');
  const commit = steps.get('commit_plan');
  assert.deepEqual(commit.needs, ['approve_plan'], 'The plan is saved only after the approval gate');
  assert.deepEqual(commit.tool, { id: 'vmp', action: 'commit_markdown_from_worktree' });
  assert.deepEqual(commit.inputs, {
    taskKey: '${steps.load_task.outputs.taskKey}',
    sourceSessionUlid: '${steps.launch_orchestrator.outputs.sessionUlid}',
    relativePath: '${steps.launch_orchestrator.outputs.planPath}',
    plannerAgentHandle: 'planning-plan-creator',
  });
  assert.equal(commit.outputs.planKey, '$.normalized.planKey');
  const verify = steps.get('verify_plan');
  assert.deepEqual(verify.needs, ['commit_plan']);
  assert.deepEqual(verify.tool, { id: 'vmp', action: 'get_plan' });
  assert.deepEqual(verify.inputs, { planKey: '${steps.commit_plan.outputs.planKey}' });
  assert.deepEqual(workflow.steps.filter(step => step.tool?.id === 'vmp').map(step => step.key), ['validate_plan_markdown', 'commit_plan', 'verify_plan']);
  assert.equal(workflow.outputMappings.planKey, '${steps.commit_plan.outputs.planKey}');
  assert.equal(workflow.outputs.planKey.required, true);
  assert.ok(workflow.steps.every(step => step.tool?.action !== 'change_status'));
});
