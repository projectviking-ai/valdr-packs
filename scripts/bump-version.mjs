import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { REPO_ROOT, VERSION_FILE, parseRepoVersion, readRepoVersion } from "./lib/version.mjs";

const BUMP_KINDS = new Set(["patch", "minor", "major"]);

const usage = () => [
  "Usage:",
  "  node scripts/bump-version.mjs <patch|minor|major|version>",
  "",
  "Examples:",
  "  node scripts/bump-version.mjs patch",
  "  node scripts/bump-version.mjs minor",
  "  node scripts/bump-version.mjs 1.4.0"
].join("\n");

export const bumpVersion = (currentVersion, nextValue) => {
  const normalizedCurrent = parseRepoVersion(currentVersion);
  const normalizedNextValue = nextValue.trim();
  if (!normalizedNextValue) {
    throw new Error("A version target is required.");
  }
  if (!BUMP_KINDS.has(normalizedNextValue)) {
    return parseRepoVersion(normalizedNextValue);
  }

  const match = normalizedCurrent.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Cannot bump non-numeric semantic version '${normalizedCurrent}'.`);
  }
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);
  if (normalizedNextValue === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }
  if (normalizedNextValue === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major + 1}.0.0`;
};

export const writeRepoVersion = (nextVersion, repoRoot = REPO_ROOT) => {
  const versionPath = path.join(repoRoot, VERSION_FILE);
  fs.writeFileSync(versionPath, `${parseRepoVersion(nextVersion)}\n`, "utf8");
};

export const runBumpVersionCli = (argv = process.argv.slice(2), repoRoot = REPO_ROOT) => {
  const requested = argv[0]?.trim();
  if (!requested || requested === "-h" || requested === "--help") {
    process.stdout.write(`${usage()}\n`);
    return requested ? 0 : 1;
  }

  const currentVersion = readRepoVersion(repoRoot);
  const nextVersion = bumpVersion(currentVersion, requested);
  writeRepoVersion(nextVersion, repoRoot);
  process.stdout.write(`${nextVersion}\n`);
  return 0;
};

const scriptPath = fileURLToPath(import.meta.url);
const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isEntrypoint) {
  try {
    process.exitCode = runBumpVersionCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
