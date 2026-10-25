import path from 'node:path';
import { fileURLToPath } from 'node:url';
const defaultRoot=fileURLToPath(new URL('../../.valdr-evals',import.meta.url));
export function parseRetentionArgs(args) {
  const mode=args[0],options={mode,json:false,evidenceRoot:defaultRoot,apply:false,olderThanDays:30,keep:5,includeFailed:false};
  let dryRun=false;
  for(let index=1;index<args.length;index++) {
    const flag=args[index];
    if (['--help','-h'].includes(flag)) {options.help=true;continue;}
    if (flag==='--json') {options.json=true;continue;}
    if (mode==='prune'&&flag==='--apply') {options.apply=true;continue;}
    if (mode==='prune'&&flag==='--dry-run') {dryRun=true;continue;}
    if (mode==='prune'&&flag==='--include-failed') {options.includeFailed=true;continue;}
    const field=flag==='--evidence-root'?'evidenceRoot':mode==='prune'?{'--older-than-days':'olderThanDays','--keep':'keep'}[flag]:null;
    if (!field) throw new Error(`Unsupported ${mode} option ${flag}. Use --help for retention usage.`);
    const value=args[++index];
    if (!value||value.startsWith('-')) throw new Error(`${flag} requires a value.`);
    if (field==='evidenceRoot') options[field]=path.resolve(value);
    else {
      if (!/^\d+$/.test(value)||Number(value)>(field==='keep'?10000:36500)) throw new Error(`${flag} must be an integer between 0 and ${field==='keep'?10000:36500}.`);
      options[field]=Number(value);
    }
  }
  if (options.apply&&dryRun) throw new Error('Choose --apply or --dry-run, not both.');
  return options;
}
export function renderRetentionResult(options,result) {
  if (options.mode==='runs') return `Saved evaluations: ${result.runs.length}\nEvidence root: ${result.root}${result.missing?' (not created)':''}\n`+result.runs.map(item=>`  ${item.name}  ${item.suite??'unknown'}  ${item.outcome??'unknown'}  ${item.completedAt??'unfinished'}${item.reason?` — ${item.reason}`:''}`).join('\n');
  return `${result.dryRun?'Prune preview (no deletion)':'Prune complete'}: ${result.selected.length} selected; ${result.protected.length} protected\nEvidence root: ${result.root}\n`+
    result.selected.map(item=>`  ${result.dryRun?'Would delete':'Deleted'} ${item.name}`).join('\n')+'\n'+result.protected.map(item=>`  Protected ${item.name}: ${item.reason}`).join('\n')+`\n${result.dryRun?'Use --apply to delete the selected evidence directories permanently.':'Deleted directories cannot be restored by the harness.'}`;
}
