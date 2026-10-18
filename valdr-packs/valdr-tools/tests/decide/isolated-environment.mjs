import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function readValdrEnvironment(envFile, inheritedEnv = process.env) {
  let contents;
  try { contents = readFileSync(envFile, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return { ...inheritedEnv }; throw error; }
  return { ...parseEnv(contents), ...inheritedEnv };
}

// Licensing uses the normal user environment; PM state belongs to the test run.
export function isolatedValdrLaunch(dirs, inheritedEnv = process.env) {
  return {
    env: { ...inheritedEnv, PM_MCP_HOME: dirs.pm, TMPDIR: dirs.tmp },
    flags: ['--data-root', dirs.data, '--pm-home', dirs.pm, '--runtime-root', dirs.runtime],
  };
}
