// Public briefs are separate from the private variant values below. No reference solutions.
export const businessAuthorContract = `
Write bundle.json as {definitions: [WorkflowDefinition, ...], entryWorkflowKey: string}.
Author fresh definitions, including any children you choose. Use schemaVersion 1.0,
pack benchmark, exact version 0.1.0, workflow keys beginning benchmark., and
benchmark-scoped source capability keys. Choose your own workflow and step names,
intermediate outputs, decomposition, and graph. The brief specifies business
outcomes, public input/output fields, and a harmless operation receipt protocol.
Fixtures provide actor @benchmark, project BENCH, and tasks BENCH-1 and BENCH-2;
root runs use BENCH-1. BENCH-404 does not exist.
Represent each business operation by a real command/run invocation of precisely
printf '%s' 'TEXT', where TEXT is its documented marker. Set timeoutSeconds 5
and omit cwd. Markers are exact, case-sensitive stdout, without a newline.
Only safe literal text, direct workflow.inputs paths, and runtime.loop.currentPass
may appear in commands. Command inputs may come from fixture inputs, literal
defaults, or direct parent-input bindings. Do not interpolate step outputs,
callback payloads, or previous receipts into commands. Command stdout is text.
Do not emit extra command markers: the operation ledger is checked for exact
order and multiplicity. A reported receipt must originate in the actual operation
result, possibly forwarded through intermediate outputs. Runtime evidence, not
just final outputs, must show the required decisions, repetitions, and waits.
PM tools are read-only. Provider sessions, registry changes, file writes, network
commands, and human approval impersonation are not authorized. External approval
uses ordinary await_condition workflow_input waits authorized for @benchmark.
The evaluator supplies a real callback token after the unique matching wait exists.
Tests use unpublished input and callback values conforming to the public interface.
`;

export const businessScenarios = [
  {
    id: '09_business_release', briefStyle: 'business', businessOracle: 'release',
    title: 'Release request with optional audit trail',
    brief: `Our release desk receives requestId (string), route (string), and audit
(boolean). A publish request must publish that release; an archive request must
archive it. If audit is requested, record it after the requested action. An
unrecognized route must block before any business operation. Valid requests
complete whether or not an audit was requested.
The operation receipt protocol is publish:<requestId>, archive:<requestId>, and
audit:<requestId>, each emitted once only when that
operation is required. Return requestId (string), route (string), and receipt
(string), where receipt is the actual selected publish/archive operation stdout.
Choose the implementation and names; the business outcome and execution ledger
are the contract.`,
    features: ['business_request', 'effect_receipts'],
    requiredOutputTypes: { requestId: 'string', route: 'string', receipt: 'string' },
    variants: [
      { id: 'publish_with_audit', inputs: { requestId: 'rel-k83', route: 'publish', audit: true }, expectedStatus: 'completed' },
      { id: 'publish_without_audit', inputs: { requestId: 'rel-q17', route: 'publish', audit: false }, expectedStatus: 'completed' },
      { id: 'archive_with_audit', inputs: { requestId: 'rel-m42', route: 'archive', audit: true }, expectedStatus: 'completed' },
      { id: 'archive_without_audit', inputs: { requestId: 'rel-p96', route: 'archive', audit: false }, expectedStatus: 'completed' },
      { id: 'unsupported_route', inputs: { requestId: 'rel-z51', route: 'defer', audit: true }, expectedStatus: 'blocked' },
    ],
  },
  {
    id: '10_business_review', briefStyle: 'business', businessOracle: 'review',
    title: 'Remediation budget and review history',
    brief: `A release request needs repeated review until it is ready, with a
budget of three reviews. Inputs are requestId (string) and readyPass (string:
1, 2, 3, or never). The deterministic review service becomes ready on readyPass;
never means that all reviews remain unsatisfactory. Each review is a real
operation emitting review:<currentPass>, where currentPass is the
runtime's one-based review pass. The durable workflow run correlates each review
with its request; review markers alone omit requestId so outcomes have a finite
closed domain. Compare the actual review receipt with the
requested readiness pass. After an unsuccessful review, remediate before the
next review, emitting remediate:<requestId>:<currentPass>. Do not remediate after
a successful review or after the final exhausted review.
Retain the immediately preceding review receipt as workflow evidence on every
review after the first, as durable review history; an invented or recomputed substitute is insufficient. Publish once, emitting publish:<requestId>,
only after the review service is ready. If all three reviews are unsuccessful,
block because the review budget is exhausted and never publish. Successful
requests return requestId (string) and readyPass (string) unchanged; actual review
receipts and history remain in durable workflow execution evidence. Choose your own names and workflow organization.`,
    features: ['business_request', 'review_history'],
    requiredOutputTypes: { requestId: 'string', readyPass: 'string' },
    variants: [
      { id: 'ready_immediately', inputs: { requestId: 'rev-h62', readyPass: '1' }, expectedStatus: 'completed' },
      { id: 'ready_after_remediation', inputs: { requestId: 'rev-d49', readyPass: '2' }, expectedStatus: 'completed' },
      { id: 'ready_on_last_review', inputs: { requestId: 'rev-s75', readyPass: '3' }, expectedStatus: 'completed' },
      { id: 'review_budget_exhausted', inputs: { requestId: 'rev-b28', readyPass: 'never' }, expectedStatus: 'blocked' },
    ],
  },
  {
    id: '11_business_approval', briefStyle: 'business', businessOracle: 'approval',
    title: 'Correlated external release approval',
    brief: `A release desk must obtain an external disposition before acting.
Inputs are requestId (string) and seal (string). Announce the request by emitting
request:<requestId>, then wait for one external callback authorized to @benchmark
with outcome approved or rejected and payload {requestId: string, seal: string}.
Both payload fields must match this request before any disposition or audit.
A mismatched request or seal must block after the announcement, without publishing,
archiving, or auditing anything. For a matching callback, approved publishes and
rejected archives; then record an audit and complete. The effect markers are
publish:<requestId> or archive:<requestId>, followed by audit:<requestId>.
Return requestId (string), decision (string) from the actual callback outcome,
and receipt (string) from the audit operation stdout. There must be a unique
live wait matching this outcome contract so the external operator can correlate
the response without knowing your step names. Choose your own implementation.`,
    features: ['business_request', 'external_approval'],
    requiredOutputTypes: { requestId: 'string', decision: 'string', receipt: 'string' },
    variants: [
      { id: 'approved', inputs: { requestId: 'approval-f72', seal: 'seal-v84' }, callbacks: [{ select: { outcomes: ['approved', 'rejected'] }, outcome: 'approved', payload: { requestId: 'approval-f72', seal: 'seal-v84' } }], expectedStatus: 'completed' },
      { id: 'rejected', inputs: { requestId: 'approval-n31', seal: 'seal-r56' }, callbacks: [{ select: { outcomes: ['approved', 'rejected'] }, outcome: 'rejected', payload: { requestId: 'approval-n31', seal: 'seal-r56' } }], expectedStatus: 'completed' },
      { id: 'stale_request', inputs: { requestId: 'approval-c68', seal: 'seal-t93' }, callbacks: [{ select: { outcomes: ['approved', 'rejected'] }, outcome: 'approved', payload: { requestId: 'approval-old', seal: 'seal-t93' } }], expectedStatus: 'blocked' },
      { id: 'wrong_seal', inputs: { requestId: 'approval-w45', seal: 'seal-g19' }, callbacks: [{ select: { outcomes: ['approved', 'rejected'] }, outcome: 'approved', payload: { requestId: 'approval-w45', seal: 'seal-wrong' } }], expectedStatus: 'blocked' },
    ],
  },
];
