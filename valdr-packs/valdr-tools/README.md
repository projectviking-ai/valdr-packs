# Valdr Tools

One standalone source pack for reusable user workflow tools. This directory is the canonical starter source; build it here and import the same archive into each Valdr installation.

Use a compatible Valdr CLI with user-tool support. Imported tools are immediately available in the Builder. Running a workflow executes them on the host, like Command steps. Import does not execute entrypoints, install runtimes, compile code or authenticate CLIs.

## Language starters

Each starter uses a hand-authored YAML manifest at `tools/<language>/summary.tool.yaml`. Requests and results use the JSON process protocol.

Each starter provides `summarize`, with input `{"text":"Hello Valdr\nTools are ready."}` and result data `{"characters":28,"words":5,"lines":2}`.

| Tool ID | Icon | Required host command | Source |
| --- | --- | --- | --- |
| `valdr-tools.user.node` | `code-bracket` | `node` | `tools/node/main.mjs` |
| `valdr-tools.user.typescript` | `variable` | `bun` | `tools/typescript/main.ts` |
| `valdr-tools.user.python` | `cube` | `python3` | `tools/python/main.py` |
| `valdr-tools.user.shell` | `command-line` | `sh` and `jq` | `tools/shell/main.sh` |
| `valdr-tools.user.native` | `cpu-chip` | `valdr-tools-native` | `tools/native/main.go` |

Characters are Unicode code points, not grapheme clusters. Words are separated by ASCII whitespace (space, tab, LF, CR, form feed and vertical tab). Lines are separated by LF; empty text has zero lines. The actions read only their request, do not read project files or use the network, and are safe to repeat. `fixtures.json` supplies shared protocol examples; Valdr exposes success data at `$.normalized.data`.

The native starter ships Go source, preserving one portable archive. Compile it explicitly on each host before execution:

```sh
# From the valdr-packs repository root, with an existing Go installation.
mkdir -p build/bin
go build -trimpath -o build/bin/valdr-tools-native valdr-packs/valdr-tools/tools/native/main.go
export PATH="$PWD/build/bin:$PATH"
```

Start the Valdr authority from that environment so it can resolve the executable. Native output stays in ignored `build/bin`, outside the tool inventory. The content hash pins packaged source; it does not pin the host binary, interpreter or utility versions. Review and rebuild the host executable when updating its source. Compilation is never part of import or workflow execution.

## CLI adapters

These are **starter integrations**, not complete wrappers for the installed CLIs. They expose selected useful read actions. **Adding commands and flags for your own needs, testing them, and maintaining those extensions is up to you.** Installing a CLI does not expose its remaining commands automatically.

The same pack includes four independent Node-dispatched adapters. Each has a local `version` action with input `{}` and output `{version: string}`. Other actions return the CLI's JSON unchanged; their output schema does not guarantee fields across CLI versions, except the two normalized Jira import actions below.

| Library entry | Tool ID | Icon | Supported read actions |
| --- | --- | --- | --- |
| GitHub CLI | `valdr-tools.user.gh` | `code-bracket-square` | `repo-view`, `repo-list`, `pr-list`, `pr-view`, `issue-list`, `issue-view`, `run-list`, `run-view`, `workflow-list`, `release-list`, `release-view`, `label-list` |
| AWS CLI | `valdr-tools.user.aws` | `server-stack` | `sts-get-caller-identity`, `s3-list-buckets`, `ec2-describe-instances`, `ec2-describe-volumes`, `ec2-describe-vpcs`, `iam-list-users`, `lambda-list-functions`, `rds-describe-db-instances`, `dynamodb-list-tables`, `ecr-describe-repositories` |
| Google Cloud CLI | `valdr-tools.user.gcloud` | `cloud` | `projects-list`, `projects-describe`, `compute-instances-list`, `compute-instances-describe`, `compute-disks-list`, `compute-networks-list`, `storage-buckets-list`, `run-services-list`, `run-services-describe` |
| Atlassian CLI | `valdr-tools.user.acli` | `ticket` | `jira-workitem-view`, `jira-workitem-import`, `jira-workitem-search`, `jira-workitem-keys`, `jira-project-list`, `jira-project-view`, `jira-workitem-comment-list`, `jira-workitem-attachment-list`, `jira-workitem-link-list`, `jira-workitem-list-watchers`, `jira-board-search`, `jira-board-view` |

Two `acli` actions (revision 1.0.6) normalize Jira data for task import and publish strict output schemas:

