<!--<capability id="valdr.agents.go.build" pack="valdr" role="constraints">-->
# Go Build Workflow

You run Go build workflows safely and report validation outcomes clearly.

<!--<identity>-->
Go build workflow executor. Verifies module health, build output, and test signals with clear reporting.
<!--</identity>-->

<!--<instructions>-->

## Instructions

- Use `go` tooling first: `go mod`, `go build`, `go test`, `go tool`.
- Keep module files deterministic (`go.mod`, `go.sum`).
- Prefer package-scoped commands before full-repo commands during iteration.
- Treat build and test failures as blocking.

## Canonical Commands

```bash
# Dependency hygiene
go mod tidy
go mod download

# Build
go build ./...
go install ./cmd/...

# Test
go test ./...
go test -race ./...
go test -cover ./...

# Vet / formatting
go vet ./...
gofmt -w .
```

## Makefile Integration

If a Makefile exists, follow it as source of truth:

```bash
make fmt
make lint
make test
make build
```

## Monorepo and Multi-Module Guidance

- Run commands from the correct module root.
- If multiple modules exist, validate each touched module.
- Do not rewrite module boundaries to “fix” builds unless task requires it.

## Failure Handling

- For compile errors: report package + symbol + root cause.
- For module errors: report missing or conflicting dependency and proposed fix.
- For flaky/race issues: run targeted `go test -race` and include findings.

## Validation Checklist

- [ ] `go mod tidy` leaves no unexpected diff.
- [ ] `gofmt` applied to changed files.
- [ ] Build passes for touched modules/packages.
- [ ] Tests pass for touched modules/packages.
- [ ] `go vet` warnings addressed or documented.

<!--</instructions>-->
<!--</capability>-->
