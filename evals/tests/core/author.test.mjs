import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runAgentTurn } from '../../core/author.mjs'
import { createLifecycle } from '../../core/lifecycle.mjs'

function fixture(t, behavior = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'author-test-'))
  const repoRoot = path.join(root, 'repo'); fs.mkdirSync(repoRoot)
  const outputDir = path.join(root, 'evidence'); fs.mkdirSync(outputDir)
  const script = path.join(root, 'codex.mjs')
  fs.writeFileSync(script, `import fs from 'node:fs';\nconst args=process.argv.slice(2); const emit=v=>process.stdout.write(JSON.stringify(v)+'\\n');\nlet prompt='';for await(const data of process.stdin)prompt+=data;\nfs.writeFileSync(${JSON.stringify(path.join(root, 'args.json'))},JSON.stringify({args,prompt,env:process.env}));\n${behavior || `emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.completed',item:{type:'agent_message',text:'done'}});emit({type:'turn.completed',usage:{input_tokens:10,output_tokens:2}});fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'done\\n');`}`)
  const lifecycle = createLifecycle()
  const environment = { root, repoRoot, lifecycle, broker: { url:'http://127.0.0.1:3000/rpc', token:'private-broker-token', requests:[] } }
  const options = { agent:{handle:'agent',expectedSystemPrompt:'Exact persona'}, profile:{providerType:'codex',model:'gpt-6.1-sol',reasoningEffort:'high'}, prompt:'Perform the task.', timeoutMs:1500, outputDir }
  t.after(async()=>{await lifecycle.close();fs.rmSync(root,{recursive:true,force:true})})
  return { root, environment, options, run: overrides => runAgentTurn(environment,{...options,...overrides},{command:process.execPath,commandArgs:[script]}) }
}

test('author requires completion, final output and process settlement, with secrets excluded from evidence',async t=>{
  const f=fixture(t); const result=await f.run()
  assert.equal(result.settled,true); assert.equal(result.finalMessage,'done'); assert.equal(result.sessionUlid,'thread-1')
  assert.equal(result.cleanup.ok,true)
  assert.ok(result.durationMs >= 0)
  assert.equal(Date.parse(result.completedAt)-Date.parse(result.startedAt),result.durationMs)
  const {args,env}=JSON.parse(fs.readFileSync(path.join(f.root,'args.json')))
  assert.ok(args.includes('--ignore-user-config')); assert.ok(args.includes('--ignore-rules')); assert.ok(!args.includes('--ephemeral'))
  assert.ok(args.includes('features.shell_tool=false')); assert.ok(args.includes('web_search="disabled"'))
  assert.equal(env.VALDR_DB_PASSWORD,undefined); assert.equal(env.VALDR_EVAL_PROXY_TOKEN,'private-broker-token')
  assert.ok(!fs.readFileSync(path.join(f.options.outputDir,'provider-launch.json'),'utf8').includes('private-broker-token'))
})

test('repair resumes the exact previous thread and rejects a different thread identity',async t=>{
  const f=fixture(t); await f.run({sessionUlid:'thread-1'})
  const {args}=JSON.parse(fs.readFileSync(path.join(f.root,'args.json')))
  assert.ok(args.includes('resume')); assert.ok(args.includes('thread-1'))
  await assert.rejects(f.run({sessionUlid:'other-thread'}),/thread identity/i)
})

test('accepted or partial turns never count as completed output',async t=>{
  const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.completed',item:{type:'agent_message',text:'looks done'}});`)
  await assert.rejects(f.run(),/completion/i)
})

test('a terminal event cannot substitute for matching final output',async t=>{
  const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.completed',item:{type:'agent_message',text:'one'}});emit({type:'turn.completed'});fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'two');`)
  await assert.rejects(f.run(),/final output/i)
})

test('unrelated MCP and native command execution fail closed',async t=>{
  for(const item of [{type:'mcp_tool_call',server:'unrelated',tool:'write'},{type:'command_execution',command:'echo bypass'}]) {
    const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.started',item:${JSON.stringify(item)}});setInterval(()=>{},1000);`)
    await assert.rejects(f.run(),/tool scope/i)
  }
})

test('Codex resource discovery can complete within the configured Valdr scope',async t=>{
  for (const tool of ['list_mcp_resources', 'list_mcp_resource_templates']) {
    for (const args of [{}, {server:'valdr'}, {server:'valdr',cursor:'next-page'}, {cursor:'next-page'}]) {
      await t.test(`${tool} ${JSON.stringify(args)}`,async t=>{
        const item={id:'discovery',type:'mcp_tool_call',server:'codex',tool,arguments:args}
        const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.started',item:{...${JSON.stringify(item)},status:'in_progress'}});emit({type:'item.completed',item:{...${JSON.stringify(item)},status:'completed',result:{content:[]},error:null}});emit({type:'item.completed',item:{type:'agent_message',text:'done'}});emit({type:'turn.completed'});fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'done');`)
        const result=await f.run()
        assert.equal(result.finalMessage,'done')
        assert.equal(result.cleanup.ok,true)
        const events=JSON.parse(fs.readFileSync(path.join(f.options.outputDir,'provider-events.json')))
        assert.equal(events.filter(event=>event.item?.id==='discovery').length,2)
      })
    }
  }
})

