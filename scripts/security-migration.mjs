// Dry-run by default. Never prints passwords, credentials, links or tokens.
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
const apply = process.argv.includes('--apply')
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw Error('Confira o projeto e use ADC sem variáveis de emulador.')
initializeApp({ credential: applicationDefault(), projectId: 'posvenda-bi', storageBucket: 'posvenda-bi.firebasestorage.app' })
let passwords = 0, bearerTokens = 0
for (const doc of (await getFirestore().collection('solicitacoes').get()).docs) {
  if (!Object.hasOwn(doc.data(), 'senha')) continue
  passwords++
  if (apply) await doc.ref.update({ senha: FieldValue.delete() })
}
const bucket = getStorage().bucket()
for (const prefix of ['Dados/', 'dados/', 'obsoleto/']) {
  const [files] = await bucket.getFiles({ prefix })
  for (const file of files) {
    const [metadata] = await file.getMetadata()
    if (!metadata.metadata?.firebaseStorageDownloadTokens) continue
    bearerTokens++
    if (apply) await file.setMetadata({ metadata: { ...metadata.metadata, firebaseStorageDownloadTokens: null } })
  }
}
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', passwords, bearerTokens }))
if (!apply) console.log('Nenhum dado alterado. Revise backups e execute --apply somente após publicar o cliente com getBytes.')
