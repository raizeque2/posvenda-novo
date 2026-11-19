import { getFirestore } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { isActiveProfile } from './securityPolicy.js'
import { executarGestaoEquipe, ErroEquipe } from './gestaoEquipe.js'

// Tudo numa transação: dois supervisores salvando metas ao mesmo tempo não apagam um ao outro
// (o Firestore repete a transação se o documento mudou no meio).
export const gestaoEquipe = onCall({ region: 'southamerica-east1', cors: ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/], maxInstances: 5, concurrency: 8, timeoutSeconds: 30, memory: '512MiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre no sistema.')
  const db = getFirestore()
  const profile = (await db.doc(`usuarios/${request.auth.uid}`).get()).data()
  if (!isActiveProfile(profile)) throw new HttpsError('permission-denied', 'Acesso indisponível.')
  try {
    return await db.runTransaction(async tx => {
      const store = {
        get: async path => { const snap = await tx.get(db.doc(path)); return snap.exists ? snap.data() : undefined },
        set: async (path, data) => { tx.set(db.doc(path), data) },
      }
      return executarGestaoEquipe(profile, request.data || {}, store)
    })
  } catch (error) {
    if (error instanceof ErroEquipe) throw new HttpsError(error.code, error.message)
    console.error('gestaoEquipe', error)
    throw new HttpsError('internal', 'Não foi possível salvar agora. Tente de novo.')
  }
})
