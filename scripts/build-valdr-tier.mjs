import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  VALDR_PACK_KEY,
  VALDR_PACK_VERSION,
  VALDR_TIER_CONFIG,
  VALDR_TIER_SOURCE_ROOT,
  VALDR_TIER_SOURCE_SYSTEM,
  VALDR_TIERS
} from "./lib/valdr-tier-config.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "..");
const generatorScript = path.join(repoRoot, "scripts", "generate-valdr-pack.mjs");

const usage = () => [
  "Usage:",
  "  node scripts/build-valdr-tier.mjs <raider|vanguard|sovereign> [--output <file>] [--exported-at <epoch-ms>]",
  "",
  "Defaults:",
  "  --output   build/valdr-<tier>.valdr-pack.tar.gz",
  "  --exported-at <current time>"
].join("\n");

const readRequiredOptionValue = (argv, index, option) => {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
};

const parseExportedAtValue = (rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--exported-at requires a non-negative integer epoch in milliseconds. Received '${rawValue}'.`);
  }
  return parsed;
};

const parseCliArgs = (argv) => {
  const options = {
    tier: null,
    output: null,
    exportedAt: null,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    switch (arg) {
      case "--output":
        options.output = readRequiredOptionValue(argv, index, "--output");
        index += 1;
        break;
      case "--exported-at":
        options.exportedAt = parseExportedAtValue(readRequiredOptionValue(argv, index, "--exported-at"));
        index += 1;
        break;
      default:
        if (!arg.startsWith("-") && options.tier === null) {
          options.tier = arg.trim().toLowerCase();
          break;
        }
        throw new Error(`Unknown argument '${arg}'.\n\n${usage()}`);
    }
  }
  return options;
};

const quoteYamlString = (value) => JSON.stringify(value);

const renderPackYaml = (tierConfig) => {
  const lines = [
    "schemaVersion: 1.0",
    `pack: ${quoteYamlString(VALDR_PACK_KEY)}`,
    `name: ${quoteYamlString(tierConfig.name)}`,
    `version: ${quoteYamlString(VALDR_PACK_VERSION)}`,
    `description: ${quoteYamlString(tierConfig.description)}`,
    "includes:"
  ];
  for (const include of tierConfig.includes) {
    lines.push(`  - path: ${quoteYamlString(include.path)}`);
    lines.push(`    description: ${quoteYamlString(include.description)}`);
  }
  return `${lines.join("\n")}\n`;
};

const copyDirectoryContents = async (sourceDir, destinationDir) => {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    await fs.cp(sourcePath, destinationPath, {
      force: true,
      recursive: entry.isDirectory()
    });
  }
};

const ensureIncludedPathsExist = async (packDir, includes) => {
  for (const include of includes) {
    const includePath = path.join(packDir, include.path);
    try {
      await fs.lstat(includePath);
    } catch {
      throw new Error(`Generated tier is missing include path '${include.path}'.`);
    }
  }
};

export const buildTier = async ({ tier, output, exportedAt }) => {
  const tierConfig = VALDR_TIER_CONFIG[tier];
  if (!tierConfig) {
    throw new Error(`Unknown tier '${tier}'. Expected one of: ${VALDR_TIERS.join(", ")}.`);
  }

  const sourceRoot = path.join(repoRoot, VALDR_TIER_SOURCE_ROOT);
  const stagingRoot = path.join(repoRoot, "build", "staging", tier);
  const stagedPackDir = path.join(stagingRoot, VALDR_PACK_KEY);
  const resolvedOutput = output ? path.resolve(process.cwd(), output) : path.join(repoRoot, "build", `${tierConfig.artifactName}.valdr-pack.tar.gz`);

  await fs.rm(stagingRoot, { recursive: true, force: true });
  await fs.mkdir(stagedPackDir, { recursive: true });

  for (const layer of tierConfig.layers) {
    const layerDir = path.join(sourceRoot, layer);
    try {
      await fs.lstat(layerDir);
    } catch {
      throw new Error(`Missing Valdr source layer '${layerDir}'.`);
    }
    await copyDirectoryContents(layerDir, stagedPackDir);
  }

  await ensureIncludedPathsExist(stagedPackDir, tierConfig.includes);
  await fs.writeFile(path.join(stagedPackDir, "pack.yaml"), renderPackYaml(tierConfig), "utf8");
  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });

  const generatorArgs = [
    generatorScript,
    stagedPackDir,
    "--output",
    resolvedOutput,
    "--source-system",
    VALDR_TIER_SOURCE_SYSTEM
  ];
  if (exportedAt !== null) {
    generatorArgs.push("--exported-at", String(exportedAt));
  }

  await execFileAsync("node", generatorArgs, {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return {
    output: resolvedOutput,
    stagedPackDir
  };
};

const run = async () => {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help || options.tier === null) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = await buildTier(options);
  process.stdout.write(`Built ${options.tier} -> ${result.output}\n`);
};

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isEntrypoint) {
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
