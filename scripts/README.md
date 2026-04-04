# Valdr Packs Scripts

Build and packaging scripts for `valdr-packs`.

## Available Scripts

| Script | Description | Input | Output |
|--------|-------------|-------|--------|
| `bump-version.mjs` | Bump or set the repo release version stored in `VERSION` | `patch` / `minor` / `major` / explicit semver | updated `VERSION` |
| `build-valdr-tier.mjs` | Assemble a Valdr tier from layered source and invoke the generic archive generator | `valdr-packs/valdr/<layer>/` + tier config | `build/valdr-<tier>.valdr-pack.tar.gz` |
| `generate-valdr-pack.mjs` | Build an importable `.valdr-pack.tar.gz` from a concrete pack directory | `<pack-dir>/pack.yaml` + includes | `build/<pack>.valdr-pack.tar.gz` |
| `validate-valdr-pack.mjs` | Stage and validate the concrete Raider/Vanguard/Sovereign pack roots | optional tier names | console report + exit status |

## Version Source

The canonical release version for this repository lives in the root `VERSION` file. Scripts that need the release version should read it through `scripts/lib/version.mjs` rather than hardcoding values in multiple places.

## bump-version.mjs

Updates the root `VERSION` file using semantic version increments or an explicit version.

### Usage

```bash
node scripts/bump-version.mjs patch
node scripts/bump-version.mjs minor
node scripts/bump-version.mjs major
node scripts/bump-version.mjs 1.2.0
```

## build-valdr-tier.mjs

Builds one of the Valdr tier artifacts from the layered source tree at `valdr-packs/valdr/`.

### Usage

```bash
# Build the default tier outputs
node scripts/build-valdr-tier.mjs raider
node scripts/build-valdr-tier.mjs vanguard
node scripts/build-valdr-tier.mjs sovereign

# Write to a custom output path
node scripts/build-valdr-tier.mjs raider --output build/custom-raider.tar.gz

# Generate deterministic output for reproducible archives
node scripts/build-valdr-tier.mjs sovereign --exported-at 1730000000000
```

### Layering Model

- `raider` = `shared + raider`
- `vanguard` = `shared + raider + vanguard`
- `sovereign` = `shared + raider + vanguard + sovereign`

The wrapper materializes `build/staging/<tier>/valdr`, writes a generated `pack.yaml` with canonical `pack: "valdr"`, and then delegates to `generate-valdr-pack.mjs`.

## validate-valdr-pack.mjs

Stages and validates the concrete pack roots that this repository actually ships.

### Usage

```bash
# Validate all tiers
node scripts/validate-valdr-pack.mjs

# Validate specific tiers
node scripts/validate-valdr-pack.mjs raider
node scripts/validate-valdr-pack.mjs vanguard sovereign
```

### Notes

- Validation is self-contained in this repository and does not depend on the sibling `valdr` repository.
- Each tier is staged under `build/staging/<tier>/valdr` before validation.
- Warnings are reported, but only validation errors produce a non-zero exit code.

## generate-valdr-pack.mjs

Builds a compressed valdr-pack archive that matches Valdr import expectations.

### Usage

```bash
# Generate from the default valdr pack root
node scripts/generate-valdr-pack.mjs

# Generate from any concrete pack directory
node scripts/generate-valdr-pack.mjs build/staging/vanguard/valdr

# Write to a custom output path
node scripts/generate-valdr-pack.mjs --output build/my-pack.valdr-pack.tar.gz

# Generate deterministic output for reproducible archives
node scripts/generate-valdr-pack.mjs --exported-at 1730000000000
```

### Notes

- `generate-valdr-pack.mjs` remains generic. It does not know about Valdr tier layering.
- `build-valdr-tier.mjs` is Valdr-specific and should be the normal entrypoint for Raider, Vanguard, and Sovereign builds.
- Generated archives are directly consumable by Valdr's preflight/commit import flow.
- Generated staging trees and archives should not be committed.
