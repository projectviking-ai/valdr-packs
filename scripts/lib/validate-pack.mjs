import fs from "node:fs/promises";
import path from "node:path";

import { CAPABILITY_ROLE_VALUES } from "./runtime.mjs";

const PROMPT_ROLE_VALUES = ["system", "guide", "checklist", "policy", "context"];

const createFindingsReporter = () => {
  const findings = [];
  const addFinding = (severity, filePath, message) => {
    findings.push({ severity, path: filePath, message });
  };
  return {
    findings,
    error: (filePath, message) => addFinding("error", filePath, message),
    warn: (filePath, message) => addFinding("warn", filePath, message)
  };
};

const normalizeNewlines = (value) => value.replaceAll("\r\n", "\n");
const normalizeYamlLineIndent = (value) => value.replaceAll("\t", "  ");

const parseYamlScalar = (raw) => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseInlineYamlKeyValue = (raw) => {
  const match = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
  if (!match || match[1] === void 0 || match[2] === void 0) return null;
  return { key: match[1], value: match[2] };
};

const parseIndentedKeyValue = (line, indent) => {
  const pattern = new RegExp(`^ {${indent}}([A-Za-z0-9_-]+):\\s*(.*)$`);
  const match = line.match(pattern);
  if (!match || match[1] === void 0 || match[2] === void 0) return null;
  return { key: match[1], value: match[2] };
};

const parseIndentedListItem = (line, indent) => {
  const pattern = new RegExp(`^ {${indent}}-\\s*(.*)$`);
  const match = line.match(pattern);
  return match?.[1] ?? null;
};

const parsePackYaml = (content) => {
  const lines = normalizeNewlines(content).split("\n");
  const result = {
    packKey: null,
    name: null,
    version: null,
    schemaVersion: null,
    description: null,
    includes: []
  };
  let inIncludes = false;

  for (const rawLine of lines) {
    const line = normalizeYamlLineIndent(rawLine);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ")) {
      inIncludes = false;
      const kv = parseInlineYamlKeyValue(trimmed);
      if (!kv) continue;
      const value = parseYamlScalar(kv.value);
      if (kv.key === "pack" && typeof value === "string") result.packKey = value.trim().toLowerCase();
      if (kv.key === "name" && typeof value === "string") result.name = value.trim();
      if (kv.key === "version") result.version = String(value ?? "").trim();
      if (kv.key === "schemaVersion") result.schemaVersion = String(value ?? "").trim();
      if (kv.key === "description" && typeof value === "string") result.description = value.trim();
      if (kv.key === "includes") inIncludes = true;
      continue;
    }

    if (!inIncludes) continue;

    const includeItem = parseIndentedListItem(line, 2);
    if (includeItem !== null) {
      const inline = includeItem.trim();
      if (!inline) continue;
      const inlinePath = parseInlineYamlKeyValue(inline);
      if (inlinePath?.key === "path") {
        const value = parseYamlScalar(inlinePath.value);
        if (typeof value === "string" && value.trim()) {
          result.includes.push(value.trim());
        }
      }
      continue;
    }

    const includeField = parseIndentedKeyValue(line, 4);
    if (!includeField) continue;
    if (includeField.key === "path") {
      const value = parseYamlScalar(includeField.value);
      if (typeof value === "string" && value.trim()) {
        result.includes.push(value.trim());
      }
    }
  }

  return result;
};

