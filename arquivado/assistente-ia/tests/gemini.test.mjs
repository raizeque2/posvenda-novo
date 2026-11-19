import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { askGemini, listPreviewGeminiModels } from '../functions/src/gemini.js'
import { selectAssistantModel } from '../functions/src/assistantModels.js'
import { createGeminiPreviewMiddleware } from '../scripts/gemini-preview.mjs'
import { previewGeminiContext } from '../src/assistant/gemini-preview.js'
import { createCredentialVault } from '../scripts/credential-vault.mjs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const key = 'key-for-local-unit-test-only', reply = { candidates: [{ content: { parts: [{ thought: true, text: 'private reasoning' }, { text: 'Resumo de teste' }] } }] }
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
test('Gemini mantém a chave no cabeçalho, respeita esforço e exclui pensamentos', async () => {
  let request
  assert.deepEqual(await askGemini(key, { model: 'gemini-3.8-flash', thinking: 'low' }, 'Resumo?', { month: '10/2026' }, async (url, init) => { request = { url, ...init }; return response(reply) }), { text: 'Resumo de teste' })
  assert.ok(!request.url.includes(key)); assert.equal(request.headers['x-goog-api-key'], key)
  assert.equal(JSON.parse(request.body).generationConfig.thinkingConfig.thinkingLevel, 'LOW')
  await assert.rejects(askGemini(key, { model: 'gemini-2.5-flash', thinking: 'high' }, '', {}), /incompatível/)
  await assert.rejects(askGemini(key, { model: '../../other' }, '', {}), /inválido/)
  await assert.rejects(askGemini(key, { model: 'gemini-3.8-flash' }, '', {}, async () => response({})), /não retornou texto/)
})
test('Lista local só inclui modelos de texto com cota gratuita; erros não vazam chave', async () => {
  const models = await listPreviewGeminiModels(key, async () => response({ models: [{ name: 'models/gemini-3.8-flash', displayName: 'Flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-paid-pro', supportedGenerationMethods: ['generateContent'] }] }))
  assert.equal(models.length, 1); assert.equal(models[0].id, 'gemini-3.8-flash')
  assert.deepEqual(selectAssistantModel({ geminiEnabled: true, geminiModels: models }, 'gemini', { thinking: 'high' }), { model: 'gemini-3.8-flash', thinking: 'high' })
  assert.throws(() => selectAssistantModel({ geminiEnabled: true, geminiModels: models }, 'gemini', { thinking: 'max' }))
  await assert.rejects(listPreviewGeminiModels(key, async () => new Response(key, { status: 403 })), error => !error.message.includes(key) && error.status === 401)
})
test('Resumo Gemini preserva MO separada e devoluções, sem enviar registros ou emails', () => {
  const context = previewGeminiContext({ month: '10/2026', cutoff: null, revenue: 10, people: 1, ranking: [{ nome: 'Pessoa de QA', tp: 12, pocoficina: 5, devPocoficina: 2, morealCons: 8, morealTec: 8, email: 'private@example.com' }], attention: [{ name: 'Pessoa de QA', metric: 'Peças', real: 12, target: 20, projection: 17 }], rawRecords: ['private'] })
  assert.equal(context.people[0].partsOS, 3); assert.equal(context.people[0].serviceAdvisor, 8)
  assert.equal(context.attention[0].realized, 12); assert.ok(!JSON.stringify(context).includes('private'))
})
test('Ponte local exige origem, sessão e consentimento; limita rajadas, informa espera e expira a chave', async t => {
  let time = 0, payload, apiCalls = 0, providerStatus = 200
  const middleware = createGeminiPreviewMiddleware({ now: () => time, fetcher: async (url, init) => {
    apiCalls++
    if (url.endsWith('models?pageSize=100')) return response({ models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }] })
    payload = JSON.parse(init.body); return providerStatus === 200 ? response(reply) : new Response('{}', { status: providerStatus })
  } })
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end() }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close())
  const origin = `http://127.0.0.1:${server.address().port}`; let cookie = ''
  const call = (action, data = {}, from = origin) => fetch(`${origin}/__assistant/gemini/${action}`, { method: 'POST', headers: { Origin: from, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(data) })
  assert.equal((await call('connect', { key, consent: true }, 'https://evil.example')).status, 403); assert.equal(apiCalls, 0)
  assert.equal((await call('connect', { key, consent: false })).status, 400); assert.equal(apiCalls, 0)
  assert.equal((await call('connect', { key: 'x'.repeat(100001), consent: true })).status, 413); assert.equal(apiCalls, 0)
  assert.equal((await call('ask')).status, 401)
  const connect = await call('connect', { key, consent: true }); assert.equal(connect.status, 200)
  cookie = connect.headers.get('set-cookie').split(';')[0]; assert.match(connect.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  assert.ok(!(await connect.text()).includes(key))
  const question = { question: 'Gráficos de vendas desse mês', consent: true, model: 'gemini-3.8-flash', context: { source: 'preview', month: '10/2026', email: 'private@example.com', people: [{ name: 'QA', parts: 10, token: key }], sales: { total: 10, daily: [{ name: '2026-10-01', value: 10, records: 1, token: key }], channels: [{ name: 'VAREJO', value: 10, records: 1 }], people: [{ name: 'QA', value: 10, records: 1 }], scope: 'QA', through: '2026-10-01', token: key }, visualizations: [{ type: 'script', code: 'private@example.com' }] } }
  assert.equal((await call('ask', { ...question, consent: false })).status, 400)
  assert.equal((await call('ask', { ...question, model: 'gemini-paid-pro' })).status, 400)
  const answer = await call('ask', question); assert.equal(answer.status, 200)
  const charts = (await answer.json()).charts
  assert.equal(charts.length, 2); assert.equal(charts[0].data[0].value, 10)
  const sentContext = JSON.parse(payload.contents[0].parts[0].text).context
  assert.equal(sentContext.visualizations[0].dimension, 'date'); assert.equal(sentContext.sales.total, 10)
  assert.ok(!JSON.stringify(payload).includes('private@example.com')); assert.ok(!JSON.stringify(payload).includes(key))
  // Normal conversation must continue beyond the previous three-request ceiling.
  for (let index = 0; index < 9; index++) assert.equal((await call('ask', question)).status, 200)
  const callsBeforeBlock = apiCalls, blocked = await call('ask', question)
  assert.equal(blocked.status, 429); assert.equal(blocked.headers.get('retry-after'), '60')
  assert.equal((await blocked.json()).retryAfterSeconds, 60); assert.equal(apiCalls, callsBeforeBlock)
  const switched = await call('connect', { key, consent: true })
  assert.equal(switched.status, 200); assert.equal((await call('ask', question)).status, 429)
  time = 15000
  const waiting = await call('ask', question)
  assert.equal(waiting.headers.get('retry-after'), '45'); assert.match((await waiting.json()).error, /45 segundos/)
  // Forty previous questions must not permanently block an otherwise valid session.
  for (let index = 0; index < 45; index++) { time = 60000 + index * 60001; assert.equal((await call('ask', question)).status, 200) }
  providerStatus = 429
  const quota = await call('ask', question)
  assert.equal(quota.status, 429); assert.match((await quota.json()).error, /cota do Gemini/)
  assert.equal(quota.headers.get('retry-after'), null)
  providerStatus = 200
  assert.equal((await call('ask', question)).status, 200)
  time = 3600001; assert.equal((await call('ask', question)).status, 401); assert.equal((await (await call('status')).json()).connected, false)
  const reconnect = await call('connect', { key, consent: true }); cookie = reconnect.headers.get('set-cookie').split(';')[0]
  assert.equal((await (await call('status')).json()).connected, true)
  await call('disconnect'); assert.equal((await (await call('status')).json()).connected, false)
})

