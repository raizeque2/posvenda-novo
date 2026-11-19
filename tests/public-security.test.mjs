import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { validarCadastro, problemaDaSenha } from '../functions/src/cadastroPolicy.js'

const source = file => readFileSync(new URL(`../functions/src/${file}`, import.meta.url), 'utf8').replace(/^import .*$/gm, '').replaceAll('export ', '')
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code } }
test('limite público persiste entre instâncias e nunca grava o IP ou token', async () => {
  const docs = new Map(), request = { rawRequest: { ip: '192.0.2.5' }, data: { token: 'private-link' } }
  const db = { doc: path => path, runTransaction: async callback => callback({ get: async path => ({ data: () => docs.get(path) }), set: (path, value) => docs.set(path, value) }) }
  const context = vm.createContext({ createHash, getFirestore: () => db, HttpsError, Date })
  vm.runInContext(source('publicRateLimit.js') + ';globalThis.limit=publicRateLimit', context)
  await context.limit(request, 'test', 2)
  await context.limit(request, 'test', 2)
  await assert.rejects(context.limit(request, 'test', 2), { code: 'resource-exhausted' })
  assert.equal(docs.size, 1)
  assert.ok(!JSON.stringify([...docs]).includes(request.rawRequest.ip))
  assert.ok(!JSON.stringify([...docs]).includes('private-link'))
})
test('cadastro público: conta nasce bloqueada, senha nunca vai ao Firestore, cargo é só pedido', async () => {
  const stored = [], checked = [], contas = [], existentes = new Set(['antigo@example.test'])
  const auth = { createUser: async u => { if (existentes.has(u.email)) throw Object.assign(Error('x'), { code: 'auth/email-already-exists' }); existentes.add(u.email); contas.push(u); return { uid: 'uid' + contas.length } }, deleteUser: async () => {} }
  const context = vm.createContext({ createHash, HttpsError, Date, TURNSTILE_SECRET: {}, onCall: (_, callback) => callback, publicRateLimit: async () => {}, validarCadastro, getAuth: () => auth,
    requireTurnstile: async (request, action) => { checked.push(action); if (request.data.turnstileToken !== 'ok') throw new HttpsError('failed-precondition', 'turnstile') },
    getFirestore: () => ({ doc: path => ({ get: async () => ({ exists: stored.some(s => s.path === path) }), create: async data => { if (stored.some(s => s.path === path)) throw Object.assign(Error('exists'), { code: 6 }); stored.push({ path, data }) } }) }) })
  vm.runInContext(source('registration.js') + ';globalThis.register=solicitarAcesso;globalThis.precheck=verificarTurnstile', context)
  const base = { nome: 'Ana', email: 'Ana@example.test', setor: 'Peças', cargo: 'supervisor', senha: 'senha123' }
  for (const data of [null, {}, { ...base, email: 'invalid' }, { ...base, senha: 'curta1' }, { ...base, senha: 'semnumero' }, { ...base, cargo: 'admin' }, { ...base, setor: 'Inventado' }, { ...base, role: 'admin' }]) await assert.rejects(context.register({ data }), { code: 'invalid-argument' })
  await assert.rejects(context.register({ data: base }), { code: 'failed-precondition' })
  assert.equal(stored.length, 0); assert.equal(contas.length, 0)
  await context.register({ data: { ...base, turnstileToken: 'ok' } })
  assert.equal(contas.length, 1)
  assert.equal(contas[0].disabled, true)
  assert.equal(contas[0].email, 'ana@example.test')
  assert.equal(stored.length, 1)
  assert.ok(!JSON.stringify(stored).includes('senha123'))
  assert.deepEqual(Object.keys(stored[0].data).sort(), ['cargoPedido', 'comSenha', 'email', 'nome', 'setor', 'solicitadoEm', 'status', 'uid'])
  assert.equal(stored[0].data.cargoPedido, 'supervisor')
  // Repetir não cria outra conta nem muda o pedido.
  await context.register({ data: { ...base, nome: 'Outro Nome', turnstileToken: 'ok' } })
  assert.equal(contas.length, 1); assert.equal(stored.length, 1); assert.equal(stored[0].data.nome, 'Ana')
  // E-mail que já tem conta: mesma resposta, pedido sem uid (admin resolve).
  assert.equal((await context.register({ data: { ...base, email: 'antigo@example.test', turnstileToken: 'ok' } })).ok, true)
  assert.equal(stored[1].data.uid, null)
  await assert.rejects(context.precheck({ data: { action: 'cadastro', turnstileToken: 'ok' } }), { code: 'invalid-argument' })
  assert.equal((await context.precheck({ data: { action: 'login', turnstileToken: 'ok' } })).ok, true)
})
test('senha do cadastro: 8+ caracteres com letra e número', () => {
  assert.notEqual(problemaDaSenha('abc12'), '')
  assert.notEqual(problemaDaSenha('somenteletras'), '')
  assert.notEqual(problemaDaSenha('12345678'), '')
  assert.equal(problemaDaSenha('moto2026'), '')
})
