import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const workflowPath = path.resolve(".github/workflows/release.yml");
const validationWorkflowPath = path.resolve(".github/workflows/validate.yml");
const workflowPackReleasePath = path.resolve(".github/workflows/release-valdr-workflow.yml");
const workflowPackPath = path.resolve("valdr-packs/valdr-workflow/pack.yaml");
const ideaToSprintWorkflowPath = path.resolve("valdr-packs/valdr-workflow/workflows/planning/valdr-workflow.workflow.idea-to-sprint.workflow.yaml");
const sprintTaskPrepareWorkflowPath = path.resolve("valdr-packs/valdr-workflow/workflows/sprint/valdr-workflow.workflow.sprint-task-prepare.workflow.yaml");
const pullRequestWorkflowPath = path.resolve("valdr-packs/valdr-workflow/workflows/git/valdr-workflow.workflow.pull-request-create.workflow.yaml");
const agentRouterReadmePath = path.resolve("valdr-packs/valdr-workflow/agents/agent-router/README.md");
const presetRouterReadmePath = path.resolve("valdr-packs/valdr-workflow/agents/launcher-preset-router/README.md");
const verdandiAuthoringPath = path.resolve("valdr-packs/valdr-workflow/orchestrator/verdandi/valdr-workflow.verdandi.authoring.md");
const verdandiOperatingPath = path.resolve("valdr-packs/valdr-workflow/orchestrator/verdandi/valdr-workflow.verdandi.operating.md");
const publicReadmePath = path.resolve("README.md");
const workflowReadmePath = path.resolve("valdr-packs/valdr-workflow/README.md");
const gitignorePath = path.resolve(".gitignore");
const licensePath = path.resolve("LICENSE");
const repoRoot = path.resolve(".");

test("release workflow is scoped to main pushes with release-affecting path filters", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /push:\n\s+branches:\n\s+- main/);
  assert.match(workflow, /paths:\n\s+- skills\/\*\*\n\s+- commands\/\*\*\n\s+- valdr-packs\/valdr\/\*\*\n\s+- scripts\/build-valdr-tier\.mjs\n\s+- scripts\/generate-valdr-pack\.mjs\n\s+- scripts\/validate-valdr-pack\.mjs\n\s+- scripts\/lib\/\*\*\n\s+- VERSION\n\npermissions:/);
  assert.doesNotMatch(workflow, /README\.md/);
  assert.doesNotMatch(workflow, /valdr-packs\/valdr-workflow/);
  assert.doesNotMatch(workflow, /VALDR_WORKFLOW_CLI_VERSION/);
  assert.doesNotMatch(workflow, /Makefile/);
  assert.doesNotMatch(workflow, /\.github\/workflows\/release(?:-valdr-workflow)?\.yml/);
});