- `jira-workitem-keys` takes `{jql}` and runs `acli jira workitem search --paginate`, returning `{keys}` in CLI order for **every** match. It requests `key,summary` because acli returns `null` items for `--fields key` alone. All pages are buffered (up to 8 MiB, roughly 10,000 items) within the 25-second CLI timeout; narrow the JQL for larger result sets.
- `jira-workitem-import` takes `{key}` and returns `key`, `title`, `type` (`bug`, `story`, `epic` or `spike` when the Jira type name matches, otherwise `task`), `jiraType`, `priority` (Highest–Lowest as 1–5, otherwise `null`), `jiraPriority`, `labels`, `status` and `descriptionMarkdown`. The description's Atlassian Document Format is converted to Markdown: headings, marks, links, lists, code blocks, quotes, panels, rules, mentions, emoji, cards and tables; media is omitted.

The host supplies Node and the named CLI. Authentication uses existing CLI configuration/keychain or the environment names listed in `process.inheritEnv`. Baseline HOME/PATH are visible to child processes; these tools are not a credential or filesystem sandbox. Version checks need no account. Network actions need the corresponding host login/profile and task authorization; import does not log in or select a profile. Inputs are typed and bounded; arbitrary commands and extra argv are rejected. Failures return bounded, redacted CLI diagnostics with the child exit code and signal.

For consistent variables when tools run through MCP or the UI, configure `~/.valdr/environment.env` on the workflow host. This file contains whole-value `${NAME}` or `$(command)` references resolved from shell startup or trusted local commands; it does not hold literal values:

```dotenv
MY_API_TOKEN=${MY_API_TOKEN}
SOME_VAR=$(printf '%s' hello)
```

