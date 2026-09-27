# Validate, import, run, update

With a compatible Valdr CLI installed, run from the public `valdr-packs` checkout:

```sh
make validate-user-workflow-tools
make test-user-workflow-tools
make build-valdr-tools
```

The tests require Bun, Node, Python 3, POSIX `sh`, `jq`, and Go. Set `VALDR_BIN=/path/to/valdr` on the `make` command if your installed Valdr executable is not on `PATH`.

For another authored pack with a compatible released CLI:

```sh
valdr validate-pack path/to/my-pack
valdr generate-valdr-pack path/to/my-pack --output build/my-pack.valdr-pack.tar.gz --exported-at 0
```

Use a compatible Valdr CLI on the import host as well; older clients cannot import executable tool metadata.

## Import and execute

Import `build/valdr-tools.valdr-pack.tar.gz` in **Settings → Valdr Packs**. Review preflight
and commit the import. Manage installed tools under **Workflows → Tools**, the tab after
**Runs**; **Import or export packs** links back to Settings. Import never installs dependencies,
compiles native code, logs in or executes entrypoints.

Each tool ID immediately gets its own named Builder library entry with its optional manifest
icon. Click or drag it to pin the latest installed revision. A sole supported action is selected automatically; select among multiple actions
in the inspector. Omitted or unknown icons use the normal tool glyph.

Running a workflow executes selected tools with ordinary host permissions, like Command
steps. Review their source and effects before running. The workflow chooses the directory;
optional step-level `cwd` overrides it. Manifest `inheritEnv` names are inherited directly
when present, with internal and unsafe names filtered. Baseline HOME/PATH remain available,
and a CLI may use existing config/keychain credentials. Keep secret values out of manifests
and workflow inputs; request environment names instead. Do not print credentials in diagnostics.

The Builder selects a pin and freezes `revision`, `contentHash`, `inputSchema`, and
`outputSchema` alongside `id` and `action` in a normal `kind: tool` step. Use Builder output
or copy those exact fields from the catalog; do not make up a hash.

## Updates

1. Read the maintained source and current diff. Preserve user changes.
2. Change revision for changed source bytes or contract. Same ID/revision with different
   content conflicts on import; do not try to overwrite the retained snapshot.
3. Validate, rebuild, review preflight and import the new revision. It is available in the
   Builder immediately. An identical reimport preserves the same identity.
4. New steps from the library use the latest installed revision. Existing steps and runs
   retain their original pins; choose the new pin explicitly in a new workflow version.

Hashes cover the semantic manifest and inventoried file bytes/metadata. They do not pin
external interpreter, CLI, native binary, plugin, dependency or auth versions.
Export retains source and pins, but excludes host environment values.
Never edit an installed snapshot: byte drift fails integrity checks. Reimport from canonical source
or restore the exact bytes through supported import/recovery.

Remove a tool from the catalog to hide it from new selections while retaining pinned
history. Existing immutable pins can still execute. Removal does not stop an already running process or undo external effects.
