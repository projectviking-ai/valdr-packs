import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createIsolatedEnvironment } from '../../core/harness.mjs'
import { createLifecycle } from '../../core/lifecycle.mjs'
import { configureRuntimeEnvironment } from '../runtime-environment.mjs'

async function fixture(t, lifecycle) {
  configureRuntimeEnvironment(t)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-cleanup-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const binary = path.join(directory, 'valdr')
  fs.writeFileSync(binary, `#!/usr/bin/env node
if(process.argv[2]==='version'){console.log('valdr 99.0.0 fixture');process.exit(0)}
const home=process.argv[process.argv.indexOf('--pm-home')+1];
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
 const request=JSON.parse(line);if(request.id===undefined)return;
 const result=request.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fixture',version:'1'}}:request.method==='tools/list'?{tools:[{name:'pm_health'}]}:{structuredContent:{data:{info:{dataDir:home}}}};
 console.log(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
});`, { mode: 0o700 })
  const environment = await createIsolatedEnvironment({ valdrBin: binary, evidenceDir: path.join(directory, 'evidence'), lifecycle })
  t.after(async () => { await environment.close(); fs.rmSync(environment.root, { recursive: true, force: true }) })
  return environment
}

test('cancellation closes the owned process and deletes its temporary files', async t => {
  const lifecycle = createLifecycle()
  const environment = await fixture(t, lifecycle)
  fs.writeFileSync(path.join(environment.root, 'temporary-data'), 'private test fixture')
  assert.equal((await lifecycle.cancel('Test cancellation')).ok, true)
  const receipt = await environment.close()
  assert.equal(receipt.ok, true)
  assert.equal(receipt.homeRetained, false)
  assert.equal(fs.existsSync(environment.root), false)
  assert.throws(() => process.kill(receipt.pid, 0), error => error.code === 'ESRCH')
})

test('cleanup preserves a directory whose ownership marker changed and reports incomplete', async t => {
  const environment = await fixture(t)
  fs.writeFileSync(path.join(environment.root, '.benchmark-owner.json'), JSON.stringify({ root: '/not-owned', kind: 'valdr-agent-eval' }))
  const receipt = await environment.close()
  assert.equal(receipt.ok, false)
  assert.equal(receipt.authorityClosed, true)
  assert.equal(receipt.homeRetained, true)
  assert.equal(fs.existsSync(environment.root), true)
  assert.match(receipt.errors.join(' '), /Ownership marker/)
})
