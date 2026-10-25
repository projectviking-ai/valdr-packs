import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const reference = new URL('../valdr-packs/valdr-workflow/reference/steps/valdr-workflow.steps.human-gate.md', import.meta.url);

function approvalExample() {
  const blocks = [...readFileSync(reference, 'utf8').matchAll(/```yaml\n([\s\S]*?)```/g)].map(match => match[1]);
  const parsed = JSON.parse(execFileSync('bun', ['-e',
    'console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()).map(text => Bun.YAML.parse(text))))'],
  { input: JSON.stringify(blocks), encoding: 'utf8' }));
  const approval = parsed.flatMap(value => Array.isArray(value) ? value : []).find(step => step.key === 'approve_spec');
  assert.ok(approval, 'The reference must provide the specification approval example');
  return approval;
}

test('the approval example authorizes its human operator independently of the bot run actor', () => {
  const approval = approvalExample();
  const context = { workflow: { inputs: { operatorHandle: '@release-operator', taskKey: 'EXAMPLE-1' } }, runtime: { actorHandle: '@verdandi' } };
  const authorizedHandles = approval.waitsFor.authorizedHandles.map(value => value.replace(/\$\{([^}]+)\}/g, (_, expression) => {
    const resolved = expression.split('.').reduce((current, key) => current?.[key], context);
    assert.equal(typeof resolved, 'string', `Authorization reference ${expression} must resolve to a supplied handle`);
    return resolved;
  }));
  assert.ok(authorizedHandles.includes('@release-operator'), 'The selected human operator must be authorized');
  assert.ok(!authorizedHandles.includes('@verdandi'), 'The bot run actor must not receive human approval authority');
});

test('the approval example validates in a complete pack with its declared inputs and producer outputs', {
  skip: process.env.VALDR_BIN ? false : 'Set VALDR_BIN to run the installed CLI integration check',
}, t => {
  const root = mkdtempSync(path.join(tmpdir(), 'valdr-human-gate-reference-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'workflows'));
  writeFileSync(path.join(root, 'pack.yaml'), 'schemaVersion: 1.0\npack: example-approval\nname: Example approval\nversion: 0.1.0\ndescription: Validate the human approval reference.\nincludes:\n  - path: workflows\n');
  writeFileSync(path.join(root, 'workflows', 'example.approval.md'),
    '<!--<capability id="example.approval" pack="example-approval" role="workflow">-->\n# Approval example\n<!--</capability>-->\n');
  const definition = { schemaVersion: '1.0', workflow: {
    key: 'example.approval', name: 'Approve specification', version: '0.1.0', pack: 'example-approval',
    source: { kind: 'capability', capabilityKey: 'example.approval' }, start: { mode: 'manual' },
    inputs: { taskKey: { type: 'string', required: true }, operatorHandle: { type: 'string', required: true } },
    steps: [{ key: 'create_spec', name: 'Supply reviewed specification evidence', kind: 'condition',
      checks: [{ kind: 'value_equals', value: true, equals: true }],
      outputs: { path: 'docs/spec.md', writerSessionUlid: '01ARZ3NDEKTSV4RRFFQ69G5FAV', reviewId: 'example-review' } }, approvalExample()],
  } };
  writeFileSync(path.join(root, 'workflows', 'approval.workflow.yaml'), JSON.stringify(definition));
  execFileSync(process.env.VALDR_BIN, ['validate-pack', root], { encoding: 'utf8' });
});
