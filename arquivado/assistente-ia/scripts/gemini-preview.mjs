import { createHash, randomBytes } from 'node:crypto'
import { createCredentialVault } from './credential-vault.mjs'
import { askGemini, GeminiError, listPreviewGeminiModels } from '../functions/src/gemini.js'
import { selectAssistantModel } from '../functions/src/assistantModels.js'
import { validateQuestion } from '../functions/src/assistantPolicy.js'
import { cleanHistory, cleanAnalysisQuery } from '../functions/src/assistantAnalysis.js'

const prefix = '/__assistant/gemini/', cookieName = 'pv_gemini', ttl = 3600000
const maxCallsPerMinute = 10
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
function validOrigin(req) {
  if (!loopback.has(req.socket.remoteAddress)) return false
  try { const origin = new URL(req.headers.origin); return origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && origin.host === req.headers.host }
  catch { return false }
}
async function readBody(req) {
  if (Number(req.headers['content-length']) > 100000) { req.resume(); throw new GeminiError('Solicitação muito grande.', 413) }
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > 100000) throw new GeminiError('Solicitação muito grande.', 413); chunks.push(chunk) }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new GeminiError('Solicitação inválida.', 400) }
}
function cleanContext(value) {
  if (value?.source !== 'preview' || !value.query && !/^\d{2}\/\d{4}$/.test(value.month)) throw new GeminiError('Resumo da prévia inválido.', 400)
  const text = v => String(v || '').slice(0, 120), number = v => Number.isFinite(v) ? v : 0
  const rows = (items, fields, limit = 300) => (Array.isArray(items) ? items : []).slice(0, limit).map(item => Object.fromEntries(fields.map(field => [field, ['name', 'metric'].includes(field) ? text(item?.[field]) : number(item?.[field])])))
  const sales = value.sales && { daily: rows(value.sales.daily, ['name', 'value', 'records'], 93).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.name)), channels: rows(value.sales.channels, ['name', 'value', 'records'], 40), people: rows(value.sales.people, ['name', 'value', 'records']), scope: text(value.sales.scope), through: /^\d{4}-\d{2}-\d{2}$/.test(value.sales.through) ? value.sales.through : null, undated: Math.max(0, number(value.sales.undated)), total: number(value.sales.total), periods: rows(value.sales.periods, ['name', 'value', 'records'], 3) }
  if (value.query) {
    const query = cleanAnalysisQuery(value.query), provenance = value.provenance || {}
    return { source: 'preview', month: query.months.join(' × '), query, sales, people: rows(value.people, ['name', 'revenue']), goals: (Array.isArray(value.goals) ? value.goals : []).slice(0, 300).map(goal => ({ name: text(goal.name), month: text(goal.month), channel: text(goal.channel), metric: text(goal.metric), target: number(goal.target) })), note: 'Dados fictícios agregados da prévia. Use apenas fatos do contexto atual. Mão de obra contada uma vez.', provenance: { generatedAt: text(provenance.generatedAt), periods: query.months, scope: sales?.scope, lastRecordDate: sales?.through, total: sales?.total || 0, sources: (Array.isArray(provenance.sources) ? provenance.sources : []).slice(0, 6).map(item => ({ month: text(item.month), kind: text(item.kind), updatedAt: text(item.updatedAt), records: number(item.records) })), warnings: (Array.isArray(provenance.warnings) ? provenance.warnings : []).slice(0, 8).map(text) } }
  }
  return { source: 'preview', month: value.month, lastRecordDate: text(value.lastRecordDate), latestRevenue: number(value.latestRevenue), peopleWithMovement: number(value.peopleWithMovement), ...(sales ? { sales } : {}), people: rows(value.people, ['name', 'parts', 'partsOS', 'serviceAdvisor', 'serviceTechnician', 'targetParts', 'targetPartsOS', 'targetService']), attention: rows(value.attention, ['name', 'metric', 'realized', 'projection', 'target']), note: 'Dados da prévia fornecidos pelo usuário; não garantem atualização até hoje. Não há estoque nem meio da venda. MO atribuída separadamente a consultores e técnicos: nunca somar as duas para receita da empresa.' }
}

