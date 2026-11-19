import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { randomBytes } from 'node:crypto'
import { sealCredential, openCredential, validCredentialName } from '../functions/src/cloudCredentialCrypto.js'
import { GeminiError } from '../functions/src/gemini.js'

function harness() {
  const master = randomBytes(32).toString('base64'), docs = new Map(); let generationKey, pending, entered
  const clone = value => value === undefined ? undefined : structuredClone(value)
  const db = { doc: path => ({ path, get: async () => ({ data: () => clone(docs.get(path)) }) }), runTransaction: async callback => callback({ get: ref => ref.get(), set: (ref, value) => docs.set(ref.path, clone(value)) }) }
  class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details } }
  const context = { randomBytes, getFirestore: () => db, onCall: (_, handler) => handler, HttpsError, defineSecret: () => ({ value: () => master }), requireAssistantAdmin: async request => { if (!request.auth || request.auth.uid === 'operational') throw new HttpsError('permission-denied', 'Sem acesso'); return { role: 'admin' } }, askAssistant: async (request, provider, key) => { generationKey = key; entered?.(); if (pending) await pending; return { text: 'Resultado fictício' } }, listPreviewGeminiModels: async () => [{ id: 'gemini-3.1-flash-lite', name: 'Modelo de teste' }], GeminiError, sealCredential, openCredential, validCredentialName, Date, console }
  const source = readFileSync(new URL('../functions/src/assistantConnections.js', import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '').replace(/export const /g, 'const ')
  vm.runInNewContext(`${source}\nglobalThis.api={assistantConnections,assistantPersonalGemini}`, context)
  const call = (uid, action, data = {}) => context.api.assistantConnections({ auth: uid ? { uid } : null, data: { action, ...data } })
  return { call, docs, key: () => generationKey, ask: (uid, data) => context.api.assistantPersonalGemini({ auth: { uid }, data }), block: () => { let release; pending = new Promise(resolve => { release = resolve }); const started = new Promise(resolve => { entered = resolve }); return { started, release: () => { pending = null; release() } } } }
}

test('conexões Firebase isolam usuários, não retornam segredos e usam a seleção salva', async () => {
  const h = harness(), key = 'fictional-api-key-for-unit-tests-only'
  await assert.rejects(h.call(null, 'status'), error => error.code === 'permission-denied')
  await assert.rejects(h.call('operational', 'status'), error => error.code === 'permission-denied')
  await assert.rejects(h.call('a', 'connect', { key, name: 'Pessoal', save: true }), error => error.code === 'invalid-argument')
  const first = await h.call('a', 'connect', { key, name: 'Pessoal', save: true, consent: true })
  const second = await h.call('a', 'connect', { key: `${key}-two`, name: 'Trabalho', save: true, consent: true })
  assert.equal(second.savedKeys.length, 2); assert.ok(!JSON.stringify(second).includes(key)); assert.ok(!JSON.stringify([...h.docs]).includes(key))
  assert.equal((await h.call('b', 'status')).savedKeys.length, 0)
  await assert.rejects(h.call('b', 'connect', { savedKeyId: first.activeKeyId, consent: true }), error => error.code === 'not-found')
  await h.call('a', 'connect', { savedKeyId: first.activeKeyId, consent: true })
  await h.ask('a', { keyId: first.activeKeyId }); assert.equal(h.key(), key)
  await assert.rejects(h.ask('a', { keyId: second.activeKeyId }), error => error.code === 'failed-precondition')
  const running = h.block(), request = h.ask('a', { keyId: first.activeKeyId })
  await running.started
  await assert.rejects(h.call('a', 'delete', { id: first.activeKeyId }), error => error.code === 'failed-precondition')
  running.release(); await request
  const renamed = await h.call('a', 'rename', { id: first.activeKeyId, name: 'Equipe' })
  assert.ok(renamed.savedKeys.some(entry => entry.name === 'Equipe'))
  await h.call('a', 'delete', { id: first.activeKeyId }); assert.equal((await h.call('a', 'status')).connected, false)
  assert.equal((await h.call('a', 'status')).savedKeys.length, 1)
})
