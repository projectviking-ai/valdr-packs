import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildTier } from "./build-valdr-tier.mjs";
import { VALDR_TIERS } from "./lib/valdr-tier-config.mjs";
import { formatValidationResult, validatePackDir } from "./lib/validate-pack.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "..");

const usage = () => [
  "Usage:",
  "  node scripts/validate-valdr-pack.mjs [raider|vanguard|sovereign ...]",
  "",
  "Defaults:",
  "  Validates all tiers"
].join("\n");

const parseCliArgs = (argv) => {
  if (argv.includes("-h") || argv.includes("--help")) {
    return { help: true, tiers: [] };
  }
  if (argv.length === 0) {
    return { help: false, tiers: VALDR_TIERS };
  }
  const tiers = argv.map((arg) => arg.trim().toLowerCase()).filter(Boolean);
  for (const tier of tiers) {
    if (!VALDR_TIERS.includes(tier)) {
      throw new Error(`Unknown tier '${tier}'. Expected one of: ${VALDR_TIERS.join(", ")}.`);
    }
  }
  return { help: false, tiers };
};

export const runValidateValdrPackCli = async (argv = process.argv.slice(2), runtime = { stdout: process.stdout, stderr: process.stderr }) => {
  let options;
  try {
    options = parseCliArgs(argv);
  } catch (error) {
    runtime.stderr.write(`${error.message}\n`);
    return 1;
  }

  if (options.help) {
    runtime.stdout.write(`${usage()}\n`);
    return 0;
  }

  let hadErrors = false;
  for (const tier of options.tiers) {
    const outputPath = path.join(repoRoot, "build", "validation", `valdr-${tier}.valdr-pack.tar.gz`);
    const { stagedPackDir } = await buildTier({ tier, output: outputPath, exportedAt: 0 });
    const result = await validatePackDir(stagedPackDir, { baseDir: repoRoot });
    runtime.stdout.write(formatValidationResult(result, `Tier ${tier}`));
    runtime.stdout.write("\n");
    if (result.errors.length > 0) {
      hadErrors = true;
    }
  }

  return hadErrors ? 1 : 0;
};

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isEntrypoint) {
  runValidateValdrPackCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
