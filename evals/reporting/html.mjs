import { formatDuration } from './report.mjs';
import { readFileSync } from 'node:fs';

const escape = value => String(value ?? 'Not recorded').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const iconSources = Object.fromEntries(['check','circle-check','x','alert-circle','arrow-right','chevron-down'].map(name=>[
  name,readFileSync(new URL(`./assets/tabler/${name}.svg`,import.meta.url),'utf8'),
]));
const iconLicense = readFileSync(new URL('./assets/tabler/LICENSE',import.meta.url),'utf8');
function icon(name,className='icon',color='#146b5b') {
  const source=iconSources[name].replaceAll('currentColor',color);
  return `<img class="${className}" src="data:image/svg+xml;charset=utf-8,${escape(encodeURIComponent(source))}" alt="" aria-hidden="true" width="24" height="24">`;
}
const humanLabel = value => String(value ?? 'Not recorded').replace(/^\d+[_-]/,'').replace(/[_-]/g,' ').replace(/^./,character=>character.toUpperCase());
const agentName = report => report.agentPath ? humanLabel(report.agentPath.split('/').at(-1).replace(/\.agent\.ya?ml$/,'')) : 'Agent not recorded';
function dateLabel(report) {
  const date=new Date(report.startedAt ?? report.completedAt ?? '');
  return Number.isNaN(date.getTime())?'Date not recorded':date.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
}
const badge = (value,label=value.replaceAll('_',' ')) => `<span class="badge ${['passed','improved'].includes(value)?'good':['candidate_failed','policy_rejected','regressed'].includes(value)?'bad':'neutral'}">${escape(label)}</span>`;
const css = `
:root{color-scheme:light;--ink:#102b33;--muted:#536e79;--line:#d2dfe2;--paper:#fff;--teal:#075b49;--teal-soft:#eff6f3;--bg:#fff;font-family:Arial,Helvetica,sans-serif;font-size:16px}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--paper);color:var(--ink);line-height:1.5}main{max-width:1440px;margin:0 auto;padding:20px 64px 28px}h1,h2,h3,h4,p{margin-top:0}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h2{font-size:30px;line-height:1.2;margin-bottom:12px}h3{font-size:18px;line-height:1.35;margin-bottom:10px}h4{font-size:16px;margin:22px 0 10px}p{overflow-wrap:anywhere}a{color:var(--teal);text-underline-offset:3px}a:hover{text-decoration-thickness:2px}a:focus-visible,summary:focus-visible{outline:3px solid #16806c;outline-offset:4px;border-radius:3px}img{max-width:100%}.icon{display:inline-block;width:24px;height:24px;object-fit:contain;flex:0 0 auto;vertical-align:middle}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.report-masthead{display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid #78949b;padding:0 0 16px;margin:0}.wordmark{margin:0;display:flex;align-items:baseline;gap:12px;color:var(--muted);font-size:15px;letter-spacing:.08em;text-transform:uppercase}.wordmark strong{font-size:24px;letter-spacing:.07em;color:var(--ink)}.report-date{font-size:15px;color:var(--muted);white-space:nowrap}.report-layout{display:grid;grid-template-columns:minmax(0,72fr) minmax(280px,28fr);align-items:stretch}.report-main{min-width:0;padding:36px 36px 24px 0}.run-facts{min-width:0;border-left:1px solid var(--line);padding:36px 0 28px 36px}.run-facts h2{font-size:27px;margin:0 0 20px}.run-facts h3{margin-bottom:10px}.run-facts p{color:var(--muted);margin-bottom:0}.facts-list{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1fr);column-gap:20px;row-gap:14px;font-size:16px;margin:0}.facts-list dt{color:var(--muted);font-weight:400}.facts-list dd{margin:0;color:var(--ink);overflow-wrap:anywhere}.facts-group{border-top:1px solid var(--line);padding-top:24px;margin-top:24px}.run-facts>h2+.facts-group{border-top:0;padding-top:0;margin-top:0}.run-facts .selected-case-title{font-family:Georgia,"Times New Roman",serif;font-size:22px;line-height:1.3;letter-spacing:-.015em;color:var(--ink);margin:0 0 8px}.run-facts>.compact{margin-top:28px}.agent-source{border:0;border-radius:0;margin:12px 0 0;background:none}.agent-source>summary{padding:4px 0;font-size:13px;font-weight:400;color:var(--muted)}.agent-source>code{display:block;font-size:12px;padding-top:6px}
.eyebrow{color:var(--muted);font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.1em}.lede,.muted{color:var(--muted)}.compact{font-size:14px}.run-summary{border:0;background:none;padding:0;margin:0}.run-summary>.eyebrow{display:block;margin:0 0 14px}.summary-verdict{display:flex;align-items:center;gap:20px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(38px,3.8vw,58px);font-weight:700;line-height:1.06;letter-spacing:-.035em;margin:0 0 18px}.summary-verdict>span{min-width:0}.verdict-icon{width:64px;height:64px;flex:0 0 64px;object-fit:contain}.verdict-icon img{display:block;width:100%;height:100%;object-fit:contain}.summary-result{font-family:Georgia,"Times New Roman",serif;font-size:clamp(22px,1.9vw,28px);line-height:1.35;letter-spacing:-.015em;margin:0 0 18px;max-width:900px}.primary-action{display:inline-flex;align-items:center;justify-content:space-between;gap:32px;max-width:100%;min-height:56px;padding:14px 24px;border:1px solid var(--teal);border-radius:7px;background:var(--teal);color:#fff;font-size:18px;font-weight:700;line-height:1.35;text-decoration:none}.primary-action:hover{background:#064b3d;border-color:#064b3d;text-decoration:none}.primary-action .icon{width:24px;height:24px}.next-step{border:0;border-left:4px solid #087d6b;border-radius:0;background:none;padding:3px 0 3px 20px;margin:22px 0 0}.next-step h3{font-size:17px;font-weight:700;color:var(--teal);margin:0}.next-step p{font-size:16px;color:var(--muted);line-height:1.5;margin:0}.summary-attention .next-step{border-left-color:#ab7a22}.summary-attention .next-step h3{color:#795713}.summary-failure .next-step{border-left-color:#b74e45}.summary-failure .next-step h3{color:#943b34}.summary-checks{font-size:14px;color:var(--muted);margin:18px 0 0}
.test-ledger{border-top:1px solid var(--line);margin-top:22px;padding-top:22px;min-width:0}.test-ledger>h2{margin:0 0 4px}.test-ledger>p{margin:0 0 14px;color:var(--muted);font-size:16px}.ledger-heading,.ledger-row>summary{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.2fr) minmax(120px,.58fr);column-gap:22px;align-items:start}.ledger-heading{padding:6px 14px 10px;border-bottom:1px solid var(--line);color:var(--muted);font-size:12px;font-weight:600;line-height:1.4;text-transform:uppercase;letter-spacing:.02em}.ledger-row{margin:0;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;min-width:0}.ledger-row>summary{padding:13px 14px;font-size:16px;font-weight:400;list-style:none}.ledger-row>summary::-webkit-details-marker{display:none}.ledger-row>summary:hover{background:#f6f9f8}.variant-name,.variant-expectation,.variant-result{min-width:0;overflow-wrap:anywhere}.variant-name strong{display:block;font-size:16px;font-weight:700;line-height:1.4}.variant-name small{display:block;font-size:15px;line-height:1.45;color:var(--muted);margin-top:2px}.variant-expectation{font-size:15px;line-height:1.5;color:var(--muted)}.variant-result{position:relative;padding-right:18px;line-height:1.4}.variant-result>.badge{white-space:normal;display:inline-flex;align-items:center;gap:8px;padding:0;background:none;border-radius:0;font-size:16px;font-weight:700;line-height:1.4;color:var(--ink)}.variant-result>.icon:not(.disclosure-icon){width:22px;height:22px;margin-right:8px}.variant-result>small{display:block;color:var(--muted);font-size:15px;margin-top:2px}.disclosure-icon{width:16px;height:16px;position:absolute;right:-3px;top:3px}.ledger-row[open]>summary .disclosure-icon{transform:rotate(180deg)}.ledger-evidence{min-width:0;background:var(--teal-soft);border-radius:0 0 7px 7px;padding:18px 24px;margin:0 0 14px;overflow-wrap:anywhere}.ledger-evidence>p:last-child{margin-bottom:0}.ledger-evidence h3,.ledger-evidence h4{font-family:Arial,Helvetica,sans-serif;font-size:16px;color:var(--teal);margin:0 0 5px}.ledger-evidence h3:not(:first-child),.ledger-evidence h4:not(:first-child){margin-top:20px}.ledger-evidence .diagnostic{margin:12px 0}.case-ledger{min-width:0}.case-ledger>h3{font-family:Georgia,"Times New Roman",serif;font-size:23px;line-height:1.25;margin:24px 0 10px}.case-outcome{font-size:14px;color:var(--muted);margin:0 0 14px}.evidence-outcome{display:block;font-size:15px;line-height:1.5;margin:0 0 18px;min-width:0}.evidence-outcome>dt{font-size:16px;font-weight:700;color:var(--teal);margin:0 0 4px}.evidence-outcome>dd{margin:0 0 14px;overflow-wrap:anywhere}.evidence-outcome>dd:last-child{margin-bottom:0}.supporting-evidence{border-top:1px solid var(--line);padding-top:22px;margin-top:24px;min-width:0}.supporting-evidence>h2{font-size:25px;margin-bottom:8px}.supporting-evidence>.case{border:0;border-top:1px solid var(--line);border-radius:0;margin:0;background:transparent}.supporting-evidence>.case>summary{padding:16px 0}.supporting-evidence>.case>.case-body{padding:0 0 20px}.ledger-empty{padding:16px 0;border-top:1px solid var(--line)}.ledger-empty>p{color:var(--muted);margin:6px 0 0}
.badge{display:inline-flex;align-items:center;gap:6px;border-radius:5px;padding:4px 9px;font-size:12px;font-weight:700;line-height:1.3;text-transform:capitalize;white-space:nowrap}.good{background:#dcefe6;color:#15583f}.bad{background:#fae7e3;color:#8a302b}.neutral{background:#f6edda;color:#705521}.badge .icon{width:18px;height:18px}.panel{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:20px;margin:22px 0}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:22px 0}.card{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:16px}.card-label{color:var(--muted);font-size:13px}.card strong{display:block;font-size:28px;line-height:1.25;margin:8px 0}.card small{color:var(--muted);font-size:13px}dl{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px 20px;margin:0}dt{color:var(--muted)}dd{margin:0;min-width:0;overflow-wrap:anywhere}details{min-width:0;border:1px solid var(--line);border-radius:6px;margin:12px 0;background:var(--paper)}summary{cursor:pointer;padding:16px 18px;font-weight:650;overflow-wrap:anywhere}.case-status{float:right;margin-left:12px}.case-id{font:700 13px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--teal);margin-right:12px;overflow-wrap:anywhere}.case-body{min-width:0;padding:0 18px 18px}.attempt{min-width:0;border-top:1px solid var(--line);padding-top:16px;margin-top:16px}.attempt:first-child{margin-top:0}.diagnostic{border-left:3px solid #bc8a4b;background:#fbf6eb;padding:12px 16px;margin:12px 0;overflow-wrap:anywhere}.diagnostic p{margin:0 0 6px}.diagnostic p:last-child{margin-bottom:0}code{font:14px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.table-wrap{width:100%;max-width:100%;min-width:0;overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;border-bottom:1px solid var(--line);padding:12px 10px;vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.025em}.comparison-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.comparison-grid>*{min-width:0}.note{border-left:3px solid #c39b4c;padding:10px 16px;background:#fbf5e7;margin:16px 0}.footer{font-size:12px;color:var(--muted);margin:24px 0 0}.evidence-body{min-width:0;padding:0 16px 16px}.evidence-detail{background:#fbfdfc}.evidence-detail>summary,.value-detail>summary{font-size:14px;padding:12px 16px}.detail-count{font-weight:400;color:var(--muted);margin-left:8px}.evidence-fields{display:block;font-size:14px;width:100%;min-width:0}.evidence-fields>dt{overflow-wrap:anywhere;padding:12px 0 4px;font-weight:650}.evidence-fields>dd{min-width:0;width:100%;margin:0 0 12px}.value-detail{margin:0;border:0;border-top:1px solid var(--line);border-radius:0;background:transparent}.value-detail>summary{padding:10px 0}.value-detail>.evidence-body{padding:0}.value-detail .evidence-fields{display:block}.evidence-fields code,.event-text code{white-space:pre-wrap;overflow-wrap:anywhere}.assertions{table-layout:fixed;min-width:600px}.assertions th:first-child{width:90px}.assertions th:nth-child(2){width:32%}.assertions td{overflow-wrap:anywhere}.assertions .badge{font-size:11px;padding:3px 7px}.activity{list-style:none;padding:0;margin:0}.activity>li>details{margin:6px 0}.activity summary{font-size:14px;padding:10px 12px}.event-text{margin-bottom:12px}.variant>summary{font-size:15px}.attempt>.evidence-detail{margin-bottom:16px}.run-context,.panel.run-context{grid-column:1/-1;border:0;border-top:1px solid var(--line);border-radius:0;margin:0;padding:0;background:transparent}.run-context>summary{font-size:16px;padding:18px 0;font-weight:700}.run-context>.case-body,.run-context>.evidence-body{padding:6px 0 24px}
@media(max-width:1100px){main{padding-left:40px;padding-right:40px}.report-main{padding-right:28px}.run-facts{padding-left:28px}.summary-verdict{font-size:44px;gap:16px}.facts-list{grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:12px}.ledger-heading,.ledger-row>summary{column-gap:16px;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(110px,.6fr)}}
@media(max-width:900px){main{padding:20px 32px 28px}.report-layout{grid-template-columns:minmax(0,1fr)}.report-main{padding:30px 0 28px}.run-facts{border-left:0;border-top:1px solid var(--line);padding:28px 0}.facts-list{grid-template-columns:170px minmax(0,1fr);max-width:620px}.summary-verdict{font-size:clamp(38px,6vw,54px)}.summary-result{font-size:25px}.comparison-grid{grid-template-columns:minmax(0,1fr)}.run-context{margin-top:0}}
@media(max-width:700px){main{padding:18px 24px 24px}.report-masthead{gap:16px;padding-bottom:14px}.wordmark{font-size:11px;gap:8px;letter-spacing:.06em}.wordmark strong{font-size:20px}.report-date{font-size:12px}.report-main{padding-top:26px}.eyebrow{font-size:12px}.summary-verdict{align-items:flex-start;font-size:clamp(34px,6.8vw,44px);gap:14px;line-height:1.1}.verdict-icon{width:48px;height:48px;flex-basis:48px}.summary-result{font-size:23px}.primary-action{font-size:16px;min-height:52px;padding:13px 20px}.next-step{padding-left:16px;margin-top:20px}.next-step p{font-size:15px}.test-ledger{padding-top:20px}h2{font-size:28px}.ledger-heading{display:none}.ledger-row>summary{grid-template-columns:minmax(0,1fr);gap:9px;padding:16px 0}.ledger-row:first-of-type{border-top:1px solid var(--line)}.variant-name strong{font-size:17px}.variant-expectation{font-size:15px}.variant-result{display:flex;align-items:center;gap:8px;padding-right:24px}.variant-result>.icon:not(.disclosure-icon){margin-right:0}.variant-result>small{margin:0 0 0 6px}.disclosure-icon{right:2px;top:3px}.ledger-evidence{padding:16px;margin-bottom:12px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.panel{padding:16px}.case-status{float:none;display:block;width:fit-content;margin:8px 0 0}.case-id{display:block;margin-bottom:4px}.case-body{padding:0 14px 14px}.run-context>.case-body{padding-left:0;padding-right:0}.evidence-body{padding:0 12px 12px}.value-detail>.evidence-body{padding:0}.facts-list{grid-template-columns:minmax(110px,.8fr) minmax(0,1fr);font-size:15px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{body{background:#fff}main{max-width:none;padding:0;font-size:12px}.report-masthead{padding-bottom:12px}.report-layout{grid-template-columns:minmax(0,2.6fr) minmax(160px,1fr)}.report-main{padding:24px 24px 20px 0}.run-facts{border-left:1px solid var(--line);border-top:0;padding:24px 0 20px 24px}.summary-verdict{font-size:32px}.summary-result{font-size:19px}.primary-action{display:none}.panel,.card,.ledger-row{break-inside:avoid}.cards{gap:8px}.facts-list{font-size:12px;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.run-facts h2{font-size:23px}.footer{margin-top:16px}a{color:inherit}.table-wrap{overflow:visible}}
`;
function document(title, body) {
  return `<!doctype html>\n<!-- Tabler Icons\n${iconLicense}-->\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>${css}</style></head><body><main>${body}<p class="footer">Valdr evaluations · Saved evidence · No external assets or model calls</p></main></body></html>\n`;
}
function metadata(report) {
  return `<dl><dt>Suite</dt><dd>${escape(report.suite)} · version ${escape(report.suiteVersion)}</dd>${report.recordedOutcome && report.recordedOutcome!==report.outcome?`<dt>Recorded outcome</dt><dd>${escape(report.recordedOutcome)}</dd>`:''}<dt>Agent</dt><dd>${escape(report.agentPath)}</dd><dt>Execution profile</dt><dd>${escape(report.profile?.providerType)} / ${escape(report.profile?.model)} / ${escape(report.profile?.reasoningEffort)}</dd><dt>Run label</dt><dd>${escape(report.round)}</dd><dt>Author duration</dt><dd>${escape(formatDuration(report.durationMs))}</dd><dt>Evidence</dt><dd><code>${escape(report.directory)}</code></dd></dl>`;
}
function cards(report) {
  if (!report.metrics) return `<div class="note">This is ${escape(report.kind)} evidence, not a measured agent performance score.</div>`;
  return `<div class="cards">${[
    ['Selected cases',report.metrics.scenarios,`${report.metrics.notStarted} not started`],
    ['First attempt',`${report.metrics.firstCandidatePassed} / ${report.metrics.firstEvaluated}`,'Evaluated cases only'],
    ['Eventual pass',`${report.metrics.eventuallyPassed} / ${report.metrics.eventualEvaluated}`,'Includes permitted repairs'],
    ['Repairs',report.metrics.repairsUsed,report.complete?'Complete evidence':'Incomplete evidence'],
  ].map(([label,value,detail])=>`<div class="card"><span class="card-label">${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(detail)}</small></div>`).join('')}</div>`;
}
function caseResult(item) {
  if (item.eventualPassed === null) return 'Not scored';
  if (item.outcome === 'policy_rejected') return 'Blocked by policy';
  if (!item.eventualPassed) return 'Needs a fix';
  if (item.firstPassed) return 'Passed on first attempt';
  const repairs = Math.max(0,item.attempts.length-1);
  return `Passed after ${repairs} repair${repairs===1?'':'s'}`;
}
function finalChecks(item) {
  if (item.eventualPassed === null) return null;
  const evaluation = item.attempts.at(-1)?.evidence?.evaluation;
  const assertions = (evaluation?.variants ?? []).flatMap(variant=>variant.assertions ?? []);
  if (!evaluation) return null;
  return { passed:assertions.filter(assertion=>assertion.pass===true).length, total:assertions.length,
    variants:(evaluation.variants ?? []).length };
}
function runSummary(report) {
  const cleanupFailed = report.cases.some(item=>item.cleanup===false) || report.context?.summary?.cleanup?.ok===false;
  const cleanupUnknown = report.kind==='run' && report.cases.some(item=>item.attempts.length && item.cleanup===null);
  let headline, scope, result, next;
  let checks = '';
  if (report.kind==='run') {
    const metrics=report.metrics;
    const failed=metrics.eventualEvaluated-metrics.eventuallyPassed;
    const unscored=metrics.scenarios-metrics.eventualEvaluated;
    scope=`${metrics.scenarios} selected case${metrics.scenarios===1?'':'s'} in ${report.suite}.`;
    if (report.agentPath) {
      const agent=report.agentPath.split('/').at(-1).replace(/\.agent\.ya?ml$/,'').replaceAll('-',' ');
      scope+=` Agent: ${agent}.`;
    }
    if (!report.complete) {
      headline=report.outcome==='cancelled'?'Run stopped early':'Run incomplete';
      result=`${metrics.eventualEvaluated} of ${metrics.scenarios} cases have a final score: ${metrics.eventuallyPassed} passed, ${failed} need a fix, ${unscored} not scored.`;
      next=report.outcome==='submission_incomplete'
        ? 'Inspect why the required submission was not captured, including the output path and session activity. Resolve the capture problem, then rerun the affected cases.'
        : report.outcome==='cancelled'
          ? 'Review the completed cases, then rerun the unfinished cases when ready.'
          : 'Review the recorded errors and missing evidence below. Resolve the runtime or evidence problem, then rerun the affected cases.';
    } else if (report.outcome==='passed') {
      headline=metrics.repairsUsed?'Passed with repairs':'Passed on the first attempt';
      result=metrics.repairsUsed
        ? `${metrics.eventuallyPassed} of ${metrics.scenarios} cases passed. ${metrics.firstCandidatePassed} passed on the first attempt; ${metrics.repairsUsed} repair turn${metrics.repairsUsed===1?'':'s'} used.`
        : `${agentName(report)} passed every selected case on the first attempt. No repair was needed.`;
      next=metrics.repairsUsed
        ? 'Review the failed first attempts to understand what needed repair. Compare a matching baseline before concluding that the agent improved.'
        : 'No fixes are indicated by these cases. Repeat the evaluation or test additional scenarios before drawing conclusions about reliability.';
    } else {
      headline=report.outcome==='policy_rejected'?'A case was blocked by policy':'Some cases need a fix';
      result=`${metrics.eventuallyPassed} of ${metrics.scenarios} cases passed; ${failed} did not pass. ${metrics.repairsUsed} repair turn${metrics.repairsUsed===1?'':'s'} used.`;
      next=report.outcome==='policy_rejected'
        ? 'Review the safety diagnostics and blocked action. Correct the submission to fit the allowed policy before rerunning that case.'
        : 'Open the failed cases below and compare expected and actual results. Fix the agent instructions or submission, then rerun those cases.';
    }
    const counts=report.cases.map(finalChecks).filter(Boolean);
    if (counts.some(item=>item.total>0)) {
      const passed=counts.reduce((sum,item)=>sum+item.passed,0), total=counts.reduce((sum,item)=>sum+item.total,0);
      const variants=counts.reduce((sum,item)=>sum+item.variants,0);
      checks=`<p class="summary-checks sr-only"><strong>Final-attempt assertions:</strong> ${passed} / ${total} recorded checks passed across ${variants} execution variant${variants===1?'':'s'}. Only scored cases with assertion receipts are included.</p>`;
    }
    if (report.outcome==='submission_incomplete') result+=' The required submission was not captured; the cause must be checked in the recorded evidence.';
  } else {
    const passed=report.outcome==='passed';
    if (report.kind==='check') {
      headline=passed?'Preflight checks passed':'Preflight needs attention';
      scope=`Runtime and fixture checks for ${report.suite}.`;
      result=passed?'The saved preflight reports that the environment and fixtures passed their checks.':'The saved preflight did not complete successfully.';
      next=passed?'Run a selected live case to measure agent behavior.':'Review the preflight errors and fix the environment before starting an agent evaluation.';
    } else if (report.kind==='replay') {
      headline=passed?'Saved submission passed':'Saved submission needs attention';
      scope=`A saved submission replay for ${report.suite}.`;
      result=passed?'The saved submission passed the recorded evaluation.':'The saved submission did not pass or the replay could not finish; inspect the recorded result below.';
      next=passed?'Use a live evaluation to measure how an agent produces a submission.':'Review the replay assertions and errors before revising or replaying the submission.';
    } else {
      headline='Execution type not recorded';
      scope=`Saved evidence for ${report.suite}.`;
      result='The evidence does not identify how this evaluation was executed.';
      next='Restore the original execution receipt before interpreting this as an agent result.';
    }
    result+=' This is not a measured agent performance score.';
  }
  if (cleanupFailed || cleanupUnknown) {
    headline=cleanupFailed?'Cleanup needs attention':'Cleanup is not verified';
    result+=cleanupFailed?' Cleanup did not finish successfully.':' Cleanup has no verified receipt.';
    next='Inspect the cleanup receipt and remaining temporary resources. Resolve and verify cleanup before starting another run.';
  } else if (report.kind==='run' && report.cases.length && report.cases.every(item=>item.cleanup===true)) result+=' Cleanup verified for every case.';
  const tone=cleanupFailed || cleanupUnknown || report.kind==='unknown' || report.kind==='run' && !report.complete
    ? 'attention' : report.outcome==='passed'?'success':'failure';
  return `<section class="run-summary summary-${tone}"><h2 class="sr-only">Run summary</h2><p class="eyebrow">${escape(humanLabel(report.suite))} · ${escape(agentName(report))}</p><h1 class="summary-verdict">${icon(tone==='success'?'circle-check':tone==='failure'?'x':'alert-circle','verdict-icon',tone==='success'?'#146b5b':tone==='failure'?'#8a302b':'#8a6320')}<span>${escape(headline)}</span></h1><h3 class="sr-only">What was tested</h3><p class="sr-only">${escape(scope)}</p><h3 class="sr-only">What happened</h3><p class="summary-result">${escape(result)}</p><a class="primary-action" href="#what-we-tested">Inspect evidence ${icon('arrow-right','icon','#ffffff')}</a>${checks}<div class="next-step"><h3>Next step</h3><p>${escape(next)}</p></div></section>`;
}
function runFacts(report) {
  const counts=report.cases.map(finalChecks).filter(Boolean);
  const passed=counts.reduce((sum,item)=>sum+item.passed,0), total=counts.reduce((sum,item)=>sum+item.total,0);
  const variants=counts.reduce((sum,item)=>sum+item.variants,0);
  const cleanup=report.cases.some(item=>item.cleanup===false)?'Needs attention':report.cases.length && report.cases.every(item=>item.cleanup===true)?'Verified':'Not verified';
  const fields=entries=>`<dl class="facts-list">${entries.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl>`;
  return `<aside class="run-facts" aria-label="Run facts"><h2>Run facts</h2><div class="facts-group">${fields([
    ['Task',humanLabel(report.suite)],['Agent',agentName(report)],['Run label',report.round ?? 'Not recorded'],
    ['Model',report.profile?`${report.profile.model ?? 'Not recorded'} · ${report.profile.reasoningEffort ?? 'Not recorded'}`:'Not recorded'],['Date (UTC)',dateLabel(report)],
  ])}${report.agentPath?`<details class="agent-source"><summary>Agent source</summary><code>${escape(report.agentPath)}</code></details>`:''}</div><div class="facts-group">${fields(report.metrics?[
    ['Outcome',humanLabel(report.outcome)],['Selected cases',report.metrics.scenarios],['First attempt',report.metrics.firstEvaluated?`${report.metrics.firstCandidatePassed} / ${report.metrics.firstEvaluated} passed`:'Not scored'],
    ['Final result',report.metrics.eventualEvaluated?`${report.metrics.eventuallyPassed} / ${report.metrics.eventualEvaluated} scored cases passed`:'Not scored'],['Execution variants',variants],
    ['Final checks',total?`${passed} / ${total}`:'No recorded assertions'],['Repairs',report.metrics.repairsUsed],
    ['Agent author time',formatDuration(report.durationMs)],['Cleanup',cleanup],
  ]:[['Evidence type',humanLabel(report.kind)],['Outcome',humanLabel(report.outcome)]])}</div>${report.cases.length===1?`<div class="facts-group"><h3>Selected case</h3><p class="selected-case-title">${escape(report.cases[0].definition?.entryWorkflowKey?humanLabel(report.cases[0].definition.entryWorkflowKey.split('.').at(-1)):report.cases[0].title)}</p>${report.cases[0].definition?.entryWorkflowKey?`<p class="muted">${escape(report.cases[0].title)}</p>`:''}</div>`:''}<p class="muted compact">Author time excludes setup, evaluation and cleanup. One trial is not a reliability estimate.</p></aside>`;
}
function variantExpectation(variant,definition,scenario) {
  const expected=variant.expectedStatus ?? definition?.expectedStatus;
  if (expected==='blocked') return 'Block this input before completing the workflow.';
  if (expected==='completed') return 'Complete the workflow with the expected results.';
  if (expected) return `Reach the expected status: ${expected}.`;
  if (scenario?.expectedOutcome==='repaired') return 'Apply only the approved repair.';
  if (scenario?.expectedOutcome==='needs_human') return 'Request a decision without changing the task.';
  return variant.assertions?.[0]?.message ?? 'Meet the recorded case requirements.';
}
function variantLedger(variant,definition,scenario) {
  const assertions=variant.assertions ?? [], passed=assertions.filter(item=>item.pass===true).length;
  const expected=variant.expectedStatus ?? definition?.expectedStatus;
  const status=variant.ok===true?'passed':variant.ok===false?'candidate_failed':'not_recorded';
  const observed=variant.actualStatus
    ? `Execution ${variant.actualStatus}${variant.ok && variant.actualStatus===expected?' as expected':''}.`
    : variant.ok===true?'The recorded evaluation passed.':variant.ok===false?'The recorded evaluation did not pass.':'No evaluation result was recorded.';
  const inputFields=definition?.inputs?Object.entries(definition.inputs).filter(([,value])=>value===null || typeof value!=='object').slice(0,3):[];
  return `<details class="ledger-row" data-variant="${escape(variant.id)}"${variant.ok===false || expected==='blocked'?' open':''}><summary><span class="variant-name"><strong>${escape(humanLabel(variant.title ?? definition?.title ?? variant.id))}</strong>${inputFields.length?`<small>${escape(inputFields.map(([key,value])=>`${humanLabel(key)}: ${String(value).slice(0,80)}`).join(' · '))}</small>`:''}</span><span class="variant-expectation">${escape(variantExpectation(variant,definition,scenario))}</span><span class="variant-result">${icon(variant.ok===true?'check':variant.ok===false?'x':'alert-circle','icon',variant.ok===false?'#8a302b':'#146b5b')}${badge(status,variant.ok===true?'Pass':variant.ok===false?'Fail':'Not recorded')}<small>${assertions.length?`${passed} / ${assertions.length} checks`:'No recorded assertions'}</small>${icon('chevron-down','icon disclosure-icon')}</span></summary><div class="ledger-evidence"><dl class="evidence-outcome"><dt>Expected</dt><dd>${escape(variantExpectation(variant,definition,scenario))}</dd><dt>Observed</dt><dd>${escape(observed)}</dd></dl>${variant.error?`<div class="diagnostic">${escape(variant.error)}</div>`:''}<details class="evidence-detail"><summary>Assertions <span class="detail-count">${assertions.length} recorded checks</span></summary><div class="evidence-body">${assertionTable(assertions)}</div></details>${evidenceDetails('Execution receipt',fieldsExcept(variant,['id','ok','assertions','error','actualStatus','expectedStatus']))}</div></details>`;
}
function testLedger(report) {
  if (report.kind==='replay') return `<section class="test-ledger" id="what-we-tested" tabindex="-1"><h2>What we tested</h2><p class="muted">Saved submission replay. This is not a new agent performance measurement.</p>${evaluationHtml(report.context?.summary?.evaluation)}</section>`;
  if (!report.cases.length) return `<section class="test-ledger" id="what-we-tested" tabindex="-1"><h2>What we tested</h2><p class="muted">${report.kind==='check'?'Runtime and fixture preflight. No agent performance was measured.':'No case measurements were recorded.'}</p>${evidenceDetails('Recorded checks',report.context?.summary,{open:true})}</section>`;
  return `<section class="test-ledger" id="what-we-tested" tabindex="-1"><h2>What we tested</h2><p class="muted">${report.cases.length} selected case${report.cases.length===1?'':'s'}. Results below use each case's final attempt; earlier attempts are kept in supporting evidence.</p>${report.cases.map(item=>{
    const checks=finalChecks(item);
    const evaluation=item.eventualPassed===null?null:item.attempts.at(-1)?.evidence?.evaluation;
    const variants=evaluation?.variants ?? [];
    const definitions=Array.isArray(item.definition?.variants)?item.definition.variants:[];
    return `<article class="case-ledger" data-case="${escape(item.id)}"><h3${report.cases.length===1?' class="sr-only"':''}>${escape(item.title)}</h3><p class="case-outcome${report.cases.length===1?' sr-only':''}">${escape(caseResult(item))} · ${checks?.total?`${checks.passed} / ${checks.total} final checks`:item.eventualPassed===null?'Not scored':'No recorded assertions'} · ${escape(formatDuration(item.durationMs))} author time</p>${variants.length?`<div class="ledger-heading" aria-hidden="true"><span>Variant</span><span>What we expected</span><span>Result</span></div>${variants.slice(0,previewEntries).map(variant=>variantLedger(variant,definitions.find(definition=>definition?.id===variant.id),item.definition)).join('')}${variants.length>previewEntries?`<p class="muted">${variants.length-previewEntries} additional variants not shown in this preview.</p>`:''}`:`<div class="ledger-empty"><strong>${escape(caseResult(item))}</strong><p>${item.eventualPassed===null?'This case has no verified final score. Review its recorded errors and cleanup below.':'No variant assertions were recorded. Review the evaluation receipt below.'}</p>${item.attempts.at(-1)?.diagnostics.map(diagnostic=>`<p class="diagnostic">${escape(diagnostic.message)}</p>`).join('') ?? ''}</div>`}</article>`;
  }).join('')}</section>`;
}
const previewEntries = 100;
const previewCharacters = 12000;
function fieldsExcept(value, keys) {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([key])=>!keys.includes(key)));
}
function countLabel(value) {
  if (Array.isArray(value)) return `${value.length} items`;
  if (value && typeof value === 'object') return `${Object.keys(value).length} fields`;
  return '';
}
function valueHtml(value, depth = 0) {
  if (value === undefined) return '<span class="muted">Not recorded</span>';
  if (value === null) return '<code>null</code>';
  if (typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
    try { return valueHtml(JSON.parse(value), depth); } catch { /* Plain text remains readable. */ }
  }
  if (typeof value !== 'object') {
    const text=String(value);
    return `<code>${escape(text.slice(0,previewCharacters))}</code>${text.length>previewCharacters?`<p class="muted compact">${text.length-previewCharacters} additional characters not shown in this preview.</p>`:''}`;
  }
  if (depth>=8) return '<p class="muted compact">Nested evidence exceeds the preview limit.</p>';
  const entries=Object.entries(value);
  if (!entries.length) return `<span class="muted">${Array.isArray(value)?'No items':'No fields'}</span>`;
  return `<dl class="evidence-fields">${entries.slice(0,previewEntries).map(([key,item])=>`<dt>${Array.isArray(value)?Number(key)+1:escape(key)}</dt><dd>${item && typeof item==='object' && Object.keys(item).length?`<details class="value-detail"><summary>${countLabel(item)}</summary><div class="evidence-body">${valueHtml(item,depth+1)}</div></details>`:valueHtml(item,depth+1)}</dd>`).join('')}</dl>${entries.length>previewEntries?`<p class="muted compact">${entries.length-previewEntries} additional items not shown in this preview.</p>`:''}`;
}
function evidenceDetails(title,value,{open=false}={}) {
  if (value===undefined || value===null) return '';
  return `<details class="evidence-detail"${open?' open':''}><summary>${escape(title)} <span class="detail-count">${countLabel(value)}</span></summary><div class="evidence-body">${valueHtml(value)}</div></details>`;
}
function assertionTable(assertions) {
  if (!assertions?.length) return '<p class="muted compact">No assertion receipt was recorded.</p>';
  return `<div class="table-wrap"><table class="assertions"><thead><tr><th scope="col">Result</th><th scope="col">Assertion</th><th scope="col">Actual</th><th scope="col">Expected</th></tr></thead><tbody>${assertions.slice(0,previewEntries).map(assertion=>`<tr><td>${badge(assertion.pass?'passed':'candidate_failed',assertion.pass?'Pass':'Fail')}</td><td>${escape(assertion.message)}</td><td>${valueHtml(assertion.actual)}</td><td>${valueHtml(assertion.expected)}</td></tr>`).join('')}</tbody></table></div>${assertions.length>previewEntries?`<p class="muted compact">${assertions.length-previewEntries} additional assertions not shown in this preview.</p>`:''}`;
}
function evaluationHtml(evaluation) {
  if (!evaluation) return '';
  const variants=evaluation.variants ?? [];
  const variantsHtml=variants.slice(0,previewEntries).map(variant=>{
    const assertions=variant.assertions ?? [];
    const passed=assertions.filter(item=>item.pass).length;
    return `<details class="variant"${variant.ok===false || variants.length===1?' open':''}><summary><span class="case-id">${escape(variant.id)}</span>${assertions.length?`${passed} / ${assertions.length} assertions`:'No recorded assertions'} ${badge(variant.ok===true?'passed':variant.ok===false?'candidate_failed':'not_recorded')}</summary><div class="evidence-body">${variant.actualStatus?`<p class="muted compact">Execution status: <strong>${escape(variant.actualStatus)}</strong></p>`:''}${variant.error?`<div class="diagnostic">${escape(variant.error)}</div>`:''}${assertionTable(assertions)}${evidenceDetails('Execution details',fieldsExcept(variant,['id','ok','assertions','error','actualStatus']))}</div></details>`;
  }).join('');
  return `${variantsHtml}${variants.length>previewEntries?`<p class="muted compact">${variants.length-previewEntries} additional variants not shown in this preview.</p>`:''}${evidenceDetails('Evaluation details',fieldsExcept(evaluation,['variants']))}`;
}
function activityHtml(events) {
  if (events === null || events === undefined) return '<p class="muted compact">Provider activity was not saved for this attempt.</p>';
  if (!events.length) return '<p class="muted compact">No provider events were recorded for this attempt.</p>';
  const labels = { 'thread.started':'Thread started', 'turn.started':'Turn started', 'turn.completed':'Turn completed', 'turn.failed':'Turn failed', error:'Provider error' };
  const itemLabels = { agent_message:'Agent message', mcp_tool_call:'Tool call', file_change:'File change', command_execution:'Command execution', web_search:'Web search', reasoning:'Reasoning', todo_list:'Task list', error:'Item error' };
  return `<details class="evidence-detail"><summary>Session activity <span class="detail-count">${events.length} events</span></summary><div class="evidence-body"><ol class="activity">${events.map((event,index)=>{
    const item = event.item;
    const state = item?.status === 'failed' || item?.error ? 'failed' : event.type.replace(/^item\./,'');
    const label = item ? `${itemLabels[item.type] ?? item.type}${item.type === 'agent_message' ? '' : ` ${state}`}${item.type === 'mcp_tool_call' ? ` · ${item.server ?? 'Unknown server'}.${item.tool ?? 'Unknown tool'}` : ''}` : labels[event.type] ?? event.type;
    const details = item ? `${item.text !== undefined ? `<div class="event-text">${valueHtml(item.text)}</div>` : ''}${evidenceDetails('Arguments',item.arguments)}${evidenceDetails('Result',item.result)}${evidenceDetails('Tool error',item.error,{open:true})}${evidenceDetails('Item details',fieldsExcept(item,['text','arguments','result','error']))}` : `${event.message !== undefined ? valueHtml(event.message) : ''}${evidenceDetails('Error',event.error,{open:true})}`;
    return `<li><details><summary><span class="case-id">${index+1}</span>${escape(label)}</summary><div class="evidence-body">${details}${evidenceDetails('Event details',fieldsExcept(event,['item','message','error']))}</div></details></li>`;
  }).join('')}</ol></div></details>`;
}
function attemptHtml(attempt,showVariants=true) {
  const evidence=attempt.evidence ?? {}, author=evidence.author;
  return `<section class="attempt"><h3>Attempt ${attempt.number} ${badge(attempt.outcome)}</h3><p class="muted compact">Author duration: ${escape(formatDuration(attempt.durationMs))}${author?.sessionUlid?` · Session <code>${escape(author.sessionUlid)}</code>`:''}</p>${attempt.diagnostics.map(diagnostic=>`<div class="diagnostic"><p>${escape(diagnostic.message)}</p>${diagnostic.actual!==undefined?`<p><strong>Actual:</strong> <code>${escape(diagnostic.actual)}</code></p>`:''}${diagnostic.expected!==undefined?`<p><strong>Expected:</strong> <code>${escape(diagnostic.expected)}</code></p>`:''}</div>`).join('')}${evidenceDetails('Agent response',author?.finalMessage,{open:true})}${showVariants?evaluationHtml(evidence.evaluation):evidenceDetails('Evaluation details',fieldsExcept(evidence.evaluation,['variants']))}${activityHtml(attempt.activity)}${author?evidenceDetails('Author and submission receipt',fieldsExcept(author,['finalMessage'])):''}${evidenceDetails('Attempt receipt',fieldsExcept(evidence,['author','evaluation']))}</section>`;
}
function casesHtml(report,finalVariantsInLedger=false) {
  return report.cases.map(item=>`<details class="case"${item.outcome!=='passed'?' open':''}><summary><span class="case-id">${escape(item.id)}</span>${escape(item.title)}<span class="case-status">${badge(item.outcome)}</span></summary><div class="case-body"><p class="muted compact">Author duration: ${escape(formatDuration(item.durationMs))} · Cleanup: ${item.cleanup===true?'verified':item.cleanup===false?'not verified':'not recorded'}</p>${evidenceDetails('Scenario brief and requirements',item.definition)}${item.attempts.map((attempt,index)=>attemptHtml(attempt,!(finalVariantsInLedger && item.eventualPassed!==null && index===item.attempts.length-1))).join('') || '<p>No attempt receipt was recorded.</p>'}${evidenceDetails('Cleanup verification',item.cleanupReceipt)}${evidenceDetails('Case receipt',item.evidence)}</div></details>`).join('');
}
function runEvidence(report) {
  const context=report.context ?? {};
  return `${evidenceDetails('Execution configuration',context.charter)}${evidenceDetails('Source provenance',context.sourceManifest)}${evidenceDetails('Run receipt',fieldsExcept(context.summary,['evaluation']))}`;
}
export function renderHtmlReport(report) {
  const cases=casesHtml(report,true);
  return document(`${report.suite} — Evaluation report`,`<header class="report-masthead"><p class="wordmark"><strong>VALDR</strong><span>/ EVALUATIONS</span></p><span class="report-date">${escape(dateLabel(report))}</span></header><div class="report-layout"><div class="report-main">${runSummary(report)}${report.warnings.map(warning=>`<div class="note">${escape(warning)}</div>`).join('')}${testLedger(report)}${cases?`<section class="supporting-evidence"><h2>Supporting evidence</h2><p class="muted compact">Case briefs, agent responses, earlier attempts and cleanup receipts.</p>${cases}</section>`:''}</div>${runFacts(report)}</div><details class="run-context"><summary>Run details &amp; provenance <span class="sr-only">Run context</span></summary><div class="case-body">${metadata(report)}${runEvidence(report)}</div></details>`);
}
const verdict=value=>value===null?'Unknown':value?'Pass':'Fail';
export function renderHtmlComparison(comparison) {
  const details=comparison.mismatches.map(item=>`<li><strong>${escape(item.field)}:</strong> ${escape(item.reason)}</li>`).join('');
  const rows=comparison.changes.map(item=>`<tr><td><strong>${escape(item.id)}</strong><br><span class="muted">${escape(item.title)}</span></td><td>First: ${verdict(item.baseline.firstPassed)}<br>Eventual: ${verdict(item.baseline.eventualPassed)}</td><td>First: ${verdict(item.candidate.firstPassed)}<br>Eventual: ${verdict(item.candidate.eventualPassed)}</td><td>${badge(item.change)}</td></tr>`).join('');
  return document('Evaluation comparison',`<header><span class="eyebrow">Valdr evaluations</span><h1>Baseline &amp; candidate</h1><p class="lede">Compare the same tasks under matching evaluation and execution conditions.</p>${badge(comparison.assessment)}</header>${!comparison.comparable?`<section class="panel"><h2>These runs are not comparable</h2><ul>${details}</ul><p>No improvement or regression claim can be made.</p></section>`:!comparison.complete?'<div class="note">Incomplete evidence: no improvement or regression claim can be made.</div>':''}<div class="comparison-grid">${[['Baseline',comparison.baseline],['Candidate',comparison.candidate]].map(([label,report])=>`<section class="panel"><h2>${label}</h2>${metadata(report)}${runEvidence(report)}</section>`).join('')}</div>${comparison.comparable?`<h2>Recorded results</h2><p class="muted">Baseline</p>${cards(comparison.baseline)}<p class="muted">Candidate</p>${cards(comparison.candidate)}<section class="panel"><h2>Case changes</h2><div class="table-wrap"><table><thead><tr><th scope="col">Case</th><th scope="col">Baseline</th><th scope="col">Candidate</th><th scope="col">Change</th></tr></thead><tbody>${rows}</tbody></table></div></section>`:''}${[['Baseline',comparison.baseline],['Candidate',comparison.candidate]].map(([label,report])=>`<section class="panel"><h2>${label} case evidence</h2>${casesHtml(report) || '<p class="muted">No measured cases recorded.</p>'}</section>`).join('')}<p class="muted">${escape(comparison.note)}</p>`);
}
