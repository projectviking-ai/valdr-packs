import { businessScenarios } from './business-scenarios.mjs';
// These are requirements and evaluator assertions, never reference solutions.
// The author receives brief + variant inputs; expected* fields remain evaluator-owned.
export const authorContract = `
Write bundle.json as {definitions: [WorkflowDefinition, ...], entryWorkflowKey: string}.
Author fresh definitions, including every required child definition. Use schemaVersion 1.0,
pack benchmark, exact version 0.1.0, workflow keys beginning benchmark., and matching
benchmark-scoped source capability keys. Use the semantic step keys in each brief.
The fixtures provide actor @benchmark, project BENCH, and existing tasks BENCH-1
and BENCH-2. Root runs use BENCH-1 as their task scope.
BENCH-404 does not exist. No live provider sessions, registry changes, file writes,
network commands, or human approval impersonation are required or authorized.
The only permitted Command action is command/run with a harmless printf command
and timeoutSeconds 5. Omit cwd to inherit the fixture repository. Use only the form
printf '%s' 'TEXT', with safe literal text, direct workflow.inputs paths, or
runtime.loop.currentPass. Inputs consumed by commands must come from fixture
inputs, literal defaults, or direct parent-input bindings. Do not interpolate
step outputs, callback payloads, or previous receipts into commands.
Command stdout is text; do not assume it is parsed JSON. PM tool actions are read-only.
Callback authoring exercises use ordinary external await_condition waits authorized
for @benchmark. The evaluator delivers matching callbacks through the public workflow
API and checks durable attempts, actual tool results, child runs, and declared outputs.
Do not replace requested children, loops, fan-out, or callback waits with hardcoded results.
`;