test("valdr-workflow release builds on dispatch and publishes only its verified tagged archive", () => {
  const workflow = fs.readFileSync(workflowPackReleasePath, "utf8");
  const archive = "build/valdr-workflow.valdr-pack.tar.gz";

  assert.match(workflow, /^on:\n  workflow_dispatch:\n  push:\n    tags:\n      - valdr-workflow-v\*\n\npermissions:/m);
  assert.match(workflow, /permissions:\n\s+contents: write/);
  assert.match(workflow, /runs-on: macos-14/);
  assert.match(workflow, /gh release download "v\$\{CLI_VERSION\}" --repo projectviking-ai\/valdr-releases/);
  assert.match(workflow, /valdr-v\$\{CLI_VERSION\}-macos-arm64\.tar\.gz/);
  assert.match(workflow, /valdr-v\$\{CLI_VERSION\}-macos-arm64\.tar\.gz\.sha256/);
  assert.match(workflow, /shasum -a 256 -c/);
  assert.doesNotMatch(workflow, /linux-x64/);
  assert.match(workflow, /actual_version="\$\(bin\/valdr version \| awk 'NR == 1 \{ print \$2 \}'\)"/);
  assert.match(workflow, /if \[ -z "\$actual_version" \] \|\| \[ "\$actual_version" != "\$CLI_VERSION" \]/);
  assert.match(workflow, /VALDR_BIN=.*make build-valdr-workflow/);
  assert.match(workflow, /PACK_VERSION="\$\(awk '[\s\S]*?if \(count != 1 \|\| version == ""\) exit 1[\s\S]*?' valdr-packs\/valdr-workflow\/pack\.yaml\)"/);
  assert.match(workflow, /if \[ -z "\$CLI_VERSION" \] \|\| \[ -z "\$PACK_VERSION" \]/);
  assert.match(workflow, /RELEASE_TAG="valdr-workflow-v\$\{PACK_VERSION\}"/);
  assert.match(workflow, /if \[ "\$GITHUB_REF_NAME" != "\$RELEASE_TAG" \]/);
  assert.match(workflow, /gh api --method GET "repos\/\$\{GITHUB_REPOSITORY\}\/releases\/tags\/\$\{GITHUB_REF_NAME\}" --include --silent/);
  assert.match(workflow, /200\) echo "Release \$GITHUB_REF_NAME already exists\." >&2; exit 1 ;;/);
  assert.match(workflow, /404\) ;;/);
  assert.match(workflow, /\*\) echo "Could not determine whether release \$GITHUB_REF_NAME exists/);
  for (const stepName of ["Verify release tag", "Fail if release exists", "Create GitHub Release"]) {
    assert.match(workflow, new RegExp(`- name: ${stepName}\\n\\s+if: github\\.event_name == 'push'`));
  }
  assert.match(workflow, /uses: actions\/upload-artifact@v4[\s\S]*?path: build\/valdr-workflow\.valdr-pack\.tar\.gz\n\s+if-no-files-found: error/);
  assert.match(workflow, /--title "Valdr Workflow Pack \$\{PACK_VERSION\}"/);
  assert.match(workflow, /--notes "Valdr workflow pack release \$\{PACK_VERSION\}"/);
  assert.doesNotMatch(workflow, /valdr-(?:raider|vanguard|sovereign)\.valdr-pack\.tar\.gz/);

  const steps = workflow.match(/- name:[\s\S]*?(?=\n      - name:|$)/g);
  const stepIndex = (name) => steps.findIndex((step) => step.startsWith(`- name: ${name}\n`));
  assert.ok(stepIndex("Fail if release exists") < stepIndex("Download pinned Valdr CLI"));
  assert.ok(stepIndex("Fail if release exists") < stepIndex("Build Valdr Workflow Pack"));
  assert.ok(stepIndex("Fail if release exists") < stepIndex("Upload Valdr Workflow Pack"));

  const releaseOperations = [
    /gh release download/,
    /shasum -a 256 -c/,
    /tar -xzf/,
    /actual_version="\$\(bin\/valdr version \| awk/,
    /make build-valdr-workflow/,
    /uses: actions\/upload-artifact@v4/,
    /gh release create/,
  ].map((pattern) => workflow.search(pattern));
  assert.ok(releaseOperations.every((index) => index >= 0), "expected every release operation");
  assert.ok(releaseOperations.every((index, position) => position === 0 || releaseOperations[position - 1] < index),
    "release operations must be download, checksum, extract, verify, build, upload, then release");

  const ghSteps = steps.filter((step) => /\bgh\b/.test(step));
  assert.ok(ghSteps.length >= 3, "expected lookup, download, and publishing gh steps");
  for (const step of ghSteps) {
    assert.match(step, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  }

  const releaseCommand = workflow.match(/gh release create[\s\S]*?--notes "Valdr workflow pack release \$\{PACK_VERSION\}"/);
  assert.ok(releaseCommand, "expected workflow-pack release creation");
  assert.deepEqual(releaseCommand[0].match(/build\/[^\\\s]+/g), [archive]);
});

test("pull requests validate the workflow pack with the exact pinned public CLI", () => {
  const workflow = fs.readFileSync(validationWorkflowPath, "utf8");

  assert.match(workflow, /runs-on: macos-14/);
  assert.match(workflow, /CLI_VERSION="\$\(tr -d '\\n' < VALDR_WORKFLOW_CLI_VERSION\)"/);
  assert.match(workflow, /gh release download "v\$\{CLI_VERSION\}" --repo projectviking-ai\/valdr-releases/);
  assert.match(workflow, /valdr-v\$\{CLI_VERSION\}-macos-arm64\.tar\.gz\.sha256/);
  assert.match(workflow, /shasum -a 256 -c/);
  assert.match(workflow, /actual_version="\$\(bin\/valdr version \| awk 'NR == 1 \{ print \$2 \}'\)"/);
  assert.match(workflow, /if \[ -z "\$actual_version" \] \|\| \[ "\$actual_version" != "\$CLI_VERSION" \]/);
  assert.match(workflow, /VALDR_BIN: \$\{\{ steps\.valdr\.outputs\.path \}\}/);
  assert.match(workflow, /run: make validate-valdr-workflow/);
});

