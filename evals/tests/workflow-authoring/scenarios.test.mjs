import assert from 'node:assert/strict';
import test from 'node:test';
import { authorContract, scenarios, developmentScenarioIds, heldOutScenarioIds } from '../../suites/workflow-authoring/scenarios.mjs';

test('benchmark preserves heldouts and adds three development business cases', () => {
  assert.equal(scenarios.length, 11);
  assert.equal(new Set(scenarios.map(s => s.id)).size, 11);
  assert.equal(developmentScenarioIds.length, 9);
  assert.equal(heldOutScenarioIds.length, 2);
  assert.ok(heldOutScenarioIds.every(id => !developmentScenarioIds.includes(id)));
});

test('every scenario requires observable mechanics and success plus negative-path evidence', () => {
  for (const scenario of scenarios.filter(item => item.briefStyle !== 'business')) {
    assert.ok(scenario.entryWorkflowKey.startsWith('benchmark.'), scenario.id);
    assert.ok(scenario.requiredSteps.length >= 2, scenario.id);
    assert.ok(Object.keys(scenario.requiredOutputTypes).length >= 2, scenario.id);
    assert.ok(scenario.variants.some(v => v.expectedStatus === 'completed'), scenario.id);
    assert.ok(scenario.variants.some(v => v.expectedStatus === 'blocked' || v.expectedOutputs?.found === false), scenario.id);
    for (const variant of scenario.variants) {
      assert.ok(variant.expectedSteps?.length || Object.keys(variant.expectedStepStatuses ?? {}).length || variant.expectedChildren, `${scenario.id}/${variant.id} needs positive evidence`);
      if (variant.expectedChildren?.outputs) assert.equal(variant.expectedChildren.outputs.length, variant.expectedChildren.count);
    }
    if (scenario.features.includes('for_each')) assert.ok(scenario.requiredSteps.some(step => step.kind === 'subworkflow' && step.forEach), scenario.id);
    if (scenario.features.includes('loop_back')) assert.ok(scenario.requiredSteps.some(step => step.kind === 'condition' && step.onFailure === 'loop_back'), scenario.id);
    if (scenario.features.includes('callback_wait')) assert.ok(scenario.requiredSteps.some(step => step.kind === 'await_condition'), scenario.id);
  }
});

test('scope case changes the inherited task and asserts both durable scope and child outputs', () => {
  const children = scenarios.find(s => s.features.includes('child_scope')).variants[0].expectedChildren;
  assert.match(authorContract, /Root runs use BENCH-1/);
  assert.equal(children.taskKeys[0], 'BENCH-2');
  assert.deepEqual(children.taskKeys, children.itemOrder);
  assert.deepEqual(children.outputs.map(output => output.taskKey), children.taskKeys);
});

test('successful fan-out variants must prove root receipts came from their child runs', () => {
  for (const scenario of scenarios.filter(item => item.features.includes('for_each'))) {
    for (const variant of scenario.variants.filter(item => item.expectedStatus === 'completed')) {
      assert.equal(variant.expectedOutputChildren.outputKey, 'children');
      assert.ok(scenario.requiredSteps.some(step => step.stepKey === variant.expectedOutputChildren.stepKey && step.forEach));
    }
  }
});

test('each rejected descendant has an explicit stopping step and forbidden downstream execution', () => {
  for (const scenario of scenarios) {
    for (const variant of scenario.variants) {
      const expected = variant.expectedChildren;
      expected?.statuses?.forEach((status, index) => {
        if (status !== 'blocked' && status !== 'failed') return;
        assert.ok(Object.values(expected.stepStatuses?.[index] ?? {}).includes(status), `${scenario.id}/${variant.id} descendant ${index} needs a specific stopping step`);
        assert.ok(expected.absentSteps?.[index]?.length, `${scenario.id}/${variant.id} descendant ${index} must prohibit downstream execution`);
      });
    }
  }
});
