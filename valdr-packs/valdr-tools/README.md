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

Explicit UI/MCP launch variables win, including empty values. List each additional name in `process.inheritEnv`; a shared reference alone does not pass it to a tool. Baseline inheritance and restricted-name filtering still apply. Restart Valdr and MCP clients after changing the file or its reference sources. See [environment variables](https://valdr.ai/valdr/docs/workflows/user-tools/runtime/#environment-variables) for the full setup.

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

## Decisions

`valdr-tools.user.decide` revision `1.0.0` provides one action, `decide`. It answers choice, predicate, and ordered score questions over supplied text. Each call selects `engine.provider` and `engine.model`; the tool has no default model. The host supplies Node.js 22 or later and access to the selected engine.

### Engine configuration

| Provider | Explicit model | Host configuration |
| --- | --- | --- |
| `laya` | `english`, `multilingual`, or `typed-decisions` | `LAYA_URL` defaults to `http://127.0.0.1:8000`; optional `LAYA_API_KEY`; calls `/v1/systemone` |
| `ollama` | `clef-flash:9b` | `OLLAMA_URL` defaults to `http://127.0.0.1:11434`; loopback only, no API key; calls `/v1/systemone` |
| `jev` | An available Jev model, for example `jev-latest` | Required `TYPESAFE_API_KEY`; fixed `https://api.typesafe.ai/v1/systemone` |
| `openai` | A Decisions-compatible model, initially `gpt-6-luna` | Required `OPENAI_API_KEY`; fixed `https://api.openai.com/v1/decisions` |

These are host environment variables, using the shared environment-reference setup described above. Endpoints, keys, images, and generation settings cannot be supplied in action input. Base URLs may include a reverse-proxy prefix, but cannot contain credentials, a query, or a fragment. Redirects are rejected.

Use an existing Laya deployment with the requested checkpoint configured. This adapter accepts the three checkpoint names above because Laya can silently auto-route unknown names. Contradictory returned routing and reported input truncation fail the call. Laya choice IDs cannot be `yes`, `no`, `true`, or `false` in any letter case; use semantic labels or a predicate. See the [Laya HTTP contract](https://github.com/NandhaKishorM/laya/blob/main/docs/http-api.md).

The initial Ollama tag, `clef-flash:9b`, requires **Ollama 0.35.1 or later**, per its [model card](https://ollama.com/library/clef-flash). Verify during setup that the tag is installed locally and resolves to local weights in your Ollama installation. Loopback restricts the endpoint; it cannot prove how a separately administered server executes a model. Hosted/cloud and other model tags are rejected by this adapter. Model installation and service startup are separate setup operations; the tool makes no download, load/unload, or service-management requests. Ollama controls normal inference loading and eviction. See the [System One API](https://docs.ollama.com/api/systemone).

Hosted model availability depends on the account/service. The [Jev quick start](https://docs.typesafe.ai/introduction/quickstart) and [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions) describe the endpoints. The adapter fixtures follow those contracts as checked on 2026-10-17; fixtures are synthetic integration examples, not proof of live availability or decision accuracy.

### Questions and acceptance

Input is `{engine, text, questions}`. `text` must be nonblank; serialize structured context into that string yourself. Supply 1–20 questions. Question IDs and option/level IDs start with an ASCII letter, contain only ASCII letters, digits, or underscores, and are at most 64 characters. Question IDs must be unique; option/level IDs must be unique within a question and cannot be `unsure` or `refused`.

| Question | Definition | Required `acceptance` | Outcome |
| --- | --- | --- | --- |
| `choice` | `options`: 2–26 `{id, description}` entries | `{minSelectedProbability: 0.8}` | Selected option ID or `unsure` |
| `predicate` | `instructions` describe a condition | `{noAtMost: 0.2, yesAtLeast: 0.8}` | `yes` at/above 0.8, `no` at/below 0.2, otherwise `unsure` |
| `score` | `levels`: 2–10 `{id, description}` entries, lowest first | `{minSelectedProbability: 0.8}` | Most likely level ID or `unsure` |

Each question also requires `id`, `type`, and nonblank `instructions`. Descriptions must be nonblank. Thresholds must be within [0,1], with `noAtMost < yesAtLeast`. A minimum probability of zero disables probability-based abstention for choice/score, but an exact top tie still produces `unsure`. Thresholds shown here are illustrative, not measured accuracy guarantees.

For example, these predicate and score definitions can be included in `questions`:

```json
[
  {"id":"ready","type":"predicate","instructions":"Does the request specify an observable result?","acceptance":{"noAtMost":0.2,"yesAtLeast":0.8}},
  {"id":"size","type":"score","instructions":"How much work is described?","levels":[{"id":"small","description":"One simple edit"},{"id":"medium","description":"Several related edits"},{"id":"large","description":"Many independent changes"}],"acceptance":{"minSelectedProbability":0.8}}
]
```

### Direct use

With the local Ollama model already configured, run this from the repository root. The five work-kind labels are caller-defined example data, not built-in routing behavior:

```sh
node --input-type=module <<'JS' | node valdr-packs/valdr-tools/tools/decide/runner.mjs
const input = {
  engine: { provider: 'ollama', model: 'clef-flash:9b' },
  text: 'Update the installation guide with the supported setup commands.',
  questions: [{
    id: 'workKind', type: 'choice',
    instructions: 'What kind of primary deliverable is requested by this task?',
    options: [
      { id: 'code', description: 'Application or library implementation and tests; incidental documentation is included.' },
      { id: 'documentation', description: 'User guides, reference pages, explanatory prose, and documentation examples.' },
      { id: 'infrastructure', description: 'Cloud resources, deployment topology, networking, and operational infrastructure.' },
      { id: 'mixed', description: 'Substantial separate deliverables requiring multiple kinds of specialist.' },
      { id: 'other', description: 'The request does not fit the listed deliverable categories or lacks enough detail to classify.' },
    ],
    acceptance: { minSelectedProbability: 0.8 },
  }],
};
console.log(JSON.stringify({ protocolVersion: 1, toolId: 'valdr-tools.user.decide',
  toolRevision: '1.0.0', action: 'decide', input,
  operationId: 'decision-example', attemptId: 'decision-example-1' }));
JS
```

After importing the existing Tools archive, an agent can discover and invoke the action through `mcp__valdr__pm_user_tool`. These are MCP calls, not shell commands:

```js
mcp__valdr__pm_user_tool({ action: 'help' });
mcp__valdr__pm_user_tool({ action: 'search', params: { toolId: 'valdr-tools.user.decide' } });
mcp__valdr__pm_user_tool({ action: 'describe', params: {
  toolId: 'valdr-tools.user.decide', toolAction: 'decide', revision: '1.0.0',
} });
// Use the input object above, an existing absolute cwd on the execution host,
// and a fresh clientRequestId for each new operation.
mcp__valdr__pm_user_tool({ action: 'run', params: {
  toolId: 'valdr-tools.user.decide', toolAction: 'decide', revision: '1.0.0',
  cwd: '/absolute/path/to/project', clientRequestId: 'unique-decision-request', input,
} });
```

Direct gateway results are at `data.result`. A matching completed gateway request replays its original result; use the same clientRequestId only for that repeat. Existing workflows can select the tool in the Builder and map `$.normalized.data.answers.workKind.outcome`. Obtain the full revision/content-hash/schema pin from the Builder/catalog; gateway `describe` provides schemas but omits the content hash. No workflow or agent definition is required for a direct call.

### Results, limits, and failures

The process returns `{ok:true,data:{engine,answers,latencyMs,usage?}}`. Each requested question appears exactly once in `answers`, with `type`, `status` (`accepted`, `uncertain`, or `refused`), and `outcome`. **Accepted means only that the explicit numerical policy passed.** It is neither measured correctness nor authorization to perform an action.

- Choice answers include `selected`, `selectedProbability`, and `probabilities` by option ID. Below threshold, the selection remains visible while outcome becomes `unsure`.
- Predicate answers include `probabilityTrue`; threshold endpoints are inclusive.
- Score answers include `selected`, zero-based `selectedIndex`, `selectedProbability`, weighted `expectedIndex`, and `probabilities` by level ID. Select the most likely level, not the rounded mean. For `[0.45, 0.30, 0.25]`, the selected index is 0 while expectedIndex is 0.8. Map level IDs to scales such as story points in the caller.
- An exact top tie is uncertain; the first declared tied option/level is retained for stable display. `providerConfidence`, when present on choice/score, preserves the provider's separate confidence metric. Acceptance always uses selected probability.
- A documented per-question refusal has `status: refused`, `outcome: refused`, and no fabricated probabilities or selection. Other valid answers remain available. This currently applies to OpenAI's refusal answer type; System One errors are tool errors.

Distributions must contain exactly the declared keys, with finite [0,1] values and a sum within 0.01 of one. Reported score means must agree within 0.01. Values are preserved without renormalization. Missing/extra answers, contradictory selections, malformed metadata, and invalid distributions fail the whole call.

`engine` records `provider` and `requestedModel`, plus `resolvedModel` and `requestId` when reported. Laya uses `routing.model` for its checkpoint; a strict response without routing leaves it absent. The schema allows `modelDigest` when available, but the current inference contracts do not supply one and the adapters do not invent it or make a metadata request. Optional `usage.inputTokens`/`outputTokens` contain only provider-reported counts, including a reported zero. A mutable model alias is not a weight pin; the tool's content hash pins code and schemas. `latencyMs` covers provider response handling and normalization.

One invocation makes one inference request, with no retries, fallback, second opinion, or splitting. Limits are 64 KiB for stdin and stdout, 64 KiB for the decoded provider response, and 8 KiB for diagnostics. HTTP has a 50-second deadline; the Valdr process limit is 60 seconds. Cancellation aborts the HTTP request. No task text, credentials, or provider bodies are logged.

Failures return `{ok:false,error:{code,message}}`. Codes distinguish `invalid_request`, `invalid_input`, `invalid_config`, `authentication_failed`, `rate_limited`, `request_rejected`, `engine_unavailable`, `timeout`, `cancelled`, `invalid_response`, `input_limit`, and `result_limit`. Valdr handles these as tool failures; they do not become normalized success data for successor conditions. Uncertainty and refusal are successful outcomes callers can route to review. The action declares read effects and idempotent retry because it computes without changing project state; deliberately repeating inference can incur another charge and return a different prediction.

### Decision tests

The new runtime tests use synthetic fixtures and temporary loopback HTTP servers, with no cloud credentials, model weights, or persistent provider service:

```sh
node --test valdr-packs/valdr-tools/tests/decide/contract.test.mjs valdr-packs/valdr-tools/tests/decide/adapters.test.mjs valdr-packs/valdr-tools/tests/decide/process.test.mjs
```

To build the archive and run all credential-free decision tests:

```sh
make test-decision-tools
```

PR and release checks run this target. It explicitly disables the licensed integration test, even if `VALDR_DECIDE_ISOLATED=1` is inherited, and does not load the repository `.env`. `archive.test.mjs` requires Bun and `tar`; it checks source inventories and checksums against the freshly built archive. Add `make test-user-workflow-tools` for the existing-tool regression suite.

Fixtures/tests are outside the executable tool inventory and are not included in the archive. Live verification, when a provider is already configured, uses separate synthetic direct calls; fixture passes establish integration behavior, not classification accuracy or production-routing suitability.

### Isolated Valdr integration test

Use the installed Valdr CLI version pinned in `VALDR_WORKFLOW_CLI_VERSION`, Node.js 22 or later on `PATH`, and your normal **Sovereign-licensed Valdr environment**. The harness preserves `HOME` and inherited configuration, including database credentials and auth-key settings, so Valdr uses its normal license discovery and shared authentication. It does not copy a license, generate credentials, or create another installation identity. Non-interactive encrypted startup requires the existing `VALDR_DB_USERNAME` and `VALDR_DB_PASSWORD` in the launch environment.

Put your existing startup credentials in the repository-root `.env` (ignored by Git), or export them in the launching shell:

```dotenv
VALDR_DB_USERNAME="your-existing-username"
VALDR_DB_PASSWORD="your-existing-password"
```

The isolated test loads this file automatically. Existing shell variables take precedence, including explicitly empty values. Values are parsed as dotenv data, with no shell expansion or command execution. Use the credentials already associated with your normal Valdr installation; the harness does not generate replacements.

From the repository root:

```sh
make build-valdr-tools
VALDR_DECIDE_ISOLATED=1 \
  node --test valdr-packs/valdr-tools/tests/decide/isolated-valdr.test.mjs
```

Set `VALDR_BIN=/absolute/path/to/valdr` in the shell or `.env` to choose the installed CLI. The enabled test fails if startup credentials, licensing, or other prerequisites are unavailable; normal decision-suite runs skip it unless `VALDR_DECIDE_ISOLATED=1` in the launching shell.

Each run creates fresh PM, data, runtime, temporary, and working directories. Both CLI commands receive explicit `--pm-home`, `--data-root`, and `--runtime-root` paths; the inherited `PM_MCP_HOME` and `TMPDIR` are overridden for this run. The isolated PM home holds the database, tool receipts, artifacts, and default worktree directories. The normal user home and authentication configuration remain in use.

The test starts `valdr pm` over stdio, verifies required tools, license status, and the isolated database paths through `pm_health`, then imports the built Tools archive through `valdr import-pack`. It checks discovery, schemas, execution of the retained Laya and Ollama runners, normalized answers, and completed-request replay without a second inference. Both adapters use a temporary loopback mock server; the Laya credential is explicitly empty for that mock. No model installation or hosted inference credentials are needed. The four-adapter fixture suite remains the contract check for Jev and OpenAI's fixed hosted endpoints.

Test-owned processes and per-run temporary files, including the database, are removed on normal completion or test failure. Command diagnostics redact credentials after assembling stream chunks; captures exceeding 8 KiB are omitted entirely. `diagnostics.test.mjs` checks split credentials, UTF-8 boundaries, and capture limits using synthetic values and a fake CLI. `isolated-environment.test.mjs` covers preservation of the normal home and existing credentials, plus isolation of the PM paths.

The test creates no workflow or agent definitions. A passing test proves the installed CLI/gateway path against controlled responses; it does not measure model quality or prove live provider availability. An invalid license fails the test without retries or bypasses.

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

For direct agent use on a server exposing `pm_user_tool`, call `help`, then `search` and `describe` to inspect an installed action. An authorized `run` needs nested `input`, an absolute `cwd`, and a `clientRequestId`; it returns the action result at `data.result` without creating a workflow. Hot-load `valdr.core.tools.pm-user-tool` from the Sovereign pack for version selection, repeat requests, and policy constraints. The workflow path below keeps its existing pins and result mapping.

1. In the Valdr UI, open **Settings → Valdr Packs** and select the archive. Review the tool IDs, source inventory, requested runtimes and actions, then commit the import.
2. Open **Workflows → Tools**, after **Runs**, to inspect installed revisions, manifests, retained source paths, or remove a revision from the catalog. **Import or export packs** links back to Settings. Imported tools are ready in the Builder; the authority host must already provide their runtime commands on `PATH`. The five language starters request no additional environment names; CLI adapters inherit the optional credential/configuration names listed in their manifests, with restricted names filtered.
3. In the workflow Builder library, click or drag **Node text summary** and provide `text`. Every tool ID has its own named entry with its manifest icon and latest installed revision. The sole supported `summarize` action is selected automatically; tools with several actions use the inspector to select one. Leave the optional working directory unset to use the workflow session worktree or project repository, or set step-level `cwd` for an absolute or relative override. With no workflow directory, execution uses the authority process cwd. Map the result from `$.normalized.data.characters`, `.words` or `.lines`.
4. Keep this repository as the single source. Change a tool revision when changing its files or contract, rebuild, review and reimport, then choose the new pin in a new workflow version. Export carries source bytes and pins; host dependencies and environment values stay on the host.

The optional top-level `icon` is a named Heroicon, such as `code-bracket`; omitted or unknown names use the default tool icon. New imports update the library choice for new steps while existing workflow pins remain unchanged. Removal from **Workflows → Tools** hides a revision from new selection and preserves existing pins.

New manifests omit `process.cwd`; its optional legacy value is ignored. Exact inventoried file arguments resolve beneath the retained tool root, so a dispatcher can run in a project directory. Step-level `cwd` accepts expressions and is separate from action `inputs`. No project key or workflow context is added to the JSON request.

To author a new action, use [the workflow-tool authoring skill](../../skills/valdr-workflow-tools/SKILL.md). Validate manifests with `valdr validate-pack`; see the [custom-tool documentation](https://valdr.ai/valdr/docs/workflows/user-tools/) for the full authoring guide.

CLI failures retain the child exit code, signal, and a bounded error message. The generated runners reuse Valdr’s redactor before shortening stderr; failed or overflowing captures are omitted. A failed Jira action also checks `acli jira auth status` for up to five seconds and includes only a failed diagnostic; successful authentication output is never returned. This check does not log in or change authentication.
