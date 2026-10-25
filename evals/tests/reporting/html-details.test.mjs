import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { evidenceFixture, saveProviderEvents } from './fixtures.mjs';
import { loadEvidence } from '../../reporting/evidence.mjs';
import { buildReport } from '../../reporting/report.mjs';
import { compareEvidence } from '../../reporting/compare.mjs';
import { renderHtmlReport, renderHtmlComparison } from '../../reporting/html.mjs';

function richFixture(t) {
  const fixture=evidenceFixture(t,e=>{
    e.scenarios[0].brief='Replace only the approved label.';
    e.summary.results[0].cleanup={ok:true,authorityClosed:true,sessionsStopped:true,authenticationRemoved:true};
    Object.assign(e.summary.results[0].attempts[0],{
      author:{durationMs:100,sessionUlid:'session-inline',finalMessage:JSON.stringify({outcome:'repaired',summary:'Verified the persisted replacement.'})},
      evaluation:{ok:true,receipt:{outcome:'repaired',taskKey:'REPAIR-1'},variants:[{id:'approved-edit',ok:true,assertions:[
        {pass:true,message:'Only the approved label changed',actual:'Approved replacement',expected:'Approved replacement'},
      ]}]},
    });
  });
  saveProviderEvents(fixture,[{type:'item.completed',item:{id:'item_0',type:'mcp_tool_call',server:'valdr',tool:'pm_task',arguments:{action:'get',apiKey:'hidden-provider-key',taskKey:'REPAIR-1'},result:{content:[{type:'text',text:'Read the isolated task'}]},error:null,status:'completed'}}]);
  return fixture;
}

test('HTML embeds scenario, response, every scored assertion and provenance without JSON navigation',t=>{
  const fixture=richFixture(t);
  const html=renderHtmlReport(buildReport(loadEvidence(fixture.directory)));
  for(const text of ['Replace only the approved label.','Verified the persisted replacement.','Only the approved label changed',
    'Approved replacement','Tool call completed','Read the isolated task','session-inline','authenticationRemoved','example/persona.md','f'.repeat(64)])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/href="[^"]*\.json(?:[?#][^"]*)?"/);
  assert.doesNotMatch(html,/hidden-provider-key/);
  assert.match(html,/\[REDACTED\]/);
  const portable=path.join(fixture.directory,'portable.html');
  fs.writeFileSync(portable,html);
  for(const file of ['summary.json','charter.json','source-manifest.json','scenario-snapshot.json'])fs.unlinkSync(path.join(fixture.directory,file));
  assert.ok(fs.readFileSync(portable,'utf8').includes('Only the approved label changed'));
  assert.doesNotMatch(html,/<script\b|<link\b|<iframe\b|<img\b[^>]*src="(?!data:image\/svg\+xml;)/i);
});

test('embedded evidence escapes hostile nested values and reports bounded previews',t=>{
  const fixture=richFixture(t);
  const report=buildReport(loadEvidence(fixture.directory));
  report.context??={};
  report.context.charter={injected:'</details><img src=x onerror=alert(1)>',many:Array.from({length:150},(_,i)=>`entry-${i}`)};
  const html=renderHtmlReport(report);
  assert.match(html,/&lt;\/details&gt;&lt;img/);
  assert.doesNotMatch(html,/<img\b[^>]*src=x|onerror=alert\(1\)>/);
  assert.match(html,/additional (items|entries)|not shown|preview limit/i);
});

test('comparison includes each run\'s case evidence without source-file links',t=>{
  const before=richFixture(t),after=richFixture(t);
  const html=renderHtmlComparison(compareEvidence(loadEvidence(before.directory),loadEvidence(after.directory)));
  assert.equal(html.split('Verified the persisted replacement.').length-1,2);
  assert.match(html,/Only the approved label changed/);
  assert.doesNotMatch(html,/href="[^"]*\.json(?:[?#][^"]*)?"/);
});

test('replay and preflight embed evidence without presenting author performance metrics',t=>{
  for(const mode of ['replay','check']){
    const fixture=evidenceFixture(t,e=>{
      e.charter.mode=mode;delete e.summary.results;
      e.summary.cleanup={ok:true,authorityClosed:true};
      if(mode==='replay')e.summary.evaluation={ok:true,variants:[{id:'replayed',ok:true,assertions:[{pass:true,message:'Durable replay output',actual:'ready',expected:'ready'}]}]};
      else e.summary.tools=['pm_health','pm_task'];
    });
    const html=renderHtmlReport(buildReport(loadEvidence(fixture.directory)));
    assert.match(html,/not a measured agent performance score/);
    assert.ok(html.includes(mode==='replay'?'Durable replay output':'pm_health'));
    assert.match(html,/authorityClosed/);
    assert.doesNotMatch(html,/href="[^"]*\.json(?:[?#][^"]*)?"/);
  }
});
