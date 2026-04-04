import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, "../..");
export const VERSION_FILE = "VERSION";

export const parseRepoVersion = (rawVersion) => {
  const version = rawVersion.trim();
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Invalid repository version '${rawVersion}'. Expected semantic version text in ${VERSION_FILE}.`);
  }
  return version;
};

export const readRepoVersion = (repoRoot = REPO_ROOT) => {
  const versionPath = path.join(repoRoot, VERSION_FILE);
  const rawVersion = fs.readFileSync(versionPath, "utf8");
  return parseRepoVersion(rawVersion);
};
