import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../functions/src/turnstile.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replaceAll('export ', '')
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code } }
const context = vm.createContext({ URLSearchParams, AbortSignal, HttpsError, console, String, defineSecret: () => ({ value: () => '' }), defineString: () => ({ value: () => 'app.example.test' }) })
vm.runInContext(source + ';globalThis.api={verifyTurnstileToken,parseHostnames,requireTurnstile}', context)
const { verifyTurnstileToken, parseHostnames, requireTurnstile } = context.api

const reply = (body, status = 200) => async (url, init) => { reply.last = { url, init }; return { ok: status < 400, status, json: async () => body } }
const base = { token: 'tok', action: 'login', secret: 'dummy-secret', hostnames: ['app.example.test'] }

test('Turnstile aceita somente sucesso com ação e hostname esperados', async () => {
  assert.deepEqual({ ...(await verifyTurnstileToken({ ...base, fetchImpl: reply({ success: true, action: 'login', hostname: 'app.example.test' }) })) }, { ok: true })
  assert.equal(reply.last.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
  assert.equal(reply.last.init.body.get('response'), 'tok')
  assert.equal((await verifyTurnstileToken({ ...base, fetchImpl: reply({ success: true, action: 'cadastro', hostname: 'app.example.test' }) })).ok, false)
  assert.equal((await verifyTurnstileToken({ ...base, fetchImpl: reply({ success: true, action: 'login', hostname: 'evil.example' }) })).ok, false)
  assert.equal((await verifyTurnstileToken({ ...base, fetchImpl: reply({ success: false, 'error-codes': ['timeout-or-duplicate'] }) })).motivo, 'timeout-or-duplicate')
})

test('Turnstile falha fechado sem segredo, sem token, em erro HTTP ou de rede', async () => {
  const never = async () => { throw Error('não deveria chamar') }
  assert.equal((await verifyTurnstileToken({ ...base, secret: '', fetchImpl: never })).motivo, 'segredo-ausente')
  assert.equal((await verifyTurnstileToken({ ...base, token: '', fetchImpl: never })).motivo, 'token-invalido')
  assert.equal((await verifyTurnstileToken({ ...base, token: 'x'.repeat(2049), fetchImpl: never })).motivo, 'token-invalido')
  assert.equal((await verifyTurnstileToken({ ...base, action: 'outra', fetchImpl: never })).motivo, 'acao-invalida')
  assert.equal((await verifyTurnstileToken({ ...base, fetchImpl: reply({}, 500) })).motivo, 'http-500')
  assert.equal((await verifyTurnstileToken({ ...base, fetchImpl: async () => { throw Error('offline') } })).motivo, 'rede')
  assert.deepEqual([...parseHostnames(' A.example.test, ,b.example.test ')], ['a.example.test', 'b.example.test'])
  // Segredo não configurado no ambiente → callable recusa.
  await assert.rejects(requireTurnstile({ data: { turnstileToken: 'tok' } }, 'login'), { code: 'failed-precondition' })
})
