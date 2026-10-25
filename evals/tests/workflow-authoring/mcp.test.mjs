import test from 'node:test'
import assert from 'node:assert/strict'
import { createMcpSession, createAuthorBroker } from '../../core/mcp.mjs'
import { authorRequestAllowed } from '../../suites/workflow-authoring/policy.mjs'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const fixture = `
const rl = require('node:readline').createInterface({input:process.stdin});
rl.on('line', line => {
 const r=JSON.parse(line); if(r.id===undefined)return;
 if(r.method==='hang')return;
 const result=r.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}}:
 r.method==='tools/call'?{content:[],structuredContent:{echo:r.params.arguments}}:{tools:[{name:'pm_health'}]};
 const text=JSON.stringify({jsonrpc:'2.0',id:r.id,result})+'\\n';
 process.stdout.write(text.slice(0,7));setTimeout(()=>process.stdout.write(text.slice(7)),5);
});`

test('public stdio client initializes and correlates fragmented tool responses', async () => {
 const session=await createMcpSession({command:process.execPath,args:['-e',fixture],env:process.env});
 try {
  assert.equal(session.initializeResult.serverInfo.name,'fixture');
  assert.deepEqual((await session.callTool('pm_health',{detail:true})).structuredContent.echo,{detail:true});
 } finally {await session.close()}
 assert.equal(session.closed,true);
});

test('timeouts reject and owned processes close without leaving pending requests', async () => {
 const session=await createMcpSession({command:process.execPath,args:['-e',fixture],env:process.env});
 try {await assert.rejects(session.request('hang',{}, {timeoutMs:25}),/timed out/)}
 finally {await session.close()}
 assert.equal(session.closed,true);
});

test('author proxy denies execution and mutations while retaining documentation and validation', () => {
 for(const [name,action] of [['pm_workflow','start'],['pm_workflow','test_definition'],['pm_session','launch_prompt'],['pm_task','create'],['pm_provider','create_preset'],['pm_user_tool','run']])
  assert.equal(authorRequestAllowed('tools/call',{name,arguments:{action}}),false);
 for(const [name,action] of [['pm_workflow','validate'],['pm_workflow','save_definition'],['pm_workflow','get'],['pm_task','get'],['pm_user_tool','describe']])
  assert.equal(authorRequestAllowed('tools/call',{name,arguments:{action}}),true);
 assert.equal(authorRequestAllowed('sampling/createMessage',{}),false);
});

test('author policy checks nested arguments and rejects conflicting or ambiguous actions', () => {
 const allowed = arguments_ => authorRequestAllowed('tools/call', {name:'pm_workflow',arguments:arguments_});
 assert.equal(allowed({action:'validate',params:{definitionJson:{}}}),true);
 assert.equal(allowed({action:'get',params:{action:'test_definition'}}),false);
 assert.equal(allowed({action:'get',params:{action:'get',key:'example'}}),true);
 for(const args of [{action:'get',params:null},{action:'get',params:[]},{action:'get',key:'example',params:{}},null,[]])
  assert.equal(allowed(args),false);
});

test('UTF-8 code points survive splitting within a character', async () => {
 const script=fixture.replace("process.stdout.write(text.slice(0,7));setTimeout(()=>process.stdout.write(text.slice(7)),5);", "const b=Buffer.from(text.replace('fixture','café'));const i=b.indexOf(0xc3)+1;process.stdout.write(b.subarray(0,i));setTimeout(()=>process.stdout.write(b.subarray(i)),5);")
 const session=await createMcpSession({command:process.execPath,args:['-e',script],env:process.env});
 try {assert.equal(session.initializeResult.serverInfo.name,'café')}
 finally {await session.close()}
});

test('a missing executable preserves the startup diagnostic and closes promptly', async () => {
 const started=Date.now();
 await assert.rejects(createMcpSession({command:'/nonexistent/verdandi-test-executable',env:process.env}),/ENOENT/);
 assert.ok(Date.now()-started<2000);
});

test('real author proxy authenticates and forwards only allowed operations into one authority', async () => {
 const authority=await createMcpSession({command:process.execPath,args:['-e',fixture],env:process.env});
 const broker=await createAuthorBroker(authority, { requestAllowed: authorRequestAllowed });
 let proxy;
 try {
  assert.equal((await fetch(broker.url,{method:'POST',body:'{}'})).status,403);
  proxy=await createMcpSession({command:process.execPath,args:[fileURLToPath(new URL('../../core/proxy.mjs',import.meta.url))],
   env:{...process.env,VALDR_EVAL_PROXY_URL:broker.url,VALDR_EVAL_PROXY_TOKEN:broker.token}});
  assert.equal((await proxy.callTool('pm_task',{action:'create'})).isError,true);
  assert.deepEqual((await proxy.callTool('pm_workflow',{action:'validate',label:'café'})).structuredContent.echo,{action:'validate',label:'café'});
 } finally {await proxy?.close();await broker.close();await authority.close()}
 assert.equal(authority.closed,true);
});

test('proxy stdin EOF aborts an in-flight broker request promptly', async () => {
 let observed;
 const arrived=new Promise(resolve=>{observed=resolve});
 const server=http.createServer(()=>observed());
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const proxy=spawn(process.execPath,[fileURLToPath(new URL('../../core/proxy.mjs',import.meta.url))],{stdio:['pipe','pipe','pipe'],env:{...process.env,
  VALDR_EVAL_PROXY_URL:`http://127.0.0.1:${server.address().port}/rpc`,VALDR_EVAL_PROXY_TOKEN:'test-only'}});
 try {
  proxy.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})+'\n');
  await arrived;
  const closed=once(proxy,'close');proxy.stdin.end();
  const timeout=AbortSignal.timeout(2000);
  const outcome=await Promise.race([closed,new Promise((_,reject)=>timeout.addEventListener('abort',()=>reject(new Error('Proxy did not stop on EOF')),{once:true}))]);
  assert.equal(outcome[0],0);
 } finally {proxy.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});