const parseAgentYaml = (content) => {
  const lines = normalizeNewlines(content).split("\n");
  const result = {
    handle: null,
    name: null,
    kind: null,
    defaultRole: null,
    tags: [],
    capabilities: [],
    prompts: []
  };
  let section = "root";
  let currentCapability = null;
  let currentPrompt = null;

  const flushCapability = () => {
    if (currentCapability?.key) {
      result.capabilities.push({
        key: currentCapability.key,
        role: currentCapability.role ?? null,
        category: currentCapability.category ?? null,
        hotLoad: currentCapability.hotLoad ?? false
      });
    }
    currentCapability = null;
  };

  const flushPrompt = () => {
    if (currentPrompt?.key) {
      result.prompts.push({
        key: currentPrompt.key,
        role: currentPrompt.role ?? null,
        hotLoad: currentPrompt.hotLoad ?? false
      });
    }
    currentPrompt = null;
  };

  const setCapabilityField = (key, raw) => {
    if (!currentCapability) currentCapability = {};
    const value = parseYamlScalar(raw);
    if (key === "key" && typeof value === "string") currentCapability.key = value.trim().toLowerCase();
    if (key === "role" && typeof value === "string") currentCapability.role = value.trim().toLowerCase();
    if (key === "category" && typeof value === "string") currentCapability.category = value.trim().toLowerCase();
    if ((key === "hot-load" || key === "hotLoad") && typeof value === "boolean") currentCapability.hotLoad = value;
  };

  const setPromptField = (key, raw) => {
    if (!currentPrompt) currentPrompt = {};
    const value = parseYamlScalar(raw);
    if ((key === "key" || key === "promptKey" || key === "prompt-key") && typeof value === "string") {
      currentPrompt.key = value.trim().toLowerCase();
    }
    if (key === "role" && typeof value === "string") currentPrompt.role = value.trim().toLowerCase();
    if ((key === "hot-load" || key === "hotLoad") && typeof value === "boolean") currentPrompt.hotLoad = value;
  };

  for (const rawLine of lines) {
    const line = normalizeYamlLineIndent(rawLine);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ")) {
      flushCapability();
      flushPrompt();
      if (trimmed === "agent:") section = "agent";
      else if (trimmed === "capabilities:") section = "capabilities";
      else if (trimmed === "prompts:") section = "prompts";
      else section = "root";
      continue;
    }

    if (section === "agent") {
      if (line.startsWith("  tags:")) {
        section = "agent-tags";
        continue;
      }
      const entry = parseIndentedKeyValue(line, 2);
      if (!entry) continue;
      const value = parseYamlScalar(entry.value);
      if (entry.key === "handle" && typeof value === "string") result.handle = value.trim();
      if (entry.key === "name" && typeof value === "string") result.name = value.trim();
      if (entry.key === "kind" && typeof value === "string") result.kind = value.trim().toLowerCase();
      if (entry.key === "defaultRole" && typeof value === "string") result.defaultRole = value.trim().toLowerCase();
      continue;
    }

    if (section === "agent-tags") {
      const tagValue = parseIndentedListItem(line, 4);
      if (tagValue !== null) {
        const value = parseYamlScalar(tagValue);
        if (typeof value === "string" && value.trim()) result.tags.push(value.trim().toLowerCase());
        continue;
      }
      section = "agent";
    }

    if (section === "capabilities") {
      const listEntry = parseIndentedListItem(line, 2);
      if (listEntry !== null) {
        flushCapability();
        currentCapability = {};
        const inline = listEntry.trim();
        if (inline) {
          const entry = parseInlineYamlKeyValue(inline);
          if (entry) setCapabilityField(entry.key, entry.value);
        }
        continue;
      }
      const entry = parseIndentedKeyValue(line, 4);
      if (entry) setCapabilityField(entry.key, entry.value);
      continue;
    }

    if (section === "prompts") {
      const listEntry = parseIndentedListItem(line, 2);
      if (listEntry !== null) {
        flushPrompt();
        currentPrompt = {};
        const inline = listEntry.trim();
        if (inline) {
          const entry = parseInlineYamlKeyValue(inline);
          if (entry) setPromptField(entry.key, entry.value);
        }
        continue;
      }
      const entry = parseIndentedKeyValue(line, 4);
      if (entry) setPromptField(entry.key, entry.value);
    }
  }

  flushCapability();
  flushPrompt();
  return result;
};

const parseTaggedAttributes = (rawAttributes) => {
  const attrs = {};
  const attrPattern = /([a-zA-Z0-9_.:-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = attrPattern.exec(rawAttributes)) !== null) {
    const key = match[1];
    const value = match[2];
    if (!key || value === void 0) continue;
    attrs[key] = value;
  }
  return attrs;
};

const parseCapabilityHeader = (content) => {
  const openTag = /<!--<capability\s+([^>]+)>-->/i.exec(content);
  if (!openTag) return null;
  const attrs = parseTaggedAttributes(openTag[1] ?? "");
  const id = (attrs.id ?? "").trim().toLowerCase();
  if (!id) return null;
  return {
    id,
    pack: (attrs.pack ?? "").trim().toLowerCase() || null,
    role: (attrs.role ?? "").trim().toLowerCase() || null,
    category: (attrs.category ?? "").trim().toLowerCase() || null
  };
};

const parsePromptHeader = (content) => {
  const openTag = /<!--<prompt\s+([^>]+)>-->/i.exec(content);
  if (!openTag) return null;
  const attrs = parseTaggedAttributes(openTag[1] ?? "");
  const key = (attrs.key ?? "").trim().toLowerCase();
  if (!key) return null;
  return {
    key,
    pack: (attrs.pack ?? "").trim().toLowerCase() || null,
    role: (attrs.role ?? "").trim().toLowerCase() || null
  };
};

