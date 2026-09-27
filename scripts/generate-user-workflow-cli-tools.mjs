import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

if (typeof Bun === 'undefined') throw new Error('Run with Bun: bun scripts/generate-user-workflow-cli-tools.mjs');

// Declarative per-action argv bindings. No shell, arbitrary argv, or auth/config mutations.
const string = (pattern, maxLength = 256) => ({ type: 'string', minLength: 1, maxLength, ...(pattern ? { pattern } : {}) });
const text = string(undefined, 4096);
const name = string('^[A-Za-z0-9][A-Za-z0-9_.:/@+-]*$');
const repo = string('^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9_.-]+$');
const integer = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const limit = { type: 'integer', minimum: 1, maximum: 100 };
const choice = (...values) => ({ type: 'string', enum: values });
const bind = (input, schema, flag, required = false, defaultValue) => ({ input, schema, ...(flag ? { flag } : {}), required, ...(defaultValue !== undefined ? { default: defaultValue } : {}) });
const take = bind('limit', limit, '--limit', false, 30);
const repository = bind('repo', repo, '--repo');
const project = bind('project', string('^[a-z][a-z0-9-]{4,61}[a-z0-9]$'), '--project');
const action = (path, description, argv) => ({ path: path.split(' '), description, argv });
const json = fields => ['--json', fields];
const gh = (path, description, fields, bindings = []) => action(path, description, [...path.split(' '), ...bindings, ...json(fields)]);
const aws = (path, description, bindings = [], paged = true) => action(path, description, [...path.split(' '), ...bindings,
  ...(paged ? [bind('limit', limit, '--max-items', false, 30)] : []),
  '--output', 'json', '--no-cli-pager', bind('profile', name, '--profile'), bind('region', string('^[a-z][a-z0-9-]*$'), '--region')]);
const cloud = (path, description, bindings = [], list = true) => action(path, description, [...path.split(' '), ...bindings,
  ...(list ? [take, bind('filter', text, '--filter')] : []), project, '--format=json', '--quiet']);
