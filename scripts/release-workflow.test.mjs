import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workflowPath = path.resolve(".github/workflows/release.yml");

test("release workflow is scoped to main pushes with release-affecting path filters", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /push:\n\s+branches:\n\s+- main/);
  assert.match(workflow, /paths:\n\s+- skills\/\*\*\n\s+- commands\/\*\*\n\s+- valdr-packs\/\*\*\n\s+- scripts\/\*\*\n\s+- VERSION\n\s+- \.github\/workflows\/release\.yml/);
  assert.doesNotMatch(workflow, /README\.md/);
});
