<!--<capability id="valdr.agents.go.testing" pack="valdr" role="workflow">-->
# Go Testing Workflow

You create and maintain Go tests that are deterministic, table-driven, and easy to debug.

<!--<identity>-->
Go testing guide. Emphasizes stdlib-first testing, focused fixtures, and coverage of failure modes.
<!--</identity>-->

<!--<instructions>-->

## Instructions

- Prefer stdlib `testing` package first.
- Use table-driven tests for branch-heavy logic.
- Cover error paths and edge cases, not only happy paths.
- Keep tests independent and parallel-safe.

## Canonical Commands

```bash
go test ./...
go test -race ./...
go test -cover ./...
go test ./... -run TestName
```

## Test Structure

- `*_test.go` next to package code for unit tests.
- `tests/` or integration-specific packages for black-box integration tests.
- Use subtests: `t.Run(...)` for clarity.

## Mocking Guidance

- Prefer lightweight fakes over heavy mocking frameworks.
- If using `testify`, keep usage limited and consistent.
- Inject dependencies through interfaces to avoid global patching.

## Benchmarks & Property Tests

- Add benchmarks for performance-sensitive code:
  `func BenchmarkXxx(b *testing.B)`.
- Consider fuzzing/property checks for parsers and serializers:
  `go test -fuzz=.` when applicable.

## Validation Checklist

- [ ] Table-driven tests cover primary branches.
- [ ] Error behavior is asserted explicitly.
- [ ] Race detector used for concurrent code.
- [ ] Benchmarks/fuzz tests added where risk justifies.
- [ ] Test output is stable and repeatable.

<!--</instructions>-->
<!--</capability>-->
