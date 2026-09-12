import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const workflowPath = path.resolve(".github/workflows/release.yml");
const validationWorkflowPath = path.resolve(".github/workflows/validate.yml");
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
  assert.match(workflow, /paths:\n\s+- skills\/\*\*\n\s+- commands\/\*\*\n\s+- valdr-packs\/valdr\/\*\*\n\s+- valdr-packs\/valdr-workflow\/\*\*\n\s+- scripts\/build-valdr-tier\.mjs\n\s+- scripts\/generate-valdr-pack\.mjs\n\s+- scripts\/validate-valdr-pack\.mjs\n\s+- scripts\/lib\/\*\*\n\s+- VERSION\n\s+- VALDR_WORKFLOW_CLI_VERSION\n\s+- Makefile\n\s+- \.github\/workflows\/release\.yml\n\npermissions:/);
  assert.doesNotMatch(workflow, /README\.md/);
  assert.doesNotMatch(workflow, /workflow_dispatch:|\n\s+tags:/);
});

test("one release builds all four packs with the pinned CLI and publishes the repository version", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  const archives = ["raider", "vanguard", "sovereign", "workflow"].map((pack) => `build/valdr-${pack}.valdr-pack.tar.gz`);

  assert.equal(fs.existsSync(".github/workflows/release-valdr-workflow.yml"), false, "one release workflow owns all packs");
  assert.match(workflow, /permissions:\n\s+contents: write/);
  assert.match(workflow, /runs-on: macos-14/);
  assert.match(workflow, /gh release download "v\$\{CLI_VERSION\}" --repo projectviking-ai\/valdr-releases/);
  assert.match(workflow, /valdr-v\$\{CLI_VERSION\}-macos-arm64\.tar\.gz/);
  assert.match(workflow, /valdr-v\$\{CLI_VERSION\}-macos-arm64\.tar\.gz\.sha256/);
  assert.match(workflow, /shasum -a 256 -c/);
  assert.doesNotMatch(workflow, /linux-x64/);
  assert.match(workflow, /actual_version="\$\(bin\/valdr version \| awk 'NR == 1 \{ print \$2 \}'\)"/);
  assert.match(workflow, /if \[ -z "\$actual_version" \] \|\| \[ "\$actual_version" != "\$CLI_VERSION" \]/);
  assert.match(workflow, /VALDR_BIN: \$\{\{ steps\.valdr\.outputs\.path \}\}/);
  assert.match(workflow, /run: make build-valdr-all/);
  assert.match(fs.readFileSync("Makefile", "utf8"), /^build-valdr-all: build-valdr-raider build-valdr-vanguard build-valdr-sovereign build-valdr-workflow$/m);
  assert.match(workflow, /tr -d '\\n' < VERSION/);
  assert.match(workflow, /if \[ -z "\$CLI_VERSION" \]/);
  assert.doesNotMatch(workflow, /GITHUB_REF_NAME/);
  assert.match(workflow, /--title "v\$\{VERSION\}"/);
  assert.match(workflow, /--notes "Valdr pack release v\$\{VERSION\}"/);

  const steps = workflow.match(/- name:[\s\S]*?(?=\n      - name:|$)/g);
  const stepIndex = (name) => steps.findIndex((step) => step.startsWith(`- name: ${name}\n`));
  assert.ok(stepIndex("Fail if release tag already exists") >= 0);
  assert.ok(stepIndex("Fail if release tag already exists") < stepIndex("Download pinned Valdr CLI"));
  assert.ok(stepIndex("Fail if release tag already exists") < stepIndex("Build release archives"));
  for (const name of ["Fail if release tag already exists", "Create GitHub Release"]) {
    assert.match(steps[stepIndex(name)], /VERSION: \$\{\{ steps\.version\.outputs\.value \}\}/);
    assert.doesNotMatch(steps[stepIndex(name)], /\n\s+if:/);
  }

  const releaseOperations = [
    /gh release download/,
    /shasum -a 256 -c/,
    /tar -xzf/,
    /actual_version="\$\(bin\/valdr version \| awk/,
    /make ci-validate/,
    /make build-valdr-all/,
    /gh release create/,
  ].map((pattern) => workflow.search(pattern));
  assert.ok(releaseOperations.every((index) => index >= 0), "expected every release operation");
  assert.ok(releaseOperations.every((index, position) => position === 0 || releaseOperations[position - 1] < index),
    "release operations must be download, checksum, extract, verify, test, build, then release");

  const ghSteps = steps.filter((step) => /\bgh\b/.test(step));
  assert.ok(ghSteps.length >= 3, "expected lookup, download, and publishing gh steps");
  for (const step of ghSteps) {
    assert.match(step, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  }

  const releaseCommand = workflow.match(/gh release create[\s\S]*?--notes "Valdr pack release v\$\{VERSION\}"/);
  assert.ok(releaseCommand, "expected one release creation");
  assert.deepEqual(releaseCommand[0].match(/build\/[^\\\s]+/g), archives);
});

test("release shell publishes all packs at the pushed commit and fails closed on tag lookup", (t) => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  const steps = workflow.match(/- name:[\s\S]*?(?=\n      - name:|$)/g);
  const guard = steps.find((step) => step.startsWith("- name: Fail if release"));
  const publish = steps.find((step) => step.startsWith("- name: Create GitHub Release\n"));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-release-"));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const calls = path.join(directory, "gh-calls");
  const script = `gh() {
    printf '%s\\n' "$@" >> "$GH_CALLS"
    if [ "$1" = api ]; then
      printf '%s\\n' "$GH_RESPONSE"
      return "$GH_STATUS"
    fi
  }
  ${guard.split("        run: |\n")[1]}
  ${publish.split("        run: |\n")[1]}`;

  for (const [response, ghStatus, expectedStatus] of [
    ["HTTP/2 200", "0", 1],
    ["HTTP/2 404", "1", 0],
    ["HTTP/2 403", "1", 1],
    ["HTTP/2 500", "1", 1],
    ["", "1", 1],
  ]) {
    fs.writeFileSync(calls, "");
    const result = spawnSync("/bin/bash", ["-e", "-c", script], {
      encoding: "utf8",
      env: {
        ...process.env, GH_CALLS: calls, GH_RESPONSE: response, GH_STATUS: ghStatus,
        GITHUB_REPOSITORY: "example/packs", GITHUB_REF_NAME: "main",
        GITHUB_SHA: "1234567890abcdef1234567890abcdef12345678",
        VERSION: "1.2.3",
      },
    });
    assert.equal(result.status, expectedStatus, `${response || "network failure"}: ${result.stderr}`);
    const expectedCalls = ["api", "--method", "GET", "repos/example/packs/git/ref/tags/v1.2.3", "--include", "--silent"];
    if (expectedStatus === 0) expectedCalls.push(
      "release", "create", "v1.2.3",
      ...["raider", "vanguard", "sovereign", "workflow"].map((pack) => `build/valdr-${pack}.valdr-pack.tar.gz`),
      "--target", "1234567890abcdef1234567890abcdef12345678",
      "--title", "v1.2.3", "--notes", "Valdr pack release v1.2.3",
    );
    assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split("\n"), expectedCalls);
  }
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

  assert.match(combined, /VALDR_WORKFLOW_CLI_VERSION/);
  assert.match(combined, /valdr-sovereign\.valdr-pack\.tar\.gz/);
  assert.match(combined, /valdr-workflow\.valdr-pack\.tar\.gz/);
  assert.doesNotMatch(combined, /valdr-workflow-v/);
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
