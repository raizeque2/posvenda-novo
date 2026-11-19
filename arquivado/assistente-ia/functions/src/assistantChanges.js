import { getFirestore } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { executeReviewedChange } from './assistantChangeService.js'
const options = { region: 'southamerica-east1', cors: ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/], maxInstances: 3, concurrency: 4, timeoutSeconds: 30 }
export const assistantChanges = onCall(options, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre no sistema.')
  if (!request.data || JSON.stringify(request.data).length > 8000) throw new HttpsError('invalid-argument', 'Solicitação inválida ou muito grande.')
  const db = getFirestore()
  try {
    return await db.runTransaction(transaction => executeReviewedChange(request.auth.uid, request.data, {
      get: async path => (await transaction.get(db.doc(path))).data(),
      set: (path, value) => transaction.set(db.doc(path), value),
    }))
  } catch (error) {
    const expected = ['unauthenticated', 'permission-denied', 'invalid-argument', 'failed-precondition']
    throw new HttpsError(expected.includes(error.code) ? error.code : 'internal', expected.includes(error.code) ? error.message : 'Não foi possível salvar. Confira o resultado da proposta antes de tentar novamente.')
  }
})
