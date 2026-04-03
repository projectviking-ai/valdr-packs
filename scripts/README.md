# Valdr Packs Scripts

Build and packaging scripts for `valdr-packs`.

## Available Scripts

| Script | Description | Input | Output |
|--------|-------------|-------|--------|
| `build-valdr-tier.mjs` | Assemble a Valdr tier from layered source and invoke the generic archive generator | `valdr-packs/valdr/<layer>/` + tier config | `build/valdr-<tier>.valdr-pack.tar.gz` |
| `generate-valdr-pack.mjs` | Build an importable `.valdr-pack.tar.gz` from a concrete pack directory | `<pack-dir>/pack.yaml` + includes | `build/<pack>.valdr-pack.tar.gz` |

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