test("workflow composition closes current pins and forwards a non-origin remote", () => {
  const sprintTaskPrepare = fs.readFileSync(sprintTaskPrepareWorkflowPath, "utf8");
  const ideaToSprint = fs.readFileSync(ideaToSprintWorkflowPath, "utf8");

  assert.match(
    sprintTaskPrepare,
    /key: valdr-workflow\.task\.prepare\n\s+version: 0\.11\.0/,
  );
  assert.doesNotMatch(sprintTaskPrepare, /key: valdr-workflow\.task\.prepare\n\s+version: 0\.10\.0/);

  const publicInputs = ideaToSprint.match(/  inputs:\n([\s\S]*?)  outputs:/)?.[1];
  assert.ok(publicInputs, "expected idea-to-sprint public inputs");
  assert.match(publicInputs, /^    remoteName: \{ type: string, required: false, default: origin \}$/m);
  assert.match(
    ideaToSprint,
    /key: valdr-workflow\.pull-request\.create[\s\S]*?inputs:[\s\S]*?remoteName: "\$\{workflow\.inputs\.remoteName\}"/,
  );
});

test("shipped workflow examples use current versions and the agent router array contract", () => {
  const agentRouterReadme = fs.readFileSync(agentRouterReadmePath, "utf8");
  const presetRouterReadme = fs.readFileSync(presetRouterReadmePath, "utf8");
  const verdandiAuthoring = fs.readFileSync(verdandiAuthoringPath, "utf8");

  assert.match(agentRouterReadme, /"agentHandles": \["<handle from this turn's listing>"\]/);
  assert.match(agentRouterReadme, /on `unknown`, `agentHandles` is an empty array/);
  assert.match(agentRouterReadme, /key: valdr-workflow\.task\.choose-agent\n\s+version: 0\.10\.0/);
  assert.doesNotMatch(agentRouterReadme, /key: valdr-workflow\.task\.choose-agent\n\s+version: 0\.1\.0/);
  assert.match(presetRouterReadme, /key: valdr-workflow\.task\.choose-preset\n\s+version: 0\.4\.0/);
  assert.doesNotMatch(presetRouterReadme, /key: valdr-workflow\.task\.choose-preset\n\s+version: 0\.1\.0/);
  assert.match(verdandiAuthoring, /key: valdr-workflow\.task\.code-review, version: 0\.4\.0/);
});

test("public workflow descriptions avoid development-process copy", () => {
  const workflowRoot = path.resolve("valdr-packs/valdr-workflow/workflows");
  const pending = [workflowRoot];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (entry.name.endsWith(".workflow.yaml")) files.push(entryPath);
    }
  }
  const descriptions = files.flatMap((file) => fs.readFileSync(file, "utf8").split("\n").filter((line) => /description:/.test(line)));
  assert.doesNotMatch(descriptions.join("\n"), /\b(?:caller|wrapper|exercise)\b/i);
});

test("Verdandi documents the current default workflow actor", () => {
  const operating = fs.readFileSync(verdandiOperatingPath, "utf8");

  assert.match(operating, /registered `pm` fallback/);
  assert.doesNotMatch(operating, /registered `workflow-runtime` fallback/);
});

test("public docs explain release assets, import order, and runtime configuration", () => {
  const publicReadme = fs.readFileSync(publicReadmePath, "utf8");
  const workflowReadme = fs.readFileSync(workflowReadmePath, "utf8");
  const combined = `${publicReadme}\n${workflowReadme}`;

  assert.match(combined, /valdr 0\.3\.0/i);
  assert.match(combined, /valdr-sovereign\.valdr-pack\.tar\.gz/);
  assert.match(combined, /valdr-workflow\.valdr-pack\.tar\.gz/);
  assert.match(combined, /valdr-workflow-v0\.13\.0/);
  assert.match(combined, /Valdr UI/);
  assert.match(combined, /pm_provider/);
  assert.match(combined, /pm_agent/);
  assert.match(combined, /remoteName/);
  assert.doesNotMatch(combined, /use it to exercise the whole per-task pipeline/);
});

