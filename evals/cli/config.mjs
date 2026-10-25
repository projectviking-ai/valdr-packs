import fs from 'node:fs';

const BUILTIN_PROFILES = Object.freeze({
  'sol-high': { providerType: 'codex', model: 'gpt-6.1-sol', reasoningEffort: 'high' },
});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const known = (value, keys, label) => {
  if (!object(value)) throw new Error(`${label} must be an object.`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Unsupported ${label} field: ${key}.`);
};
export function loadConfiguration(file) {
  if (!file) return { defaults: {}, profiles: { ...BUILTIN_PROFILES } };
  let config;
  try { config = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error('Cannot read evaluation configuration. Use an existing file containing valid JSON.'); }
  known(config, ['schemaVersion', 'defaults', 'profiles'], 'configuration');
  if (config.schemaVersion !== 1) throw new Error('Evaluation configuration requires schemaVersion: 1.');
  known(config.defaults ?? {}, ['suite', 'scenario', 'agentPath', 'tier', 'profile', 'round', 'maxRepairs', 'timeoutMs', 'valdrBin', 'packsRoot', 'evidenceRoot'], 'defaults');
  known(config.profiles ?? {}, Object.keys(config.profiles ?? {}), 'profiles');
  for (const [name, profile] of Object.entries(config.profiles ?? {})) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error('Profile names must use lowercase letters, digits and hyphens.');
    known(profile, ['providerType', 'model', 'reasoningEffort'], `profile ${name}`);
    if (profile.providerType !== undefined && profile.providerType !== 'codex') throw new Error('This release supports Codex profiles only.');
    if (typeof profile.model !== 'string' || !profile.model.trim()) throw new Error(`Profile ${name} requires a nonblank model.`);
    if (!['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(profile.reasoningEffort)) throw new Error(`Profile ${name} has an unsupported reasoningEffort.`);
  }
  return { defaults: config.defaults ?? {}, profiles: { ...BUILTIN_PROFILES, ...config.profiles } };
}
export function selectProfile(name, profiles = BUILTIN_PROFILES) {
  const profile = Object.hasOwn(profiles, name) ? profiles[name] : null;
  if (!profile) throw new Error(`Unknown execution profile ${name}. Select a configured profile or sol-high.`);
  return { ...profile, key: `valdr-agent-eval-${name}`, providerType: 'codex', model: profile.model.trim(), sandboxMode: 'workspace-write', approvalPolicy: 'never' };
}
