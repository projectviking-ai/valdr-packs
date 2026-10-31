# valdr-packs

Distributable agent packs and skills for [Valdr](https://valdr.ai
) — the control plane for AI agents. Write once, deploy to Claude Code, Codex, and Gemini CLI.

Valdr packs are portable, self-describing bundles of agents, prompts, and capabilities. Import one and get a complete roster of agents with their capabilities, orchestration wiring, and domain knowledge ready to work.

## Quick Start

Download the Sovereign, Workflow, and Tools packs from the same release. Use Valdr 0.4.1 for this pack release, including the planning team's structured Questions gates and the pull-request follow-up automation; the CLI used to build and validate these packs is pinned separately in [`VALDR_WORKFLOW_CLI_VERSION`](VALDR_WORKFLOW_CLI_VERSION).

| Component | Release asset |
| --- | --- |
| Valdr CLI | `valdr-v<cli-version>-macos-arm64.tar.gz` plus its `.sha256` |
| Valdr Sovereign pack | `valdr-sovereign.valdr-pack.tar.gz` |
| Valdr Workflow pack | `valdr-workflow.valdr-pack.tar.gz` |
| Valdr Tools pack | `valdr-tools.valdr-pack.tar.gz` |

1. Download Valdr 0.4.1 from [Valdr releases](https://github.com/projectviking-ai/valdr-releases/releases). For building packs from this checkout and validating them, use the version in [`VALDR_WORKFLOW_CLI_VERSION`](VALDR_WORKFLOW_CLI_VERSION) at your chosen pack release tag.
2. Download `valdr-sovereign.valdr-pack.tar.gz` from your chosen release on [Valdr Packs releases](https://github.com/projectviking-ai/valdr-packs/releases).
3. Download `valdr-workflow.valdr-pack.tar.gz` from that same release.
4. In the Valdr UI pack import flow, preflight and import the Sovereign pack first, then the Workflow and Tools packs. Review the preflight plan before each commit. If a prior version is installed, use the import plan's update/replace operations; do not delete an active pack or interrupt frozen runs.
5. Configure provider presets, register eligible bot agents, and attach a Git repository project before starting a workflow.

The Workflow pack intentionally fails closed when it cannot identify an eligible executor, reviewer, or provider preset. Use `pm_provider` with `action: list_presets` to find provider preset keys and `pm_agent` with `action: list` to inspect eligible bot handles. Router and sizing presets must honour strict JSON output; implementation, review, planning, and pull-request writer presets also need repository access where their input descriptions say so. Full setup and entrypoint details are in the [Workflow pack guide](valdr-packs/valdr-workflow/README.md).

Valdr 0.3.4 supports Claude, Codex, OpenCode, and Ollama sessions. Direct Gemini, OpenAI API, and Anthropic API presets no longer launch; replace affected agent/workflow selections with registered OpenCode presets. Configure model providers and authentication in OpenCode; migration is not automatic. See the [OpenCode provider guide](https://valdr.ai/valdr/docs/valdr-provider-packs/overview/#opencode).

Session input defaults to queued follow-ups. `delivery: "steer"` redirects an active supported Codex/Claude ad-hoc turn; workflow-owned input remains queued. External Gemini CLI skill installation remains supported.

Pull-request workflows default `remoteName` to `origin`, preserve the actual checked-out base branch when no base is supplied, and propose draft pull requests by default. Supply another remote name explicitly when the project uses a different Git remote. Proposal publication always requires the named human operator's approval.

### Install skills as a plugin

Claude Code:

```text
/plugin marketplace add projectviking-ai/valdr-packs
/plugin install valdr@valdr-packs
```

Codex:

```bash
codex plugin marketplace add projectviking-ai/valdr-packs
codex plugin add valdr@valdr-packs
```

Start a new session or chat after installation. Both plugins include all seven public skills and use your existing Valdr MCP connection. They do not import Valdr packs or configure credentials. See the [skills installation guide](plugins/valdr/README.md#installation) for prerequisites and migration from standalone copies.

### Source checkout skills

From a source checkout, install the repository's standalone skills with:

```bash
# Install skills to all supported platforms
make sync-all

# Or install to a specific platform
make sync-skills-claude    # ~/.claude/skills/
make sync-skills-codex     # ~/.agents/skills/
make sync-skills-gemini    # ~/.gemini/skills/
make sync-skills-agent     # ~/.agents/skills/
```

## Evaluating agents

To test agents and orchestrators from this checkout, use the
[Valdr evaluation harness](evals/README.md). It includes workflow-authoring and
task-repair suites with fixture checks through the installed `valdr` CLI.
Live runs use the public Codex CLI and scoped Valdr MCP access. Run from this
repository root with Bun to reuse `.env` credentials and the existing default
Valdr license. Discovery, previews and saved reports work offline. Start with:

```sh
bun evals/run.mjs list task-repair
bun evals/run.mjs doctor task-repair
bun evals/run.mjs run task-repair --scenario 01_exact_replacement --dry-run
# After a run, read the saved result or compare two compatible trials:
# bun evals/run.mjs runs
# bun evals/run.mjs prune --older-than-days 60 --keep 10  # Preview only
# bun evals/run.mjs report .valdr-evals/<run-directory>
# bun evals/run.mjs compare .valdr-evals/<baseline> .valdr-evals/<candidate>
```

## Repository Structure

```
valdr-packs/
├── plugins/valdr/             # Public plugin and canonical skill sources
│   ├── skills/
│   │   ├── valdr-agent/       # Load any registered agent persona by handle
│   │   ├── valdr-auditor/     # Session auditing & scoring
│   │   ├── valdr-executor/    # Task execution & lifecycle
│   │   ├── valdr-orchestrator/ # Unified orchestrator routing
│   │   ├── valdr-planner/     # VMP feature planning
│   │   ├── valdr-reviewer/    # Code review & quality gates
│   │   └── valdr-workflow-tools/ # Workflow-tool authoring
│   └── README.md             # Skill index and installation notes
│
├── scripts/                   # Build & packaging tooling
│   ├── build-valdr-tier.mjs   # Assemble Raider/Vanguard/Sovereign from source layers
│   ├── generate-valdr-pack.mjs # Build importable .valdr-pack.tar.gz archives
│   └── lib/runtime.mjs        # Shared runtime (normalization, hashing, validation)
├── evals/                     # Agent and orchestrator evaluation harness
│   ├── run.mjs                # Single CLI for all evaluation suites
│   ├── cli/                   # Commands, configuration, and prerequisite checks
│   ├── core/                  # Isolated Valdr execution, sessions, and evidence
│   ├── reporting/             # Saved-result summaries, comparisons, and HTML reports
│   ├── retention/             # Evidence inventory and safe retention
│   ├── suites/                # Workflow authoring and task repair
│   ├── tests/                 # Core, suite, and binary integration tests
│   └── docs/                  # Usage details and suite authoring contract
├── Makefile                   # Skill sync, builds, and validation targets
│
└── valdr-packs/               # Agent pack definitions
    ├── PACK-SPEC.md           # pack.yaml format specification
    ├── AGENT-SPEC.md          # .agent.yaml format specification
    ├── PROMPT-SPEC.md         # Prompt markdown specification
    ├── TAG-MAP.md             # Structured tagging conventions
    ├── valdr/                 # Layered Valdr pack source
    │   ├── shared/            # Files common to all tiers
    │   ├── raider/            # Raider-only overrides
    │   ├── vanguard/          # Vanguard-only overrides
    │   └── sovereign/         # Sovereign-only overrides
    └── valdr-workflow/        # Independently versioned workflow pack
```

## What's Inside

### Skills

Skills teach agents specialized knowledge. They activate automatically when the model detects relevance — no manual invocation needed.

| Skill | Trigger | Purpose |
|-------|---------|---------|
| **valdr-agent** | User asks to load or adopt a registered agent persona | Load the agent prompt by handle and follow its persona |
| **valdr-executor** | User asks to execute, run, or complete a task | Fetch tasks, execute work, update checklists, change status |
| **valdr-planner** | Work needs structure, requirements, or stakeholder visibility | VMP structured planning with specs and task generation |
| **valdr-reviewer** | User asks to review a task, record review scores, or verify completion | Code review workflow, lightweight review scoring, verification gate |
| **valdr-auditor** | User asks to audit a session or evaluate agent work | Session evaluation, audit score runs, evidence-backed verdicts |
| **valdr-orchestrator** | User needs PM navigation, registry operations, or sprint orchestration | Route work through Gunnar, Nikol, or Skadi and follow the selected orchestrator prompt |
| **valdr-workflow-tools** | User authors or updates a workflow tool | Build typed CLI and code tools with explicit execution contracts |

Load a registered persona with `/valdr:valdr-agent sigrid` in the Claude Code plugin, or ask Codex to `Use $valdr:valdr-agent with sigrid`. Standalone skills use `/valdr-agent sigrid` in Claude Code or `$valdr-agent` in Codex.

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

### Valdr Workflow

An independently versioned companion to Sovereign that adds workflow definitions, workflow-owned agents, and a workflow-owned user tool. It covers task readiness, staffing, implementation and review, sprint execution, plan generation, operator-approved pull-request publication, and follow-up on published pull requests until they are merged or closed (see [PR follow-up](valdr-packs/valdr-workflow/README.md#pr-follow-up)). Import Sovereign first so the Workflow agents can resolve the core capabilities they reference.

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
| **Claude Code** | `valdr` plugin or native folders | Plugin cache or `~/.claude/skills/` |
| **Codex** | `valdr` plugin or native folders | Plugin cache or `~/.agents/skills/` |
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
| `test-scripts` | Run the repository script and evaluation test suites |
| `test-evals` | Run agent evaluation harness tests without a model |
| `check-evals` | Check installed CLI prerequisites and both fixture suites without model calls |
| `test-evals-integration` | Check workflow execution and task repair/refusal with the installed `valdr` CLI, without model calls |
| `check-evals-readiness` | Run offline tests, pinned-pack validation and installed `valdr` CLI checks; see [Readiness](evals/docs/readiness.md) |
| `ci-validate` | Run pack validation, script tests and evaluation harness tests |
| `generate-valdr-pack` | Run the generic pack archive generator |
| `build-valdr-raider` | Build the Raider tier archive |
| `build-valdr-vanguard` | Build the Vanguard tier archive |
| `build-valdr-sovereign` | Build the Sovereign tier archive |
| `build-valdr-all` | Build Raider, Vanguard, Sovereign, Workflow, and Tools archives with the pinned CLI |

Use `VALDR_BIN=/path/to/valdr` to select the installed CLI. For
`check-evals-readiness`, set `PACK_VALDR_BIN=/path/to/pinned/valdr` when pack
validation uses a different executable; it defaults to `VALDR_BIN`.

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
node scripts/bump-version.mjs "<version>"
```

For any pack update, including Workflow or Tools changes, bump `VERSION` and merge to `main`. GitHub Actions validates and builds all five archives, creates the matching tag, and publishes one GitHub Release containing Raider, Vanguard, Sovereign, Workflow, and Tools. No manual tag creation, build, or release trigger is needed. An existing release tag is rejected; use a new version for each release.

The three tier archives use the repository version internally. The Workflow and Tools archives retain their pack versions from their own `pack.yaml` files; they are distributed in the same repository release.

### CI Automation

- Pull requests run pack validation, script tests and offline evaluation harness tests through `.github/workflows/validate.yml`. The full language-starter suite remains a local check.
- Pushes to `main` trigger `.github/workflows/release.yml` for pack sources, shared build scripts, `VERSION`, `VALDR_WORKFLOW_CLI_VERSION`, `Makefile`, or the release workflow itself. It verifies the pinned Valdr CLI, validates the repository, builds all five archives, and publishes them to one `v<version>` GitHub Release for the pushed commit.

For local verification:

```bash
make ci-validate
make test-user-workflow-tools
```

## User workflow tools

The standalone [Valdr Tools pack](valdr-packs/valdr-tools/README.md) includes language starters, CLI adapters (`gh`, `aws`, `gcloud`, `acli`), and Maven builds. Build once and import the archive into each Valdr installation. Manage installed tools in **Workflows → Tools**; import/export remains in **Settings → Valdr Packs**. Each tool has a named Builder entry with its manifest icon. New steps use the latest installed revision; existing pins stay unchanged. Workflows select the working directory and execute tools on the host, like Command steps. Import does not execute code, install dependencies, or authenticate CLIs.

With a compatible Valdr CLI installed, run from this checkout:

```sh
make validate-user-workflow-tools
make test-user-workflow-tools
make build-valdr-tools
```

See the [pack README](valdr-packs/valdr-tools/README.md) for runtime prerequisites and the [authoring skill](plugins/valdr/skills/valdr-workflow-tools/SKILL.md) for the process contract, CLI discovery, and revision updates.

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

1. **Single source of truth** — Maintain skills in `plugins/valdr/skills/`, deploy everywhere
2. **Platform-native** — Use each platform's native format where supported
3. **Safe syncing** — Only touch `valdr-*` files, preserve user content
4. **Hot-load, don't bloat** — Skills load detailed docs on-demand via capabilities
5. **Composable** — Mix and match capabilities per agent
6. **Tiered access** — Scale from UI-only knowledge (Raider) to full automation (Sovereign)

## Requirements

- [Valdr](https://valdr.ai) 0.4.1 with the Valdr PM MCP server enabled; source builds and CLI pack validation use the version pinned for your pack release
- Valdr Sovereign pack imported before the Workflow pack from the same release
- A configured project repository, provider presets, eligible bot agents, and a human operator handle for Workflow entrypoints
- Node.js and the [GitHub CLI](https://cli.github.com) (`gh`), authenticated, on the Valdr host for pull-request follow-up only: its user tool runs under `node` on the host. See [PR follow-up](valdr-packs/valdr-workflow/README.md#pr-follow-up) for the token it needs
- [Node.js](https://nodejs.org) and GNU Make only when building or syncing from a source checkout

## Contributing

1. Fork this repository
2. Add skills to `plugins/valdr/skills/`
3. Run `make sync-skills`
4. Test with `make sync-all`
5. Submit a PR

## License

[MIT](LICENSE)
