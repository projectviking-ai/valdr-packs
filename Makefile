SHELL := /bin/sh

VALDR_BIN ?= valdr
PACK_VALDR_BIN ?= $(VALDR_BIN)
VALDR_WORKFLOW_CLI_VERSION := $(strip $(shell cat VALDR_WORKFLOW_CLI_VERSION))

SCRIPT_TESTS := node --test scripts/lib/version.test.mjs scripts/bump-version.test.mjs scripts/lib/validate-pack.test.mjs scripts/build-valdr-tier.test.mjs scripts/release-workflow.test.mjs scripts/user-workflow-cli-tools.test.mjs scripts/user-workflow-maven.test.mjs scripts/discover-cli.test.mjs scripts/sync-skills.test.mjs scripts/human-gate-reference.test.mjs

.PHONY: test-evals-integration check-evals-readiness test-evals check-evals validate-user-workflow-tools build-valdr-tools test-user-workflow-tools test-decision-tools help sync-all sync-skills sync-skills-all sync-skills-agent sync-skills-claude sync-skills-codex sync-skills-gemini validate-valdr-pack check-valdr-workflow-cli validate-valdr-workflow test-scripts ci-validate generate-valdr-pack build-valdr-raider build-valdr-vanguard build-valdr-sovereign build-valdr-workflow build-valdr-all

help:
	@echo "Targets:"
	@echo "  sync-all             Sync skills to all global destinations"
	@echo "  sync-skills          Sync skills into project-local directories"
	@echo "  sync-skills-all      Alias for sync-all"
	@echo "  sync-skills-agent    Sync skills to ~/.agents/skills/"
	@echo "  sync-skills-claude   Sync skills to ~/.claude/skills/"
	@echo "  sync-skills-codex    Sync skills to ~/.agents/skills/ (alias for sync-skills-agent)"
	@echo "  sync-skills-gemini   Sync skills to ~/.gemini/skills/"
	@echo "  validate-valdr-pack  Stage and validate the Raider/Vanguard/Sovereign pack roots"
	@echo "  check-valdr-workflow-cli Verify the pinned Valdr CLI version"
	@echo "  validate-valdr-workflow Validate the valdr-workflow pack with the pinned CLI"
	@echo "  test-scripts         Run the repository script and evaluation test suites"
	@echo "  test-evals           Test the agent/orchestrator evaluation harness"
	@echo "  test-evals-integration Run workflow and task-repair checks with the installed Valdr CLI (no model calls)"
	@echo "  check-evals-readiness Run offline tests, pinned-pack validation and installed Valdr CLI checks"
	@echo "  check-evals          Check installed CLI prerequisites and both fixture suites (no model calls)"
	@echo "  ci-validate          Run pack validation, script tests and evaluation harness tests"
	@echo "  generate-valdr-pack  Run the generic pack archive generator"
	@echo "  build-valdr-raider   Build the Raider valdr tier archive"
	@echo "  build-valdr-vanguard Build the Vanguard valdr tier archive"
	@echo "  build-valdr-sovereign Build the Sovereign valdr tier archive"
	@echo "  build-valdr-workflow Build the valdr-workflow pack archive with the pinned CLI"
	@echo "  validate-user-workflow-tools Validate tools with the installed Valdr CLI"
	@echo "  build-valdr-tools    Build the standalone, deterministic user-tools archive"
	@echo "  test-user-workflow-tools Test starters and pack validation"
	@echo "  test-decision-tools Build the Tools archive and run credential-free decision tests"
	@echo "  build-valdr-all      Build Raider, Vanguard, Sovereign, Workflow, and Tools archives"
	@echo ""
	@echo "Variables:"
	@echo "  VALDR_BIN           Installed Valdr CLI executable (default: valdr)"
	@echo "  PACK_VALDR_BIN      Pinned CLI for pack checks in check-evals-readiness (default: VALDR_BIN)"

sync-all: sync-skills-agent sync-skills-claude sync-skills-codex sync-skills-gemini
	@echo ""
	@echo "All skills synced to global locations."

sync-skills-all: sync-all
	@# Alias for sync-all

sync-skills:
	@set -e; \
	for dest in .agents/skills .claude/skills .gemini/skills; do \
		mkdir -p "$$dest"; \
		for source in skills/valdr-*; do \
			[ -d "$$source" ] || continue; \
			rsync -a --delete "$$source/" "$$dest/$${source##*/}/"; \
		done; \
	done