const jira = (path, description, bindings = [], list = false) => action(path, description, [...path.split(' '), ...bindings, ...(list ? [take] : []), '--json']);
const key = bind('key', string('^[A-Z][A-Z0-9_]*-[0-9]+$'), '--key', true);
const id = bind('id', integer, '--id', true);
const version = argv => ({ path: ['version'], description: 'Read the installed CLI version without signing in.', argv, text: true });
// Transformed actions name a runner-local output transform and publish a strict output schema.
// Their catalog path must be unique per manifest, so it differs from the CLI command that argv already spells out.
const transformed = (catalogPath, spec, transform, outputSchema, extra = {}) => ({ ...spec, path: catalogPath.split(' '), transform, outputSchema, ...extra });
const nullable = type => ({ type: [type, 'null'] });
const strict = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const workitemKey = { type: 'string', pattern: key.schema.pattern };
const adapters = {
  gh: {
    version: version(['--version']),
    'repo-view': gh('repo view', 'Read a repository; omit repo to use the execution working directory.', 'nameWithOwner,url,description,defaultBranchRef,isPrivate', [bind('repo', repo)]),
    'repo-list': gh('repo list', 'List at most 100 repositories for an owner or the authenticated user.', 'nameWithOwner,url,description,isPrivate', [bind('owner', name), take]),
    'pr-list': gh('pr list', 'List at most 100 pull requests, optionally filtered by state, branch or search.', 'number,title,state,url,headRefName,baseRefName', [repository, take, bind('state', choice('open', 'closed', 'merged', 'all'), '--state', false, 'open'), bind('base', name, '--base'), bind('head', name, '--head'), bind('search', text, '--search')]),
    'pr-view': gh('pr view', 'Read one pull request.', 'number,title,state,url,headRefName,baseRefName,body,author,mergeable', [bind('number', integer, undefined, true), repository]),
    'issue-list': gh('issue list', 'List at most 100 issues, optionally filtered by state, assignee, label or search.', 'number,title,state,url', [repository, take, bind('state', choice('open', 'closed', 'all'), '--state', false, 'open'), bind('assignee', name, '--assignee'), bind('label', text, '--label'), bind('search', text, '--search')]),
    'issue-view': gh('issue view', 'Read one issue.', 'number,title,state,url,body,author,labels,assignees', [bind('number', integer, undefined, true), repository]),
    'run-list': gh('run list', 'List at most 100 Actions workflow runs.', 'databaseId,displayTitle,status,conclusion,url,headBranch,workflowName', [repository, take, bind('branch', name, '--branch'), bind('workflow', name, '--workflow')]),
    'run-view': gh('run view', 'Read one Actions workflow run without downloading logs or artifacts.', 'databaseId,displayTitle,status,conclusion,url,headBranch,workflowName,jobs', [bind('runId', integer, undefined, true), repository]),
    'workflow-list': gh('workflow list', 'List at most 100 Actions workflow definitions.', 'id,name,path,state', [repository, take]),
    'release-list': gh('release list', 'List at most 100 releases.', 'tagName,name,isDraft,isPrerelease,publishedAt', [repository, take]),
    'release-view': gh('release view', 'Read a release by tag, or the latest release when tag is omitted.', 'tagName,name,body,url,isDraft,isPrerelease,publishedAt,assets', [bind('tag', name), repository]),
    'label-list': gh('label list', 'List at most 100 repository labels.', 'name,description,color', [repository, take, bind('search', text, '--search')]),
  },
  aws: {
    version: version(['--version']),
    'sts-get-caller-identity': aws('sts get-caller-identity', 'Read the configured AWS caller identity.', [], false),
    's3-list-buckets': aws('s3api list-buckets', 'List the first bounded page of account buckets.'),
    'ec2-describe-instances': aws('ec2 describe-instances', 'List the first bounded page of compute instance reservations.'),
    'ec2-describe-volumes': aws('ec2 describe-volumes', 'List the first bounded page of block storage volumes.'),
    'ec2-describe-vpcs': aws('ec2 describe-vpcs', 'List the first bounded page of virtual networks.'),
    'iam-list-users': aws('iam list-users', 'List the first bounded page of IAM user metadata; credentials are not returned.'),
    'lambda-list-functions': aws('lambda list-functions', 'List the first bounded page of Lambda function metadata.'),
    'rds-describe-db-instances': aws('rds describe-db-instances', 'List the first bounded page of database instance metadata.'),
    'dynamodb-list-tables': aws('dynamodb list-tables', 'List the first bounded page of table names.'),
    'ecr-describe-repositories': aws('ecr describe-repositories', 'List the first bounded page of container repositories.'),
  },
  gcloud: {
    version: version(['version']),
    'projects-list': cloud('projects list', 'List at most 100 visible projects.'),
    'projects-describe': cloud('projects describe', 'Read one project.', [bind('projectId', name, undefined, true)], false),
    'compute-instances-list': cloud('compute instances list', 'List at most 100 compute instances in the selected or configured project.'),
    'compute-instances-describe': cloud('compute instances describe', 'Read one compute instance in an explicit zone.', [bind('instance', name, undefined, true), bind('zone', name, '--zone', true)], false),
    'compute-disks-list': cloud('compute disks list', 'List at most 100 block storage disks.'),
    'compute-networks-list': cloud('compute networks list', 'List at most 100 virtual networks.'),
    'storage-buckets-list': cloud('storage buckets list', 'List at most 100 storage buckets.'),
    'run-services-list': cloud('run services list', 'List at most 100 Cloud Run services.', [bind('region', name, '--region')]),
    'run-services-describe': cloud('run services describe', 'Read one Cloud Run service in an explicit region.', [bind('service', name, undefined, true), bind('region', name, '--region', true)], false),
  },
  acli: {
    version: version(['--version']),
    'jira-workitem-view': jira('jira workitem view', 'Read one Jira work item.', [bind('key', key.schema, undefined, true)]),
    'jira-workitem-import': transformed('jira workitem import',
      jira('jira workitem view', 'Read one Jira work item normalized for task import, with its description as markdown.', [bind('key', key.schema, undefined, true), '--fields', 'summary,issuetype,priority,labels,description,status']),
      'jiraWorkitemImport',
      strict({
        key: workitemKey, title: { type: 'string' }, type: choice('task', 'bug', 'story', 'epic', 'spike'), jiraType: nullable('string'),
        priority: { ...nullable('integer'), minimum: 1, maximum: 5 }, jiraPriority: nullable('string'), labels: { type: 'array', items: { type: 'string' } },
        status: nullable('string'), descriptionMarkdown: { type: 'string' },
      }),
    ),
    'jira-workitem-search': jira('jira workitem search', 'Read at most 100 work items matching JQL.', [bind('jql', text, '--jql', true)], true),
    // acli 1.3.36 emits `null` items for `--fields key` alone; summary is the smallest allowed field that keeps each item's key.
    // Every page is buffered before the transform, so this action alone raises the capture limit (~10k items).
    'jira-workitem-keys': transformed('jira workitem keys',
      jira('jira workitem search', 'Read the keys of every work item matching JQL, paginating through all results.', [bind('jql', text, '--jql', true), '--paginate', '--fields', 'key,summary']),
      'jiraWorkitemKeys',
      strict({ keys: { type: 'array', items: workitemKey } }),
      { maxBuffer: 8 * 1024 * 1024 },
    ),
    'jira-project-list': jira('jira project list', 'Read at most 100 visible Jira projects.', [], true),
    'jira-project-view': jira('jira project view', 'Read one Jira project.', [bind('key', string('^[A-Z][A-Z0-9_]*$'), '--key', true)]),
    'jira-workitem-comment-list': jira('jira workitem comment list', 'Read one bounded page of work item comments.', [key], true),
    'jira-workitem-attachment-list': jira('jira workitem attachment list', 'Read attachment metadata without downloading files.', [key]),
    'jira-workitem-link-list': jira('jira workitem link list', 'Read links for one work item.', [key]),
    'jira-workitem-list-watchers': jira('jira workitem list-watchers', 'Read watchers for one work item.', [key]),
    'jira-board-search': jira('jira board search', 'Read at most 100 boards, optionally matching a name or type.', [bind('name', text, '--name'), bind('type', choice('scrum', 'kanban', 'simple'), '--type')], true),
    'jira-board-view': jira('jira board view', 'Read one Jira board.', [id]),
  },
};
for (const entries of Object.values(adapters)) for (const spec of Object.values(entries)) {
  const bindings = spec.argv.filter(value => typeof value === 'object');
  spec.properties = Object.fromEntries(bindings.map(value => [value.input, value.schema]));
  spec.required = bindings.filter(value => value.required).map(value => value.input);
}
function commandFor(actionId, input) {
  const spec = Object.hasOwn(commands, actionId) ? commands[actionId] : undefined;
  if (!spec) throw new Error('Unsupported CLI action.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Input must be an object.');
  if (Object.keys(input).some(key => !Object.hasOwn(spec.properties, key)) || spec.required.some(key => !Object.hasOwn(input, key))) throw new Error('Unexpected or missing input field.');
  for (const [key, value] of Object.entries(input)) {
    const s = spec.properties[key];
    const valid = s.type === 'integer'
      ? Number.isInteger(value) && value >= s.minimum && value <= s.maximum
      : typeof value === 'string' && !value.includes('\0') && (s.minLength === undefined || [...value].length >= s.minLength) && (s.maxLength === undefined || [...value].length <= s.maxLength) && (!s.pattern || new RegExp(s.pattern).test(value)) && (!s.enum || s.enum.includes(value));
    if (!valid) throw new Error(`Invalid input field: ${key}.`);
  }
  const args = spec.argv.flatMap(binding => {
    if (typeof binding === 'string') return [binding];
    const value = input[binding.input] ?? binding.default;
    if (value === undefined) return [];
    // Equals binding keeps leading hyphens in free text from becoming another option.
    return binding.flag ? [`${binding.flag}=${value}`] : [String(value)];
  });
  return { args, text: spec.text === true };
}
function diagnosticText(result, secrets, limit) {
  // A maxBuffer failure may end halfway through a secret: do not expose partial capture.
  if (result.error) return `CLI diagnostic unavailable (${result.error.code ?? 'capture_failed'}).`;
  const redacted = redactSensitiveText(result.stderr ?? '', secrets).trim();
  return redacted.length > limit ? `${redacted.slice(0, limit)}… [truncated]` : redacted;
}
// Output transforms are emitted only into runners whose actions name one.
function adfToMarkdown(document) {
  if (document === null || document === undefined) return '';
  if (typeof document === 'string') return document.trim();
  const list = value => Array.isArray(value) ? value : [];
  const inlineTypes = ['text', 'hardBreak', 'mention', 'emoji', 'inlineCard'];
  const markOrder = ['code', 'strike', 'em', 'strong', 'link'];
  const inline = nodes => list(nodes).map(node => {
    if (!node || typeof node !== 'object') return '';
    const attrs = node.attrs ?? {};
    switch (node.type) {
      case 'text':
        return list(node.marks).filter(mark => markOrder.includes(mark?.type)).sort((a, b) => markOrder.indexOf(a.type) - markOrder.indexOf(b.type)).reduce((text, mark) => {
          if (mark.type === 'code') return `\`${text}\``;
          if (mark.type === 'strike') return `~~${text}~~`;
          if (mark.type === 'em') return `*${text}*`;
          if (mark.type === 'strong') return `**${text}**`;
          return typeof mark.attrs?.href === 'string' ? `[${text}](${mark.attrs.href})` : text;
        }, typeof node.text === 'string' ? node.text : '');
      case 'hardBreak': return '\n';
      case 'mention': return String(attrs.text ?? '');
      case 'emoji': return String(attrs.text || attrs.shortName || '');
      case 'inlineCard': return String(attrs.url ?? '');
      case 'media': case 'mediaSingle': case 'mediaGroup': case 'mediaInline': return '';
      default: return inline(node.content);
    }
  }).join('');
  // Consecutive inline nodes form one paragraph; blocks are separated by a blank line (a newline inside list items).
  const blocks = (nodes, separator = '\n\n') => {
    const parts = [];
    let run = [];
    const flush = () => { if (run.length) parts.push(inline(run)); run = []; };
    for (const node of list(nodes)) {
      if (inlineTypes.includes(node?.type)) { run.push(node); continue; }
      flush();
      parts.push(block(node));
    }
    flush();
    return parts.filter(part => part.trim() !== '').join(separator);
  };
  const items = node => {
    let number = Number.isInteger(node.attrs?.order) ? node.attrs.order : 1;
    return list(node.content).map(item => {
      const marker = node.type === 'orderedList' ? `${number++}. ` : '- ';
      // Continuation lines align with the item text, so nested bullets indent two spaces.
      const pad = ' '.repeat(marker.length);
      return blocks(item?.type === 'listItem' ? item.content : [item], '\n').split('\n').map((line, index) => index === 0 ? marker + line : line ? pad + line : '').join('\n');
    }).join('\n');
  };
  const quote = text => text ? text.split('\n').map(line => line ? `> ${line}` : '>').join('\n') : '';
  const table = node => {
    const rows = list(node.content).filter(row => row?.type === 'tableRow')
      .map(row => list(row.content).map(cell => blocks(cell?.content, ' ').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()));
    if (!rows.length) return '';
    const width = Math.max(1, ...rows.map(row => row.length));
    const line = cells => `| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`;
    return [line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n');
  };
  const block = node => {
    if (!node || typeof node !== 'object') return '';
    const attrs = node.attrs ?? {};
    switch (node.type) {
      case 'paragraph': return inline(node.content);
      case 'heading': return `${'#'.repeat(Math.min(Math.max(Number.isInteger(attrs.level) ? attrs.level : 1, 1), 6))} ${inline(node.content)}`;
      case 'bulletList': case 'orderedList': return items(node);
      case 'codeBlock': return `\`\`\`${typeof attrs.language === 'string' ? attrs.language : ''}\n${list(node.content).map(child => typeof child?.text === 'string' ? child.text : '').join('')}\n\`\`\``;
      case 'blockquote': case 'panel': return quote(blocks(node.content));
      case 'rule': return '---';
      case 'blockCard': case 'embedCard': return String(attrs.url ?? '');
      case 'table': return table(node);
      case 'media': case 'mediaSingle': case 'mediaGroup': return '';
      default: return blocks(node.content);
    }
  };
  return block(document).trim();
}
function jiraWorkitemKeys(data) {
  if (!Array.isArray(data)) throw new Error('Expected a work item array.');
  return { keys: data.map(item => { if (typeof item?.key !== 'string') throw new Error('Work item is missing its key.'); return item.key; }) };
}
function jiraWorkitemImport(data) {
  const fields = data?.fields;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.key !== 'string' || !fields || typeof fields !== 'object' || Array.isArray(fields) || typeof fields.summary !== 'string') throw new Error('Unexpected work item shape.');
  const name = value => typeof value?.name === 'string' ? value.name : null;
  const jiraType = name(fields.issuetype);
  const jiraPriority = name(fields.priority);
  const type = jiraType?.toLowerCase();
  const priorities = { highest: 1, high: 2, medium: 3, low: 4, lowest: 5 };
  const priority = jiraPriority?.toLowerCase();
  return {
    key: data.key, title: fields.summary,
    type: ['bug', 'story', 'epic', 'spike'].includes(type) ? type : 'task', jiraType,
    priority: priority && Object.hasOwn(priorities, priority) ? priorities[priority] : null, jiraPriority,
    labels: Array.isArray(fields.labels) ? fields.labels.filter(label => typeof label === 'string') : [],
    status: name(fields.status),
    descriptionMarkdown: adfToMarkdown(fields.description),
  };
}
const transforms = { jiraWorkitemKeys, jiraWorkitemImport };
function transformOutput(actionId, data) {
  const transform = commands[actionId].transform;
  return transform ? transforms[transform](data) : data;
}
function main() {
  const fail = (code, message, termination = {}) => ({ ok: false, error: { code, message, ...termination } });
  try {
    const bytes = readFileSync(0);
    if (bytes.length > 65536) return fail('invalid_input', 'Request exceeds 65536 bytes.');
    const request = JSON.parse(bytes.toString('utf8'));
    const allowed = ['protocolVersion', 'toolId', 'toolRevision', 'action', 'input', 'operationId', 'attemptId'];
    if (!request || request.protocolVersion !== 1 || request.toolId !== `valdr-tools.user.${cli}` || request.toolRevision !== revision || !['operationId', 'attemptId'].every(key => typeof request[key] === 'string' && request[key].length > 0) || Object.keys(request).some(key => !allowed.includes(key))) return fail('invalid_request', 'Invalid user-tool request envelope.');
    const command = commandFor(request.action, request.input);
    const result = spawnSync(cli, command.args, {
      encoding: 'utf8', shell: false, timeout: 25000, maxBuffer: 512 * 1024,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.error?.code === 'ENOENT') return fail('runtime_missing', `${cli} is not installed on the host PATH.`);
    if (result.error || result.status !== 0) {
      const secrets = Object.entries(process.env).filter(([key]) => /api[_-]?key|access[_-]?key|private[_-]?key|token|secret|authorization|auth|password|credential/i.test(key)).map(([, value]) => value).filter(Boolean);
      const details = [`${cli} failed (${result.error?.code ?? result.status ?? result.signal}).`];
      if (!result.error && failureDiagnostic && failureDiagnostic.actionPathPrefix.every((part, index) => commands[request.action].path[index] === part)) {
        const probe = spawnSync(cli, failureDiagnostic.args, { encoding: 'utf8', shell: false, timeout: 5000, maxBuffer: 16384, env: { ...process.env, ...environment }, stdio: ['ignore', 'ignore', 'pipe'] });
        if (probe.error || probe.status !== 0) details.push(`Authentication diagnostic: ${diagnosticText(probe, secrets, 600) || `status check failed (${probe.error?.code ?? probe.status ?? probe.signal}).`}`);
      }
      details.push(diagnosticText(result, secrets, 1200));
      return fail('cli_failed', details.filter(Boolean).join('\n').slice(0, 2000), { exitCode: result.status, signal: result.signal });
    }
    try { return { ok: true, data: command.text ? { version: result.stdout.trim() } : JSON.parse(result.stdout) }; }
    catch { return fail('invalid_output', `${cli} did not return valid JSON.`); }
  } catch (error) { return fail('invalid_input', error instanceof SyntaxError ? 'Request must be JSON.' : error.message); }
}

const settings = {
  gh: {
    revision: '1.0.5', name: 'GitHub CLI', icon: 'code-bracket-square',
    inheritEnv: ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_HOST', 'GH_CONFIG_DIR'],
    environment: { GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_NO_EXTENSION_UPDATE_NOTIFIER: '1', GH_TELEMETRY: '0', GH_PAGER: 'cat' },
  },
  aws: {
    revision: '1.0.5', name: 'AWS CLI', icon: 'server-stack',
    inheritEnv: ['AWS_PROFILE', 'AWS_REGION', 'AWS_DEFAULT_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_CONFIG_FILE', 'AWS_SHARED_CREDENTIALS_FILE'],
    environment: { AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off' },
  },
  gcloud: {
    revision: '1.0.5', name: 'Google Cloud CLI', icon: 'cloud',
    inheritEnv: ['CLOUDSDK_CONFIG', 'CLOUDSDK_ACTIVE_CONFIG_NAME', 'GOOGLE_APPLICATION_CREDENTIALS'],
    environment: { CLOUDSDK_CORE_DISABLE_PROMPTS: '1', CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: 'true' },
  },
  acli: { revision: '1.0.6', name: 'Atlassian CLI', icon: 'ticket', inheritEnv: [], environment: {}, failureDiagnostic: { actionPathPrefix: ['jira'], args: ['jira', 'auth', 'status'] } },
};
const check = process.argv.includes('--check');
function emit(file, content) {
  if (check) {
    if (readFileSync(file, 'utf8') !== content) throw new Error(`${file.pathname} needs regeneration: bun scripts/generate-user-workflow-cli-tools.mjs`);
  } else writeFileSync(file, content);
}
// Embed the checked-in redactor so each packaged runner is self-contained.
const redactionSnapshot = new URL('./lib/user-tool-redaction.mjs', import.meta.url);
const redaction = readFileSync(redactionSnapshot, 'utf8').replace('export ', '');
// split/join avoids `$` replacement patterns; a drifted anchor must fail generation, not silently skip the transform.
const replaceOnce = (source, search, replacement) => {
  const parts = source.split(search);
  if (parts.length !== 2) throw new Error(`Expected exactly one ${JSON.stringify(search)} in main(); found ${parts.length - 1}.`);
  return parts.join(replacement);
};
for (const [cli, entries] of Object.entries(adapters)) {
  const config = settings[cli];
  const revision = config.revision;
  const transformed = Object.values(entries).filter(spec => spec.transform);
  for (const spec of transformed) if (!Object.hasOwn(transforms, spec.transform)) throw new Error(`Unknown output transform: ${spec.transform}`);
  // Runners without transforms keep the shared main() text byte-for-byte, so their content hashes are unchanged.
  const mainSource = transformed.length === 0 ? main.toString() : replaceOnce(
    // Bun normalizes function text (512 * 1024 is folded), so anchors match the emitted form.
    replaceOnce(main.toString(), 'maxBuffer: 524288,', 'maxBuffer: commands[request.action].maxBuffer ?? 524288,'),
    ': JSON.parse(result.stdout) }',
    ': transformOutput(request.action, JSON.parse(result.stdout)) }',
  );
  const transformSource = transformed.length === 0 ? '' : `export ${adfToMarkdown.toString()}
${Object.values(transforms).map(transform => transform.toString()).join('\n')}
const transforms = { ${Object.keys(transforms).join(', ')} };
export ${transformOutput.toString()}
`;
  const directory = new URL(`../valdr-packs/valdr-tools/tools/${cli}/`, import.meta.url);
  if (!check) mkdirSync(directory, { recursive: true });
  // Share the protocol wrapper at generation time; installed snapshots remain self-contained.
  const runner = `// Generated by scripts/generate-user-workflow-cli-tools.mjs. Edit its authoring definitions.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const revision = ${JSON.stringify(revision)};
const cli = ${JSON.stringify(cli)};
const environment = ${JSON.stringify({ ...config.environment, PAGER: 'cat', NO_COLOR: '1' }, null, 2)};
const failureDiagnostic = ${JSON.stringify(config.failureDiagnostic ?? null)};
${redaction}
export const commands = ${JSON.stringify(entries, (key, value) => key === 'outputSchema' ? undefined : value, 2)};
export ${commandFor.toString()}
${diagnosticText.toString()}
${transformSource}${mainSource}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(JSON.stringify(main()) + '\\n');
`;
  emit(new URL('runner.mjs', directory), runner);
  const manifest = {
    schemaVersion: 1, id: `valdr-tools.user.${cli}`, revision, name: config.name, icon: config.icon,
    description: `Starter read actions for the host-installed ${cli} CLI. Extend the metadata for your workflows; host installation and authentication are required.`,
    files: [{ path: 'runner.mjs' }], process: { executable: 'node', args: ['runner.mjs'], inheritEnv: config.inheritEnv },
    limits: { timeoutSeconds: config.failureDiagnostic ? 35 : 30, maxInputBytes: 65536, maxResultBytes: 1048576, maxLogBytes: 4096 },
    actions: Object.entries(entries).map(([id, spec]) => ({
      id, path: spec.path, name: spec.path.join(' '), description: spec.description,
      inputSchema: { type: 'object', properties: spec.properties, required: spec.required, additionalProperties: false },
      outputSchema: spec.outputSchema ?? (spec.text ? { type: 'object', properties: { version: { type: 'string' } }, required: ['version'], additionalProperties: false } : true),
      execution: 'supported', sideEffects: 'read', retry: 'idempotent',
    })),
  };
  emit(new URL(`${cli}.tool.yaml`, directory), `${Bun.YAML.stringify(manifest, null, 2).replace(/[ \t]+$/gm, '')}\n`);
}
