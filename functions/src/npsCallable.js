import { getFirestore } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { isActiveProfile } from './securityPolicy.js'
import { publicRateLimit } from './publicRateLimit.js'
import { podeAcessar } from './tabPolicy.js'
import { ErroNps, idValido, paraCsv, paraPainel, prepararAvaliacao, prepararComentario, situacaoComentario } from './nps.js'

const CORS = ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]
const OPCOES = { region: 'southamerica-east1', cors: CORS, maxInstances: 5, concurrency: 16, timeoutSeconds: 30 }
const LIMITE_PAINEL = 5000

const comoHttps = (error, contexto) => {
  if (error instanceof ErroNps) return new HttpsError(error.code, error.message)
  if (error instanceof HttpsError) return error
  console.error(contexto, error)
  return new HttpsError('internal', 'Não foi possível concluir agora. Tente de novo.')
}

// Público (totem e celular do cliente, sem login). A coleção nps/ é fechada nas
// regras: só esta função grava. Limite por IP (hash) contra envio em massa.
export const npsPesquisa = onCall(OPCOES, async request => {
  const { acao, avaliacao, id, comentario } = request.data || {}
  const db = getFirestore()
  try {
    if (acao === 'avaliar') {
      await publicRateLimit(request, 'nps-avaliar', 40, 10 * 60000)
      const doc = prepararAvaliacao(avaliacao)
      const ref = db.doc(`nps/${doc.id}`)
      // Reenvio do mesmo id (rede caiu depois de gravar) devolve sucesso sem duplicar.
      await db.runTransaction(async tx => { if (!(await tx.get(ref)).exists) tx.set(ref, doc) })
      return { id: doc.id }
    }
    if (acao === 'comentario' || acao === 'comentar') {
      await publicRateLimit(request, 'nps-comentario', 30, 10 * 60000)
      if (!idValido(id)) throw new ErroNps('not-found', 'Avaliação não encontrada.')
      const ref = db.doc(`nps/${id}`)
      return await db.runTransaction(async tx => {
        const snap = await tx.get(ref)
        if (!snap.exists) throw new ErroNps('not-found', 'Avaliação não encontrada.')
        if (acao === 'comentario') return { situacao: situacaoComentario(snap.data()) }
        tx.set(ref, prepararComentario(snap.data(), comentario))
        return { situacao: 'comentado' }
      })
    }
    throw new ErroNps('invalid-argument', 'Ação inválida.')
  } catch (error) { throw comoHttps(error, 'npsPesquisa') }
})

// Painel: quem tem a aba NPS (política de abas). CPF completo só na planilha do administrador.
export const npsPainel = onCall(OPCOES, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre no sistema.')
  const db = getFirestore()
  const profile = (await db.doc(`usuarios/${request.auth.uid}`).get()).data()
  if (!isActiveProfile(profile)) throw new HttpsError('permission-denied', 'Acesso indisponível.')
  const cfg = (await db.doc('config/permissoes').get()).data()
  const permissoes = typeof cfg?.payload === 'string' ? JSON.parse(cfg.payload) : cfg
  if (!podeAcessar(profile.role, '/nps', permissoes, profile.setor)) throw new HttpsError('permission-denied', 'Módulo não autorizado para este perfil.')
  try {
    const snap = await db.collection('nps').orderBy('criadoEm', 'desc').limit(LIMITE_PAINEL).get()
    const docs = snap.docs.map(d => d.data())
    const acao = request.data?.acao
    if (acao === 'ler') return { avaliacoes: docs.map(paraPainel), limite: docs.length >= LIMITE_PAINEL }
    if (acao === 'exportar') return { csv: paraCsv(docs, { comCpf: profile.role === 'admin' }) }
    throw new ErroNps('invalid-argument', 'Ação inválida.')
  } catch (error) { throw comoHttps(error, 'npsPainel') }
})
