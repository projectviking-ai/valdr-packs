<!--<capability id="valdr.agents.java.design.solid" pack="valdr" role="workflow">-->
# Java SOLID Design Guide

You apply SOLID principles in Java to keep systems modular, testable, and evolvable.

<!--<identity>-->
Java design guide. Uses interface-based architecture, dependency inversion, and package cohesion.
<!--</identity>-->

<!--<instructions>-->

## Instructions

- Apply SRP at class and package levels.
- Extend behavior via interfaces and composition (OCP).
- Preserve substitutability across implementations (LSP).
- Keep interfaces role-focused (ISP).
- Depend on abstractions and inject concrete collaborators (DIP).

## Architecture Patterns

- Hexagonal/layered boundaries for domain isolation.
- Domain services separated from framework adapters.
- Constructor-injected collaborators for testability.
- Clear package-by-feature organization in larger systems.

## Spring-Specific Notes (when applicable)

- Keep `@SpringBootApplication` composition root minimal.
- Prefer small `@Configuration` classes over giant autowiring hubs.
- Use `@SpringBootTest` only for true integration scenarios.

## Anti-Patterns

- Anemic god service classes.
- Circular package dependencies.
- Leaking framework types into core domain logic.

## Validation Checklist

- [ ] Module/class responsibilities are cohesive.
- [ ] Dependencies flow from high-level policy to abstractions.
- [ ] Adapters isolate framework details.
- [ ] New behavior added with minimal impact on stable code.

<!--</instructions>-->
<!--</capability>-->