export function createGeminiPreviewMiddleware({ fetcher = fetch, now = Date.now, vault = createCredentialVault() } = {}) {
  const sessions = new Map(), connects = [], working = new Set()
  function drop(id) { const session = sessions.get(id); if (session) { clearTimeout(session.expiration); session.key = ''; sessions.delete(id) } }
  async function saved(method, ...args) { try { return await vault[method](...args) } catch (error) { throw new GeminiError(error.message, 400) } }
  return async (req, res, next) => {
    if (!req.url?.startsWith(prefix)) return next()
    const respond = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.end(JSON.stringify(data)) }
    if (!validOrigin(req) || req.method !== 'POST' || !req.headers['content-type']?.startsWith('application/json')) return respond(403, { error: 'Conexão permitida apenas na prévia local e na mesma origem.' })
    let locked
    try {
      const time = now()
      for (const [id, session] of sessions) if (session.expires <= time) drop(id)
      const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
      const token = /^[a-f0-9]{64}$/.test(cookie || '') ? cookie : null
      // Cookies are host-scoped; include the port to isolate different local apps.
      const ownerFor = value => createHash('sha256').update(`${req.headers.host}:${value}`).digest('hex')
      const owner = token && ownerFor(token), session = sessions.get(owner)
      const action = req.url.slice(prefix.length), data = await readBody(req)
      const state = async current => ({ available: true, savingSupported: process.platform === 'win32', connected: !!current, models: current?.models || [], activeKeyId: current?.keyId || null, savedKeys: owner ? await saved('list', owner) : [] })
      if (action === 'status') return respond(200, await state(session))
      if (working.has(owner)) throw new GeminiError('Aguarde a operação atual antes de enviar outra consulta ou trocar a chave.', 409)
      if (owner) { working.add(owner); locked = owner }
      if (action === 'disconnect') { drop(owner); return respond(200, await state(null)) }
      if (action === 'rename' || action === 'delete') {
        if (!owner || typeof data.id !== 'string' || !/^[a-f0-9]{32}$/.test(data.id)) throw new GeminiError('Chave salva não encontrada neste navegador.', 404)
        if (action === 'rename') await saved('rename', owner, data.id, data.name)
        else { await saved('remove', owner, data.id); if (session?.keyId === data.id) drop(owner) }
        return respond(200, await state(sessions.get(owner)))
      }
      if (action === 'connect') {
        while (connects[0] <= time - 60000) connects.shift()
        if (connects.length >= 5) throw new GeminiError('Aguarde um minuto antes de tentar conectar novamente.', 429)
        connects.push(time)
        if (data.consent !== true) throw new GeminiError('Autorize a conexão para usar a chave.', 400)
        if (data.save === true && (process.platform !== 'win32' || typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 60 || /[\x00-\x1f\x7f]/.test(data.name))) throw new GeminiError('Informe um nome de até 60 caracteres. Salvar chaves exige Windows.', 400)
        const fromSaved = typeof data.savedKeyId === 'string'
        if (fromSaved && (!owner || !/^[a-f0-9]{32}$/.test(data.savedKeyId))) throw new GeminiError('Chave salva não encontrada neste navegador.', 404)
        const key = fromSaved ? await saved('get', owner, data.savedKeyId) : data.key?.trim()
        if (typeof key !== 'string' || key.length < 20 || key.length > 256 || /\s/.test(key)) throw new GeminiError('Informe a chave do AI Studio e autorize a conexão.', 400)
        if (sessions.size >= 16 && !session) throw new GeminiError('Há muitas sessões locais. Reinicie a prévia.', 429)
        const models = await listPreviewGeminiModels(key, fetcher), id = token || randomBytes(32).toString('hex'), nextOwner = ownerFor(id)
        const keyId = fromSaved ? data.savedKeyId : data.save === true ? (await saved('add', nextOwner, data.name, key)).id : null
        // Retain usage counters when switching keys; key selection cannot bypass limits.
        const current = { key, keyId, models, expires: time + ttl, calls: session?.calls || [], working: false, expiration: setTimeout(() => drop(nextOwner), ttl).unref() }
        drop(owner); sessions.set(nextOwner, current)
        res.setHeader('Set-Cookie', `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=${prefix}; Max-Age=31536000`)
        return respond(200, { available: true, savingSupported: process.platform === 'win32', connected: true, models, activeKeyId: keyId, savedKeys: await saved('list', nextOwner) })
      }
      if (action !== 'ask') throw new GeminiError('Operação inválida.', 404)
      if (!session) throw new GeminiError('A sessão do Gemini expirou. Conecte a chave novamente.', 401, 'session-expired')
      if (data.keyId !== undefined && data.keyId !== session.keyId) throw new GeminiError('A chave ativa mudou em outra aba. Abra Conexões e selecione a chave novamente.', 409)
      const question = validateQuestion(data), selected = selectAssistantModel({ geminiEnabled: true, geminiModels: session.models }, 'gemini', data), context = cleanContext(data.context)
      // Burst protection for the loopback bridge; the provider controls the key's quota.
      session.calls = session.calls.filter(at => at > time - 60000)
      if (session.working) throw new GeminiError('Já há uma consulta em andamento. Aguarde a resposta.', 409)
      if (session.calls.length >= maxCallsPerMinute) {
        const seconds = Math.max(1, Math.ceil((session.calls[0] + 60000 - time) / 1000))
        const error = new GeminiError(`Você enviou ${maxCallsPerMinute} consultas em um minuto. Aguarde ${seconds} segundos antes de tentar novamente.`, 429, 'local-rate-limit')
        error.retryAfterSeconds = seconds
        throw error
      }
      session.calls.push(time); session.working = true
      try { return respond(200, await askGemini(session.key, selected, question, context, fetcher, cleanHistory(data.history))) } finally { session.working = false }
    } catch (error) {
      if (error instanceof GeminiError && error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds))
      respond(error instanceof GeminiError ? error.status : 400, { error: error instanceof GeminiError ? error.message : 'Confira a pergunta, o modelo, o esforço e a autorização de envio.', errorCode: error instanceof GeminiError ? error.code : 'invalid-request', ...(error instanceof GeminiError && error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}) })
    }
    finally { if (locked) working.delete(locked) }
  }
}
export function geminiPreview() {
  return { name: 'gemini-local-preview', configureServer(server) { server.middlewares.use(createGeminiPreviewMiddleware()) } }
}