export const scenarios = [
  {
    id: '01_routed_release',
    title: 'Mutually exclusive release branches with a safe join',
    brief: `Author benchmark.routed-release. Inputs: lane string and audit boolean.
Use step keys validate_lane, probe, prepare_ship, ship, prepare_archive, archive,
audit, finish. Reject an unknown lane at validate_lane by blocking; the only lanes
are ship and archive. probe must execute Command and return literal ready.
The ship lane executes prepare_ship then ship; the archive lane executes
prepare_archive then archive. Both preparation and action cards on the unselected
lane must remain unexecuted. audit runs after the selected action only when audit
is true. finish must run for either valid lane even when audit is skipped.
Required workflow outputs: lane string unchanged from input, probe string from
the executed probe result. Commands may print their semantic step names.
Keep branching in the workflow graph, not in shell logic.`,
    features: ['conditional_routes', 'skipped_dependencies', 'command_outputs', 'typed_outputs'],
    variants: [
      { id: 'ship_audited', inputs: { lane: 'ship', audit: true }, expectedStatus: 'completed', expectedOutputs: { lane: 'ship', probe: 'ready' }, expectedSteps: ['validate_lane', 'probe', 'prepare_ship', 'ship', 'audit', 'finish'], expectedStepOrder: [['prepare_ship', 'ship'], ['ship', 'audit'], ['audit', 'finish']], absentSteps: ['prepare_archive', 'archive'] },
      { id: 'archive_without_audit', inputs: { lane: 'archive', audit: false }, expectedStatus: 'completed', expectedOutputs: { lane: 'archive', probe: 'ready' }, expectedSteps: ['validate_lane', 'probe', 'prepare_archive', 'archive', 'finish'], expectedStepOrder: [['prepare_archive', 'archive'], ['archive', 'finish']], absentSteps: ['prepare_ship', 'ship', 'audit'] },
      { id: 'unknown_lane', inputs: { lane: 'unknown', audit: true }, expectedStatus: 'blocked', expectedStepStatuses: { validate_lane: 'blocked' }, absentSteps: ['probe', 'ship', 'archive', 'finish'] },
    ],
  },
  {
    id: '02_loop_receipts',
    title: 'Bounded remediation with previous-pass evidence',
    brief: `Author benchmark.loop-receipts. Input: permit boolean. Use keys
preflight, setup, inspect, capture_previous, decide, verify_final, finish.
preflight blocks when permit is false. setup runs once before a bounded loop.
The corridor starts at inspect and ends at decide. inspect must execute Command
printf of the current loop pass. decide succeeds exactly when that text is 3,
otherwise loops back, with at most three total passes. Its closed outcome domain
is the strings 1, 2, 3. decide must expose a reason output equal to the observed
pass text. capture_previous is a condition card in the corridor, runs on passes 2 and 3
only, and exposes priorReason from the immediately preceding decide receipt.
It must never dereference previous-pass evidence on pass 1. verify_final runs
only after the successful third pass and verifies both final pass 3 and prior
reason 2. finish follows it. Required root outputs: finalPass string from the
executed inspect, priorReason string from capture_previous. A previous receipt
must be read through supported loop runtime context, not through mutable files.`,
    features: ['loop_back', 'loop_previous', 'runtime_phase', 'command_outputs'],
    variants: [
      { id: 'three_passes', inputs: { permit: true }, expectedStatus: 'completed', expectedOutputs: { finalPass: '3', priorReason: '2' }, expectedAttempts: { setup: 1, inspect: 3, decide: 3, verify_final: 1, finish: 1 }, expectedSteps: ['capture_previous', 'verify_final', 'finish'], expectedStepOutputs: { capture_previous: { priorReason: '2' } } },
      { id: 'preflight_refusal', inputs: { permit: false }, expectedStatus: 'blocked', expectedStepStatuses: { preflight: 'blocked' }, absentSteps: ['setup', 'inspect', 'finish'] },
    ],
  },
  {
    id: '03_typed_fanout',
    title: 'Sequential fan-out preserves typed item receipts',
    brief: `Author benchmark.typed-fanout and child benchmark.typed-item.
Root inputs: items array of objects, batch string. Root keys: validate_items,
before_items, process_items, verify_batch, finish. Child inputs: item required
object and batch required string. Child keys: validate_item, receipt, finish_item.
process_items must use real sequential forEach over the input array, passing each
object as item and batch separately. Each item has label string, count integer,
and enabled boolean. validate_item blocks for enabled false. receipt runs a
Command printing item.label. Each completed child returns required outputs
item object unchanged, batch string, and label string from receipt stdout.
The root returns batch and the runtime's ordered children array. An empty items
array completes without child runs. A rejected item blocks the parent and must
prevent root finish. Do not flatten items into interpolated JSON strings.`,
    features: ['for_each', 'subworkflow', 'typed_outputs', 'child_failure'],
    variants: [
      { id: 'ordered_items', inputs: { batch: 'batch-a', items: [{ label: 'alpha', count: 2, enabled: true }, { label: 'beta', count: 5, enabled: true }] }, expectedStatus: 'completed', expectedOutputs: { batch: 'batch-a' }, expectedSteps: ['process_items', 'verify_batch', 'finish'], expectedChildren: { count: 2, statuses: ['completed', 'completed'], itemOrder: [{ label: 'alpha', count: 2, enabled: true }, { label: 'beta', count: 5, enabled: true }] } },
      { id: 'empty_items', inputs: { batch: 'empty', items: [] }, expectedStatus: 'completed', expectedOutputs: { batch: 'empty', children: [] }, expectedSteps: ['process_items', 'finish'], expectedChildren: { count: 0 } },
      { id: 'second_item_rejected', inputs: { batch: 'blocked', items: [{ label: 'alpha', count: 2, enabled: true }, { label: 'beta', count: 5, enabled: false }] }, expectedStatus: 'blocked', expectedChildren: { count: 2, statuses: ['completed', 'blocked'] }, absentSteps: ['verify_batch', 'finish'] },
    ],
  },
  {
    id: '04_nested_contracts',
    title: 'Nested child contracts preserve arrays, objects, and booleans',
    brief: `Author benchmark.nested-contracts, benchmark.contract-middle, and
benchmark.contract-leaf. Root inputs: payload object, labels array, count integer,
enabled boolean. Root keys: validate_request, before_child, call_middle,
verify_receipt, finish. Middle keys: accept_request, call_leaf, expose_receipt.
Leaf keys: validate_leaf, probe_leaf, expose_leaf. Every child must explicitly
declare and receive all four required inputs. validate_leaf blocks when enabled
is false. probe_leaf runs Command returning leaf-ok. Leaf returns the original
payload object, labels array, count integer, enabled boolean, and probe string.
Middle forwards every typed output from its child, and root returns every typed
output from the middle child. Neither nested object nor array may be serialized
into text. Required root outputs have those exact names and types. A leaf refusal
must block both ancestors; root finish cannot run. Verify the returned contract
before root finish.`,
    features: ['nested_subworkflow', 'required_inputs', 'typed_outputs', 'child_failure'],
    variants: [
      { id: 'typed_values', inputs: { payload: { name: 'sample', nested: { stable: true } }, labels: ['alpha', 'beta'], count: 7, enabled: true }, expectedStatus: 'completed', expectedOutputs: { payload: { name: 'sample', nested: { stable: true } }, labels: ['alpha', 'beta'], count: 7, enabled: true, probe: 'leaf-ok' }, expectedSteps: ['call_middle', 'verify_receipt', 'finish'], expectedChildren: { count: 2, statuses: ['completed', 'completed'] } },
      { id: 'leaf_refusal', inputs: { payload: { name: 'refused' }, labels: [], count: 0, enabled: false }, expectedStatus: 'blocked', expectedChildren: { count: 2, statuses: ['blocked', 'blocked'] }, absentSteps: ['verify_receipt', 'finish'] },
    ],
  },
  {
    id: '05_callback_quality_gate',
    title: 'External callback receipt controls release',
    brief: `Author benchmark.callback-quality-gate. Inputs: requestId string,
expectedDigest string. Keys: prepare_request, await_receipt, verify_digest,
release, quarantine, audit, finish. prepare_request executes Command returning
requestId. await_receipt is an ordinary external callback wait with outcomes
accepted and quarantined, authorized to @benchmark. Receipt payload contains
digest string and evidence array. A digest mismatch blocks at verify_digest
before either side-effect branch. On matching digest, accepted executes release
and quarantined executes quarantine; the other branch must not execute. audit
and finish follow either valid branch. Required root outputs: requestId string,
outcome string from accepted callback evidence, evidence array from its payload.
The evaluator will deliver the callback; do not add a session or human gate.`,
    features: ['callback_wait', 'callback_payload', 'conditional_routes', 'typed_outputs'],
    variants: [
      { id: 'accepted', inputs: { requestId: 'request-a', expectedDigest: 'digest-a' }, callbacks: [{ stepKey: 'await_receipt', outcome: 'accepted', payload: { digest: 'digest-a', evidence: ['proof-a', 'proof-b'] } }], expectedStatus: 'completed', expectedOutputs: { requestId: 'request-a', outcome: 'accepted', evidence: ['proof-a', 'proof-b'] }, expectedSteps: ['await_receipt', 'verify_digest', 'release', 'audit', 'finish'], absentSteps: ['quarantine'] },
      { id: 'quarantined', inputs: { requestId: 'request-b', expectedDigest: 'digest-b' }, callbacks: [{ stepKey: 'await_receipt', outcome: 'quarantined', payload: { digest: 'digest-b', evidence: [] } }], expectedStatus: 'completed', expectedOutputs: { requestId: 'request-b', outcome: 'quarantined', evidence: [] }, expectedSteps: ['quarantine', 'audit', 'finish'], absentSteps: ['release'] },
      { id: 'wrong_digest', inputs: { requestId: 'request-c', expectedDigest: 'digest-c' }, callbacks: [{ stepKey: 'await_receipt', outcome: 'accepted', payload: { digest: 'wrong', evidence: ['untrusted'] } }], expectedStatus: 'blocked', expectedStepStatuses: { verify_digest: 'blocked' }, absentSteps: ['release', 'quarantine', 'audit', 'finish'] },
    ],
  },
  {
    id: '06_optional_task_lookup',
    title: 'Nullable PM task lookup with separate downstream branches',
    brief: `Author benchmark.optional-task-lookup. Input lookupKey string. Root
keys: inspect_task, verify_presence, prepare_found, report_found, prepare_missing,
report_missing, audit, finish. inspect_task must actually call pm_task/get with
allowMissing true against lookupKey. Use normalized found as the decision, and
retain normalized task as an object only on the found branch. verify_presence
must verify found is a boolean. Existing tasks execute prepare_found and
report_found, and report_found must derive taskKey from the real PM task record.
Missing tasks execute prepare_missing and report_missing without dereferencing
null task data. Both cards on the opposite branch stay unexecuted. audit and
finish execute for either branch. Required root outputs: found boolean from the
tool result and requestedKey string unchanged from lookupKey. Expose taskKey as
an output on report_found. Do not create the missing task.`,
    features: ['pm_tool', 'nullable_output', 'conditional_routes', 'skipped_dependencies'],
    variants: [
      { id: 'found', inputs: { lookupKey: 'BENCH-1' }, expectedStatus: 'completed', expectedOutputs: { found: true, requestedKey: 'BENCH-1' }, expectedSteps: ['inspect_task', 'prepare_found', 'report_found', 'audit', 'finish'], expectedStepOutputs: { report_found: { taskKey: 'BENCH-1' } }, absentSteps: ['prepare_missing', 'report_missing'] },
      { id: 'missing', inputs: { lookupKey: 'BENCH-404' }, expectedStatus: 'completed', expectedOutputs: { found: false, requestedKey: 'BENCH-404' }, expectedSteps: ['inspect_task', 'prepare_missing', 'report_missing', 'audit', 'finish'], absentSteps: ['prepare_found', 'report_found'] },
    ],
  },
  {
    id: '07_child_loop_exhaustion',
    title: 'Repeated child workflow with bounded exhausted refusal',
    brief: `HELD OUT: do not use this scenario to choose instruction changes.
Author benchmark.child-loop-exhaustion and benchmark.loop-observer. Root input:
observed string, constrained to ready or retry. Root keys: preflight, setup,
call_observer, decide, verify_completion, finish. Child required inputs: observed
string and pass integer. Child keys: validate_observation, probe_observation,
expose_observation. Child validates the closed ready/retry domain, executes a
Command printing observed, and returns observed string from stdout plus pass
integer unchanged. Root must repeatedly call the real child inside a loop
corridor ending at decide. Pass runtime.loop.currentPass to the child. decide
continues only for ready, otherwise repeats the child up to three total passes,
then blocks with a reason output saying that readiness was required. Child
failure must not be disguised as another pass. setup executes once; successful
completion returns observed string and passes integer from the final child.
Do not use forEach or automatic retry for this bounded remediation.`,
    features: ['held_out', 'loop_back', 'subworkflow_in_loop', 'loop_exhaustion', 'typed_outputs'],
    variants: [
      { id: 'ready_first_pass', inputs: { observed: 'ready' }, expectedStatus: 'completed', expectedOutputs: { observed: 'ready', passes: 1 }, expectedAttempts: { setup: 1, call_observer: 1, decide: 1, finish: 1 }, expectedSteps: ['verify_completion', 'finish'], expectedChildren: { count: 1, statuses: ['completed'] } },
      { id: 'bounded_exhaustion', inputs: { observed: 'retry' }, expectedStatus: 'blocked', expectedAttempts: { setup: 1, call_observer: 3, decide: 3 }, expectedStepStatuses: { decide: 'blocked' }, expectedChildren: { count: 3, statuses: ['completed', 'completed', 'completed'] }, absentSteps: ['verify_completion', 'finish'] },
    ],
  },
  {
    id: '08_callback_task_fanout',
    title: 'Callback-produced task list drives scoped child fan-out',
    brief: `HELD OUT: do not use this scenario to choose instruction changes.
Author benchmark.callback-task-fanout and benchmark.scoped-task-reader. Root
input batch string. Root keys: announce, await_tasks, validate_tasks, read_tasks,
verify_complete, finish. announce executes a Command printing batch. await_tasks
is an external callback wait authorized to @benchmark with outcome tasks_ready.
Its payload has taskKeys array. validate_tasks requires a nonempty array of
unique nonempty strings and blocks before fan-out for invalid lists. read_tasks
must sequentially fan out the callback's exact array into the child under the
required input name taskKey. Bind required child batch separately. Child keys:
check_scope, read_task, expose_task. Child declares taskKey string and batch
string, checks runtime task/project scope against taskKey and fixture BENCH,
actually reads pm_task/get, and returns taskKey from the real task record,
projectKey from runtime context, and batch unchanged. Root returns batch and
the runtime children array. finish runs only after all scoped child reads finish.
Do not pass a fabricated task key or keep the parent's task scope in place of
the selected item's task scope.`,
    features: ['held_out', 'callback_wait', 'for_each', 'child_scope', 'pm_tool'],
    variants: [
      { id: 'scoped_read', inputs: { batch: 'scope-a' }, callbacks: [{ stepKey: 'await_tasks', outcome: 'tasks_ready', payload: { taskKeys: ['BENCH-2', 'BENCH-1'] } }], expectedStatus: 'completed', expectedOutputs: { batch: 'scope-a' }, expectedSteps: ['await_tasks', 'validate_tasks', 'read_tasks', 'verify_complete', 'finish'], expectedChildren: { count: 2, statuses: ['completed', 'completed'], itemOrder: ['BENCH-2', 'BENCH-1'] } },
      { id: 'duplicate_tasks', inputs: { batch: 'scope-duplicate' }, callbacks: [{ stepKey: 'await_tasks', outcome: 'tasks_ready', payload: { taskKeys: ['BENCH-1', 'BENCH-1'] } }], expectedStatus: 'blocked', expectedStepStatuses: { validate_tasks: 'blocked' }, expectedChildren: { count: 0 }, absentSteps: ['read_tasks', 'verify_complete', 'finish'] },
      { id: 'empty_tasks', inputs: { batch: 'scope-empty' }, callbacks: [{ stepKey: 'await_tasks', outcome: 'tasks_ready', payload: { taskKeys: [] } }], expectedStatus: 'blocked', expectedStepStatuses: { validate_tasks: 'blocked' }, expectedChildren: { count: 0 }, absentSteps: ['read_tasks', 'finish'] },
    ],
  },
];

