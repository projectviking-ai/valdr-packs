import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  CAPABILITY_ROLE_VALUES,
  VALDR_PACK_CANONICAL_IDENTITY_KEYS,
  VALDR_PACK_SCHEMA_VERSION,
  computeValdrPackDigest,
  createAgentIdentity,
  createCapabilityIdentity,
  createManifest,
  createPromptIdentity,
  normalizeValdrPackHandle,
  normalizeValdrPackPath,
  toCanonicalValdrPackEntityKey
} from "./lib/runtime.mjs";
const DEFAULT_PACK_DIR = "valdr-packs/valdr";
const DEFAULT_SOURCE_SYSTEM = "valdr-pack/scripts/generate-valdr-pack";
const MANIFEST_PATH = "manifest.json";
const TAR_BLOCK_SIZE = 512;
const MAX_TAR_PATH_LENGTH = 255;
const PROMPT_ROLE_VALUES = ["system", "guide", "checklist", "policy", "context"];
const textEncoder = new TextEncoder();
const writeLine = (stream, line = "") => {
  stream.write(`${line}\n`);
};
/**
 * @typedef {{ write: (value: string) => unknown }} PackCliWritable
 * @typedef {{ stdout: PackCliWritable, stderr: PackCliWritable }} PackCliRuntime
 */