const listFilesRecursively = async (directory, skipSubPacks = false) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (skipSubPacks) {
        const subPackYaml = path.join(fullPath, "pack.yaml");
        try {
          await fs.access(subPackYaml);
          continue;
        } catch {
          // continue recursion
        }
      }
      results.push(...await listFilesRecursively(fullPath, skipSubPacks));
    } else if (entry.isFile()) {
      results.push(fullPath);
    } else if (entry.isSymbolicLink()) {
      throw new Error(`Symlink '${fullPath}' is not supported in valdr-pack validation.`);
    }
  }
  return results;
};

const ensureChildPath = (root, candidate) => {
  const relative = path.relative(root, candidate);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`Path '${candidate}' escapes pack root '${root}'.`);
};

const validatePackYaml = (packYamlPath, parsed, reporter) => {
  const { error, warn } = reporter;
  if (!parsed.schemaVersion) error(packYamlPath, "Missing required field: schemaVersion");
  if (!parsed.packKey) error(packYamlPath, "Missing required field: pack");
  if (!parsed.name) error(packYamlPath, "Missing required field: name");
  if (!parsed.version) error(packYamlPath, "Missing required field: version");
  if (!parsed.description) warn(packYamlPath, "Missing recommended field: description");
  if (parsed.includes.length === 0) warn(packYamlPath, "No includes paths defined; pack root will be scanned");
};

const validateCapabilityFile = (filePath, parsed, packKey, reporter) => {
  const { error, warn } = reporter;
  if (!parsed.id) error(filePath, "Capability missing id attribute");
  if (!parsed.role) warn(filePath, "Capability missing role attribute");
  if (!parsed.pack) warn(filePath, "Capability missing pack attribute");
  if (parsed.role && !CAPABILITY_ROLE_VALUES.includes(parsed.role)) {
    error(filePath, `Invalid capability role '${parsed.role}'. Allowed: ${CAPABILITY_ROLE_VALUES.join(", ")}`);
  }
  if (packKey && parsed.pack && parsed.pack !== packKey) {
    warn(filePath, `Capability pack '${parsed.pack}' does not match pack.yaml key '${packKey}'`);
  }
  const expectedFilename = `${parsed.id}.md`;
  const actualFilename = path.basename(filePath);
  if (actualFilename !== expectedFilename) {
    warn(filePath, `Filename '${actualFilename}' does not match capability id '${parsed.id}' (expected '${expectedFilename}')`);
  }
};

const validatePromptFile = (filePath, parsed, packKey, reporter) => {
  const { error, warn } = reporter;
  if (!parsed.key) error(filePath, "Prompt missing key attribute");
  if (!parsed.role) warn(filePath, "Prompt missing role attribute");
  if (parsed.role && !PROMPT_ROLE_VALUES.includes(parsed.role)) {
    warn(filePath, `Invalid prompt role '${parsed.role}'. Allowed: ${PROMPT_ROLE_VALUES.join(", ")}`);
  }
  if (packKey && parsed.pack && parsed.pack !== packKey) {
    warn(filePath, `Prompt pack '${parsed.pack}' does not match pack.yaml key '${packKey}'`);
  }
};

