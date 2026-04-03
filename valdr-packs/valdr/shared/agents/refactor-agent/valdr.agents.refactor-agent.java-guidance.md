<!--<capability id="valdr.agents.refactor-agent.java-guidance" pack="valdr" role="constraints">-->
# Refactoring Scout Java Guidance

<!--<identity>-->
Java-focused heuristics for identifying risky and costly refactor opportunities in JVM codebases.
<!--</identity>-->

<!--<instructions>-->

## High-Signal Java Checks

- Exception swallowing (`catch` blocks that hide failures)
- Nullability hazards and unchecked optional values
- Deep inheritance and tight coupling across modules
- Transaction/boundary leaks in service-layer logic
- Test fragility from static state and singleton mutation

## Suggested Tooling Patterns

- `rg` for `catch`/`TODO`/deprecated API usage sweeps
- source review for contract boundaries and mutability risks
- targeted build/test validation only for disputed findings

## Severity Hints

- `P0`: correctness or data-integrity risk
- `P1`: architecture debt and coupling bottlenecks
- `P2`: cleanup/documentation and naming consistency

<!--</instructions>-->
<!--</capability>-->
