import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGhReference, parseCobraHelp, classify, coverageStatus } from '../skills/valdr-workflow-tools/scripts/discover-cli.mjs';

test('gh reference inventory retains groups, leaves and aliases without flag syntax', () => {
  assert.deepEqual(parseGhReference('# gh reference\n\n## gh repo <command>\n\nAliases\n\ngh repos\n\n### gh repo view [<repository>] [flags]\n\nDescription\n'), [
    { path: ['repo'], kind: 'group', aliases: [['repos']] },
    { path: ['repo', 'view'], kind: 'command', aliases: [] },
  ]);
});

test('gh headings with children are groups even without a command placeholder', () => {
  const commands = parseGhReference('## gh attestation\n\n### gh attestation verify <file>\n\n## gh codespace [flags]\n\n### gh codespace list\n');
  assert.equal(commands.find(command => command.path.join(' ') === 'attestation')?.kind, 'group');
  assert.equal(commands.find(command => command.path.join(' ') === 'codespace')?.kind, 'group');
});

test('metadata exceptions are incomplete regardless of their error wording', () => {
  assert.equal(coverageStatus(['s3api: ImportError'], []), 'INCOMPLETE');
  assert.equal(coverageStatus([], ['Local alias not inspected']), 'INCOMPLETE');
  assert.equal(coverageStatus([], ['User configuration excluded from bundled CLI scope']), 'PASS');
});

test('unsupported authored actions retain their own reason', () => {
  const [row] = classify([{ path: ['auth', 'login'], kind: 'command' }], {
    actions: [{ id: 'auth-login', path: ['auth', 'login'], execution: 'unsupported', unsupportedReason: 'Interactive login remains a host responsibility.' }],
  });
  assert.equal(row.unsupportedReason, 'Interactive login remains a host responsibility.');
  assert.equal(row.execution, 'unsupported');
});

test('Cobra help parses both command sections and excludes flags and examples', () => {
  assert.deepEqual(parseCobraHelp('Usage:\n  acli [command]\n\nAvailable Commands\n  jira       Jira commands\n  confluence Confluence commands\n\nAdditional Commands:\n  help       Help\n\nAliases:\n  issue, workitem\n\nFlags:\n  -h, --help Help\n'), {
    children: ['jira', 'confluence', 'help'], aliases: ['issue', 'workitem'],
  });
  assert.deepEqual(parseCobraHelp('Usage:\n  acli jira workitem view [key]\n\nExamples:\n  acli jira workitem delete KEY-1\n'), { children: [], aliases: [] });
});

test('every discovered command receives reviewed action identity or an explicit unsupported reason', () => {
  const result = classify([{ path: ['jira'], kind: 'group' }, { path: ['jira', 'delete'], kind: 'command' }], {
    actions: [{ id: 'version', path: ['version'], execution: 'supported' }],
  });
  assert.equal(result.length, 3);
  assert(result.filter(row => row.execution === 'unsupported').every(row => row.unsupportedReason && row.schemaConfidence === 'inventory-only'));
  assert.deepEqual(result.find(row => row.actionId === 'version')?.path, ['version']);
});
