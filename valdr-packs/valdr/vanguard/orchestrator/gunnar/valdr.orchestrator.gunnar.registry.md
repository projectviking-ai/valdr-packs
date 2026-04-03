<!--<capability id="valdr.orchestrator.gunnar.registry" pack="valdr" role="workflow">-->
# Registry Workflow

<!--<identity>-->
Agent, prompt, and capability registry exploration and evaluation. Use this workflow when a user needs to assess registry health, evaluate agent configurations, or understand capability coverage.
<!--</identity>-->

<!--<instructions>-->

## When This Workflow Applies

This workflow is for **registry evaluation and health assessment**. Simple registry lookups (list agents, get an agent by handle) are handled directly from the system prompt.

**Use this workflow when:**
- User asks if an agent is properly configured
- User wants to assess registry completeness or find gaps
- User asks about capability coverage across agents
- User wants to audit prompts, orphaned capabilities, or unused content

## Registry Data Model

```
Agent
├── capabilities[]  → linked (non-hot-load) capabilities
├── prompts[]       → linked prompts with useFor tags
├── notes[]         → summary, status, preferences
└── tags[]          → categorization

Capability
├── key            → unique identifier (domain.subdomain.name)
├── category       → grouping
└── promptId       → linked prompt content

Prompt
├── role           → system | guide | checklist | policy | context
├── content        → the prompt text
└── tags[]         → categorization
```

## Evaluation Workflows

### Agent Assessment

Evaluate whether an agent is properly configured.

1. `pm_agent { action: "get", handle }` → full agent record
2. Check against criteria:

| Check | What to Look For |
|-------|-----------------|
| Identity | `name` descriptive, `handle` consistent, `kind` correct |
| Role | `defaultRole` matches agent's purpose |
| Capabilities | Core capability linked, hot-load capabilities exist in registry but NOT linked |
| Tags | Reflect the agent's domain and role |

3. If capabilities reference prompts, spot-check that prompt content exists:
   `pm_capability { action: "prompt", key: "<capability-key>" }` → should return content

**Present:** Pass/fail per check, specific gaps, recommendations.

### Capability Coverage

Find what capabilities exist for a domain and who uses them.

1. `pm_capability { action: "list", search: "<domain>" }` → capabilities in domain
2. `pm_agent { action: "list", capabilityKeys: ["<key>"] }` → agents using each capability

**Present:** Coverage matrix — which agents have which capabilities, gaps.

### Registry Health Check

Audit the registry for structural issues. Run all three in parallel.

1. `pm_capability { action: "list" }` → look for capabilities with missing `promptId`
2. `pm_agent { action: "list" }` → look for agents with empty capabilities
3. `pm_prompt { action: "list" }` → cross-reference with capability `promptId` values to find orphans

**Present:** Orphaned capabilities, agents without capabilities, unused prompts, recommendations.

### Prompt Audit

Evaluate prompt quality for a specific agent or domain.

1. Identify prompts via agent or capability lookup
2. Load content: `pm_capability { action: "prompt", key }` or `pm_prompt { action: "get", key }`
3. Evaluate:

| Check | What to Look For |
|-------|-----------------|
| Role | Appropriate for content type (system vs guide vs checklist) |
| Structure | Uses capability/prompt tags correctly |
| Clarity | Instructions are unambiguous and actionable |
| Completeness | Covers the capability's scope without bloat |

**Present:** Quality assessment per prompt, specific issues, suggestions.

## Common Questions → Quick Patterns

| Question | Pattern |
|----------|---------|
| "What can agent X do?" | `pm_agent { action: "get", handle }` → list capabilities |
| "Who can do Y?" | `pm_agent { action: "list", capabilityKeys: ["<key>"] }` |
| "What prompts exist for Z?" | `pm_prompt { action: "list", search: "<domain>" }` |
| "Is agent X properly set up?" | Run Agent Assessment workflow above |

<!--</instructions>-->

<!--</capability>-->
