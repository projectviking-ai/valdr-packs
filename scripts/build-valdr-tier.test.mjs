import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const buildScript = path.join(repoRoot, "scripts", "build-valdr-tier.mjs");
const buildDir = path.join(repoRoot, "build");
const tiers = ["raider", "vanguard", "sovereign"];
const exportedAt = "1730000000000";

const archivePathForTier = (tier) => path.join(buildDir, `valdr-${tier}.valdr-pack.tar.gz`);
const archiveRoot = "valdr-packs/valdr/";
let cachedArchives = null;

const runBuild = (args) => {
  execFileSync("node", [buildScript, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe"
  });
};

const ensureBuiltArchives = () => {
  if (cachedArchives) {
    return cachedArchives;
  }
  const builtArchives = {};
  for (const tier of tiers) {
    const archivePath = archivePathForTier(tier);
    fs.rmSync(archivePath, { force: true });
    runBuild([tier, "--exported-at", exportedAt]);
    builtArchives[tier] = archivePath;
  }
  cachedArchives = builtArchives;
  return cachedArchives;
};

const listArchiveEntries = (archivePath) => execFileSync("tar", ["-tzf", archivePath], {
  cwd: repoRoot,
  encoding: "utf8"
}).trim().split("\n").filter(Boolean);

const readArchiveText = (archivePath, relpath) => execFileSync("tar", ["-xOf", archivePath, relpath], {
  cwd: repoRoot,
  encoding: "utf8"
});

const readManifest = (archivePath) => JSON.parse(readArchiveText(archivePath, "manifest.json"));
const hasPrefix = (entries, prefix) => entries.some((entry) => entry.startsWith(prefix));

test("build-valdr-tier builds all tiers to distinct default archive names", () => {
  const archives = ensureBuiltArchives();
  for (const tier of tiers) {
    const archivePath = archives[tier];
    assert.equal(archivePath, archivePathForTier(tier));
    assert.ok(fs.existsSync(archivePath), `expected ${archivePath} to exist`);
  }
});

test("build-valdr-tier supports a custom output path", () => {
  const customArchivePath = path.join(buildDir, "test-custom", "valdr-raider.custom.tar.gz");
  fs.rmSync(customArchivePath, { force: true });
  fs.mkdirSync(path.dirname(customArchivePath), { recursive: true });
  runBuild(["raider", "--output", customArchivePath, "--exported-at", exportedAt]);
  assert.ok(fs.existsSync(customArchivePath), `expected ${customArchivePath} to exist`);
});

test("generated manifests use the canonical valdr pack identity and archive root", () => {
  const archives = ensureBuiltArchives();
  for (const tier of tiers) {
    const entries = listArchiveEntries(archives[tier]);
    assert.ok(entries.includes("manifest.json"), `${tier} archive should include a top-level manifest.json`);
    assert.ok(
      entries.filter((entry) => entry !== "manifest.json").every((entry) => entry.startsWith(archiveRoot)),
      `${tier} pack files should be rooted at ${archiveRoot}`
    );
    const manifest = readManifest(archives[tier]);
    assert.equal(manifest.packKey, "valdr");
  }
});

