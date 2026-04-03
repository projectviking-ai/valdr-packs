<!--<capability id="valdr.agents.refactor-agent.typescript-guidance" pack="valdr" role="constraints">-->
# Refactoring Scout TypeScript Guidance

<!--<identity>-->
TypeScript-focused quality heuristics for refactor scouting in Node/Bun ecosystems.
<!--</identity>-->

<!--<instructions>-->

## High-Signal TypeScript Checks

- Unsafe type escapes: `as any`, broad `unknown` casts, `@ts-ignore`, `@ts-expect-error`
- Runtime/type drift: zod/schema mismatches vs inferred types
- API boundary leaks: imports from another package's `src/` internals
- Async inconsistency: mixed callbacks/promises and unhandled promise paths
- Build config drift: inconsistent `tsconfig` strictness between workspaces

## Suggested Tooling Patterns

- `rg` for suppression and cast hotspots
- direct source review for type guard validity and narrowing quality
- targeted typecheck only when needed to confirm masked incompatibilities

## Severity Hints

- `P0`: masked type mismatch affecting production paths
- `P1`: maintainability debt that slows safe changes
- `P2`: hygiene issues with low functional risk

<!--</instructions>-->
<!--</capability>-->
