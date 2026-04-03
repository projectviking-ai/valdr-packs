<!--<capability id="valdr.orchestrator.nikol.pack-authoring" pack="valdr" role="workflow" prompt-tags="orchestrator,pack-authoring">-->
# Pack Authoring Workflow

<!--<identity>-->
Workflow for creating, structuring, and maintaining valdr-packs as on-disk content that can be imported into the Valdr system.
<!--</identity>-->

<!--<instructions>-->

## Hard-File-First Principle

**The on-disk file is always the source of truth.** When creating or updating pack content:

1. **Write or edit the hard file first** — the `.md` prompt file, the `.agent.yaml` manifest, or the `pack.yaml`.
2. **Then sync to the registry** — via `pm_valdr_pack` or individual `pm_prompt`/`pm_capability`/`pm_agent` calls.
3. **Never create content only in the registry** — if it doesn't exist as a file on disk, it's not durable.

When updating existing content, always read the hard file, edit it, then sync to the registry. The registry is a deployment target, not the authoring surface.

## Pack Discovery

Before creating a new pack, check for existing packs in both locations:

| Priority | Location | When |
|----------|----------|------|
| 1 | `valdr-packs/` at repo root | Primary — monorepo or dedicated pack repo |
| 2 | `./valdr/valdr-packs/` relative to cwd | Alternate — embedded in another project |

Discovery:
```
Glob: valdr-packs/*/pack.yaml
Glob: valdr/valdr-packs/*/pack.yaml
```

If a pack with the same key already exists, work within that pack's directory. Do not create a duplicate.

## Pack Directory Structure

```
valdr-packs/<pack-key>/
├── pack.yaml                              # Pack manifest (required)
├── README.md                              # Pack overview (recommended)
├── <content-root>/                        # Matches includes[].path in pack.yaml
│   ├── core/                              # Shared capabilities (optional)
│   │   ├── tools/                         # Tool documentation
│   │   ├── registry/                      # Registry references
│   │   ├── specs/                         # Spec references
│   │   └── context/                       # Shared context prompts
│   ├── orchestrator/                      # Orchestrator agents
│   │   └── <handle>/
│   ├── reviewer/                          # Reviewer agents
│   │   └── <handle>/
│   ├── planner/                           # Planner agents
│   │   └── <handle>/
│   ├── executor/                          # Executor agents
│   │   └── <handle>/
│   └── agents/                            # General-purpose agents
│       └── <domain>/<handle>/
```

**Agent directory contents:**
```
<handle>/
├── <handle>.agent.yaml                    # Agent manifest (required)
├── README.md                              # Agent overview (recommended)
├── ORCHESTRATOR_CAPABILITY_MATRIX.md      # Orchestrators only
└── <pack>.<domain>.<handle>.<name>.md     # Capability prompt files
```

## Creating a New Pack from Scratch

### Step 1: Create pack directory and manifest

Create `valdr-packs/<pack-key>/pack.yaml`:

```yaml
schemaVersion: 1.0
pack: <pack-key>
name: <Human-Friendly Name>
version: 0.1.0
description: <Short description of pack purpose>
includes:
  - path: <content-root>
    description: <What this subtree contains>
```

Hot-load `valdr.core.specs.pack-yaml` for the full field spec.

### Step 2: Create agent directories

For each agent in the pack:

1. Create the directory: `<content-root>/<role>/<handle>/`
2. Write the agent manifest: `<handle>.agent.yaml`
3. Write the core system prompt: `<pack>.<domain>.<handle>.system.md`
4. Write workflow/context capabilities as separate `.md` files

Hot-load `valdr.core.specs.agent-yaml` for the agent manifest spec.

### Step 3: Write capability prompt files

Every capability needs a backing prompt markdown file. The filename must match the capability key: `<capability-key>.md`.

**Capability-backed prompt:**
```markdown
<!--<capability id="<pack>.<domain>.<agent>.<name>" pack="<pack>" role="<role>">-->
# <Display Name>

<!--<identity>-->
<Brief identity statement — under 50 words>
<!--</identity>-->

<!--<instructions>-->
<Main instructional content>
<!--</instructions>-->
<!--</capability>-->
```

**Standalone prompt (no capability wrapper):**
```markdown
<!--<prompt key="<prompt-key>" pack="<pack>" role="<role>" tags="tag-a,tag-b">-->
# <Display Name>

<Content>
<!--</prompt>-->
```

Hot-load `valdr.core.specs.prompt-markdown` for the full prompt spec.

### Step 4: Write the agent manifest

```yaml
schemaVersion: 1.0
agent:
  handle: <handle>
  name: <Display Name>
  kind: bot
  defaultRole: <role>
  tags:
    - <pack-key>
    - <role>
    - <domain-tags>
capabilities:
  - key: <pack>.<domain>.<handle>.system
    role: core
    category: <category>
  - key: <pack>.<domain>.<handle>.<workflow>
    role: workflow
    category: <category>
    hot-load: true
  # Shared references as needed:
  - key: valdr.core.registry.taxonomy
    role: context
    category: registry
    hot-load: true
```

