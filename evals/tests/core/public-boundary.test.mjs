import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { createIsolatedEnvironment, isolatedEnvironment, OWNED_PREFIX } from '../../core/harness.mjs'
import { createMcpSession } from '../../core/mcp.mjs'
import { configureRuntimeEnvironment } from '../runtime-environment.mjs'

test('failed version probes suppress raw diagnostics and return setup guidance', t => {
  const root = directory(t)
  const executable = path.join(root, 'valdr')
  fs.writeFileSync(executable, '#!/bin/sh\nprintf "Bearer probe-secret\\033[31m" >&2\nexit 1\n', { mode: 0o700 })
  const moduleUrl = new URL('../../core/binary.mjs', import.meta.url).href
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { getBinaryInfo } from ${JSON.stringify(moduleUrl)}; try { getBinaryInfo(${JSON.stringify(executable)}); } catch (error) { console.log(error.message); }`], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.match(result.stdout, /version check failed.*installed valdr CLI/i)
  assert.doesNotMatch(result.stdout, /probe-secret|\u001b|Bearer/)
})

function directory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-public-boundary-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}
function fakeBinary(root) {
  const executable = path.join(root, 'valdr')
  fs.writeFileSync(executable, `#!/usr/bin/env node
const fs=require('node:fs');
if(process.argv[2]==='version'){console.log('valdr 99.0.0 fixture');process.exit(0)}
const home=process.argv[process.argv.indexOf('--pm-home')+1];
fs.writeFileSync(${JSON.stringify(path.join(root, 'launch.json'))},JSON.stringify({args:process.argv.slice(2),env:process.env}));
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
 const request=JSON.parse(line);if(request.id===undefined)return;
 const result=request.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fixture',version:'1'}}:request.method==='tools/list'?{tools:[{name:'pm_health'}]}:{structuredContent:{data:{info:{dataDir:home}}}};
 console.log(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
});`, { mode: 0o700 })
  return executable
}

test('child environment excludes arbitrary inherited configuration and credentials', t => {
  const root = fs.mkdtempSync(OWNED_PREFIX)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'pm'))
  fs.writeFileSync(path.join(root, '.benchmark-owner.json'), JSON.stringify({ root, kind: 'valdr-agent-eval' }))
  const inherited = { PATH: '/bin', HOME: '/host-home', LANG: 'en_US.UTF-8', VALDR_DB_USERNAME: 'fixture-user', VALDR_DB_PASSWORD: 'fixture-password', APP_PASSWORD: 'do-not-forward', PRIVATE_SETTING: 'do-not-forward' }
  const env = isolatedEnvironment({ root, mode: 'runtime', inherited })
  assert.equal(env.APP_PASSWORD, undefined)
  assert.equal(env.PRIVATE_SETTING, undefined)
  assert.equal(env.PATH, inherited.PATH)
  assert.equal(env.HOME, '/host-home')
  assert.equal(inherited.HOME, '/host-home')
})

test('runtime isolation passes documented paths as flags and removes its owned home on close', async t => {
  const root = directory(t)
  configureRuntimeEnvironment(t, { HOME: path.join(root, 'user') })
  const environment = await createIsolatedEnvironment({ valdrBin: fakeBinary(root), evidenceDir: path.join(root, 'evidence') })
  t.after(() => environment.close())
  const launch = JSON.parse(fs.readFileSync(path.join(root, 'launch.json')))
  for (const [flag, suffix] of [['--pm-home', 'pm'], ['--runtime-root', 'runtime']]) {
    assert.equal(launch.args[launch.args.indexOf(flag) + 1], path.join(environment.root, suffix))
  }
  assert.equal(launch.args[launch.args.indexOf('--data-root') + 1], path.join(root, 'user', '.valdr'))
  const receipt = await environment.close()
  assert.equal(receipt.ok, true)
  assert.equal(receipt.homeRetained, false)
  assert.equal(fs.existsSync(environment.root), false)
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'evidence/cleanup.json'))).ok, true)
})

test('author fixtures expose the scoped broker and settle the author before cleanup', async t => {
  const root = directory(t)
  configureRuntimeEnvironment(t)
  const environment = await createIsolatedEnvironment({ valdrBin: fakeBinary(root), evidenceDir: path.join(root, 'evidence'), mode: 'author', requestAllowed: () => false })
  t.after(() => environment.close())
  const reply = await fetch(environment.broker.url, { method: 'POST', headers: { authorization: `Bearer ${environment.broker.token}` }, body: JSON.stringify({ method: 'tools/call', params: { name: 'pm_task', arguments: { action: 'update' } } }) }).then(response => response.json())
  assert.equal(reply.result.isError, true)
  assert.equal(environment.broker.requests[0].allowed, false)
  let stopped = false
  environment.registerAuthorCleanup(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(fs.existsSync(environment.root), true)
    stopped = true
    return { ok: true }
  })
  assert.equal((await environment.close()).ok, true)
  assert.equal(stopped, true)
  assert.equal(fs.existsSync(environment.root), false)
  await assert.rejects(fetch(environment.broker.url), /fetch|connect/i)
})

test('unverified author shutdown retains its owned fixture directory', async t => {
  const root = directory(t)
  configureRuntimeEnvironment(t)
  const environment = await createIsolatedEnvironment({ valdrBin: fakeBinary(root), evidenceDir: path.join(root, 'evidence'), mode: 'author' })
  t.after(() => fs.rmSync(environment.root, { recursive: true, force: true }))
  environment.registerAuthorCleanup(async () => ({ ok: false }))
  const receipt = await environment.close()
  assert.equal(receipt.ok, false)
  assert.equal(receipt.homeRetained, true)
})

test('MCP drains the final response after process exit before closing the request', async t => {
  const root = directory(t)
  const fixture = path.join(root, 'fixture.mjs')
  fs.writeFileSync(fixture, `import {spawn} from 'node:child_process';
import readline from 'node:readline';
readline.createInterface({input:process.stdin}).on('line',line=>{
 const request=JSON.parse(line);if(request.id===undefined)return;
 if(request.method==='initialize'){console.log(JSON.stringify({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fixture',version:'1'}}}));return;}
 const reply=JSON.stringify({jsonrpc:'2.0',id:request.id,result:{drained:true}});
 spawn(process.execPath,['-e','setTimeout(()=>console.log('+JSON.stringify(reply)+'),40)'],{stdio:['ignore',1,'ignore']});process.exit(0);
});`)
  const session = await createMcpSession({ command: process.execPath, args: [fixture] })
  t.after(() => session.close())
  assert.deepEqual(await session.request('final'), { drained: true })
})

test('MCP shutdown stops a descendant even after its parent exits', { skip: process.platform === 'win32' }, async t => {
  const root = directory(t)
  const heartbeat = path.join(root, 'heartbeat')
  const fixture = path.join(root, 'fixture.mjs')
  fs.writeFileSync(fixture, `import {spawn} from 'node:child_process';import readline from 'node:readline';
const descendant=spawn(process.execPath,['-e',${JSON.stringify(`const fs=require('node:fs');setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},'.'),20)`) }],{stdio:'ignore'});
const lines=readline.createInterface({input:process.stdin});lines.on('close',()=>process.exit(0));
lines.on('line',line=>{const request=JSON.parse(line);if(request.id!==undefined)console.log(JSON.stringify({jsonrpc:'2.0',id:request.id,result:request.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fixture',version:'1'}}:{pid:descendant.pid}}))});`)
  const session = await createMcpSession({ command: process.execPath, args: [fixture] })
  const { pid } = await session.request('descendant')
  t.after(() => { try { process.kill(pid, 'SIGKILL') } catch {} })
  t.after(() => session.close())
  for (let tries = 0; !fs.existsSync(heartbeat) && tries < 50; tries++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.ok(fs.existsSync(heartbeat))
  await session.close()
  const size = fs.statSync(heartbeat).size
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(fs.statSync(heartbeat).size, size)
})


test('temporary environment roots honor TMPDIR', t => {
  const root = directory(t)
  const harnessUrl = new URL('../../core/harness.mjs', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `import { OWNED_PREFIX } from ${JSON.stringify(harnessUrl)}; console.log(OWNED_PREFIX)`],
    { env: { PATH: process.env.PATH, TMPDIR: root }, encoding: 'utf8' }).trim()
  assert.equal(path.dirname(output), fs.realpathSync(root))
})
