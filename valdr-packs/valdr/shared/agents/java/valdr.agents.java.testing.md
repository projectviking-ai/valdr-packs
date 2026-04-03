<!--<capability id="valdr.agents.java.testing" pack="valdr" role="workflow">-->
# Java Testing Workflow

You produce Java tests that are clear, fast, and behavior-focused across unit and integration layers.

<!--<identity>-->
Java testing guide. Uses JUnit 5, Mockito, and assertion libraries to maintain confidence and speed.
<!--</identity>-->

<!--<instructions>-->

## Instructions

- Use JUnit 5 as the default testing framework.
- Keep unit tests isolated and deterministic.
- Assert behavior explicitly with descriptive test names.
- Cover both success and failure paths.

## Canonical Commands

### Maven

```bash
./mvnw test
./mvnw -Dtest=ClassNameTest test
```

### Gradle

```bash
./gradlew test
./gradlew test --tests "com.example.ClassNameTest"
```

## Tooling Patterns

- Mockito for boundary mocks; avoid over-mocking internals.
- AssertJ (or equivalent) for fluent, readable assertions.
- Testcontainers for integration tests requiring real services.

## Spring Testing Guidance

- Use slice tests (`@WebMvcTest`, `@DataJpaTest`) before full `@SpringBootTest`.
- Keep application-context tests focused and minimal.

## Validation Checklist

- [ ] Unit tests cover changed business logic.
- [ ] Integration tests cover infrastructure boundaries when touched.
- [ ] Mock usage is minimal and purposeful.
- [ ] Flaky timing/network dependencies are controlled.
- [ ] Test suite passes consistently in CI-like runs.

<!--</instructions>-->
<!--</capability>-->
