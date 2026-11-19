import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import * as policy from '../functions/src/securityPolicy.js'
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code } }
test('conta é bloqueada no Firestore antes do Auth; exclusão limpa BI e cofre; admin não remove o próprio acesso', async () => {
  const events = []
  let caller = { role: 'admin' }
  const userRef = { get: async () => ({ data: () => caller }), update: async value => events.push(['profile', value.ativo]), set: async value => events.push(['profile', value.ativo]) }
  const db = { doc: () => ({ get: async () => ({ data: () => caller }) }), collection: name => ({ doc: uid => name === 'usuarios' ? userRef : { path: `${name}/${uid}` } }), recursiveDelete: async ref => { assert.equal(ref, userRef); events.push(['recursive-delete']) }, batch: () => ({ delete: ref => events.push(['delete', ref.path]), commit: async () => {} }) }
  const auth = { updateUser: async () => events.push(['auth-disable']), revokeRefreshTokens: async () => events.push(['revoke']), deleteUser: async () => events.push(['auth-delete']) }
  const context = vm.createContext({ ...policy, HttpsError, getFirestore: () => db, getAuth: () => auth, initializeApp: () => {}, onCall: (_, callback) => callback })
  const source = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace(/^export \{.*$/gm, '').replaceAll('export ', '')
  vm.runInContext(source + ';globalThis.manage=gerenciarUsuario', context)
  const request = acao => ({ auth: { uid: 'admin' }, data: { acao, uid: 'other' } })
  await context.manage(request('desativar'))
  assert.deepEqual(events, [['profile', false], ['auth-disable'], ['revoke']])
  events.length = 0
  await context.manage(request('excluir'))
  assert.deepEqual(events.slice(0, 3), [['profile', false], ['auth-delete'], ['recursive-delete']])
  assert.ok(events.some(event => event[1] === 'assistantConnections/other'))
  events.length = 0
  for (const data of [{ acao: 'excluir', uid: 'admin' }, { acao: 'desativar', uid: 'admin' }, { acao: 'atualizarPerfil', uid: 'admin', role: 'operacional' }]) await assert.rejects(context.manage({ auth: { uid: 'admin' }, data }), { code: 'failed-precondition' })
  caller = { role: 'admin', ativo: false }
  await assert.rejects(context.manage(request('reativar')), { code: 'permission-denied' })
  assert.equal(events.length, 0)
})