Explicit UI/MCP launch variables win, including empty values. List each additional name in `process.inheritEnv`; a shared reference alone does not pass it to a tool. Baseline inheritance and internal/unsafe-name filtering still apply. Restart Valdr and MCP clients after changing the file or its reference sources. See [environment variables](https://valdr.ai/valdr/docs/workflows/user-tools/runtime/#environment-variables) for the full setup.

The source generator, `scripts/generate-user-workflow-cli-tools.mjs`, emits `tools/<cli>/<cli>.tool.yaml` and `tools/<cli>/runner.mjs` for `gh`, `aws`, `gcloud`, and `acli`. Each manifest inventories its own runner; the imported snapshot contains only that CLI's command table and requested environment names. A CLI-specific change does not change the other CLI snapshots.

After reviewing source changes, run `bun scripts/generate-user-workflow-cli-tools.mjs`; use `--check` to verify both manifests and runners. Bump the affected tool's revision whenever its generated content changes. A shared generator change needs new revisions only for tools whose emitted files change. Preserve any user edits before regenerating.

Keep CLI discovery evidence in a local directory outside the executable pack. Review captures for host-specific details and user aliases before sharing them. It records supported and unsupported command paths and explicit gaps; the small starter catalog does not claim every CLI command is executable. Follow the [discovery reference](../../skills/valdr-workflow-tools/references/cli-discovery.md) to extend the supported surface.

## Maven builds

`valdr-tools.user.maven` runs in the workflow's working directory. It prefers an executable project `./mvnw`, falling back to host `mvn` when no wrapper exists. The host supplies Node and Java; optional `javaHome` selects an absolute JDK home without changing the host configuration.

- `version` is a read action and returns `version`, `summary`, `durationMs`, `exitCode`, `logPath`, and `logTruncated`.
- `build` accepts `goals` (default `["package"]`), optional `properties`, `modules`, `profiles`, `alsoMake`, `javaHome`, and `timeoutSeconds` (default 240, maximum 270). Goals are literal lifecycle phases or plugin goals; properties become individual `-Dname=value` arguments. For example, `{"goals":["clean","verify"],"properties":{"skipITs":true},"profiles":["ci"]}`. Maven and project/plugin configuration control what these goals do.

Builds use `-B -ntp -Dstyle.color=never`. Every build that runs to completion returns a result: `result` (`passed` on exit zero, `failed` on a nonzero exit), a short `summary`, `errorExcerpt` (the first distinct error lines, up to ten, without Maven's closing boilerplate, or the last stderr lines when Maven printed none; redacted and empty when passed), `durationMs`, `exitCode`, `logPath`, and `logTruncated`. Optional `testSummary` is the last observed Maven test summary line, **not an aggregate across modules or suites**. Because a failed build is a result rather than a tool failure, a workflow can map `result` and `errorExcerpt` and route a failed build, for example back to the agent session that made the change. Startup and environment errors that exit nonzero (for example a misconfigured JDK or an unreachable repository) are also `failed` results, so keep loop-backs bounded. The action itself fails only when Maven can't be launched (no `mvn`, or `mvnw`/`javaHome` not executable), times out, is cancelled, or is killed by a signal; that error carries the exit code or signal and the log path. Logs never become the tool's full stdout result.

Logs are local temporary files with owner-only access, redacted using Valdr's shared text redactor. Retention is bounded to 2 MiB and individual complete lines are shortened after redaction; oversized unfinished lines are discarded. `logTruncated` indicates incomplete retention. Clean up these files through normal host temporary-file maintenance when no longer needed. Timeout and forwarded cancellation terminate Maven's process group, including ordinary child processes spawned by plugins.

Builds are `write` actions with `manual` retry because goals can install, deploy, or invoke arbitrary project/plugin behavior. After a timeout or interruption, inspect external effects before retrying. A build that runs and exits nonzero is a `failed` result for workflow routing; `retry` governs tool failures, not that result. In a copy limited to safe, convergent goals, you may change the retry policy to `idempotent` and bump the revision. Beyond the baseline environment the tool passes only `JAVA_HOME`; add `MAVEN_OPTS` or repository credential variables to `inheritEnv` in your copy if your build reads them (credential values shorter than 8 characters aren't redacted from the log). When you change the tool, update the revision in both the manifest and the runner's request check. Dependencies and wrapper downloads use the host's existing network and Maven settings; import itself does not install or run anything.

## Validate and build

With a compatible Valdr CLI installed, run from the `valdr-packs` repository root:

```sh
make validate-user-workflow-tools
make test-user-workflow-tools
make build-valdr-tools
```

Tests require Bun, Node, Python 3, POSIX `sh`, `jq`, and Go. They exercise the language protocols, reject malformed requests, and verify archive determinism and source checksums. CLI tests use fake executables; check authenticated service access separately.

The build produces `build/valdr-tools.valdr-pack.tar.gz` using the installed `valdr` CLI. Set `VALDR_BIN=/path/to/valdr` on the `make` command if it is not on `PATH`.

## Import and use

1. In the Valdr UI, open **Settings → Valdr Packs** and select the archive. Review the tool IDs, source inventory, requested runtimes and actions, then commit the import.
2. Open **Workflows → Tools**, after **Runs**, to inspect installed revisions, manifests, retained source paths, or remove a revision from the catalog. **Import or export packs** links back to Settings. Imported tools are ready in the Builder; the authority host must already provide their runtime commands on `PATH`. The five language starters request no additional environment names; CLI adapters inherit the optional credential/configuration names listed in their manifests, with internal and unsafe names filtered.
3. In the workflow Builder library, click or drag **Node text summary** and provide `text`. Every tool ID has its own named entry with its manifest icon and latest installed revision. The sole supported `summarize` action is selected automatically; tools with several actions use the inspector to select one. Leave the optional working directory unset to use the workflow session worktree or project repository, or set step-level `cwd` for an absolute or relative override. With no workflow directory, execution uses the authority process cwd. Map the result from `$.normalized.data.characters`, `.words` or `.lines`.
4. Keep this repository as the single source. Change a tool revision when changing its files or contract, rebuild, review and reimport, then choose the new pin in a new workflow version. Export carries source bytes and pins; host dependencies and environment values stay on the host.

The optional top-level `icon` is a named Heroicon, such as `code-bracket`; omitted or unknown names use the default tool icon. New imports update the library choice for new steps while existing workflow pins remain unchanged. Removal from **Workflows → Tools** hides a revision from new selection and preserves existing pins.

New manifests omit `process.cwd`; its optional legacy value is ignored. Exact inventoried file arguments resolve beneath the retained tool root, so a dispatcher can run in a project directory. Step-level `cwd` accepts expressions and is separate from action `inputs`. No project key or workflow context is added to the JSON request.

To author a new action, use [the workflow-tool authoring skill](../../skills/valdr-workflow-tools/SKILL.md). Validate manifests with `valdr validate-pack`; see the [custom-tool documentation](https://valdr.ai/valdr/docs/workflows/user-tools/) for the full authoring guide.

CLI failures retain the child exit code, signal, and a bounded error message. The generated runners reuse Valdr’s redactor before shortening stderr; failed or overflowing captures are omitted. A failed Jira action also checks `acli jira auth status` for up to five seconds and includes only a failed diagnostic; successful authentication output is never returned. This check does not log in or change authentication.
