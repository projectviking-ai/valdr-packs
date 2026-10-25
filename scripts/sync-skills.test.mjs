import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const makefile = fileURLToPath(new URL('../Makefile', import.meta.url));

function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-skill-sync-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.copyFileSync(makefile, path.join(directory, 'Makefile'));
  fs.writeFileSync(path.join(directory, 'VALDR_WORKFLOW_CLI_VERSION'), '0.0.0\n');
  return directory;
}

function write(directory, relative, contents) {
  const target = path.join(directory, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function seedDestination(directory, destination) {
  write(directory, `${destination}/valdr-managed/SKILL.md`, 'Old skill');
  write(directory, `${destination}/valdr-managed/stale.txt`, 'Remove this managed file');
  write(directory, `${destination}/valdr-evals/SKILL.md`, 'Repository-only evaluation skill');
  write(directory, `${destination}/custom-skill/SKILL.md`, 'User skill');
}

function verifyDestination(directory, destination) {
  assert.equal(fs.readFileSync(path.join(directory, destination, 'valdr-managed/SKILL.md'), 'utf8'), 'Current source skill');
  assert.equal(fs.existsSync(path.join(directory, destination, 'valdr-managed/stale.txt')), false);
  assert.equal(fs.readFileSync(path.join(directory, destination, 'valdr-evals/SKILL.md'), 'utf8'), 'Repository-only evaluation skill');
  assert.equal(fs.readFileSync(path.join(directory, destination, 'custom-skill/SKILL.md'), 'utf8'), 'User skill');
}

test('project skill sync replaces managed contents and preserves repository-only skills', t => {
  const directory = workspace(t);
  write(directory, 'skills/valdr-managed/SKILL.md', 'Current source skill');
  const destinations = ['.agents/skills', '.claude/skills', '.gemini/skills'];
  for (const destination of destinations) seedDestination(directory, destination);
  execFileSync('make', ['sync-skills'], { cwd: directory, stdio: 'pipe' });
  for (const destination of destinations) verifyDestination(directory, destination);
});

test('skill sync with no source skills leaves existing destinations intact', t => {
  const directory = workspace(t);
  write(directory, '.agents/skills/valdr-evals/SKILL.md', 'Keep this skill');
  execFileSync('make', ['sync-skills'], { cwd: directory, stdio: 'pipe' });
  assert.equal(fs.readFileSync(path.join(directory, '.agents/skills/valdr-evals/SKILL.md'), 'utf8'), 'Keep this skill');
});

for (const [target, destination] of [
  ['sync-skills-agent', '.agents/skills'],
  ['sync-skills-codex', '.agents/skills'],
  ['sync-skills-claude', '.claude/skills'],
  ['sync-skills-gemini', '.gemini/skills'],
]) test(`${target} preserves skills absent from this repository's source`, t => {
  const directory = workspace(t);
  const temporaryHome = path.join(directory, 'home');
  write(directory, 'skills/valdr-managed/SKILL.md', 'Current source skill');
  seedDestination(temporaryHome, destination);
  execFileSync('make', [target, `HOME=${temporaryHome}`], { cwd: directory, stdio: 'pipe' });
  verifyDestination(temporaryHome, destination);
});
