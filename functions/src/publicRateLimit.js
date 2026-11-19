import { createHash } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

// Shared across Cloud Functions instances; raw IPs and possession tokens are not stored.
export async function publicRateLimit(request, namespace, maximum = 30, windowMs = 60000) {
  const now = Date.now(), identity = request.rawRequest?.ip || 'unknown'
  const id = createHash('sha256').update(`${namespace}:${identity}`).digest('hex')
  const ref = getFirestore().doc(`publicRequestLimits/${id}`)
  await getFirestore().runTransaction(async transaction => {
    const previous = (await transaction.get(ref)).data() || {}
    const fresh = now - (previous.start || 0) >= windowMs
    const start = fresh ? now : previous.start, count = fresh ? 0 : previous.count || 0
    if (count >= maximum) throw new HttpsError('resource-exhausted', 'Muitas tentativas. Aguarde e tente novamente.', { retryAfterSeconds: Math.max(1, Math.ceil((start + windowMs - now) / 1000)) })
    transaction.set(ref, { start, count: count + 1, expiresAt: new Date(now + 86400000) })
  })
}