const validateAgent = async (agentYamlPath, agent, packKey, allCapabilityFiles, reporter, toDisplayPath) => {
  const { error, warn } = reporter;
  const agentYamlDisplayPath = toDisplayPath(agentYamlPath);
  const agentDir = path.dirname(agentYamlPath);
  if (!agent.handle) error(agentYamlDisplayPath, "Missing required field: agent.handle");
  if (!agent.name) error(agentYamlDisplayPath, "Missing required field: agent.name");
  if (!agent.kind) warn(agentYamlDisplayPath, "Missing field: agent.kind (defaults to bot)");
  if (!agent.defaultRole) warn(agentYamlDisplayPath, "Missing field: agent.defaultRole");

  const coreCapabilities = agent.capabilities.filter((capability) => capability.role === "core");
  if (coreCapabilities.length === 0) {
    error(agentYamlDisplayPath, "No role: core capability found - exactly one is required");
  } else if (coreCapabilities.length > 1) {
    error(agentYamlDisplayPath, `Found ${coreCapabilities.length} role: core capabilities - exactly one is required`);
  }

  for (const coreCapability of coreCapabilities) {
    if (coreCapability.hotLoad) {
      error(agentYamlDisplayPath, `Core capability '${coreCapability.key}' must not be hot-loaded`);
    }
  }

  for (const capability of agent.capabilities) {
    if (!capability.key) {
      error(agentYamlDisplayPath, "Capability entry missing key");
      continue;
    }
    if (capability.role && !CAPABILITY_ROLE_VALUES.includes(capability.role)) {
      error(agentYamlDisplayPath, `Capability '${capability.key}' has invalid role '${capability.role}'. Allowed: ${CAPABILITY_ROLE_VALUES.join(", ")}`);
    }

    const expectedFilename = `${capability.key}.md`;
    const expectedPath = path.join(agentDir, expectedFilename);
    let resolvedCapability = allCapabilityFiles.get(expectedPath) ?? null;
    let resolvedPath = expectedPath;

    if (!resolvedCapability) {
      for (const [filePath, parsedCapability] of allCapabilityFiles) {
        if (parsedCapability.id === capability.key) {
          resolvedCapability = parsedCapability;
          resolvedPath = filePath;
          break;
        }
      }
    }

    if (!resolvedCapability) {
      const isExternal = capability.key.startsWith("valdr.core.") || !capability.key.startsWith(`${packKey ?? ""}.`);
      if (isExternal) continue;
      error(agentYamlDisplayPath, `Capability '${capability.key}' has no matching .md file (expected '${expectedFilename}' or a file with id="${capability.key}")`);
      continue;
    }

    if (resolvedCapability.id !== capability.key) {
      error(toDisplayPath(resolvedPath), `Capability id '${resolvedCapability.id}' does not match agent.yaml key '${capability.key}'`);
    }
    if (capability.category && resolvedCapability.category && capability.category !== resolvedCapability.category) {
      error(agentYamlDisplayPath, `Category mismatch for '${capability.key}': agent.yaml says '${capability.category}', markdown says '${resolvedCapability.category}'`);
    }
    if (capability.role && resolvedCapability.role && capability.role !== resolvedCapability.role) {
      warn(agentYamlDisplayPath, `Role mismatch for '${capability.key}': agent.yaml says '${capability.role}', markdown says '${resolvedCapability.role}'`);
    }
    if (packKey && resolvedCapability.pack && resolvedCapability.pack !== packKey) {
      warn(toDisplayPath(resolvedPath), `Pack attribute '${resolvedCapability.pack}' does not match pack.yaml key '${packKey}'`);
    }
    const actualFilename = path.basename(resolvedPath);
    if (actualFilename !== expectedFilename) {
      warn(toDisplayPath(resolvedPath), `Filename '${actualFilename}' does not match capability key '${capability.key}' (expected '${expectedFilename}')`);
    }
  }

  for (const prompt of agent.prompts) {
    if (!prompt.key) {
      error(agentYamlDisplayPath, "Prompt entry missing key");
      continue;
    }
    if (prompt.role && !PROMPT_ROLE_VALUES.includes(prompt.role)) {
      warn(agentYamlDisplayPath, `Prompt '${prompt.key}' has role '${prompt.role}' which is not a standard prompt role. Allowed: ${PROMPT_ROLE_VALUES.join(", ")}`);
    }
  }
};