for (const [scenarioId, stepKey] of [['03_typed_fanout', 'process_items'], ['08_callback_task_fanout', 'read_tasks']]) {
  for (const variant of scenarios.find(scenario => scenario.id === scenarioId).variants) {
    if (variant.expectedStatus === 'completed') variant.expectedOutputChildren = { outputKey: 'children', stepKey };
  }
}

export const developmentScenarioIds = scenarios.filter(s => !s.features.includes('held_out')).map(s => s.id);
export const heldOutScenarioIds = scenarios.filter(s => s.features.includes('held_out')).map(s => s.id);

// Structural checks prevent substituting hardcoded outputs for the requested
// runtime mechanics. These requirements are evaluator-only like expectedOutputs.
const requiredStep = (workflowKey, stepKey, kind, extra = {}) => ({ workflowKey, stepKey, kind, ...extra });
const commandStep = (workflowKey, stepKey) => requiredStep(workflowKey, stepKey, 'tool', { toolId: 'command', action: 'run' });
const childStep = (workflowKey, stepKey, childKey, extra = {}) => requiredStep(workflowKey, stepKey, 'subworkflow', { childKey, ...extra });
const rootKeys = ['routed-release', 'loop-receipts', 'typed-fanout', 'nested-contracts', 'callback-quality-gate', 'optional-task-lookup', 'child-loop-exhaustion', 'callback-task-fanout'].map(key => `benchmark.${key}`);
const outputTypes = [
  { lane: 'string', probe: 'string' },
  { finalPass: 'string', priorReason: 'string' },
  { batch: 'string', children: 'array' },
  { payload: 'object', labels: 'array', count: 'integer', enabled: 'boolean', probe: 'string' },
  { requestId: 'string', outcome: 'string', evidence: 'array' },
  { found: 'boolean', requestedKey: 'string' },
  { observed: 'string', passes: 'integer' },
  { batch: 'string', children: 'array' },
];
const structures = [
  [requiredStep(rootKeys[0], 'validate_lane', 'condition'), commandStep(rootKeys[0], 'probe')],
  [commandStep(rootKeys[1], 'inspect'), requiredStep(rootKeys[1], 'capture_previous', 'condition'), requiredStep(rootKeys[1], 'decide', 'condition', { onFailure: 'loop_back' })],
  [childStep(rootKeys[2], 'process_items', 'benchmark.typed-item', { forEach: true }), requiredStep('benchmark.typed-item', 'validate_item', 'condition'), commandStep('benchmark.typed-item', 'receipt')],
  [childStep(rootKeys[3], 'call_middle', 'benchmark.contract-middle'), childStep('benchmark.contract-middle', 'call_leaf', 'benchmark.contract-leaf'), requiredStep('benchmark.contract-leaf', 'validate_leaf', 'condition'), commandStep('benchmark.contract-leaf', 'probe_leaf')],
  [commandStep(rootKeys[4], 'prepare_request'), requiredStep(rootKeys[4], 'await_receipt', 'await_condition'), requiredStep(rootKeys[4], 'verify_digest', 'condition')],
  [requiredStep(rootKeys[5], 'inspect_task', 'tool', { toolId: 'pm_task', action: 'get' }), requiredStep(rootKeys[5], 'verify_presence', 'condition')],
  [childStep(rootKeys[6], 'call_observer', 'benchmark.loop-observer'), requiredStep(rootKeys[6], 'decide', 'condition', { onFailure: 'loop_back' }), requiredStep('benchmark.loop-observer', 'validate_observation', 'condition'), commandStep('benchmark.loop-observer', 'probe_observation')],
  [commandStep(rootKeys[7], 'announce'), requiredStep(rootKeys[7], 'await_tasks', 'await_condition'), requiredStep(rootKeys[7], 'validate_tasks', 'condition'), childStep(rootKeys[7], 'read_tasks', 'benchmark.scoped-task-reader', { forEach: true }), requiredStep('benchmark.scoped-task-reader', 'check_scope', 'condition'), requiredStep('benchmark.scoped-task-reader', 'read_task', 'tool', { toolId: 'pm_task', action: 'get' })],
];
for (const [index, scenario] of scenarios.entries()) {
  scenario.entryWorkflowKey = rootKeys[index];
  scenario.requiredSteps = structures[index];
  scenario.requiredOutputTypes = outputTypes[index];
}

