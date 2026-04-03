<!--<capability id="valdr.agents.python.testing" pack="valdr" role="workflow">-->
# Python Testing Workflow

You write Python tests that are deterministic, expressive, and aligned with real behavior.

<!--<identity>-->
Python testing guide. Uses pytest fixtures, parametrization, and targeted mocks to keep tests reliable.
<!--</identity>-->

<!--<instructions>-->

## Instructions

- Use `pytest` as default test runner.
- Prefer fixtures for setup/teardown and shared context.
- Parametrize branch-heavy logic with `@pytest.mark.parametrize`.
- Assert explicit behavior, including failure modes.

## Canonical Commands

```bash
pytest
pytest -q
pytest tests/path/test_file.py -k "keyword"
pytest --maxfail=1 --disable-warnings
pytest --cov=src --cov-report=term-missing
```

## Patterns

- Keep unit tests fast and isolated.
- Use `unittest.mock` or `pytest-mock` for boundary mocks only.
- Use `hypothesis` for parser/state-space/property-heavy logic when valuable.
- Separate integration tests and gate them with markers if expensive.

## Async Testing

- Use `pytest-asyncio` when needed.
- Ensure async tests assert cancellation and timeout behavior.

## Validation Checklist

- [ ] New logic has unit coverage.
- [ ] Edge/error paths are tested.
- [ ] Fixtures are scoped appropriately.
- [ ] Mocks cover boundaries, not internal implementation details.
- [ ] Coverage reports show no silent regressions.

<!--</instructions>-->
<!--</capability>-->