export const validatePackDir = async (packDir, { baseDir = packDir } = {}) => {
  const reporter = createFindingsReporter();
  const resolvedPackDir = path.resolve(packDir);
  const resolvedBaseDir = path.resolve(baseDir);
  const toDisplayPath = (targetPath) => path.relative(resolvedBaseDir, targetPath) || ".";
  const { findings, error, warn } = reporter;

  const packYamlPath = path.join(resolvedPackDir, "pack.yaml");
  let packKey = null;
  let includes = [];

  try {
    const packYamlContent = await fs.readFile(packYamlPath, "utf8");
    const parsedPackYaml = parsePackYaml(packYamlContent);
    validatePackYaml(toDisplayPath(packYamlPath), parsedPackYaml, reporter);
    packKey = parsedPackYaml.packKey;
    includes = parsedPackYaml.includes.length > 0 ? parsedPackYaml.includes : ["."];
  } catch (readError) {
    if (readError?.code === "ENOENT") {
      error(toDisplayPath(packYamlPath), "pack.yaml does not exist");
    } else {
      error(toDisplayPath(packYamlPath), `Failed to parse pack.yaml: ${readError.message}`);
    }
  }

  const includedFiles = new Set();
  for (const includePath of includes) {
    const absoluteInclude = path.resolve(resolvedPackDir, includePath);
    try {
      ensureChildPath(resolvedPackDir, absoluteInclude);
      const stat = await fs.lstat(absoluteInclude);
      if (stat.isDirectory()) {
        const subPackYamlPath = path.join(absoluteInclude, "pack.yaml");
        try {
          await fs.access(subPackYamlPath);
          const subPackYaml = await fs.readFile(subPackYamlPath, "utf8");
          const parsedSubPack = parsePackYaml(subPackYaml);
          if (parsedSubPack.packKey && parsedSubPack.packKey !== packKey) {
            continue;
          }
        } catch {
          // normal include directory
        }
        for (const includedFile of await listFilesRecursively(absoluteInclude, true)) {
          includedFiles.add(includedFile);
        }
        continue;
      }
      if (stat.isFile()) {
        includedFiles.add(absoluteInclude);
        continue;
      }
      error(toDisplayPath(packYamlPath), `Include path '${includePath}' must be a file or directory`);
    } catch (includeError) {
      if (
        includeError instanceof Error &&
        (includeError.message.includes("escapes pack root") || includeError.message.includes("Symlink '"))
      ) {
        error(toDisplayPath(packYamlPath), includeError.message);
        continue;
      }
      error(toDisplayPath(packYamlPath), `Include path '${includePath}' does not exist under pack root`);
    }
  }

  const allFiles = [...includedFiles].sort((left, right) => left.localeCompare(right));

  const capabilityFiles = new Map();
  const promptFiles = new Map();
  const markdownFiles = allFiles.filter((filePath) => filePath.endsWith(".md"));
  for (const markdownFile of markdownFiles) {
    const content = await fs.readFile(markdownFile, "utf8");
    const capabilityHeader = parseCapabilityHeader(content);
    if (capabilityHeader) {
      capabilityFiles.set(markdownFile, capabilityHeader);
      validateCapabilityFile(toDisplayPath(markdownFile), capabilityHeader, packKey, reporter);
      continue;
    }
    const promptHeader = parsePromptHeader(content);
    if (promptHeader) {
      promptFiles.set(markdownFile, promptHeader);
      validatePromptFile(toDisplayPath(markdownFile), promptHeader, packKey, reporter);
    }
  }

  const agentYamlFiles = allFiles.filter((filePath) => filePath.endsWith(".agent.yaml"));
  const referencedCapabilities = new Set();
  for (const agentYamlPath of agentYamlFiles) {
    try {
      const content = await fs.readFile(agentYamlPath, "utf8");
      const agent = parseAgentYaml(content);
      await validateAgent(agentYamlPath, agent, packKey, capabilityFiles, reporter, toDisplayPath);
      for (const capability of agent.capabilities) {
        if (capability.key) referencedCapabilities.add(capability.key);
      }
    } catch (readError) {
      error(toDisplayPath(agentYamlPath), `Failed to parse: ${readError.message}`);
    }
  }

  for (const [filePath, parsedCapability] of capabilityFiles) {
    if (referencedCapabilities.has(parsedCapability.id)) continue;
    const isPackLocal = !parsedCapability.id.startsWith("valdr.core.") && (!packKey || parsedCapability.id.startsWith(`${packKey}.`));
    if (isPackLocal) {
      warn(toDisplayPath(filePath), `Capability '${parsedCapability.id}' is not referenced by any agent.yaml in this pack`);
    }
  }

  findings.sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path);
    if (pathOrder !== 0) return pathOrder;
    if (left.severity !== right.severity) return left.severity.localeCompare(right.severity);
    return left.message.localeCompare(right.message);
  });

  const errors = findings.filter((finding) => finding.severity === "error");
  const warnings = findings.filter((finding) => finding.severity === "warn");

  return {
    packDir: resolvedPackDir,
    packKey,
    filesScanned: allFiles.length,
    agentCount: agentYamlFiles.length,
    capabilityCount: capabilityFiles.size,
    promptCount: promptFiles.size,
    findings,
    errors,
    warnings
  };
};

export const formatValidationResult = (result, label = result.packDir) => {
  const lines = [
    `${label}`,
    `  Pack key: ${result.packKey ?? "(unknown)"}`,
    `  Files scanned: ${result.filesScanned}`,
    `  Agents: ${result.agentCount}`,
    `  Capabilities: ${result.capabilityCount}`,
    `  Prompts: ${result.promptCount}`
  ];

  if (result.findings.length === 0) {
    lines.push("  No issues found.");
    return `${lines.join("\n")}\n`;
  }

  for (const finding of result.findings) {
    const prefix = finding.severity === "error" ? "ERROR" : "WARN ";
    lines.push(`  ${finding.path}`);
    lines.push(`    ${prefix} ${finding.message}`);
  }
  lines.push(`  ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
  return `${lines.join("\n")}\n`;
};
