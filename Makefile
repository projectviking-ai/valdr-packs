SHELL := /bin/sh

VALDR_BIN ?= valdr
VALDR_WORKFLOW_CLI_VERSION := $(strip $(shell cat VALDR_WORKFLOW_CLI_VERSION))

SCRIPT_TESTS := node --test scripts/lib/version.test.mjs scripts/bump-version.test.mjs scripts/lib/validate-pack.test.mjs scripts/build-valdr-tier.test.mjs scripts/release-workflow.test.mjs

.PHONY: help sync-all sync-skills sync-skills-all sync-skills-agent sync-skills-claude sync-skills-codex sync-skills-gemini validate-valdr-pack check-valdr-workflow-cli validate-valdr-workflow test-scripts ci-validate generate-valdr-pack build-valdr-raider build-valdr-vanguard build-valdr-sovereign build-valdr-workflow build-valdr-all

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
	@echo "  test-scripts         Run the repository script test suite"
	@echo "  ci-validate          Run pack validation plus script tests"
	@echo "  generate-valdr-pack  Run the generic pack archive generator"
	@echo "  build-valdr-raider   Build the Raider valdr tier archive"
	@echo "  build-valdr-vanguard Build the Vanguard valdr tier archive"
	@echo "  build-valdr-sovereign Build the Sovereign valdr tier archive"
	@echo "  build-valdr-workflow Build the valdr-workflow pack archive with the pinned CLI"
	@echo "  build-valdr-all      Build all Valdr tier archives"

sync-all: sync-skills-agent sync-skills-claude sync-skills-codex sync-skills-gemini
	@echo ""
	@echo "All skills synced to global locations."

sync-skills-all: sync-all
	@# Alias for sync-all

sync-skills:
	@set -e; \
	mkdir -p .agents/skills .claude/skills .gemini/skills; \
	for dest in .agents/skills .claude/skills .gemini/skills; do \
		if ls -d "$$dest"/valdr-* >/dev/null 2>&1; then \
			rm -rf "$$dest"/valdr-*; \
		fi; \
	done
	@if ls -d skills/valdr-* >/dev/null 2>&1; then \
		rsync -a skills/valdr-* .agents/skills/; \
		rsync -a skills/valdr-* .claude/skills/; \
		rsync -a skills/valdr-* .gemini/skills/; \
	fi

sync-skills-agent:
	@set -e; \
	dest="$(HOME)/.agents/skills"; \
	mkdir -p "$$dest"; \
	if ls -d "$$dest"/valdr-* >/dev/null 2>&1; then \
		rm -rf "$$dest"/valdr-*; \
	fi; \
	if ls -d skills/valdr-* >/dev/null 2>&1; then \
		rsync -a skills/valdr-* "$$dest"/; \
	else \
		echo "No skills/valdr-* found; nothing to sync."; \
	fi

sync-skills-claude:
	@set -e; \
	dest="$(HOME)/.claude/skills"; \
	mkdir -p "$$dest"; \
	if ls -d "$$dest"/valdr-* >/dev/null 2>&1; then \
		rm -rf "$$dest"/valdr-*; \
	fi; \
	if ls -d skills/valdr-* >/dev/null 2>&1; then \
		rsync -a skills/valdr-* "$$dest"/; \
	else \
		echo "No skills/valdr-* found; nothing to sync."; \
	fi

sync-skills-codex: sync-skills-agent
	@# Codex now uses ~/.agents/skills/

sync-skills-gemini:
	@set -e; \
	dest="$(HOME)/.gemini/skills"; \
	mkdir -p "$$dest"; \
	if ls -d "$$dest"/valdr-* >/dev/null 2>&1; then \
		rm -rf "$$dest"/valdr-*; \
	fi; \
	if ls -d skills/valdr-* >/dev/null 2>&1; then \
		rsync -a skills/valdr-* "$$dest"/; \
	else \
		echo "No skills/valdr-* found; nothing to sync."; \
	fi

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
	@$(SCRIPT_TESTS)

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

build-valdr-all: build-valdr-raider build-valdr-vanguard build-valdr-sovereign
