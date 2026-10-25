import fs from 'node:fs';
import path from 'node:path';

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const validScenarioId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const outcomes = new Set(['passed','candidate_failed','policy_rejected','infrastructure_incomplete','submission_incomplete','cancelled']);
const maximumEvidenceBytes = 64 * 1024 * 1024;
function readJson(file, optional = false, budget) {
  let descriptor, bytes;
  try {
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const info = fs.fstatSync(descriptor);
    if (!info.isFile()) throw new Error('Saved evidence must be a regular file.');
    if (info.size > maximumEvidenceBytes || (budget && info.size > budget.remaining)) throw new Error('Evidence exceeds the 64 MiB reporting limit.');
    bytes = Buffer.alloc(info.size + 1);
    let length = 0, count;
    while (length < bytes.length && (count = fs.readSync(descriptor, bytes, length, bytes.length - length, null)) > 0) length += count;
    if (length > info.size) throw new Error('Saved evidence changed while reading; retry after the run stops.');
    bytes = bytes.subarray(0, length);
    if (budget) budget.remaining -= length;
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    throw new Error(`${file}: cannot read saved evidence. ${error.message}`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error(`${file}: expected valid JSON. Restore the original evidence file.`); }
}
function readProviderEvents(directory, scenarioId, attempt, budget) {
  const caseDirectory = path.join(directory, scenarioId);
  const attemptDirectory = path.join(caseDirectory, `attempt-${attempt}`);
  const file = path.join(attemptDirectory, 'provider-events.json');
  try {
    for (const part of [directory, caseDirectory, attemptDirectory, file]) {
      const info = fs.lstatSync(part);
      if (info.isSymbolicLink()) throw new Error('Provider evidence must not use symbolic links.');
      if (part !== file && !info.isDirectory()) throw new Error('Provider evidence parents must be directories.');
    }
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`${file}: cannot read saved evidence. ${error.message}`);
  }
  const events = readJson(file, false, budget);
  if (!Array.isArray(events) || events.length > 10000) throw new Error(`${file}: provider events must be an array with at most 10000 entries.`);
  for (const event of events) {
    if (!isRecord(event) || typeof event.type !== 'string' || !event.type.trim()) throw new Error(`${file}: each provider event requires a nonempty string type.`);
    if (event.type.startsWith('item.')) {
      if (!isRecord(event.item) || typeof event.item.type !== 'string' || !event.item.type.trim()) throw new Error(`${file}: item events require an item object with a string type.`);
      for (const field of ['id','server','tool','status','text']) if (event.item[field] !== undefined && typeof event.item[field] !== 'string') throw new Error(`${file}: provider event item.${field} must be a string.`);
    }
  }
  return events;
}
function checkId(id, file, seen) {
  if (!validScenarioId(id) || seen.has(id)) throw new Error(`${file}: scenario IDs must be unique safe path segments.`);
  seen.add(id);
}
export function loadEvidence(input) {
  const resolved = path.resolve(input);
  let directory, summaryPath;
  try {
    const info = fs.statSync(resolved);
    directory = info.isDirectory() ? resolved : path.dirname(resolved);
    summaryPath = info.isDirectory() ? path.join(resolved,'summary.json') : resolved;
  } catch { throw new Error(`${resolved}: run not found. Pass a saved run directory or summary.json.`); }
  const summary = readJson(summaryPath);
  if (!isRecord(summary) || summary.schemaVersion !== 1) throw new Error(`${summaryPath}: supported summary schemaVersion is 1.`);
  if (typeof summary.suite !== 'string' || !summary.suite.trim()) throw new Error(`${summaryPath}: missing suite ID.`);
  if (summary.ok !== undefined && typeof summary.ok !== 'boolean') throw new Error(`${summaryPath}: ok must be boolean.`);
  if (!outcomes.has(summary.outcome)) throw new Error(`${summaryPath}: missing or unsupported outcome.`);
  if (summary.results !== undefined) {
    if (!Array.isArray(summary.results) || summary.results.length > 1000) throw new Error(`${summaryPath}: results must be an array with at most 1000 cases.`);
    const seen = new Set();
    for (const result of summary.results) {
      if (!isRecord(result)) throw new Error(`${summaryPath}: each scenario result must be an object.`);
      checkId(result.scenarioId,summaryPath,seen);
      if (!Array.isArray(result.attempts) || result.attempts.length > 100) throw new Error(`${summaryPath}: scenario attempts must be an array with at most 100 entries.`);
      const attempts = new Set();
      for (const attempt of result.attempts) {
        if (!isRecord(attempt) || !Number.isSafeInteger(attempt.attempt) || attempt.attempt < 1 || attempts.has(attempt.attempt)) throw new Error(`${summaryPath}: attempt numbers must be unique positive integers.`);
        attempts.add(attempt.attempt);
        if (attempt.evaluation !== undefined && (!isRecord(attempt.evaluation) || typeof attempt.evaluation.ok !== 'boolean')) throw new Error(`${summaryPath}: evaluation.ok must be boolean.`);
        if (attempt.author !== undefined && !isRecord(attempt.author)) throw new Error(`${summaryPath}: author receipt must be an object.`);
        if (attempt.evaluation) {
          const checkArray=(value,field)=>{if(value!==undefined && value!==null && !Array.isArray(value))throw new Error(`${summaryPath}: ${field} must be an array.`);};
          for(const field of ['errors','validation','variants'])checkArray(attempt.evaluation[field],`evaluation.${field}`);
          checkArray(attempt.evaluation.safety?.errors,'evaluation.safety.errors');
          const checkMembers=(values,field,allowStrings=false)=>{for(const value of values??[])if(!isRecord(value) && !(allowStrings && typeof value==='string'))throw new Error(`${summaryPath}: ${field} contains an invalid diagnostic member.`);};
          checkMembers(attempt.evaluation.validation,'evaluation.validation');
          checkMembers(attempt.evaluation.variants,'evaluation.variants');
          for(const validation of attempt.evaluation.validation??[]){checkArray(validation.errors,'validation.errors');checkMembers(validation.errors,'validation.errors',true);}
          for(const variant of attempt.evaluation.variants??[]){
            checkArray(variant.assertions,'variant.assertions');checkMembers(variant.assertions,'variant.assertions');
            for(const assertion of variant.assertions??[])if(typeof assertion.pass!=='boolean' || typeof assertion.message!=='string')throw new Error(`${summaryPath}: variant.assertions require boolean pass and string message fields.`);
          }
        }
      }
      if (result.cleanup !== undefined && (!isRecord(result.cleanup) || typeof result.cleanup.ok !== 'boolean')) throw new Error(`${summaryPath}: cleanup.ok must be boolean.`);
    }
  }
  const charter = readJson(path.join(directory,'charter.json'),true);
  const scenarios = readJson(path.join(directory,'scenario-snapshot.json'),true);
  const sourceManifest = readJson(path.join(directory,'source-manifest.json'),true);
  if (charter !== null && !isRecord(charter)) throw new Error(`${directory}/charter.json: expected an object.`);
  if (sourceManifest !== null && !isRecord(sourceManifest)) throw new Error(`${directory}/source-manifest.json: expected an object.`);
  if (scenarios !== null) {
    if (!Array.isArray(scenarios) || scenarios.length > 1000) throw new Error(`${directory}/scenario-snapshot.json: expected an array with at most 1000 cases.`);
    const seen = new Set();
    for (const scenario of scenarios) {
      if (!isRecord(scenario)) throw new Error(`${directory}/scenario-snapshot.json: expected scenario objects.`);
      checkId(scenario.id,`${directory}/scenario-snapshot.json`,seen);
    }
  }
  const artifacts = [];
  const providerEvents = Object.create(null);
  const providerBudget = { remaining: maximumEvidenceBytes };
  for (const name of ['summary.json','charter.json','scenario-snapshot.json','source-manifest.json']) {
    const file = name==='summary.json' ? summaryPath : path.join(directory,name);
    if (fs.existsSync(file)) artifacts.push({path:file,label:name});
  }
  for (const result of summary.results??[]) {
    providerEvents[result.scenarioId] = Object.create(null);
    for (const attempt of result.attempts) providerEvents[result.scenarioId][attempt.attempt] = readProviderEvents(directory, result.scenarioId, attempt.attempt, providerBudget);
    const paths=[['result.json',undefined],...result.attempts.map(attempt=>[`attempt-${attempt.attempt}/result.json`,attempt.attempt])];
    for (const [name,attempt] of paths) {
      const file=path.join(directory,result.scenarioId,name);
      if (fs.existsSync(file)) artifacts.push({path:file,label:attempt?`Attempt ${attempt} result`:'Case result',scenarioId:result.scenarioId});
    }
  }
  return { directory, summaryPath, summary, charter, scenarios, sourceManifest, artifacts, providerEvents };
}
