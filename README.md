# valdr-packs

Distributable agent packs, skills, and commands for [Valdr](https://valdr.ai
) — the control plane for AI agents. Write once, deploy to Claude Code, Codex, and Gemini CLI.

Valdr packs are portable, self-describing bundles of agents, prompts, and capabilities. Import one and get a complete roster of agents with their capabilities, orchestration wiring, and domain knowledge ready to work.

## Quick Start

```bash
# Install skills to all supported platforms
make sync-all

# Or install to a specific platform
make sync-skills-claude    # ~/.claude/skills/
make sync-skills-codex     # ~/.agents/skills/
make sync-skills-gemini    # ~/.gemini/skills/
make sync-skills-agent     # ~/.agents/skills/
```

## Repository Structure

```
valdr-packs/
├── commands/                  # User-invoked slash commands (source of truth)
│   └── valdr-agent.md         # /valdr-agent <handle> — load an agent persona
│
├── skills/                    # Model-invoked skills (source of truth)
│   ├── valdr-auditor/         # Session auditing & scoring
│   ├── valdr-executor/        # Task execution & lifecycle
│   ├── valdr-orchestrator/    # Unified orchestrator routing
│   ├── valdr-planner/         # VMP feature planning
│   ├── valdr-reviewer/        # Code review & quality gates
│   └── README.md              # Skill index and installation notes
│
├── scripts/                   # Build & packaging tooling
│   ├── build-valdr-tier.mjs   # Assemble Raider/Vanguard/Sovereign from source layers
│   ├── generate-valdr-pack.mjs # Build importable .valdr-pack.tar.gz archives
│   └── lib/runtime.mjs        # Shared runtime (normalization, hashing, validation)
├── Makefile                   # Sync targets for installing skills
│
└── valdr-packs/               # Agent pack definitions
    ├── PACK-SPEC.md           # pack.yaml format specification
    ├── AGENT-SPEC.md          # .agent.yaml format specification
    ├── PROMPT-SPEC.md         # Prompt markdown specification
    ├── TAG-MAP.md             # Structured tagging conventions
    └── valdr/                 # Layered Valdr pack source
        ├── shared/            # Files common to all tiers
        ├── raider/            # Raider-only overrides
        ├── vanguard/          # Vanguard-only overrides
        └── sovereign/         # Sovereign-only overrides
```

## What's Inside

### Commands

Commands are explicit user actions invoked via `/command-name`. Defined once in `commands/`, deployed everywhere.

| Command | Invocation | Description |
|---------|------------|-------------|
| `valdr-agent` | `/valdr-agent <handle>` | Load an agent persona from the Valdr registry |

```
/valdr-agent sigrid    # Load the Sigrid reviewer persona
/valdr-agent freya     # Load the Freya planner persona
/valdr-agent gunnar    # Load the Gunnar orchestrator persona
```

### Skills

Skills teach agents specialized knowledge. They activate automatically when the model detects relevance — no manual invocation needed.

| Skill | Trigger | Purpose |
|-------|---------|---------|
| **valdr-executor** | User asks to execute, run, or complete a task | Fetch tasks, execute work, update checklists, change status |
| **valdr-planner** | Work needs structure, requirements, or stakeholder visibility | VMP structured planning with specs and task generation |
| **valdr-reviewer** | User asks to review a task, score work, or verify completion | Code review workflow, scoring, verification gate |
| **valdr-auditor** | User asks to audit a session or evaluate agent work | Session evaluation, quality scoring, evidence-backed verdicts |
| **valdr-orchestrator** | User needs PM navigation, registry operations, or sprint orchestration | Route work through Gunnar, Nikol, or Skadi and follow the selected orchestrator prompt |

### Commands vs Skills

| | Commands | Skills |
|---|---------|--------|
| **Trigger** | User types `/command-name` | Model detects relevance automatically |
| **Structure** | Single `.md` file | Folder with `SKILL.md` and optional `agents/` or `assets/` |
| **Example** | `/valdr-agent sigrid` | Auto-activates for task execution |

## Three-Tier Pack System

Valdr packs use a layered source model that builds three self-contained artifacts. All three import as logical pack `valdr`, so higher tiers replace lower-tier definitions by reusing the same handles and `valdr.*` capability keys.

### Valdr Raider

Manual and UI-only guidance.

- Domain and utility agents
- Freya planner
- Sigrid reviewer
- No MCP tool docs, executor flows, auditors, or orchestrators

### Valdr Vanguard

MCP-enabled PM workflows without live session orchestration.

