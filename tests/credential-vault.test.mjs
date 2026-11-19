import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCredentialVault } from '../scripts/credential-vault.mjs'

test('cofre salva, recupera, renomeia e exclui sem expor chaves na lista', { skip: process.platform !== 'win32' }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'posvenda-vault-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const vault = createCredentialVault({ directory }), owner = 'a'.repeat(64), other = 'b'.repeat(64)
  const key = 'fake-credential-for-vault-test-only'
  const saved = await vault.add(owner, 'Minha chave de teste', key)
  assert.deepEqual(Object.keys(saved).sort(), ['id', 'name'])
  const files = await readdir(directory), bytes = await readFile(join(directory, files[0]), 'utf8')
  assert.ok(!bytes.includes(key)); assert.ok(!bytes.includes('Minha chave'))
  const restarted = createCredentialVault({ directory })
  assert.deepEqual(await restarted.list(owner), [saved])
  assert.equal(await restarted.get(owner, saved.id), key)
  assert.deepEqual(await restarted.list(other), [])
  await assert.rejects(restarted.get(other, saved.id), /não encontrada/)
  await restarted.rename(owner, saved.id, 'Trabalho')
  assert.equal((await restarted.list(owner))[0].name, 'Trabalho')
  await assert.rejects(restarted.add(owner, 'trabalho', key), /nome/)
  await assert.rejects(restarted.rename(owner, saved.id, '  '), /nome/i)
  await assert.rejects(restarted.get('../../outside', saved.id))
  await restarted.remove(owner, saved.id)
  assert.deepEqual(await restarted.list(owner), [])
  await assert.rejects(restarted.get(owner, saved.id), /não encontrada/)
  await writeFile(join(directory, files[0]), 'corrupted ciphertext')
  await assert.rejects(restarted.list(owner), /cofre/)
  assert.equal(await readFile(join(directory, files[0]), 'utf8'), 'corrupted ciphertext')
})