test("tier boundaries match the Raider, Vanguard, and Sovereign contract", () => {
  const archives = ensureBuiltArchives();
  const raiderEntries = listArchiveEntries(archives.raider);
  assert.equal(hasPrefix(raiderEntries, `${archiveRoot}core/`), false);
  assert.equal(hasPrefix(raiderEntries, `${archiveRoot}base/`), false);
  assert.equal(hasPrefix(raiderEntries, `${archiveRoot}executor/`), false);
  assert.equal(hasPrefix(raiderEntries, `${archiveRoot}orchestrator/`), false);
  assert.equal(hasPrefix(raiderEntries, `${archiveRoot}auditor/`), false);

  const vanguardEntries = listArchiveEntries(archives.vanguard);
  assert.equal(hasPrefix(vanguardEntries, `${archiveRoot}core/`), true);
  assert.equal(hasPrefix(vanguardEntries, `${archiveRoot}base/`), true);
  assert.equal(hasPrefix(vanguardEntries, `${archiveRoot}executor/`), true);
  assert.equal(hasPrefix(vanguardEntries, `${archiveRoot}orchestrator/`), true);
  assert.equal(hasPrefix(vanguardEntries, `${archiveRoot}auditor/`), true);
  assert.equal(vanguardEntries.includes(`${archiveRoot}core/tools/valdr.core.tools.pm-audit.md`), true);
  assert.equal(vanguardEntries.includes(`${archiveRoot}auditor/tyr-v2/tyr-v2.agent.yaml`), true);
  assert.equal(vanguardEntries.includes(`${archiveRoot}core/tools/valdr.core.tools.pm-session.md`), false);
  assert.equal(hasPrefix(vanguardEntries, `${archiveRoot}orchestrator/skadi/`), false);

  const sovereignEntries = listArchiveEntries(archives.sovereign);
  assert.equal(sovereignEntries.includes(`${archiveRoot}core/tools/valdr.core.tools.pm-session.md`), true);
  assert.equal(hasPrefix(sovereignEntries, `${archiveRoot}orchestrator/skadi/`), true);
});

test("tier overrides preserve expected agent handles and session boundaries", () => {
  const archives = ensureBuiltArchives();

  const raiderPythonAgent = readArchiveText(archives.raider, `${archiveRoot}agents/python/python-task-agent.agent.yaml`);
  const vanguardPythonAgent = readArchiveText(archives.vanguard, `${archiveRoot}agents/python/python-task-agent.agent.yaml`);
  const sovereignPythonAgent = readArchiveText(archives.sovereign, `${archiveRoot}agents/python/python-task-agent.agent.yaml`);
  assert.match(raiderPythonAgent, /handle:\s+python-task-agent/);
  assert.doesNotMatch(raiderPythonAgent, /hot-load:\s+true/);
  assert.match(vanguardPythonAgent, /handle:\s+python-task-agent/);
  assert.match(vanguardPythonAgent, /hot-load:\s+true/);
  assert.match(sovereignPythonAgent, /handle:\s+python-task-agent/);
  assert.match(sovereignPythonAgent, /hot-load:\s+true/);

  const vanguardSigridAgent = readArchiveText(archives.vanguard, `${archiveRoot}reviewer/sigrid/sigrid.agent.yaml`);
  const sovereignSigridAgent = readArchiveText(archives.sovereign, `${archiveRoot}reviewer/sigrid/sigrid.agent.yaml`);
  assert.doesNotMatch(vanguardSigridAgent, /valdr\.core\.tools\.pm-session/);
  assert.match(sovereignSigridAgent, /valdr\.core\.tools\.pm-session/);

  const vanguardTyrAgent = readArchiveText(archives.vanguard, `${archiveRoot}auditor/tyr-v2/tyr-v2.agent.yaml`);
  const sovereignTyrAgent = readArchiveText(archives.sovereign, `${archiveRoot}auditor/tyr-v2/tyr-v2.agent.yaml`);
  const vanguardTyrSystem = readArchiveText(archives.vanguard, `${archiveRoot}auditor/tyr-v2/valdr.auditor.tyr.v2.system.md`);
  const sovereignTyrSystem = readArchiveText(archives.sovereign, `${archiveRoot}auditor/tyr-v2/valdr.auditor.tyr.v2.system.md`);
  assert.match(vanguardTyrAgent, /handle:\s+tyr-v2/);
  assert.match(sovereignTyrAgent, /handle:\s+tyr-v2/);
  assert.match(vanguardTyrSystem, /id="valdr\.auditor\.tyr\.v2\.system"/);
  assert.match(sovereignTyrSystem, /id="valdr\.auditor\.tyr\.v2\.system"/);

  const vanguardAuditorMatrix = readArchiveText(archives.vanguard, `${archiveRoot}auditor/tyr-v2/AUDITOR_CAPABILITY_MATRIX.md`);
  assert.match(vanguardAuditorMatrix, /pm_audit action=context/);
  assert.match(vanguardAuditorMatrix, /pm_audit action=events/);
  assert.match(vanguardAuditorMatrix, /pm_audit action=score/);
  assert.doesNotMatch(vanguardAuditorMatrix, /pm_session action=(get|events)/);
});