**Rules:**
- Exactly one `role: core` capability (not hot-loaded)
- Workflows, references, and tool docs are `hot-load: true`
- `category` must match the capability markdown `category` attribute when both are present

### Step 5: Validate on disk

Run the pack validator if the `valdr` CLI is available:

```bash
valdr validate-pack --pack-dir <pack-directory>
```

Or run it directly with bun or node:

```bash
bun valdr-packs/scripts/validate-pack.ts --pack-dir <pack-directory>
```

The validator checks:

- [ ] `pack.yaml` exists at pack root with required fields
- [ ] Every agent directory has `<handle>.agent.yaml`
- [ ] Every agent has exactly one `role: core` capability
- [ ] Every capability in `.agent.yaml` has a corresponding `.md` file on disk
- [ ] Capability keys use dots: `pack.domain.agent.name`
- [ ] Prompt keys use dashes: `pack-domain-agent-name`
- [ ] Filenames match capability keys: `<capability-key>.md`
- [ ] Capability markdown `category` matches agent YAML `category` where both are set
- [ ] No orphaned capability files unreferenced by any agent manifest

Always run validation before importing. If the validator exits with errors, fix the hard files first.

```

**Incremental import (preferred for updates):**

1. `pm_prompt { action: "create", ... }` for each new prompt
2. `pm_capability { action: "ensure", ... }` for each capability
3. `pm_agent { action: "create", ... }` for each agent (non-hot-load caps only)
4. Verify hot-load access: `pm_capability { action: "prompt", key: "<key>" }`

## Updating an Existing Pack

### Locating files

1. Find the pack root: look for `pack.yaml` in `valdr-packs/<pack-key>/`
2. Read `pack.yaml` → `includes` paths tell you where content lives
3. Find the agent directory: `<includes-path>/<role>/<handle>/`
4. Read `<handle>.agent.yaml` → capability list tells you which `.md` files exist

### Edit workflow (hard-file-first)

1. **Read** the hard file on disk
2. **Edit** the content in the `.md` file or `.agent.yaml`
3. **Sync** to registry:
   - Prompt content changes: `pm_prompt { action: "update", key: "<key>", content: "<updated>" }`
   - Capability metadata changes: `pm_capability { action: "ensure", ... }`
   - Agent manifest changes: `pm_agent { action: "update", ... }`

### Adding a capability to an existing agent

1. Write the new `.md` file in the agent directory
2. Add the entry to `<handle>.agent.yaml` (with `hot-load: true` if appropriate)
3. Register the prompt: `pm_prompt { action: "create", key: "<prompt-key>", ... }`
4. Register the capability: `pm_capability { action: "ensure", key: "<cap-key>", promptId: "<id>", ... }`
5. If agent-linked (not hot-load): `pm_agent { action: "update", handle: "<handle>", capabilities: { set: [...] } }`
6. Update capability matrix and README

### Removing a capability

1. If agent-linked: `pm_agent { action: "update", handle: "<handle>", capabilities: { remove: ["<key>"] } }`
2. Remove the entry from `<handle>.agent.yaml`
3. Keep the `.md` file and registry entries if other agents reference the capability
4. Update capability matrix and README

## Key Conventions

### Naming

| Entity | Convention | Example |
|--------|-----------|---------|
| Capability key | dots | `valdr.orchestrator.nikol.pack-authoring` |
| Prompt key | dashes | `valdr-orchestrator-nikol-pack-authoring` |
| Filename | matches capability key | `valdr.orchestrator.nikol.pack-authoring.md` |
| Agent manifest | `<handle>.agent.yaml` | `nikol.agent.yaml` |
| Pack manifest | `pack.yaml` | `pack.yaml` |

### Key derivation

Prompt key = capability key with dots replaced by dashes:
- `valdr.orchestrator.nikol.system` → `valdr-orchestrator-nikol-system`

### Role selection

| Content | Capability Role | When |
|---------|----------------|------|
| Agent identity | `core` | Always — exactly one per agent |
| Step-by-step workflows | `workflow` | Procedural guides |
| Rules, policies | `constraints` | Behavioral boundaries |
| Reference data | `context` | Lookup tables, conventions |
| Tool documentation | `integration` | MCP tool guides |
| Quality checks | `validation` | Checklists, gates |

Hot-load `valdr.core.registry.taxonomy` for the full role/kind taxonomy.

## Anti-Patterns (DO NOT)

1. Create content only in the registry without a backing hard file on disk
2. Edit registry content without updating the hard file first
3. Create a new pack directory when one already exists for that pack key
4. Skip the `pack.yaml` manifest
5. Mix agents from different packs in the same directory tree
6. Use dots in prompt keys or dashes in capability keys
7. Skip on-disk validation before importing

<!--</instructions>-->
<!--</capability>-->
