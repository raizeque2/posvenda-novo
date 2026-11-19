import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('../serviceAccountKey.json')

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'posvenda-bi.firebasestorage.app',
})

const db = getFirestore()
const bucket = getStorage().bucket()

async function listarMeses(pasta) {
  try {
    const [files] = await bucket.getFiles({ prefix: `Dados/${pasta}/` })
    return files
      .map(f => {
        const nome = f.name.replace(`Dados/${pasta}/`, '').replace('.json', '')
        // Suporta MM-YYYY e YYYY-MM
        if (/^\d{2}-\d{4}$/.test(nome)) {
          const [mm, yyyy] = nome.split('-')
          return `${yyyy}/${mm}`
        }
        if (/^\d{4}-\d{2}$/.test(nome)) {
          const [yyyy, mm] = nome.split('-')
          return `${yyyy}/${mm}`
        }
        return null
      })
      .filter(Boolean)
      .sort()
  } catch (e) {
    console.error(`Erro ao listar ${pasta}:`, e.message)
    return []
  }
}

async function main() {
  console.log('Buscando meses disponíveis no Storage...')
  const [pecas, oficina] = await Promise.all([
    listarMeses('Pecas'),
    listarMeses('Oficina'),
  ])

  console.log('Peças:', pecas)
  console.log('Oficina:', oficina)

  if (pecas.length === 0 && oficina.length === 0) {
    console.log('Nenhum mês encontrado. Verifique os arquivos no Storage.')
    process.exit(1)
  }

  await db.collection('config').doc('mesesDisponiveis').set({ pecas, oficina })
  console.log(`✅ mesesDisponiveis salvo no Firestore: ${pecas.length} peças, ${oficina.length} oficina`)
}

main().catch(e => { console.error(e); process.exit(1) })
