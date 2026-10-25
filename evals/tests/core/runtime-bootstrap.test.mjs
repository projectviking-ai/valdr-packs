import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { createIsolatedEnvironment, isolatedEnvironment, OWNED_PREFIX } from '../../core/harness.mjs'
import { writeEvidence } from '../../core/evidence.mjs'
import { configureRuntimeEnvironment } from '../runtime-environment.mjs'

const digest = value => crypto.createHash('sha256').update(value).digest('hex')
function directory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-bootstrap-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}
function ownedRoot(t) {
  const root = fs.mkdtempSync(OWNED_PREFIX)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'pm'))
  fs.writeFileSync(path.join(root, '.benchmark-owner.json'), JSON.stringify({ root, kind: 'valdr-agent-eval' }))
  return root
}
function fakeBinary(root, missingTools = false, healthError = null) {
  const executable = path.join(root, 'valdr')
  fs.writeFileSync(executable, `#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
if(process.argv[2]==='version'){console.log('valdr 99.0.0 fixture');process.exit(0)}
const home=process.argv[process.argv.indexOf('--pm-home')+1];
const license=path.join(process.env.HOME,'.valdr','valdr.lic');
const hash=value=>crypto.createHash('sha256').update(value||'').digest('hex');
fs.writeFileSync(${JSON.stringify(path.join(root, 'launch.json'))},JSON.stringify({home,userHome:process.env.HOME,args:process.argv.slice(2),
 credentials:{username:hash(process.env.VALDR_DB_USERNAME),password:hash(process.env.VALDR_DB_PASSWORD)},
 license:fs.existsSync(license)?{path:license,isLink:fs.lstatSync(license).isSymbolicLink(),target:fs.lstatSync(license).isSymbolicLink()?fs.readlinkSync(license):null}:null}));
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
 const request=JSON.parse(line);if(request.id===undefined)return;
 const healthError=${JSON.stringify(healthError)};
 const result=request.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fixture',version:'1'}}:request.method==='tools/list'?{tools:${missingTools ? '[]' : "[{name:'pm_health'}]"}}:healthError?{isError:true,content:[{type:'text',text:healthError}]}:{structuredContent:{data:{info:{dataDir:home}}}};
 console.log(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
});`, { mode: 0o700 })
  return executable
}

test('owned environments retain credentials and redact passwords without corrupting identifiers', t => {
  const inherited = { PATH: '/bin', HOME: '/configured-home', VALDR_DB_USERNAME: 'configured-user', VALDR_DB_PASSWORD: 'configured-password', APP_PASSWORD: 'unrelated-secret' }
  const environments = [ownedRoot(t), ownedRoot(t)].map(root => isolatedEnvironment({ root, mode: 'runtime', inherited }))
  for (const environment of environments) {
    assert.equal(environment.VALDR_DB_USERNAME, 'configured-user')
    assert.equal(environment.VALDR_DB_PASSWORD, 'configured-password')
    assert.equal(environment.HOME, '/configured-home')
    assert.equal(environment.APP_PASSWORD, undefined)
    const evidence = path.join(directory(t), 'evidence.json')
    writeEvidence(evidence, { username: environment.VALDR_DB_USERNAME, VALDR_DB_USERNAME: environment.VALDR_DB_USERNAME,
      message: `username=${environment.VALDR_DB_USERNAME}; password=${environment.VALDR_DB_PASSWORD}` })
    assert.deepEqual(JSON.parse(fs.readFileSync(evidence)), { username: '[REDACTED]', VALDR_DB_USERNAME: '[REDACTED]',
      message: 'username=[REDACTED]; password=[REDACTED]' })
  }
  assert.equal(inherited.VALDR_DB_PASSWORD, 'configured-password')
})

test('registered password text cannot corrupt the next workspace ownership marker', t => {
  const root = directory(t)
  const disposable = path.join(root, 'private-bootstrap-regression-secret')
  fs.mkdirSync(disposable)
  const executable = fakeBinary(root)
  const moduleUrl = new URL('../../core/harness.mjs', import.meta.url).href
  const script = `import { createIsolatedEnvironment } from ${JSON.stringify(moduleUrl)};
const closed=[];
for(let index=0;index<2;index++){
 const environment=await createIsolatedEnvironment({valdrBin:${JSON.stringify(executable)},evidenceDir:${JSON.stringify(path.join(root, 'evidence'))}+index});
 closed.push((await environment.close()).ok);
}
console.log(JSON.stringify(closed));`
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    env: { PATH: process.env.PATH, HOME: root, TMPDIR: disposable, VALDR_DB_USERNAME: 'fixture-identity', VALDR_DB_PASSWORD: 'private-bootstrap-regression-secret' },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.deepEqual(JSON.parse(output), [true, true])
  assert.deepEqual(fs.readdirSync(disposable), [])
})

