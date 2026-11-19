import { initializeApp, cert } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('../serviceAccountKey.json')

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'posvenda-bi.firebasestorage.app',
})

const bucket = getStorage().bucket()

async function main() {
  const [files] = await bucket.getFiles()
  console.log('Todos os arquivos no Storage:')
  files.forEach(f => console.log(' ', f.name))
}

main().catch(e => { console.error(e); process.exit(1) })