test('discovery exemption rejects foreign targets, malformed arguments and other helpers',async t=>{
  const cases=[
    {server:'unrelated',tool:'list_mcp_resources',arguments:{}},
    {server:'codex',tool:'read_mcp_resource',arguments:{server:'valdr',uri:'valdr://private'}},
    {server:'codex',tool:'exec_command',arguments:{}},
    ...['list_mcp_resources','list_mcp_resource_templates'].flatMap(tool=>[
      {server:'other'}, {server:'valdr_alpha'}, {server:''}, {server:null}, {server:['valdr']},
      {cursor:1}, {cursor:null}, {uri:'valdr://private'}, [], null, '{}', undefined,
    ].map(args=>({server:'codex',tool,arguments:args}))),
  ]
  for (const item of cases) {
    const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.started',item:{type:'mcp_tool_call',...${JSON.stringify(item)}}});setInterval(()=>{},1000);`)
    await assert.rejects(f.run(),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE' && /tool scope/i.test(error.message))
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.options.outputDir,'provider-cleanup.json'))).ok,true)
  }
})

test('allowed discovery still requires successful transport and a completed author turn',async t=>{
  const item={type:'mcp_tool_call',server:'codex',tool:'list_mcp_resources',arguments:{},status:'failed',error:{message:'Discovery transport unavailable'}}
  const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.completed',item:${JSON.stringify(item)}});emit({type:'item.completed',item:{type:'agent_message',text:'done'}});emit({type:'turn.completed'});fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'done');`)
  await assert.rejects(f.run(),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE' && /Discovery transport unavailable/.test(error.message))
  const partial=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.completed',item:{...${JSON.stringify(item)},status:'completed',error:null,result:{content:[]}}});`)
  await assert.rejects(partial.run(),/completion/i)
})

test('timeout stops an author before returning, even after it prints completed',async t=>{
  const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.completed',item:{type:'agent_message',text:'done'}});emit({type:'turn.completed'});fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'done');setInterval(()=>{},1000);`)
  await assert.rejects(f.run({timeoutMs:100}),/timed out/i)
  const cleanup=JSON.parse(fs.readFileSync(path.join(f.options.outputDir,'provider-cleanup.json')))
  assert.equal(cleanup.ok,true)
  const diagnostics=JSON.parse(fs.readFileSync(path.join(f.options.outputDir,'provider-diagnostics.json')))
  assert.ok(diagnostics.durationMs>=100)
  assert.equal(Date.parse(diagnostics.completedAt)-Date.parse(diagnostics.startedAt),diagnostics.durationMs)
  assert.throws(()=>process.kill(cleanup.pid,0),error=>error.code==='ESRCH')
})

test('cancellation stops the owned author subprocess',async t=>{
  const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});setInterval(()=>{},1000);`)
  const pending=f.run(); setTimeout(()=>f.environment.lifecycle.cancel('stop test'),100)
  await assert.rejects(pending,/stop test|cancel/i)
})

test('author redacts split credential output and registers cleanup before cancellation can remove the workspace',async t=>{
  const f=fixture(t,`process.stderr.write('private-broker-');process.stderr.write('token');emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'turn.failed',error:{message:'private-broker-token'}});`)
  let registered=false; f.environment.registerAuthorCleanup=()=>{registered=true}
  await assert.rejects(f.run(),error=>!error.message.includes('private-broker-token'))
  assert.equal(registered,true)
  assert.ok(!fs.readFileSync(path.join(f.options.outputDir,'provider-diagnostics.json'),'utf8').includes('private-broker-token'))
})

test('provider approval and transport failures are infrastructure errors, not candidate output',async t=>{
  const f=fixture(t,`emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.completed',item:{type:'mcp_tool_call',server:'valdr',tool:'pm_task',error:{message:'MCP tool call requires approval, but approval policy is never'},status:'failed'}});emit({type:'item.completed',item:{type:'agent_message',text:'needs_human'}});emit({type:'turn.completed'});fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'needs_human');`)
  await assert.rejects(f.run(),error=>error.code==='VALDR_EVAL_INFRASTRUCTURE' && /approval/.test(error.message))
})

test('completed parent cannot leave a child running against the fixture',async t=>{
  const f=fixture(t,`const {spawn}=await import('node:child_process');const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(new URL('./descendant.pid',import.meta.url),String(descendant.pid));emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});emit({type:'item.completed',item:{type:'agent_message',text:'done'}});emit({type:'turn.completed'});fs.writeFileSync(args[args.indexOf('--output-last-message')+1],'done');descendant.unref();`)
  const result=await f.run()
  assert.equal(result.cleanup.processGroupStopped,true)
  assert.equal(result.cleanup.processClosed,true)
  const pid=Number(fs.readFileSync(path.join(f.root,'descendant.pid'),'utf8'))
  assert.throws(()=>process.kill(pid,0),error=>error.code==='ESRCH')
})

test('author refuses an executable changed since the charter without launching it',async t=>{
  const {getCodexBinaryInfo}=await import('../../core/binary.mjs')
  const f=fixture(t)
  const executable=path.join(f.root,'codex-version-fixture')
  fs.writeFileSync(executable,'#!/bin/sh\n[ "$1" = --version ] || exit 42\necho "codex-cli 1.0.0"\n',{mode:0o700})
  const authorBinary=getCodexBinaryInfo(executable)
  fs.appendFileSync(executable,'\n# changed after charter\n')
  await assert.rejects(runAgentTurn(f.environment,{...f.options,authorBinary}),/Codex executable changed/)
  assert.equal(fs.existsSync(path.join(f.root,'args.json')),false)
})
