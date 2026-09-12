import assert from "node:assert/strict";
import test from "node:test";

import { bumpVersion } from "./bump-version.mjs";

test("bumpVersion increments patch versions", () => {
  assert.equal(bumpVersion("1.2.3", "patch"), "1.2.4");
});

test("bumpVersion increments minor versions and resets patch", () => {
  assert.equal(bumpVersion("1.2.3", "minor"), "1.3.0");
});

test("bumpVersion increments major versions and resets lower parts", () => {
  assert.equal(bumpVersion("1.2.3", "major"), "2.0.0");
});

test("bumpVersion accepts an explicit semantic version", () => {
  assert.equal(bumpVersion("1.2.3", "2.5.0"), "2.5.0");
});

test("bumpVersion accepts four-part release revisions and rejects extra components", () => {
  assert.equal(bumpVersion("0.3.0", "0.3.0.1"), "0.3.0.1");
  assert.equal(bumpVersion("0.3.0.1", "0.3.0.2"), "0.3.0.2");
  assert.equal(bumpVersion("0.3.0.1", "patch"), "0.3.1");
  assert.throws(() => bumpVersion("0.3.0", "0.3.0.1.2"), /Invalid repository version/);
});