const usage = () => [
  "Usage:",
  "  node scripts/generate-valdr-pack.mjs [pack-dir] [--output <file>] [--source-system <value>] [--exported-at <epoch-ms>]",
  "  valdr generate-valdr-pack <pack-dir> [--output <file>] [--source-system <value>] [--exported-at <epoch-ms>]",
  "",
  "Defaults:",
  `  --pack-dir ${DEFAULT_PACK_DIR}`,
  "  --output   build/<pack>.valdr-pack.tar.gz",
  `  --source-system ${DEFAULT_SOURCE_SYSTEM}`,
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
    packDir: DEFAULT_PACK_DIR,
    output: null,
    sourceSystem: DEFAULT_SOURCE_SYSTEM,
    exportedAt: null,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    switch (arg) {
      case "--pack-dir":
        options.packDir = readRequiredOptionValue(argv, index, "--pack-dir");
        index += 1;
        break;
      case "--output":
        options.output = readRequiredOptionValue(argv, index, "--output");
        index += 1;
        break;
      case "--source-system":
        options.sourceSystem = readRequiredOptionValue(argv, index, "--source-system");
        index += 1;
        break;
      case "--exported-at": {
        const rawValue = readRequiredOptionValue(argv, index, "--exported-at");
        options.exportedAt = parseExportedAtValue(rawValue);
        index += 1;
        break;
      }
      case "":
        break;
      default:
        if (!arg.startsWith("-") && options.packDir === DEFAULT_PACK_DIR) {
          options.packDir = arg;
          break;
        }
        throw new Error(`Unknown argument '${arg}'.\n\n${usage()}`);
    }
  }
  return options;
};
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const normalizeNewlines = (value) => value.replaceAll("\r\n", "\n");
const normalizeYamlLineIndent = (value) => value.replaceAll("\t", "  ");
const parseYamlScalar = (raw) => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};
const canonicalizeTags = (tags) => {
  if (!tags || tags.length === 0) {
    return [];
  }
  const normalized = tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0 && tag.length <= 64);
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
};
const canonicalizePromptContexts = (contexts) => {
  if (!contexts || contexts.length === 0) {
    return [];
  }
  const normalized = contexts.map((context) => context.trim().toLowerCase()).filter((context) => context.length > 0 && context.length <= 64);
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
};
const toCapabilityRole = (role) => {
  const normalized = role?.trim().toLowerCase();
  if (normalized && CAPABILITY_ROLE_VALUES.includes(normalized)) {
    return normalized;
  }
  return CAPABILITY_ROLE_VALUES[0];
};
const toPromptRoleFromCapabilityRole = (role) => {
  const normalized = role?.trim().toLowerCase();
  if (normalized === "core") return "system";
  if (normalized === "workflow") return "guide";
  if (normalized === "validation") return "checklist";
  if (normalized === "constraints" || normalized === "constraint") return "policy";
  if (normalized === "context") return "context";
  return "guide";
};
const toPromptRole = (role) => {
  const normalized = role?.trim().toLowerCase();
  if (normalized && PROMPT_ROLE_VALUES.includes(normalized)) {
    return normalized;
  }
  return toPromptRoleFromCapabilityRole(role);
};
const normalizePromptArchiveRecord = (record) => ({
  key: record.key.trim().toLowerCase(),
  role: record.role,
  name: record.name.trim(),
  content: record.content
});
const normalizeCapabilityArchiveRecord = (record) => ({
  key: record.key.trim().toLowerCase(),
  name: record.name?.trim().length ? record.name.trim() : null,
  category: record.category?.trim().length ? record.category.trim().toLowerCase() : null,
  promptKey: record.promptKey?.trim().length ? record.promptKey.trim().toLowerCase() : null,
  role: record.role,
  pack: record.pack?.trim().length ? record.pack.trim().toLowerCase() : null
});
const normalizeSourceRelpath = (sourceRelpath) => {
  if (!sourceRelpath?.trim().length) {
    return void 0;
  }
  return normalizeValdrPackPath(sourceRelpath.trim().replace(/^\/+/, ""));
};
const normalizeOptionalHandle = (handle) => {
  if (handle === null || handle === void 0 || handle.trim().length === 0) {
    return null;
  }
  return normalizeValdrPackHandle(handle);
};
const normalizeAgentArchiveRecord = (record) => {
  const normalizedCapabilities = (record.capabilities ?? []).map((capability) => ({
    key: capability.key.trim().toLowerCase(),
    category: capability.category?.trim().length ? capability.category.trim().toLowerCase() : null,
    role: capability.role,
    hotLoad: capability.hotLoad === true,
    order: capability.order,
    promptKey: capability.promptKey?.trim().length ? capability.promptKey.trim().toLowerCase() : null,
    sourceRelpath: normalizeSourceRelpath(capability.sourceRelpath)
  })).sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.key.localeCompare(right.key);
  });
  const normalizedPrompts = (record.prompts ?? []).map((prompt) => ({
    promptKey: prompt.promptKey.trim().toLowerCase(),
    useFor: canonicalizePromptContexts(prompt.useFor),
    role: prompt.role,
    hotLoad: prompt.hotLoad === true,
    order: prompt.order,
    sourceRelpath: normalizeSourceRelpath(prompt.sourceRelpath)
  })).sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.promptKey.localeCompare(right.promptKey);
  });
  const normalizedHandle = normalizeOptionalHandle(record.handle);
  return {
    id: record.id?.trim().length ? record.id.trim() : null,
    name: record.name.trim(),
    kind: record.kind?.trim().length ? record.kind.trim().toLowerCase() : "bot",
    handle: normalizedHandle,
    defaultRole: record.defaultRole?.trim().length ? record.defaultRole.trim().toLowerCase() : null,
    tags: canonicalizeTags(record.tags),
    capabilities: normalizedCapabilities,
    prompts: normalizedPrompts
  };
};
const derivePromptKeyFromCapabilityKey = (capabilityKey) => capabilityKey.replace(/\./g, "-");
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
const parseMarkdownBodyWithHeading = (innerContent, fallbackName) => {
  const normalized = normalizeNewlines(innerContent).trim();
  if (!normalized) {
    return { name: fallbackName, body: "" };
  }
  const lines = normalized.split("\n");
  const heading = lines[0]?.trim();
  if (heading && heading.startsWith("# ")) {
    const name = heading.slice(2).trim() || fallbackName;
    let start = 1;
    while (start < lines.length && lines[start]?.trim() === "") {
      start += 1;
    }
    const body = lines.slice(start).join("\n").trim();
    return { name, body };
  }
  return { name: fallbackName, body: normalized };
};
const parseCapabilityMarkdownFile = (entryPath, content, packKey) => {
  const openTag = /<!--<capability\s+([^>]+)>-->/i.exec(content);
  if (!openTag) {
    return null;
  }
  const closeIndex = content.search(/<!--<\/capability>-->/i);
  const openEnd = openTag.index + openTag[0].length;
  const inner = closeIndex >= 0 ? content.slice(openEnd, closeIndex) : content.slice(openEnd);
  const attrs = parseTaggedAttributes(openTag[1] ?? "");
  const key = (attrs.id ?? "").trim().toLowerCase();
  if (!key) {
    throw new Error(`Capability file '${entryPath}' is missing id.`);
  }
  const roleCandidate = (attrs.role ?? "").trim().toLowerCase();
  const role = CAPABILITY_ROLE_VALUES.includes(roleCandidate) ? roleCandidate : CAPABILITY_ROLE_VALUES[0];
  const { name, body } = parseMarkdownBodyWithHeading(inner, key);
  const promptKey = derivePromptKeyFromCapabilityKey(key);
  const promptRole = toPromptRoleFromCapabilityRole(role);
  return {
    capability: normalizeCapabilityArchiveRecord({
      key,
      name,
      category: null,
      promptKey,
      role,
      pack: (attrs.pack ?? packKey).trim().toLowerCase()
    }),
    prompt: normalizePromptArchiveRecord({
      key: promptKey,
      role: promptRole,
      name,
      content: body.length > 0 ? body : `Capability ${key}`
    })
  };
};
const parsePromptMarkdownFile = (entryPath, content) => {
  const openTag = /<!--<prompt\s+([^>]+)>-->/i.exec(content);
  if (!openTag) {
    return null;
  }
  const closeIndex = content.search(/<!--<\/prompt>-->/i);
  const openEnd = openTag.index + openTag[0].length;
  const inner = closeIndex >= 0 ? content.slice(openEnd, closeIndex) : content.slice(openEnd);
  const attrs = parseTaggedAttributes(openTag[1] ?? "");
  const key = (attrs.key ?? "").trim().toLowerCase();
  if (!key) {
    throw new Error(`Prompt file '${entryPath}' is missing key.`);
  }
  const roleCandidate = (attrs.role ?? "").trim().toLowerCase();
  const role = PROMPT_ROLE_VALUES.includes(roleCandidate) ? roleCandidate : "guide";
  const { name, body } = parseMarkdownBodyWithHeading(inner, key);
  return normalizePromptArchiveRecord({
    key,
    role,
    name,
    content: body.length > 0 ? body : name
  });
};
const parseIndentedKeyValue = (line, indent) => {
  const pattern = new RegExp(`^ {${indent}}([A-Za-z0-9_-]+):\\s*(.*)$`);
  const match = line.match(pattern);
  if (!match || match[1] === void 0 || match[2] === void 0) {
    return null;
  }
  return { key: match[1], value: match[2] };
};
const parseIndentedListItem = (line, indent) => {
  const pattern = new RegExp(`^ {${indent}}-\\s*(.*)$`);
  const match = line.match(pattern);
  return match?.[1] ?? null;
};
const parseInlineYamlKeyValue = (raw) => {
  const match = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
  if (!match || match[1] === void 0 || match[2] === void 0) {
    return null;
  }
  return { key: match[1], value: match[2] };
};
const parseTopLevelAgentSection = (trimmed) => {
  if (trimmed === "agent:") return "agent";
  if (trimmed === "capabilities:") return "capabilities";
  if (trimmed === "prompts:") return "prompts";
  return "root";
};
const assignAgentRootField = (result, key, rawValue) => {
  const value = parseYamlScalar(rawValue);
  if (key === "handle" && typeof value === "string") result.handle = value.trim();
  if (key === "id" && typeof value === "string") result.id = value.trim();
  if (key === "name" && typeof value === "string") result.name = value.trim();
  if (key === "kind" && typeof value === "string") result.kind = value.trim().toLowerCase();
  if (key === "defaultRole" && typeof value === "string") result.defaultRole = value.trim().toLowerCase();
};
const pushAgentTag = (result, rawValue) => {
  const value = parseYamlScalar(rawValue);
  if (typeof value === "string" && value.trim()) {
    result.tags.push(value.trim().toLowerCase());
  }
};
const assignInlineCapabilityField = (inline, setCapabilityField) => {
  if (!inline.length) return;
  const parsedInline = parseInlineYamlKeyValue(inline);
  if (!parsedInline) return;
  setCapabilityField(parsedInline.key, parsedInline.value);
};
const assignInlinePromptField = (inline, setPromptField) => {
  if (!inline.length) return;
  const parsedInline = parseInlineYamlKeyValue(inline);
  if (!parsedInline) return;
  setPromptField(parsedInline.key, parsedInline.value);
};
const parseAgentYamlFile = (entryPath, content) => {
  const lines = normalizeNewlines(content).split("\n");
  const result = {
    tags: [],
    capabilities: [],
    prompts: []
  };
  let section = "root";
  let currentCapability = null;
  let currentPrompt = null;
  const flushCapability = () => {
    if (!currentCapability) return;
    if (currentCapability.key) {
      result.capabilities.push(currentCapability);
    }
    currentCapability = null;
  };
  const flushPrompt = () => {
    if (!currentPrompt) return;
    if (currentPrompt.key) {
      result.prompts.push(currentPrompt);
    }
    currentPrompt = null;
  };
  const setCapabilityField = (key, raw) => {
    if (!currentCapability) currentCapability = { key: "" };
    const value = parseYamlScalar(raw);
    if (key === "key" && typeof value === "string") currentCapability.key = value.trim().toLowerCase();
    if (key === "role" && typeof value === "string") currentCapability.role = value.trim().toLowerCase();
    if ((key === "hot-load" || key === "hotLoad") && typeof value === "boolean") currentCapability.hotLoad = value;
    if (key === "order" && typeof value === "number") currentCapability.order = Math.max(0, Math.trunc(value));
    if ((key === "promptKey" || key === "prompt-key") && typeof value === "string") {
      currentCapability.promptKey = value.trim().toLowerCase();
    }
  };
  const setPromptField = (key, raw) => {
    if (!currentPrompt) currentPrompt = { key: "" };
    const value = parseYamlScalar(raw);
    if ((key === "key" || key === "promptKey" || key === "prompt-key") && typeof value === "string") {
      currentPrompt.key = value.trim().toLowerCase();
    }
    if (key === "role" && typeof value === "string") currentPrompt.role = value.trim().toLowerCase();
    if ((key === "hot-load" || key === "hotLoad") && typeof value === "boolean") currentPrompt.hotLoad = value;
    if (key === "order" && typeof value === "number") currentPrompt.order = Math.max(0, Math.trunc(value));
  };
  for (const rawLine of lines) {
    const line = normalizeYamlLineIndent(rawLine);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (!line.startsWith(" ")) {
      flushCapability();
      flushPrompt();
      section = parseTopLevelAgentSection(trimmed);
      continue;
    }
    if (section === "agent") {
      if (line.startsWith("  tags:")) {
        section = "agent-tags";
        continue;
      }
      const entry = parseIndentedKeyValue(line, 2);
      if (!entry) continue;
      assignAgentRootField(result, entry.key, entry.value);
      continue;
    }
    if (section === "agent-tags") {
      const tagValue = parseIndentedListItem(line, 4);
      if (tagValue !== null) {
        pushAgentTag(result, tagValue);
        continue;
      }
      section = "agent";
    }
    if (section === "capabilities") {
      const listEntry = parseIndentedListItem(line, 2);
      if (listEntry !== null) {
        flushCapability();
        currentCapability = { key: "" };
        assignInlineCapabilityField(listEntry.trim(), setCapabilityField);
        continue;
      }
      const entry = parseIndentedKeyValue(line, 4);
      if (entry) {
        setCapabilityField(entry.key, entry.value);
      }
      continue;
    }
    if (section === "prompts") {
      const listEntry = parseIndentedListItem(line, 2);
      if (listEntry !== null) {
        flushPrompt();
        currentPrompt = { key: "" };
        assignInlinePromptField(listEntry.trim(), setPromptField);
        continue;
      }
      const entry = parseIndentedKeyValue(line, 4);
      if (entry) {
        setPromptField(entry.key, entry.value);
      }
      continue;
    }
  }
  flushCapability();
  flushPrompt();
  if (!result.handle && !result.id) {
    throw new Error(`Agent file '${entryPath}' must include handle or id.`);
  }
  if (!result.name) {
    throw new Error(`Agent file '${entryPath}' must include agent.name.`);
  }
  return result;
};
const parsePackYaml = (sourcePath, content) => {
  const lines = normalizeNewlines(content).split("\n");
  let packKey = null;
  const includes = [];
  let inIncludes = false;
  let pendingIncludeHasPath = false;
  const pushInclude = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    includes.push(trimmed);
  };
  const assignPackRootField = (key, rawValue) => {
    if (key === "pack") {
      const value = parseYamlScalar(rawValue);
      if (typeof value === "string" && value.trim()) {
        packKey = value.trim().toLowerCase();
      }
    }
    if (key === "includes") {
      inIncludes = true;
    }
  };
  const assignIncludePath = (rawPath) => {
    const value = parseYamlScalar(rawPath);
    if (typeof value === "string") {
      pushInclude(value);
      pendingIncludeHasPath = true;
    }
  };
  for (const rawLine of lines) {
    const line = normalizeYamlLineIndent(rawLine);
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    if (!line.startsWith(" ")) {
      inIncludes = false;
      pendingIncludeHasPath = false;
      const keyValue = parseInlineYamlKeyValue(trimmed);
      if (!keyValue) continue;
      assignPackRootField(keyValue.key, keyValue.value);
      continue;
    }
    if (!inIncludes) {
      continue;
    }
    const includeItem = parseIndentedListItem(line, 2);
    if (includeItem !== null) {
      pendingIncludeHasPath = false;
      const inline = includeItem.trim();
      if (!inline) {
        continue;
      }
      const inlinePath = parseInlineYamlKeyValue(inline);
      if (inlinePath?.key === "path") {
        assignIncludePath(inlinePath.value);
      }
      continue;
    }
    const includeField = parseIndentedKeyValue(line, 4);
    if (!includeField) {
      continue;
    }
    if (includeField.key === "path") {
      assignIncludePath(includeField.value);
      continue;
    }
    if (!pendingIncludeHasPath && includeField.key === "description") {
      continue;
    }
  }
  if (!packKey) {
    throw new Error(`Pack manifest '${sourcePath}' must include 'pack: <key>'.`);
  }
  return {
    packKey,
    includes: includes.length > 0 ? includes : ["."]
  };
};
const ensureChildPath = (root, candidate) => {
  const relative = path.relative(root, candidate);
  if (relative === "" || !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return;
  }
  throw new Error(`Path '${candidate}' escapes pack root '${root}'.`);
};
const listFilesRecursively = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const childFiles = await listFilesRecursively(fullPath);
      results.push(...childFiles);
      continue;
    }
    if (entry.isFile()) {
      results.push(fullPath);
      continue;
    }
    if (entry.isSymbolicLink()) {
      throw new Error(`Symlink '${fullPath}' is not supported in valdr-pack generation.`);
    }
  }
  return results;
};
const collectPackSourceFiles = async (packDirAbsolute, packYaml) => {
  const filesByArchivePath = new Map();
  const packDirName = path.basename(packDirAbsolute);
  const archiveRoot = normalizeValdrPackPath(path.posix.join("valdr-packs", packDirName));
  const sourceFiles = new Set();
  sourceFiles.add(path.join(packDirAbsolute, "pack.yaml"));
  for (const includePath of packYaml.includes) {
    const absoluteInclude = path.resolve(packDirAbsolute, includePath);
    ensureChildPath(packDirAbsolute, absoluteInclude);
    let stats;
    try {
      stats = await fs.lstat(absoluteInclude);
    } catch {
      throw new Error(`Included path '${includePath}' does not exist under '${packDirAbsolute}'.`);
    }
    if (stats.isDirectory()) {
      const files = await listFilesRecursively(absoluteInclude);
      for (const filePath of files) {
        sourceFiles.add(filePath);
      }
      continue;
    }
    if (stats.isFile()) {
      sourceFiles.add(absoluteInclude);
      continue;
    }
    throw new Error(`Included path '${includePath}' must be a file or directory.`);
  }
  const sortedSourceFiles = [...sourceFiles].sort((left, right) => left.localeCompare(right));
  for (const sourceFile of sortedSourceFiles) {
    ensureChildPath(packDirAbsolute, sourceFile);
    const relativeLocal = path.relative(packDirAbsolute, sourceFile);
    const relativePosix = normalizeValdrPackPath(relativeLocal.split(path.sep).join("/"));
    const archivePath = normalizeValdrPackPath(path.posix.join(archiveRoot, relativePosix));
    if (!archivePath || archivePath === "." || archivePath === "..") {
      throw new Error(`Invalid archive path for source file '${sourceFile}'.`);
    }
    const content = new Uint8Array(await fs.readFile(sourceFile));
    const prior = filesByArchivePath.get(archivePath);
    if (prior) {
      const priorChecksum = sha256Hex(prior);
      const nextChecksum = sha256Hex(content);
      if (priorChecksum !== nextChecksum) {
        throw new Error(`Archive path collision with different content at '${archivePath}'.`);
      }
      continue;
    }
    filesByArchivePath.set(archivePath, content);
  }
  return filesByArchivePath;
};
const resolveArchiveSourceRelpath = (entryPath, agentRoot, fallback) => {
  if (!entryPath) {
    return fallback;
  }
  if (entryPath.startsWith(`${agentRoot}/`)) {
    return entryPath.slice(agentRoot.length + 1);
  }
  return path.posix.basename(entryPath);
};
const parsePackSpecArchive = (manifestPaths, files, packKey) => {
  const decodedByPath = new Map();
  for (const entryPath of manifestPaths) {
    const content = files.get(entryPath);
    if (!content) continue;
    if (entryPath.endsWith(".md") || entryPath.endsWith(".yaml") || entryPath.endsWith(".yml")) {
      decodedByPath.set(entryPath, Buffer.from(content).toString("utf8"));
    }
  }
  const capabilityByKey = new Map();
  const capabilityPathByKey = new Map();
  const promptByKey = new Map();
  const promptPathByKey = new Map();
  for (const [entryPath, text] of decodedByPath.entries()) {
    if (!entryPath.endsWith(".md")) {
      continue;
    }
    const capabilityParsed = parseCapabilityMarkdownFile(entryPath, text, packKey);
    if (capabilityParsed) {
      capabilityByKey.set(capabilityParsed.capability.key, capabilityParsed.capability);
      capabilityPathByKey.set(capabilityParsed.capability.key, entryPath);
      if (!promptByKey.has(capabilityParsed.prompt.key)) {
        promptByKey.set(capabilityParsed.prompt.key, capabilityParsed.prompt);
        promptPathByKey.set(capabilityParsed.prompt.key, entryPath);
      }
      continue;
    }
    const promptParsed = parsePromptMarkdownFile(entryPath, text);
    if (promptParsed) {
      promptByKey.set(promptParsed.key, promptParsed);
      promptPathByKey.set(promptParsed.key, entryPath);
    }
  }
  const agentRecords = [];
  const agentYamlPaths = [...decodedByPath.keys()].filter((entryPath) => entryPath.endsWith(".agent.yaml"));
  for (const agentYamlPath of agentYamlPaths.sort((left, right) => left.localeCompare(right))) {
    const agentYamlText = decodedByPath.get(agentYamlPath);
    if (!agentYamlText) continue;
    const parsed = parseAgentYamlFile(agentYamlPath, agentYamlText);
    const agentRoot = normalizeValdrPackPath(path.posix.dirname(agentYamlPath));
    const capabilities = parsed.capabilities.map((entry, index) => {
      const capability = capabilityByKey.get(entry.key);
      if (!capability) {
        throw new Error(
          `Agent file '${agentYamlPath}' references capability '${entry.key}' without matching capability markdown.`
        );
      }
      const capabilityPath = capabilityPathByKey.get(entry.key);
      const sourceRelpath = resolveArchiveSourceRelpath(capabilityPath, agentRoot, `${entry.key}.md`);
      const promptKey = entry.promptKey ?? capability.promptKey ?? derivePromptKeyFromCapabilityKey(entry.key);
      return {
        key: entry.key,
        category: capability.category,
        role: toCapabilityRole(entry.role ?? capability.role),
        hotLoad: entry.hotLoad ?? false,
        order: entry.order ?? (index + 1) * 10,
        promptKey,
        sourceRelpath
      };
    });
    const prompts = parsed.prompts.map((entry, index) => {
      const prompt = promptByKey.get(entry.key);
      if (!prompt) {
        throw new Error(
          `Agent file '${agentYamlPath}' references prompt '${entry.key}' without matching prompt markdown.`
        );
      }
      const promptPath = promptPathByKey.get(entry.key);
      const sourceRelpath = resolveArchiveSourceRelpath(promptPath, agentRoot, `${entry.key}.md`);
      return {
        promptKey: entry.key,
        useFor: [toPromptRole(entry.role ?? prompt.role)],
        role: toPromptRole(entry.role ?? prompt.role),
        hotLoad: entry.hotLoad ?? false,
        order: entry.order ?? (index + 1) * 10,
        sourceRelpath
      };
    });
    agentRecords.push(
      normalizeAgentArchiveRecord({
        id: parsed.id ?? null,
        name: parsed.name ?? parsed.handle ?? parsed.id ?? "agent",
        kind: parsed.kind ?? "bot",
        handle: parsed.handle ? normalizeValdrPackHandle(parsed.handle) : null,
        defaultRole: parsed.defaultRole ?? null,
        tags: parsed.tags,
        capabilities,
        prompts
      })
    );
  }
  return {
    prompts: [...promptByKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
    capabilities: [...capabilityByKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
    agents: agentRecords.sort((left, right) => {
      const leftKey = left.handle ?? left.id ?? "";
      const rightKey = right.handle ?? right.id ?? "";
      return leftKey.localeCompare(rightKey);
    })
  };
};
const splitTarPath = (archivePath) => {
  if (archivePath.length <= 100) {
    return { name: archivePath, prefix: "" };
  }
  if (archivePath.length > MAX_TAR_PATH_LENGTH) {
    throw new Error(`Archive path '${archivePath}' exceeds tar path limit (${MAX_TAR_PATH_LENGTH} characters).`);
  }
  const slashIndex = archivePath.lastIndexOf("/");
  if (slashIndex <= 0 || slashIndex === archivePath.length - 1) {
    throw new Error(`Cannot encode tar path '${archivePath}'.`);
  }
  const prefix = archivePath.slice(0, slashIndex);
  const name = archivePath.slice(slashIndex + 1);
  if (name.length > 100 || prefix.length > 155) {
    throw new Error(`Cannot encode tar path '${archivePath}'.`);
  }
  return { name, prefix };
};
const writeTarString = (target, offset, length, value) => {
  const encoded = textEncoder.encode(value);
  const limit = Math.min(encoded.length, length);
  target.set(encoded.subarray(0, limit), offset);
};
const writeTarOctal = (target, offset, length, value) => {
  const octal = Math.floor(value).toString(8);
  const padded = octal.padStart(length - 1, "0");
  writeTarString(target, offset, length - 1, padded);
  target[offset + length - 1] = 0;
};
const createTarHeader = (archivePath, size, timestampSeconds) => {
  const header = new Uint8Array(TAR_BLOCK_SIZE);
  const split = splitTarPath(archivePath);
  writeTarString(header, 0, 100, split.name);
  writeTarString(header, 100, 8, "000644");
  writeTarString(header, 108, 8, "000000");
  writeTarString(header, 116, 8, "000000");
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, timestampSeconds);
  writeTarString(header, 148, 8, "        ");
  header[156] = 48;
  writeTarString(header, 257, 6, "ustar");
  writeTarString(header, 263, 2, "00");
  writeTarString(header, 345, 155, split.prefix);
  const checksum = header.reduce((total, value) => total + value, 0);
  const checksumOctal = checksum.toString(8).padStart(6, "0");
  writeTarString(header, 148, 6, checksumOctal);
  header[154] = 0;
  header[155] = 32;
  return header;
};
const buildTarGzPayload = (files, timestampMs) => {
  const chunks = [];
  const timestampSeconds = Math.floor(timestampMs / 1e3);
  const sortedEntries = [...files.entries()].sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath));
  for (const [archivePath, content] of sortedEntries) {
    const header = createTarHeader(archivePath, content.length, timestampSeconds);
    chunks.push(header);
    chunks.push(content);
    const remainder = content.length % TAR_BLOCK_SIZE;
    if (remainder !== 0) {
      chunks.push(new Uint8Array(TAR_BLOCK_SIZE - remainder));
    }
  }
  chunks.push(new Uint8Array(TAR_BLOCK_SIZE * 2));
  const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const joined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return gzipSync(joined, { mtime: timestampSeconds });
};
const resolveExportedAt = (options) => options.exportedAt ?? Date.now();
const buildArchiveChecksums = (archiveFiles) => {
  const checksums = {};
  for (const [archivePath, content] of archiveFiles.entries()) {
    checksums[archivePath] = sha256Hex(content);
  }
  return checksums;
};
const buildManifestReferences = (parsedEntities) => [
  ...parsedEntities.prompts.map((prompt) => ({
    entity: createPromptIdentity({ kind: "prompt", key: prompt.key }),
    dependsOn: {
      prompts: [],
      capabilities: [],
      agents: []
    }
  })),
  ...parsedEntities.capabilities.map((capability) => ({
    entity: createCapabilityIdentity({ kind: "capability", key: capability.key }),
    dependsOn: {
      prompts: capability.promptKey !== null ? [createPromptIdentity({ kind: "prompt", key: capability.promptKey })] : [],
      capabilities: [],
      agents: []
    }
  })),
  ...parsedEntities.agents.map((agent) => ({
    entity: createAgentIdentity({
      kind: "agent",
      handle: agent.handle ?? null,
      id: agent.id ?? null
    }),
    dependsOn: {
      prompts: agent.prompts.map(
        (prompt) => createPromptIdentity({ kind: "prompt", key: prompt.promptKey })
      ),
      capabilities: agent.capabilities.map(
        (capability) => createCapabilityIdentity({ kind: "capability", key: capability.key })
      ),
      agents: []
    }
  }))
].sort(
  (left, right) => toCanonicalValdrPackEntityKey(left.entity).localeCompare(toCanonicalValdrPackEntityKey(right.entity))
);
const logGenerationSummary = (outputPath, manifest, payloadSize, runtime) => {
  writeLine(runtime.stdout, `Generated valdr-pack: ${outputPath}`);
  writeLine(runtime.stdout, `Pack key: ${manifest.packKey}`);
  writeLine(runtime.stdout, `Digest: ${manifest.digest}`);
  writeLine(
    runtime.stdout,
    `Entities: prompts=${manifest.exportMetadata.entityCounts.prompts} capabilities=${manifest.exportMetadata.entityCounts.capabilities} agents=${manifest.exportMetadata.entityCounts.agents}`
  );
  writeLine(runtime.stdout, `Archive entries: ${manifest.archive.entries.length}`);
  writeLine(runtime.stdout, `Size bytes: ${payloadSize}`);
};
export const runGenerateValdrPackCli = async (
  argv,
  /** @type {PackCliRuntime} */ runtime = { stdout: process.stdout, stderr: process.stderr }
) => {
  let options;
  try {
    options = parseCliArgs(argv);
  } catch (error) {
    writeLine(runtime.stderr, error instanceof Error ? error.message : String(error));
    return 1;
  }
  if (options.help) {
    writeLine(runtime.stdout, usage());
    return 0;
  }
  try {
    const cwd = process.cwd();
    const packDirAbsolute = path.resolve(cwd, options.packDir);
    const packYamlPath = path.join(packDirAbsolute, "pack.yaml");
    const packYamlText = await fs.readFile(packYamlPath, "utf8");
    const parsedPackYaml = parsePackYaml(packYamlPath, packYamlText);
    const outputPath = path.resolve(
      cwd,
      options.output ?? path.join("build", `${parsedPackYaml.packKey}.valdr-pack.tar.gz`)
    );
    const exportedAt = resolveExportedAt(options);
    const archiveFiles = await collectPackSourceFiles(packDirAbsolute, parsedPackYaml);
    const archivePaths = [...archiveFiles.keys()].sort((left, right) => left.localeCompare(right));
    const parsedEntities = parsePackSpecArchive(archivePaths, archiveFiles, parsedPackYaml.packKey);
    const checksums = buildArchiveChecksums(archiveFiles);
    const digest = computeValdrPackDigest(checksums);
    const references = buildManifestReferences(parsedEntities);
    const manifest = createManifest({
      schemaVersion: VALDR_PACK_SCHEMA_VERSION,
      packKey: parsedPackYaml.packKey,
      digest,
      exportMetadata: {
        exportedAt,
        sourceSystem: options.sourceSystem,
        entityCounts: {
          prompts: parsedEntities.prompts.length,
          capabilities: parsedEntities.capabilities.length,
          agents: parsedEntities.agents.length
        },
        canonicalIdentityKeys: VALDR_PACK_CANONICAL_IDENTITY_KEYS
      },
      archive: {
        entries: archivePaths.map((archivePath) => ({
          path: archivePath,
          checksum: checksums[archivePath] ?? "",
          sizeBytes: archiveFiles.get(archivePath)?.length ?? 0
        })),
        checksums
      },
      dependencyGraph: {
        references
      }
    });
    const finalArchiveFiles = new Map(archiveFiles);
    finalArchiveFiles.set(MANIFEST_PATH, textEncoder.encode(`${JSON.stringify(manifest)}\n`));
    const payload = buildTarGzPayload(finalArchiveFiles, exportedAt);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, payload);
    logGenerationSummary(outputPath, manifest, payload.length, runtime);
    return 0;
  } catch (error) {
    writeLine(runtime.stderr, error instanceof Error ? error.message : String(error));
    return 1;
  }
};

// CLI entry point
const exitCode = await runGenerateValdrPackCli(process.argv.slice(2));
process.exit(exitCode);
