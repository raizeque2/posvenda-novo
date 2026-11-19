import { getFirestore } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { sectorSnapshotData } from './sectorSnapshotPolicy.js'
import { publicRateLimit } from './publicRateLimit.js'

export const portalSnapshot = onCall({ region: 'southamerica-east1', cors: ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/], timeoutSeconds: 30, memory: '256MiB', maxInstances: 3, concurrency: 8 }, async request => {
  const state = String(request.data?.estado || '').toUpperCase(), type = String(request.data?.tipo || '').toLowerCase()
  if (!['AL', 'PE'].includes(state) || !['pecas', 'oficina'].includes(type) || !/^[a-f0-9]{64}$/.test(request.data?.token || '')) throw new HttpsError('permission-denied', 'Link indisponível.')
  await publicRateLimit(request, 'sector-link')
  const db = getFirestore(), [snap, config] = await Promise.all([db.doc(`snapshots/${state}-${type}`).get(), db.doc('config/snapshotConfig').get()])
  try { return sectorSnapshotData(snap.exists ? JSON.parse(snap.data().payload) : null, JSON.parse(config.data()?.payload || '{}'), request.data) }
  catch { throw new HttpsError('permission-denied', 'Este link está inválido, revogado ou expirado. Solicite um endereço atualizado ao responsável.') }
})