scenarios[2].variants[0].expectedChildren.outputs = [
  { item: { label: 'alpha', count: 2, enabled: true }, batch: 'batch-a', label: 'alpha' },
  { item: { label: 'beta', count: 5, enabled: true }, batch: 'batch-a', label: 'beta' },
];
Object.assign(scenarios[2].variants[2].expectedChildren, {
  stepStatuses: [{}, { validate_item: 'blocked' }],
  absentSteps: [[], ['receipt', 'finish_item']],
});
scenarios[3].variants[0].expectedChildren.outputs = [
  { payload: { name: 'sample', nested: { stable: true } }, labels: ['alpha', 'beta'], count: 7, enabled: true, probe: 'leaf-ok' },
  { payload: { name: 'sample', nested: { stable: true } }, labels: ['alpha', 'beta'], count: 7, enabled: true, probe: 'leaf-ok' },
];
Object.assign(scenarios[3].variants[1].expectedChildren, {
  stepStatuses: [{ call_leaf: 'blocked' }, { validate_leaf: 'blocked' }],
  absentSteps: [['expose_receipt'], ['probe_leaf', 'expose_leaf']],
});
scenarios[6].variants[0].expectedChildren.outputs = [{ observed: 'ready', pass: 1 }];
scenarios[6].variants[1].expectedChildren.outputs = [
  { observed: 'retry', pass: 1 }, { observed: 'retry', pass: 2 }, { observed: 'retry', pass: 3 },
];
Object.assign(scenarios[7].variants[0].expectedChildren, {
  taskKeys: ['BENCH-2', 'BENCH-1'],
  projectKeys: ['BENCH', 'BENCH'],
  outputs: [{ taskKey: 'BENCH-2', projectKey: 'BENCH', batch: 'scope-a' }, { taskKey: 'BENCH-1', projectKey: 'BENCH', batch: 'scope-a' }],
});

// Business briefs leave the implementation and step names to the author.
scenarios.push(...businessScenarios);
developmentScenarioIds.push(...businessScenarios.map(scenario => scenario.id));

