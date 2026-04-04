import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validatePackDir } from "./validate-pack.mjs";

const tempDirs = [];

const createTempDir = async (prefix) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

const createPack = async (rootDir, { includes = ["."] } = {}) => {
  const packDir = path.join(rootDir, "pack");
  await fs.mkdir(packDir, { recursive: true });
  await fs.writeFile(
    path.join(packDir, "pack.yaml"),
    [
      'schemaVersion: "1"',
      "pack: demo",
      "name: Demo Pack",
      'version: "0.0.1"',
      "description: Demo pack for validator tests",
      "includes:",
      ...includes.map((includePath) => `  - path: ${includePath}`),
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(packDir, "demo.core.md"),
    [
      '<!--<capability id="demo.core" pack="demo" role="core">-->',
      "# Demo Core",
      "",
      "Core instructions.",
      "<!--</capability>-->",
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(packDir, "demo.agent.yaml"),
    [
      "agent:",
      '  handle: "@demo-agent"',
      "  name: Demo Agent",
      "  kind: bot",
      "  defaultRole: executor",
      "capabilities:",
      "  - key: demo.core",
      "    role: core",
      ""
    ].join("\n"),
    "utf8"
  );
  return packDir;
};

test.after(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

test("validatePackDir returns no errors for a valid concrete pack", async () => {
  const rootDir = await createTempDir("valdr-packs-validate-valid-");
  const packDir = await createPack(rootDir);

  const result = await validatePackDir(packDir);

  assert.equal(result.errors.length, 0);
});

test("validatePackDir reports missing local capability references as errors", async () => {
  const rootDir = await createTempDir("valdr-packs-validate-invalid-");
  const packDir = await createPack(rootDir);
  await fs.writeFile(
    path.join(packDir, "demo.agent.yaml"),
    [
      "agent:",
      '  handle: "@demo-agent"',
      "  name: Demo Agent",
      "  kind: bot",
      "  defaultRole: executor",
      "capabilities:",
      "  - key: demo.missing",
      "    role: core",
      ""
    ].join("\n"),
    "utf8"
  );

  const result = await validatePackDir(packDir);

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /no matching \.md file/i);
});

test("validatePackDir rejects include paths that escape the pack root", async () => {
  const rootDir = await createTempDir("valdr-packs-validate-escape-");
  const packDir = await createPack(rootDir, { includes: [".", "../outside.md"] });
  await fs.writeFile(path.join(rootDir, "outside.md"), "# Outside\n", "utf8");

  const result = await validatePackDir(packDir);

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /escapes pack root/i);
});

test("validatePackDir scans file includes instead of dropping them", async () => {
  const rootDir = await createTempDir("valdr-packs-validate-file-");
  const packDir = await createPack(rootDir, { includes: ["demo.core.md", "demo.agent.yaml"] });

  const result = await validatePackDir(packDir);

  assert.equal(result.errors.length, 0);
  assert.equal(result.filesScanned, 2);
  assert.equal(result.agentCount, 1);
  assert.equal(result.capabilityCount, 1);
});

test("validatePackDir rejects symlinks found while scanning included directories", async () => {
  const rootDir = await createTempDir("valdr-packs-validate-symlink-");
  const packDir = await createPack(rootDir);
  await fs.writeFile(path.join(packDir, "real.md"), "# Real\n", "utf8");
  await fs.symlink("real.md", path.join(packDir, "linked.md"));

  const result = await validatePackDir(packDir);

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /symlink .* not supported/i);
});
