import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadEvidence } from '../reporting/evidence.mjs';
import { buildReport } from '../reporting/report.mjs';
import { suiteNames } from '../suites/registry.mjs';

const dayMs = 86400000;
const generatedName = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9][a-z0-9-]*-[a-f0-9]{6}$/;
const receiptNames = ['summary.json','charter.json','scenario-snapshot.json','source-manifest.json'];
const identity = stat => `${stat.dev}:${stat.ino}`;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const exists = file => { try { return fs.lstatSync(file); } catch (error) { if (error.code==='ENOENT') return null; throw error; } };
function rootInfo(input) {
  const resolved=path.resolve(input), stat=exists(resolved);
  if (!stat) return {root:resolved,identity:null,missing:true};
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${resolved}: evidence root must be a directory, never a link.`);
  return {root:fs.realpathSync(resolved),identity:identity(stat),missing:false};
}
function inspectRun(root,name) {
  const directory=path.join(root,name), stat=fs.lstatSync(directory);
  const item={name,directory,suite:null,mode:null,outcome:null,completedAt:null,recognized:false,reason:null};
  if (stat.isSymbolicLink() || !stat.isDirectory()) return {...item,reason:'Not a regular run directory; links are never followed.'};
  if (!generatedName.test(name)) return {...item,reason:'Unrecognized run directory name.'};
  if (exists(path.join(directory,'.active'))) return {...item,reason:'Active marker present; investigate stale markers manually.'};
  try {
    const receipts=[];
    for (const file of receiptNames) {
      const source=path.join(directory,file),info=exists(source);
      if (!info) throw new Error(`Missing required receipt: ${file}.`);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${file} is not a regular receipt.`);
      if (info.size>4*1024*1024) throw new Error(`${file} exceeds the 4 MiB retention metadata limit.`);
      receipts.push(hash(fs.readFileSync(source)));
    }
    const evidence=loadEvidence(directory),{summary,charter,scenarios,sourceManifest}=evidence;
    if (charter===null) throw new Error('charter.json must contain an object.');
    if (scenarios===null) throw new Error('scenario-snapshot.json must contain an array.');
    if (sourceManifest===null) throw new Error('source-manifest.json must contain an object.');
    item.suite=summary.suite;item.outcome=summary.outcome;item.mode=charter?.mode;
    item.completedAt=summary.completedAt??null;
    if (!suiteNames.includes(item.suite) || charter?.suite!==item.suite || summary.suiteVersion!==charter?.suiteVersion
        || !['run','check','replay'].includes(item.mode)) throw new Error('Missing or inconsistent suite/mode provenance.');
    item.recognized=true;
    const completed=Date.parse(item.completedAt),started=Date.parse(charter.startedAt);
    if (typeof item.completedAt!=='string' || !Number.isFinite(completed) || !Number.isFinite(started) || started>completed) throw new Error('Missing or invalid completed-run receipt.');
    if (!['passed','candidate_failed','policy_rejected'].includes(item.outcome)) throw new Error('Incomplete or cancelled outcome.');
    if (item.mode==='run') {
      const report=buildReport(evidence);
      if (!report.complete) throw new Error('Incomplete case measurements or cleanup.');
    } else if (summary.cleanup?.ok!==true) throw new Error('Verified cleanup receipt is missing.');
    if (summary.ok!==(item.outcome==='passed')) throw new Error('Summary status and outcome disagree.');
    item.fingerprint=hash(JSON.stringify([identity(stat),stat.mtimeMs,stat.ctimeMs,receipts]));
  } catch (error) { item.reason=`Protected: ${error.message}`; }
  return item;
}
export function inventoryRuns(input) {
  const info=rootInfo(input);
  const names=info.missing?[]:fs.readdirSync(info.root);
  if (names.length>10000) throw new Error(`${info.root}: exceeds the 10000-entry inventory limit; narrow the evidence root.`);
  const runs=names.sort().map(name=>inspectRun(info.root,name));
  return {schemaVersion:1,ok:true,...info,runs};
}
export function planPrune(inventory,{olderThanDays=30,keep=5,includeFailed=false,now=Date.now()}={}) {
  if (!Number.isInteger(olderThanDays)||olderThanDays<0||olderThanDays>36500) throw new Error('olderThanDays must be between 0 and 36500.');
  if (!Number.isInteger(keep)||keep<0||keep>10000) throw new Error('keep must be between 0 and 10000.');
  if (!Number.isFinite(now)) throw new Error('Retention clock must be a finite timestamp.');
  const newest=new Set(inventory.runs.filter(item=>item.fingerprint).sort((a,b)=>Date.parse(b.completedAt??0)-Date.parse(a.completedAt??0)||b.name.localeCompare(a.name)).slice(0,keep).map(item=>item.name));
  const selected=[],protectedRuns=[];
  for (const item of inventory.runs) {
    const reason=item.reason || (newest.has(item.name)?`Among newest ${keep} recognized runs.`:null)
      || (Date.parse(item.completedAt)>now-olderThanDays*dayMs?`Newer than ${olderThanDays} days.`:null)
      || (!includeFailed && item.outcome!=='passed'?'Failed candidates are retained; use --include-failed to opt in.':null);
    if (reason) protectedRuns.push({...item,reason});else selected.push(item);
  }
  return {schemaVersion:1,ok:true,root:inventory.root,identity:inventory.identity,dryRun:true,olderThanDays,keep,includeFailed,now,selected,protected:protectedRuns,deleted:[]};
}
export function applyPrune(plan) {
  const inventory=inventoryRuns(plan.root);
  if (inventory.identity!==plan.identity) throw new Error('Evidence root changed or was replaced; preview again.');
  const current=planPrune(inventory,plan);
  if (JSON.stringify(current.selected.map(item=>[item.name,item.fingerprint]))!==JSON.stringify(plan.selected.map(item=>[item.name,item.fingerprint]))) throw new Error('Run identity, receipts or active state changed; preview again before deleting.');
  const deleted=[];
  for (const item of current.selected) {
    if (rootInfo(plan.root).identity!==plan.identity || inspectRun(plan.root,item.name).fingerprint!==item.fingerprint) throw new Error('Run or root changed during pruning; inspect evidence before retrying.');
    fs.rmSync(path.join(plan.root,item.name),{recursive:true});
    deleted.push(item.name);
  }
  return {...current,dryRun:false,deleted};
}
export function markActive(directory) {
  const file=path.join(directory,'.active'),token=crypto.randomUUID();
  fs.writeFileSync(file,JSON.stringify({schemaVersion:1,pid:process.pid,startedAt:new Date().toISOString(),token}),{flag:'wx',mode:0o600});
  const owner=identity(fs.lstatSync(file));let released=false;
  return ()=>{
    if (released) return;
    const stat=exists(file);
    if (!stat || stat.isSymbolicLink() || identity(stat)!==owner || JSON.parse(fs.readFileSync(file,'utf8')).token!==token) throw new Error(`${file}: active marker ownership changed; investigate manually.`);
    fs.unlinkSync(file);released=true;
  };
}
