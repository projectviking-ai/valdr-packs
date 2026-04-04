import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readRepoVersion } from "./version.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

test("readRepoVersion reads the repository VERSION file", () => {
  const versionPath = path.join(repoRoot, "VERSION");
  const version = readRepoVersion(repoRoot);
  const expectedVersion = fs.readFileSync(versionPath, "utf8").trim();

  assert.equal(versionPath.endsWith("VERSION"), true);
  assert.equal(version, expectedVersion);
});
