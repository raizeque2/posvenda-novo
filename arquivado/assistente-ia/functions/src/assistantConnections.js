import { randomBytes } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { requireAssistantAdmin, askAssistant } from './assistant.js'
import { listPreviewGeminiModels, GeminiError } from './gemini.js'
import { sealCredential, openCredential, validCredentialName } from './cloudCredentialCrypto.js'

const masterKey = defineSecret('ASSISTANT_VAULT_KEY')
const options = { region: 'southamerica-east1', cors: ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/], timeoutSeconds: 120, memory: '512MiB', maxInstances: 3, concurrency: 1, secrets: [masterKey] }
const idPattern = /^[a-f0-9]{32}$/
const conflict = () => new HttpsError('failed-precondition', 'Há uma operação em andamento. Aguarde e tente novamente.')
const decodeEntries = (state, master, owner) => (state.entries || []).map(entry => ({ ...entry, credential: openCredential(master, owner, entry.id, entry.payload) }))
function status(state, master, owner) {
  const entries = decodeEntries(state, master, owner), active = entries.find(entry => entry.id === state.activeKeyId)
  return { available: true, environment: 'firebase', savingSupported: true, connected: !!active, models: active?.models || [], activeKeyId: active?.id || null, savedKeys: entries.map(entry => ({ id: entry.id, name: entry.credential.name })) }
}
async function acquire(ref, token, connecting = false) {
  await getFirestore().runTransaction(async transaction => {
    const state = (await transaction.get(ref)).data() || {}, now = Date.now()
    if ((state.busyUntil || 0) > now) throw conflict()
    const connects = (state.connects || []).filter(time => time > now - 60000)
    if (connecting && connects.length >= 5) throw new HttpsError('resource-exhausted', 'Aguarde um minuto antes de conectar novamente.')
    transaction.set(ref, { ...state, busyToken: token, busyUntil: now + 145000, ...(connecting ? { connects: [...connects, now] } : {}) })
  })
}
async function release(ref, token) {
  await getFirestore().runTransaction(async transaction => {
    const state = (await transaction.get(ref)).data() || {}
    if (state.busyToken === token) transaction.set(ref, { ...state, busyToken: '', busyUntil: 0 })
  })
}
function publicError(error) {
  if (error instanceof HttpsError) return error
  if (error instanceof GeminiError) return new HttpsError(error.status === 429 ? 'resource-exhausted' : 'failed-precondition', error.message, { errorCode: error.code, retryAfterSeconds: error.retryAfterSeconds })
  return new HttpsError('failed-precondition', 'Não foi possível gerenciar a conexão. Confira o nome, a chave e a configuração do cofre.')
}

export const assistantConnections = onCall(options, async request => {
  await requireAssistantAdmin(request)
  const owner = request.auth.uid, master = masterKey.value(), ref = getFirestore().doc(`assistantConnections/${owner}`), data = request.data || {}, action = data.action || 'status'
  if (!['status', 'connect', 'disconnect', 'rename', 'delete'].includes(action)) throw new HttpsError('invalid-argument', 'Operação inválida.')
  const token = randomBytes(16).toString('hex')
  let locked = false
  try {
    if (action === 'status') return status((await ref.get()).data() || {}, master, owner)
    if (action === 'connect' && data.consent !== true) throw new HttpsError('invalid-argument', 'Autorize a conexão antes de usar a chave.')
    await acquire(ref, token, action === 'connect'); locked = true
    const state = (await ref.get()).data() || {}, entries = decodeEntries(state, master, owner)
    let nextEntries = state.entries || [], activeKeyId = state.activeKeyId || null
    if (action === 'connect') {
      let entry, name, key
      if (data.savedKeyId !== undefined) {
        if (!idPattern.test(data.savedKeyId)) throw new HttpsError('not-found', 'Chave não encontrada na sua conta.')
        entry = entries.find(value => value.id === data.savedKeyId)
        if (!entry) throw new HttpsError('not-found', 'Chave não encontrada na sua conta.')
        ;({ name, key } = entry.credential)
      } else {
        if (data.save !== true) throw new HttpsError('invalid-argument', 'Confirme Salvar e usar para cadastrar a conexão.')
        name = validCredentialName(data.name); key = data.key
        if (typeof key !== 'string' || key.length < 20 || key.length > 256 || /\s/.test(key)) throw new HttpsError('invalid-argument', 'Informe uma chave válida do AI Studio.')
        if (entries.length >= 20 || entries.some(value => value.credential.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new HttpsError('invalid-argument', 'Use um nome único. Limite de 20 chaves por conta.')
      }
      const models = await listPreviewGeminiModels(key), id = entry?.id || randomBytes(16).toString('hex')
      const next = { id, payload: entry?.payload || sealCredential(master, owner, id, { name, key }), models }
      nextEntries = [...nextEntries.filter(value => value.id !== id), next]; activeKeyId = id
    } else if (action === 'disconnect') activeKeyId = null
    else {
      if (!idPattern.test(data.id || '')) throw new HttpsError('not-found', 'Chave não encontrada na sua conta.')
      const entry = entries.find(value => value.id === data.id)
      if (!entry) throw new HttpsError('not-found', 'Chave não encontrada na sua conta.')
      if (action === 'delete') { nextEntries = nextEntries.filter(value => value.id !== entry.id); if (activeKeyId === entry.id) activeKeyId = null }
      else {
        const name = validCredentialName(data.name)
        if (entries.some(value => value.id !== entry.id && value.credential.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new HttpsError('invalid-argument', 'Esse nome já está em uso.')
        nextEntries = nextEntries.map(value => value.id === entry.id ? { ...value, payload: sealCredential(master, owner, value.id, { ...entry.credential, name }) } : value)
      }
    }
    await getFirestore().runTransaction(async transaction => {
      const current = (await transaction.get(ref)).data() || {}
      if (current.busyToken !== token) throw conflict()
      transaction.set(ref, { ...current, entries: nextEntries, activeKeyId })
    })
    return status({ ...state, entries: nextEntries, activeKeyId }, master, owner)
  } catch (error) { throw publicError(error) }
  finally { if (locked) await release(ref, token) }
})

export const assistantPersonalGemini = onCall(options, async request => {
  await requireAssistantAdmin(request)
  const owner = request.auth.uid, master = masterKey.value(), ref = getFirestore().doc(`assistantConnections/${owner}`), token = randomBytes(16).toString('hex')
  await acquire(ref, token)
  try {
    const state = (await ref.get()).data() || {}, entries = decodeEntries(state, master, owner), entry = entries.find(value => value.id === state.activeKeyId)
    if (!entry || request.data?.keyId !== entry.id) throw new HttpsError('failed-precondition', 'A conexão ativa mudou. Abra Conexões e selecione sua chave novamente.', { errorCode: 'session-expired' })
    return await askAssistant(request, 'gemini', entry.credential.key, { geminiEnabled: true, geminiModels: entry.models })
  } catch (error) { throw publicError(error) }
  finally { await release(ref, token) }
})
