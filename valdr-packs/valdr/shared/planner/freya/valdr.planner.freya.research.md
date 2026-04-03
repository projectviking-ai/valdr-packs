<!--<capability id="valdr.planner.freya.research" pack="valdr" role="workflow">-->
# VMP Research Guide

This capability provides guidance for exploring codebases before drafting plans.

## CRITICAL: Research Before Planning

**DO NOT draft a plan without research.** Agents that skip research produce vague plans with wrong file paths, missing constraints, and broken assumptions.

## Research Workflow

### Step 1: Understand the Stack

Identify the project's technical foundation:

```
- Language(s): TypeScript, Python, Go, etc.
- Runtime: Node.js, Bun, Deno, etc.
- Framework(s): Next.js, Express, FastAPI, etc.
- Build system: npm, pnpm, cargo, make, etc.
- Test runner: vitest, jest, pytest, etc.
```

**How to discover:**
- Read `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`
- Check for config files: `tsconfig.json`, `vite.config.ts`, `.eslintrc`
- Look at CI/CD files: `.github/workflows/`, `Makefile`

### Step 2: Map the File Structure

Understand where code lives:

```
- Source code: src/, lib/, pkg/
- Tests: test/, __tests__/, *.test.ts
- Schemas: schema/, migrations/, db/
- Docs: docs/, README.md, ADRs/
- Config: config/, .env.example
```

**How to discover:**
- Use `ls` or glob patterns to explore directories
- Read existing similar files to understand patterns
- Check imports to trace dependencies

### Step 3: Find Related Code

Identify files that will be affected:

```
- Files to modify (source changes)
- Files to add (new functionality)
- Files to update (tests, docs, schemas)
- Files that import/depend on changed code
```

**How to discover:**
- Search for function/class names: `grep "functionName"`
- Search for file references: `grep "import.*filename"`
- Check test files for related tests

### Step 4: Capture Behavioral Contracts

Document behaviors that must not drift:

| Contract Type | What to Capture |
|---------------|-----------------|
| Error messages | Exact strings, punctuation, format |
| Validation rules | Required/optional fields, rejection behavior |
| Precedence | Which values win when multiple are provided |
| Ordering | Sort order, deterministic lists |
| Response shapes | Field names, types, nesting |
| Helper functions | Required utilities to call |

**How to discover:**
- Read existing tests for expected behaviors
- Check error handling code for message formats
- Look at API contracts and type definitions

### Step 5: Identify Entry Points

Find where the feature touches the system:

| Entry Point Type | Examples |
|------------------|----------|
| API handlers | `router.post()`, `@app.get()` |
| CLI commands | `program.command()`, `argparse` |
| UI routes | `pages/`, `app/`, React components |
| Background jobs | Workers, cron jobs, queues |
| Events | Event handlers, webhooks |

### Step 6: Document External Interfaces

Identify what external consumers will see:

- Public API endpoints (REST, GraphQL)
- CLI flags and output formats
- Configuration file formats
- Database schema changes
- Documentation updates needed

## Research Output Template

After research, you should be able to fill in:

```markdown
## Research Findings

**Stack:** <language> / <runtime> / <framework>

**Files to modify:**
- `path/to/file1.ts` - <what changes>
- `path/to/file2.ts` - <what changes>

**Files to add:**
- `path/to/new-file.ts` - <purpose>

**Test locations:**
- `path/to/tests/` - <test patterns>

**Behavioral contracts:**
- Error format: "<exact error string>"
- Required helper: `helperFunction()` in `path/to/utils.ts`

**External interfaces:**
- API: `POST /endpoint` - <changes>
- Docs: `docs/API.md` - <updates needed>
```

## Research Anti-Patterns

1. ❌ **Assuming file paths** — Always verify paths exist
2. ❌ **Skipping test discovery** — Tests reveal expected behavior
3. ❌ **Ignoring error messages** — Exact strings matter for compatibility
4. ❌ **Missing helper functions** — Don't reinvent existing utilities
5. ❌ **Forgetting docs** — API/tool changes need doc updates

## When Research is Complete

You're ready to draft when you can answer:

- [ ] What stack/framework is this?
- [ ] What files need to change?
- [ ] What tests exist and where?
- [ ] What error messages/formats must be preserved?
- [ ] What helper functions should be used?
- [ ] What external interfaces are affected?
- [ ] What docs need updating?

If you can't answer these, keep researching.

<!--</capability>-->