sync-skills-agent:
	@set -e; \
	dest="$(HOME)/.agents/skills"; \
	mkdir -p "$$dest"; \
	for source in skills/valdr-*; do \
		[ -d "$$source" ] || continue; \
		rsync -a --delete "$$source/" "$$dest/$${source##*/}/"; \
	done

sync-skills-claude:
	@set -e; \
	dest="$(HOME)/.claude/skills"; \
	mkdir -p "$$dest"; \
	for source in skills/valdr-*; do \
		[ -d "$$source" ] || continue; \
		rsync -a --delete "$$source/" "$$dest/$${source##*/}/"; \
	done

sync-skills-codex: sync-skills-agent
	@# Codex now uses ~/.agents/skills/

sync-skills-gemini:
	@set -e; \
	dest="$(HOME)/.gemini/skills"; \
	mkdir -p "$$dest"; \
	for source in skills/valdr-*; do \
		[ -d "$$source" ] || continue; \
		rsync -a --delete "$$source/" "$$dest/$${source##*/}/"; \
	done

validate-valdr-pack:
	@node scripts/validate-valdr-pack.mjs

check-valdr-workflow-cli:
	@actual="$$($(VALDR_BIN) version)" || exit $$?; \
	actual_version="$$(printf '%s\n' "$$actual" | sed -n 's/^valdr \([^ (]*\).*$$/\1/p')"; \
	if [ "$$actual_version" != "$(VALDR_WORKFLOW_CLI_VERSION)" ]; then \
		echo "Expected Valdr CLI $(VALDR_WORKFLOW_CLI_VERSION), got: $$actual" >&2; \
		exit 1; \
	fi

validate-valdr-workflow: check-valdr-workflow-cli
	@$(VALDR_BIN) validate-pack valdr-packs/valdr-workflow

test-scripts:
	@bun scripts/generate-user-workflow-cli-tools.mjs --check
	@$(SCRIPT_TESTS)
	@$(MAKE) test-evals

test-evals:
	@bun test --timeout 30000 evals/tests

check-evals:
	@bun evals/run.mjs doctor workflow-authoring --json --valdr-bin "$(VALDR_BIN)"
	@bun evals/run.mjs doctor task-repair --json --valdr-bin "$(VALDR_BIN)"

ci-validate: validate-valdr-pack test-scripts

generate-valdr-pack:
	@node scripts/generate-valdr-pack.mjs

build-valdr-raider:
	@node scripts/build-valdr-tier.mjs raider

build-valdr-vanguard:
	@node scripts/build-valdr-tier.mjs vanguard

build-valdr-sovereign:
	@node scripts/build-valdr-tier.mjs sovereign

build-valdr-workflow: validate-valdr-workflow
	@mkdir -p build
	@$(VALDR_BIN) generate-valdr-pack valdr-packs/valdr-workflow --output build/valdr-workflow.valdr-pack.tar.gz

build-valdr-all: build-valdr-raider build-valdr-vanguard build-valdr-sovereign build-valdr-workflow build-valdr-tools

validate-user-workflow-tools:
	@$(VALDR_BIN) validate-pack valdr-packs/valdr-tools

build-valdr-tools: validate-user-workflow-tools
	@mkdir -p build
	@$(VALDR_BIN) generate-valdr-pack valdr-packs/valdr-tools --output build/valdr-tools.valdr-pack.tar.gz --exported-at 0

test-user-workflow-tools: validate-user-workflow-tools
	@bun scripts/generate-user-workflow-cli-tools.mjs --check
	@VALDR_BIN="$(VALDR_BIN)" node --test scripts/user-workflow-tools.test.mjs scripts/user-workflow-cli-tools.test.mjs scripts/user-workflow-maven.test.mjs scripts/user-workflow-pack.test.mjs

test-decision-tools: build-valdr-tools
	@VALDR_BIN="$(VALDR_BIN)" VALDR_DECIDE_ISOLATED=0 node --test valdr-packs/valdr-tools/tests/decide/*.test.mjs

# Evaluations use the installed Valdr CLI; pack validation uses the exact release pin.
test-evals-integration:
	@bun evals/tests/integration/workflow-binary.mjs "$(VALDR_BIN)"
	@bun evals/tests/integration/task-repair-binary.mjs "$(VALDR_BIN)"
	@bun evals/tests/integration/author-scope.mjs

check-evals-readiness:
	@$(MAKE) ci-validate
	@$(MAKE) validate-valdr-workflow validate-user-workflow-tools VALDR_BIN="$(PACK_VALDR_BIN)"
	@$(MAKE) check-evals test-evals-integration VALDR_BIN="$(VALDR_BIN)"