test('default license setup survives owned workspace cleanup unchanged', async t => {
  const root = directory(t)
  const userHome = path.join(root, 'user')
  const source = path.join(userHome, '.valdr/valdr.lic')
  fs.mkdirSync(path.dirname(source), { recursive: true })
  fs.writeFileSync(source, 'fixture-license-content\n', { mode: 0o400 })
  const before = fs.statSync(source)
  configureRuntimeEnvironment(t, { HOME: userHome })
  const environment = await createIsolatedEnvironment({ valdrBin: fakeBinary(root), evidenceDir: path.join(root, 'evidence') })
  t.after(() => environment.close())
  const launch = JSON.parse(fs.readFileSync(path.join(root, 'launch.json')))
  assert.ok(environment.env.VALDR_DB_USERNAME)
  assert.ok(environment.env.VALDR_DB_PASSWORD)
  assert.equal(launch.credentials.username, digest(environment.env.VALDR_DB_USERNAME))
  assert.equal(launch.credentials.password, digest(environment.env.VALDR_DB_PASSWORD))
  assert.equal(launch.credentials.username, digest('eval-fixture-user'))
  assert.equal(launch.credentials.password, digest('eval-fixture-password'))
  assert.equal(launch.license?.isLink, false)
  assert.equal(launch.license.target, null)
  assert.equal(launch.userHome, userHome)
  assert.equal(launch.args[launch.args.indexOf('--data-root') + 1], path.join(userHome, '.valdr'))
  assert.equal(launch.home, path.join(environment.root, 'pm'))
  assert.equal(launch.args[launch.args.indexOf('--runtime-root') + 1], path.join(environment.root, 'runtime'))
  const receipt = await environment.close()
  assert.equal(receipt.ok, true)
  assert.equal(fs.existsSync(launch.license.path), true)
  assert.equal(fs.readFileSync(source, 'utf8'), 'fixture-license-content\n')
  assert.equal(fs.statSync(source).ino, before.ino)
  assert.equal(fs.statSync(source).mtimeMs, before.mtimeMs)
})

test('an absent default license permits offline fixtures and gives setup guidance for missing tools', async t => {
  const root = directory(t)
  configureRuntimeEnvironment(t, { HOME: path.join(root, 'no-license') })
  const environment = await createIsolatedEnvironment({ valdrBin: fakeBinary(root), evidenceDir: path.join(root, 'ready') })
  assert.equal((await environment.close()).ok, true)
  await assert.rejects(createIsolatedEnvironment({ valdrBin: fakeBinary(root, true), evidenceDir: path.join(root, 'missing') }), /Settings.*valdr\.lic/)
})

test('default license initialization failure retains the public health diagnosis', async t => {
  const root = directory(t)
  const userHome = path.join(root, 'user')
  const source = path.join(userHome, '.valdr/valdr.lic')
  fs.mkdirSync(path.dirname(source), { recursive: true })
  fs.writeFileSync(source, 'existing-license')
  configureRuntimeEnvironment(t, { HOME: userHome })
  await assert.rejects(createIsolatedEnvironment({
    valdrBin: fakeBinary(root, true, 'License validation state is unavailable.'),
    evidenceDir: path.join(root, 'evidence'),
  }), error => error.code === 'VALDR_EVAL_INFRASTRUCTURE' && /License validation state is unavailable/.test(error.message))
  const launch = JSON.parse(fs.readFileSync(path.join(root, 'launch.json')))
  assert.equal(launch.license.path, source)
  assert.equal(launch.license.isLink, false)
  const failure = JSON.parse(fs.readFileSync(path.join(root, 'evidence/startup-failure.json')))
  assert.match(failure.error, /License validation state is unavailable/)
  assert.equal(fs.readFileSync(source, 'utf8'), 'existing-license')
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'evidence/cleanup.json'))).ok, true)
})

for (const missing of ['VALDR_DB_USERNAME', 'VALDR_DB_PASSWORD']) test(`missing ${missing} stops before launching and removes its owned workspace`, async t => {
  configureRuntimeEnvironment(t, { [missing]: undefined })
  const root = directory(t)
  await assert.rejects(createIsolatedEnvironment({ valdrBin: fakeBinary(root), evidenceDir: path.join(root, 'evidence') }),
    error => error.code === 'VALDR_EVAL_INFRASTRUCTURE' && /VALDR_DB_USERNAME.*VALDR_DB_PASSWORD/.test(error.message))
  assert.equal(fs.existsSync(path.join(root, 'launch.json')), false)
  const cleanup = JSON.parse(fs.readFileSync(path.join(root, 'evidence/cleanup.json')))
  assert.equal(cleanup.ok, true)
  assert.equal(fs.existsSync(cleanup.root), false)
})
