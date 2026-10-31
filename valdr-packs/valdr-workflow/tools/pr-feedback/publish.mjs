import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrFeedbackError } from './contract.mjs';
import { readPr } from './github.mjs';

const fail = message => { throw new PrFeedbackError('publication_blocked', message); };
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const canonicalPaths = paths => [...new Set(paths)].sort();

/** Publish the exact reviewed tree; an interrupted publication requires inspection, never automatic replay. */
export function publishReviewed(input, { cwd = process.cwd(), env = process.env } = {}) {
  const { owner, repo, number, remoteName, headBranch, expectedHeadSha, expectedTreeSha, paths } = input;
  if (!sha(expectedHeadSha) || !sha(expectedTreeSha) || !Array.isArray(paths)
    || !paths.every(p => typeof p === 'string' && p !== '' && !p.includes('\0') && !path.isAbsolute(p) && !p.split('/').includes('..'))
    || typeof remoteName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(remoteName)
    || typeof headBranch !== 'string' || headBranch.startsWith('-')) fail('Invalid reviewed publication input.');
  const deadline = Date.now() + 50000;
  const gitEnv = { ...env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete gitEnv[key];
  const git = (args, index) => {
    const timeout = Math.min(20000, deadline - Date.now());
    if (timeout <= 0) fail('Publication ran out of time; inspect the branch before retrying.');
    const result = spawnSync('git', ['--literal-pathspecs', ...args], {
      cwd, env: { ...gitEnv, ...(index ? { GIT_INDEX_FILE: index } : {}) }, shell: false,
      encoding: 'utf8', timeout, maxBuffer: 1048576, stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.error || result.status !== 0) fail(`Git ${args[0]} failed; inspect the branch before retrying.`);
    return result.stdout;
  };
  git(['check-ref-format', '--branch', headBranch]);
  if (git(['branch', '--show-current']).trim() !== headBranch || git(['rev-parse', 'HEAD']).trim() !== expectedHeadSha) fail('The implementation branch changed after review.');
  const headTree = git(['rev-parse', 'HEAD^{tree}']).trim();
  if (git(['write-tree']).trim() !== headTree) fail('Staged changes require inspection before publication.');
  const destination = git(['remote', 'get-url', '--push', '--all', remoteName]).trim();
  let remote;
  try { remote = new URL(destination.replace(/^([^/@]+)@([^/:]+):/, 'ssh://$1@$2/')); } catch { fail('The push destination is not a supported GitHub repository URL.'); }
  if (!['https:', 'ssh:'].includes(remote.protocol) || remote.hostname.toLowerCase() !== (env.GH_HOST || 'github.com').toLowerCase()
    || remote.pathname.replace(/^\//, '').replace(/\.git$/, '').toLowerCase() !== `${owner}/${repo}`.toLowerCase()
    || destination.includes('\n')) fail('The push destination does not match this pull request.');
  const remoteHead = () => git(['ls-remote', '--refs', destination, `refs/heads/${headBranch}`]).trim().split(/\s/)[0];
  const checkPr = () => {
    const pr = readPr(owner, repo, number, { env, deadline, timeoutMs: 20000 });
    if (pr.state !== 'open' || !pr.sameRepo || !pr.headAvailable || pr.headRef !== headBranch || pr.headSha !== expectedHeadSha) fail('The pull request closed or its head changed after review.');
    if (remoteHead() !== expectedHeadSha) fail('The remote branch changed after review.');
  };
  checkPr();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'valdr-pr-publish-'));
  const preparedIndex = path.join(temp, 'index');
  const rawIndex = git(['rev-parse', '--git-path', 'index']).trim();
  const indexPath = path.resolve(cwd, rawIndex), lockPath = `${indexPath}.lock`;
  let lock, ownsLock = false;
  try {
    git(['read-tree', expectedHeadSha], preparedIndex);
    git(['add', '-A', '--', '.'], preparedIndex);
    const tree = git(['write-tree'], preparedIndex).trim();
    const changedPaths = git(['diff', '--name-only', '--no-renames', '-z', expectedHeadSha, tree, '--']).split('\0').filter(Boolean);
    if (tree !== expectedTreeSha || JSON.stringify(canonicalPaths(changedPaths)) !== JSON.stringify(canonicalPaths(paths))) fail('Worktree changes no longer match the reviewed snapshot.');
    if (tree === headTree) return { commitSha: expectedHeadSha, changed: false };
    checkPr();
    lock = fs.openSync(lockPath, 'wx', 0o666); ownsLock = true;
    const liveIndex = path.join(temp, 'live-index');
    fs.copyFileSync(indexPath, liveIndex);
    if (git(['write-tree'], liveIndex).trim() !== headTree) fail('The index changed during publication.');
    const commitSha = git(['commit-tree', tree, '-p', expectedHeadSha, '-m', 'Address pull request feedback']).trim();
    git(['update-ref', `refs/heads/${headBranch}`, commitSha, expectedHeadSha]);
    fs.writeFileSync(lock, fs.readFileSync(preparedIndex)); fs.fsyncSync(lock); fs.closeSync(lock); lock = undefined;
    fs.renameSync(lockPath, indexPath); ownsLock = false;
    // Push the frozen reviewed commit; a concurrent remote change is rejected by ordinary fast-forward rules.
    git(['push', '--no-follow-tags', destination, `${commitSha}:refs/heads/${headBranch}`]);
    if (remoteHead() !== commitSha) fail('The pushed commit could not be confirmed; inspect the remote branch.');
    return { commitSha, changed: true };
  } finally {
    if (lock !== undefined) fs.closeSync(lock);
    if (ownsLock) fs.rmSync(lockPath, { force: true });
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
