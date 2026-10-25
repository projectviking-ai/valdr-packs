import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import * as binaries from '../../core/binary.mjs'

test('Codex provenance resolves the executable and hashes its actual bytes using only --version', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-codex-binary-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const binary = path.join(root, 'codex-real')
  const source = '#!/bin/sh\n[ "$#" = 1 ] && [ "$1" = --version ] || exit 42\nprintf "codex-cli 1.2.3\\n"\n'
  fs.writeFileSync(binary, source, { mode: 0o700 })
  const link = path.join(root, 'codex'); fs.symlinkSync(binary, link)
  const first = binaries.getCodexBinaryInfo(link)
  assert.deepEqual(first, { path: fs.realpathSync(binary), version: 'codex-cli 1.2.3',
    sha256: crypto.createHash('sha256').update(source).digest('hex'), platform: process.platform, arch: process.arch })
  fs.appendFileSync(binary, '\n# patched executable\n')
  const second = binaries.getCodexBinaryInfo(link)
  assert.equal(second.version, first.version)
  assert.notEqual(second.sha256, first.sha256)
})

test('Codex provenance refuses another program and a missing executable', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-codex-invalid-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const binary = path.join(root, 'other')
  fs.writeFileSync(binary, '#!/bin/sh\necho "different-cli 1.0.0"\n', { mode: 0o700 })
  assert.throws(() => binaries.getCodexBinaryInfo(binary), /Codex version/)
  assert.throws(() => binaries.getCodexBinaryInfo(path.join(root, 'missing')), /Codex executable not found/)
})