test('chaves nomeadas persistem, ficam isoladas e a consulta usa a chave selecionada', { skip: process.platform !== 'win32' }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'posvenda-keys-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  let sentKey, blockReply, notifyReply
  const options = { vault: createCredentialVault({ directory }), fetcher: async (url, init) => {
    if (url.endsWith('models?pageSize=100')) return response({ models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }] })
    sentKey = init.headers['x-goog-api-key']; notifyReply?.(); if (blockReply) await blockReply; return response(reply)
  } }
  let middleware = createGeminiPreviewMiddleware(options)
  const server = createServer((req, res) => middleware(req, res, () => res.end()))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close())
  const origin = `http://127.0.0.1:${server.address().port}`; let cookie = ''
  const call = async (action, data = {}, credentials = cookie) => {
    const result = await fetch(`${origin}/__assistant/gemini/${action}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: credentials }, body: JSON.stringify(data) })
    const body = await result.json(); assert.ok(!JSON.stringify(body).includes(key)); return { status: result.status, body, cookie: result.headers.get('set-cookie')?.split(';')[0] }
  }
  const first = await call('connect', { key, name: 'Pessoal', save: true, consent: true })
  assert.equal(first.status, 200); cookie = first.cookie
  const firstId = first.body.activeKeyId
  const secondKey = `${key}-two`, second = await call('connect', { key: secondKey, name: 'Trabalho', save: true, consent: true })
  const secondId = second.body.activeKeyId
  assert.equal(second.body.savedKeys.length, 2); assert.equal(second.cookie, cookie)
  assert.deepEqual((await call('status', {}, '')).body.savedKeys, [])
  assert.equal((await call('connect', { savedKeyId: firstId, consent: true }, '')).status, 404)
  assert.equal((await call('rename', { id: firstId, name: 'Roubar' }, '')).status, 404)
  assert.equal((await call('delete', { id: firstId }, '')).status, 404)
  middleware = createGeminiPreviewMiddleware({ ...options, vault: createCredentialVault({ directory }) })
  const restarted = await call('status'); assert.equal(restarted.body.connected, false); assert.equal(restarted.body.savedKeys.length, 2)
  assert.equal((await call('connect', { savedKeyId: firstId, consent: false })).status, 400)
  const question = { question: 'Resumo', consent: true, model: 'gemini-3.8-flash', context: { source: 'preview', month: '10/2026' } }
  await call('connect', { savedKeyId: firstId, consent: true }); assert.equal((await call('ask', question)).status, 200); assert.equal(sentKey, key)
  assert.equal((await call('ask', { ...question, keyId: secondId })).status, 409)
  await call('connect', { savedKeyId: secondId, consent: true }); assert.equal((await call('ask', question)).status, 200); assert.equal(sentKey, secondKey)
  let releaseReply; blockReply = new Promise(resolve => { releaseReply = resolve }); t.after(releaseReply)
  const reachedProvider = new Promise(resolve => { notifyReply = resolve }), pending = call('ask', question)
  await reachedProvider
  assert.equal((await call('delete', { id: secondId })).status, 409)
  releaseReply(); assert.equal((await pending).status, 200); blockReply = null
  assert.equal((await call('rename', { id: firstId, name: 'Casa' })).body.savedKeys[0].name, 'Casa')
  assert.equal((await call('rename', { id: firstId, name: 'Trabalho' })).status, 400)
  await call('delete', { id: firstId }); assert.equal((await call('status')).body.connected, true)
  await call('disconnect'); const disconnected = (await call('status')).body
  assert.equal(disconnected.connected, false); assert.equal(disconnected.savedKeys.length, 1)
  await call('connect', { savedKeyId: secondId, consent: true })
  const deleted = await call('delete', { id: secondId }); assert.equal(deleted.body.connected, false); assert.deepEqual(deleted.body.savedKeys, [])
})