test("pack metadata and repository hygiene are public-release safe", () => {
  const workflowPack = fs.readFileSync(workflowPackPath, "utf8");
  const gitignore = fs.readFileSync(gitignorePath, "utf8");
  const license = fs.readFileSync(licensePath, "utf8");

  assert.match(workflowPack, /^license: MIT$/m);
  assert.match(workflowPack, /^homepage: https:\/\/valdr\.ai$/m);
  assert.match(workflowPack, /^repository: https:\/\/github\.com\/projectviking-ai\/valdr-packs$/m);
  assert.match(gitignore, /^\/\.mcp\.json$/m);
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 ProjectViking\.ai/);
});

test("public pull-request workflow resolves its repository without exposing repoId", () => {
  const workflow = fs.readFileSync(pullRequestWorkflowPath, "utf8");
  const publicInputs = workflow.match(/  inputs:\n([\s\S]*?)  outputs:/)?.[1];

  assert.ok(publicInputs, "expected public workflow inputs");
  assert.doesNotMatch(publicInputs, /^    repoId:/m);
  assert.doesNotMatch(workflow, /\$\{workflow\.inputs\.repoId\}/);
  assert.equal(
    workflow.match(/repoId: "\$\{steps\.observe_remote\.outputs\.repoId\}"/g)?.length,
    6,
  );
});

test("validate-valdr-workflow rejects old, failed-probe, and 0.3.0-dev CLIs before validation; accepts exact 0.3.0", () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "valdr-workflow-"));
  const fakeValdr = path.join(temporaryDirectory, "valdr");

  test.after(() => fs.rmSync(temporaryDirectory, { force: true, recursive: true }));

  fs.writeFileSync(fakeValdr, `#!/bin/sh
if [ "$1" = version ]; then
  echo 'valdr 0.2.9 (test)'
  exit 0
fi
echo 'validate-pack should not run' >&2
exit 1
`);
  fs.chmodSync(fakeValdr, 0o755);

  let oldVersionFailure;
  assert.throws(
    () => {
      try {
        execFileSync("make", ["validate-valdr-workflow", `VALDR_BIN=${fakeValdr}`], {
          cwd: repoRoot,
          stdio: "pipe",
        });
      } catch (error) {
        oldVersionFailure = error;
        throw error;
      }
    },
    /Command failed/,
  );
  assert.doesNotMatch(oldVersionFailure.stderr.toString(), /validate-pack should not run/);

  fs.writeFileSync(fakeValdr, `#!/bin/sh
if [ "$1" = version ]; then
  echo 'valdr 0.3.0 (test)'
  exit 1
fi
echo 'validate-pack should not run' >&2
exit 0
`);

  let failedProbeFailure;
  assert.throws(
    () => {
      try {
        execFileSync("make", ["validate-valdr-workflow", `VALDR_BIN=${fakeValdr}`], {
          cwd: repoRoot,
          stdio: "pipe",
        });
      } catch (error) {
        failedProbeFailure = error;
        throw error;
      }
    },
    /Command failed/,
  );
  assert.doesNotMatch(failedProbeFailure.stderr.toString(), /validate-pack should not run/);

  fs.writeFileSync(fakeValdr, `#!/bin/sh
if [ "$1" = version ]; then
  echo 'valdr 0.3.0-dev (test)'
  exit 0
fi
echo 'validate-pack should not run' >&2
exit 0
`);

  let lookalikeVersionFailure;
  assert.throws(
    () => {
      try {
        execFileSync("make", ["validate-valdr-workflow", `VALDR_BIN=${fakeValdr}`], {
          cwd: repoRoot,
          stdio: "pipe",
        });
      } catch (error) {
        lookalikeVersionFailure = error;
        throw error;
      }
    },
    /Command failed/,
  );
  assert.doesNotMatch(lookalikeVersionFailure.stderr.toString(), /validate-pack should not run/);

  fs.writeFileSync(fakeValdr, `#!/bin/sh
if [ "$1" = version ]; then
  echo 'valdr 0.3.0 (test)'
  exit 0
fi
if [ "$1" = validate-pack ] && [ "$2" = valdr-packs/valdr-workflow ] && [ "$#" -eq 2 ]; then
  exit 0
fi
exit 1
`);

  assert.doesNotThrow(() => execFileSync("make", ["validate-valdr-workflow", `VALDR_BIN=${fakeValdr}`], {
    cwd: repoRoot,
    stdio: "pipe",
  }));
});
