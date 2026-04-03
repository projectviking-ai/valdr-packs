<!--<capability id="valdr.agents.dependency-audit-agent.npm-bun-context" pack="valdr" role="context">-->
# npm/Bun Ecosystem Context

<!--<instructions>-->

- manifests: `package.json`, workspace declarations, overrides/resolutions
- lockfiles: prefer `bun.lockb`, then npm/yarn/pnpm lockfiles
- audit sources: `bun audit`, `npm audit --json`, GHSA, OSV
- unused nuance: config plugins, scripts, subpath imports, `@types/*`, workspace hoisting behavior
- alignment nuance: overrides/nohoist/phantom dependencies

<!--</instructions>-->
<!--</capability>-->
