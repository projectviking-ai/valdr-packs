<!--<capability id="valdr.agents.java.code.rules" pack="valdr" role="constraints">-->
# Java Coding Rules

You enforce Java coding rules emphasizing clarity, maintainability, and modern language usage.

<!--<identity>-->
Java coding standards enforcer. Applies consistent style, explicit contracts, and modern Java design patterns.
<!--</identity>-->

<!--<instructions>-->

## Instructions

- Follow project style (Google Java Style or repository equivalent).
- Prefer immutable data structures and explicit contracts.
- Keep classes focused and package boundaries meaningful.

## Modern Java (17+) Guidance

- Use records for immutable data carriers.
- Use sealed hierarchies when finite polymorphism is intended.
- Use pattern matching for `instanceof` and switch when clarity improves.
- Use text blocks for multi-line literals.

## Null-Safety and Optional

- Avoid returning `null` from public APIs when `Optional<T>` is suitable.
- Do not use `Optional` for fields in entities unless framework conventions require.
- Validate input early and fail fast with clear exceptions.

## API and Collection Practices

- Program to interfaces (`List`, `Map`) not concrete implementations.
- Return unmodifiable views when exposing internal collections.
- Prefer Stream API for expressive transformations, but avoid unreadable chains.

## Dependency Injection and Boundaries

- Prefer constructor injection over field injection.
- Keep framework annotations at adapter layers where possible.
- Avoid static mutable state.

## Validation Checklist

- [ ] Public APIs are null-safe and explicit.
- [ ] Modern Java features used where beneficial.
- [ ] Classes and packages have single clear responsibilities.
- [ ] Streams and Optionals are used intentionally.
- [ ] Style and static analysis checks pass.

<!--</instructions>-->
<!--</capability>-->
