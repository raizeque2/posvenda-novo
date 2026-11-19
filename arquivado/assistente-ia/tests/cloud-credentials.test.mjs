import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { sealCredential, openCredential, validCredentialName } from '../functions/src/cloudCredentialCrypto.js'

test('cofre Firebase cifra dados e vincula a credencial ao usuário e identificador', () => {
  const master = randomBytes(32).toString('base64'), value = { name: 'Chave de teste', key: 'not-a-real-api-key-just-a-test' }
  const payload = sealCredential(master, 'owner-a', 'entry-a', value)
  assert.ok(!JSON.stringify(payload).includes(value.key)); assert.ok(!JSON.stringify(payload).includes(value.name))
  assert.deepEqual(openCredential(master, 'owner-a', 'entry-a', payload), value)
  assert.throws(() => openCredential(master, 'owner-b', 'entry-a', payload))
  assert.throws(() => openCredential(master, 'owner-a', 'entry-b', payload))
  assert.throws(() => openCredential(master, 'owner-a', 'entry-a', { ...payload, data: 'AAAA' }))
  assert.throws(() => sealCredential('', 'owner-a', 'entry-a', value))
  assert.equal(validCredentialName(' Pessoal '), 'Pessoal')
  assert.throws(() => validCredentialName('x'.repeat(61)))
})