- Adds core PM tool docs, executor workflows, and shared base behaviors
- Adds Gunnar, Nikol, and Tyr v2
- Keeps review and execution follow-up in PM state and comments
- Excludes `pm_session`, Skadi, session spawning, and session messaging

### Valdr Sovereign

Full orchestration tier.

- Adds `pm_session`
- Adds Skadi
- Adds session-aware reviewer, executor, and orchestrator overrides
- Supports spawning, session messaging, and worktree-aware orchestration

## Agent Roster

### Orchestrators
| Agent | Handle | Role | Tier |
|-------|--------|------|------|
| Gunnar | `gunnar` | PM navigation — find projects, tasks, sprints, agents | Vanguard, Sovereign |
| Nikol | `nikol` | Registry management — create agents, author prompts, link capabilities | Vanguard, Sovereign |
| Skadi | `skadi` | Sprint orchestration — planning, staffing, review routing, launch readiness | Sovereign |

### Specialists
| Agent | Handle | Role | Tier |
|-------|--------|------|------|
| Sigrid | `sigrid` | Code review gatekeeper — 7-dimension quality scoring | Raider, Vanguard, Sovereign |
| Freya | `freya` | Feature planner — turns ideas into structured plans with tasks | Raider, Vanguard, Sovereign |
| Tyr v2 | `tyr-v2` | Session auditor — evaluates agent execution with evidence-backed scores | Vanguard, Sovereign |

### Domain Agents
| Agent | Domain |
|-------|--------|
| Go Agent | Go modules, SOLID design, testing |
| Java Agent | Maven/Gradle, hexagonal architecture, JUnit |
| Python Agent | pip/poetry/uv, typing, protocols, pytest |
| Rust Agent | Cargo, ownership, traits, property testing |

### Utility Agents
| Agent | Domain |
|-------|--------|
| CI/CD Agent | GitHub Actions, pipelines, deployment, quality gates |
| Security Agent | Vulnerability scanning, secrets, compliance, dependency audits |
| Infrastructure Agent | Terraform, containers, cloud, networking, observability |
| Refactor Scout | Code health discovery and refactoring guidance |
| Hugo Docs Agent | Documentation drift audit and patch application |
| Dependency Audit Agent | Multi-ecosystem vulnerability and unused dependency detection |

## Platform Support

| Platform | Skills | Install Location |
|----------|--------|------------------|
| **Claude Code** | Native folders | `~/.claude/skills/` |
| **Codex** | Native folders | `~/.agents/skills/` |
| **Gemini CLI** | Native folders | `~/.gemini/skills/` |

## Building & Syncing

### Make Targets

| Target | Description |
|--------|-------------|
| `sync-all` | Sync skills to all global locations |
| `sync-skills-all` | Alias for `sync-all` |
| `sync-skills` | Sync skills to project-local directories |
| `sync-skills-claude` | Sync skills to `~/.claude/skills/` |
| `sync-skills-codex` | Alias for `sync-skills-agent` (Codex now uses `~/.agents/`) |
| `sync-skills-gemini` | Sync skills to `~/.gemini/skills/` |
| `sync-skills-agent` | Sync skills to `~/.agents/skills/` |
| `validate-valdr-pack` | Stage and validate all three Valdr tier pack roots |
| `test-scripts` | Run the repository script test suite |
| `ci-validate` | Run pack validation plus script tests |
| `generate-valdr-pack` | Run the generic pack archive generator |
| `build-valdr-raider` | Build the Raider tier archive |
| `build-valdr-vanguard` | Build the Vanguard tier archive |
| `build-valdr-sovereign` | Build the Sovereign tier archive |
| `build-valdr-all` | Build all three tier archives |

### Generating Pack Archives

Build importable `.valdr-pack.tar.gz` archives for Valdr import:

```bash
# Build the self-contained Valdr tier variants
node scripts/build-valdr-tier.mjs raider
node scripts/build-valdr-tier.mjs vanguard
node scripts/build-valdr-tier.mjs sovereign

# Or use the generic generator on a concrete pack directory
node scripts/generate-valdr-pack.mjs build/staging/vanguard/valdr

# Write to a custom output path
node scripts/build-valdr-tier.mjs sovereign --output build/my-pack.valdr-pack.tar.gz
```

Default tier outputs are:

- `build/valdr-raider.valdr-pack.tar.gz`
- `build/valdr-vanguard.valdr-pack.tar.gz`
- `build/valdr-sovereign.valdr-pack.tar.gz`

Archives are directly consumable by Valdr's preflight/commit import flow.

### Release Version

The pack-set release version lives in the root [`VERSION`](VERSION) file.

```bash
# Bump the checked-in release version
node scripts/bump-version.mjs patch
node scripts/bump-version.mjs minor
node scripts/bump-version.mjs major
node scripts/bump-version.mjs 1.2.0
```

All three tier archives share that version, and the release workflow publishes them under a matching GitHub Release tag such as `v0.1.0`.

### CI Automation

- Pull requests and non-`main` branch pushes run pack validation and script tests through `.github/workflows/validate.yml`
- Pushes to `main` only trigger `.github/workflows/release.yml` when release-affecting files change: `skills/`, `commands/`, `valdr-packs/`, `scripts/`, `VERSION`, or the release workflow itself
- When it runs, the release workflow validates the repo, builds all three tier archives, and publishes them to a GitHub Release

For local verification:

```bash
make ci-validate
```

## Creating Your Own Pack

### Pack Manifest (`pack.yaml`)

```yaml
schemaVersion: 1.0
pack: my-team
name: My Team Pack
version: 0.1.0
description: Team-specific agents and capabilities.
includes:
  - path: agents
    description: Team agents and role-specific capabilities
  - path: shared
    description: Shared prompts and reusable capability fragments
```

### Agent Definition (`.agent.yaml`)

```yaml
schemaVersion: 1.0
agent:
  handle: my-reviewer
  name: My Team Reviewer
  kind: bot
  defaultRole: reviewer
capabilities:
  - key: myteam.reviewer.system
    role: core
  - key: myteam.reviewer.workflow
    role: workflow
    hot-load: true
prompts:
  - key: myteam-review-guide
    role: guide
    hot-load: true
```

### Capabilities & Prompts (Markdown)

```markdown
<!--<capability id="myteam.reviewer.system" pack="my-team" role="core">-->
# My Team Reviewer

You are a code reviewer that enforces our team conventions...
<!--</capability>-->
```

### Authoring Workflow

1. **Choose source directory** — `~/.valdr/valdr-packs/<pack-name>` (user-wide) or `./.valdr/valdr-packs/<pack-name>` (repo-local)
2. **Create `pack.yaml`** — Define identity, version, and included directories
3. **Define agents** — `.agent.yaml` with handle, kind, and capability bindings (exactly one `role: core` required)
4. **Author capabilities** — Markdown with `<!--<capability>-->` tags and role classification
5. **Validate** — `valdr validate-pack <pack-dir>`
6. **Generate archive** — `valdr generate-valdr-pack <pack-dir> --output <path>`
7. **Import via Valdr UI** — Upload archive, review preflight plan, commit

### Capability Roles

| Role | Priority | Purpose |
|------|----------|---------|
| `core` | 0 | Foundational system-level behavior (exactly one required per agent) |
| `workflow` | 1 | Operational instructions and execution patterns |
| `constraints` | 2 | Rules, policies, and behavioral boundaries |
| `context` | 3 | Background information and domain knowledge |
| `validation` | 4 | Verification steps and completion criteria |
| `integration` | 5 | External system interfaces and API behaviors |

## Specifications

Detailed format specifications live in `valdr-packs/`:

| Spec | Describes |
|------|-----------|
| [`PACK-SPEC.md`](valdr-packs/PACK-SPEC.md) | `pack.yaml` format, required/optional fields, discovery rules |
| [`AGENT-SPEC.md`](valdr-packs/AGENT-SPEC.md) | `.agent.yaml` format, capability bindings, prompt roles |
| [`PROMPT-SPEC.md`](valdr-packs/PROMPT-SPEC.md) | Prompt markdown format, HTML comment annotation syntax |
| [`TAG-MAP.md`](valdr-packs/TAG-MAP.md) | Structured tagging conventions for scoring, versioning, and traceability |

## Safety

All sync operations **only affect `valdr-*` files**. Your custom commands and skills are never modified or deleted.

## Design Principles

1. **Single source of truth** — Write once in `commands/` or `skills/`, deploy everywhere
2. **Platform-native** — Use each platform's native format where supported
3. **Safe syncing** — Only touch `valdr-*` files, preserve user content
4. **Hot-load, don't bloat** — Skills load detailed docs on-demand via capabilities
5. **Composable** — Mix and match capabilities per agent
6. **Tiered access** — Scale from UI-only knowledge (Raider) to full automation (Sovereign)

## Requirements

- [Valdr](https://valdr.ai) with the Valdr PM MCP server enabled
- [Node.js](https://nodejs.org) (for `generate-valdr-pack.mjs`)
- GNU Make (for build/sync targets)

## Contributing

1. Fork this repository
2. Add commands to `commands/` or skills to `skills/`
3. Run `make sync-skills`
4. Test with `make sync-all`
5. Submit a PR

## License

MIT
