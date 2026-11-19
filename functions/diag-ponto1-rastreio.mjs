/**
 * diag-ponto1-rastreio.mjs — SOMENTE LEITURA.
 *
 * config/estoqueControle não existe, mas o usuário fez um upload real agora.
 * Rastreia por ONDE esse upload realmente passou: esquema novo
 * (Dados/Estoque/atual|fechamentos/) ou esquema antigo (Dados/Estoque/{data}.json,
 * legado, ainda presente no código mas não deveria mais ser chamado).
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))
const BUCKET = 'posvenda-bi.firebasestorage.app'

if (!getApps().length) initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET })
const db = getFirestore()
const bucket = getStorage().bucket(BUCKET)

async function listar(prefixo) {
  const [files] = await bucket.getFiles({ prefix: prefixo })
  return files.map(f => ({ name: f.name, updated: new Date(f.metadata.updated), size: f.metadata.size }))
    .sort((a, b) => b.updated - a.updated)
}

async function main() {
  console.log(`\n${'═'.repeat(74)}`)
  console.log(`  RASTREIO — por onde o upload real passou`)
  console.log(`${'═'.repeat(74)}`)

  console.log(`\n  Agora: ${new Date().toISOString()}  (${new Date().toLocaleString('pt-BR')})`)

  console.log(`\n[A] Dados/Estoque/atual/ (esquema NOVO — janela rolante)`)
  const atual = await listar('Dados/Estoque/atual/')
  if (!atual.length) console.log('    VAZIO — nenhum arquivo aqui.')
  for (const f of atual) console.log(`    ${f.name}  updated=${f.updated.toLocaleString('pt-BR')}  ${f.size} bytes`)

  console.log(`\n[B] Dados/Estoque/fechamentos/ (esquema NOVO — congelados)`)
  const fech = await listar('Dados/Estoque/fechamentos/')
  if (!fech.length) console.log('    VAZIO — nenhum arquivo aqui.')
  for (const f of fech) console.log(`    ${f.name}  updated=${f.updated.toLocaleString('pt-BR')}  ${f.size} bytes`)

  console.log(`\n[C] Dados/Estoque/ direto (esquema ANTIGO — legado) — 10 mais recentes por modificação real`)
  const [allFiles] = await bucket.getFiles({ prefix: 'Dados/Estoque/' })
  const legado = allFiles
    .filter(f => !f.name.includes('/atual/') && !f.name.includes('/fechamentos/') && !f.name.includes('/fechamentos_historico/'))
    .map(f => ({ name: f.name, updated: new Date(f.metadata.updated), size: f.metadata.size }))
    .sort((a, b) => b.updated - a.updated)
  for (const f of legado.slice(0, 10)) console.log(`    ${f.name}  updated=${f.updated.toLocaleString('pt-BR')}  ${f.size} bytes`)

  console.log(`\n[D] config/estoqueControle`)
  const snap = await db.collection('config').doc('estoqueControle').get()
  console.log(`    Existe? ${snap.exists ? 'SIM' : 'NÃO'}`)
  if (snap.exists) console.log(`    ${JSON.stringify(snap.data())}`)

  console.log(`\n[E] Se o arquivo mais recente do esquema ANTIGO for muito recente (poucos minutos/`)
  console.log(`    horas atrás), o upload real caiu no código velho, não no novo.`)
  if (legado.length) {
    const maisRecente = legado[0]
    const diffMin = (Date.now() - maisRecente.updated.getTime()) / 60000
    console.log(`    Arquivo legado mais recente: ${maisRecente.name}`)
    console.log(`    Modificado há ${diffMin.toFixed(1)} minutos`)
    if (maisRecente.name.includes('2026-08')) {
      console.log(`    ⚠ Nome contém "2026-08" — é candidato a ser o upload real de hoje, no esquema ANTIGO.`)
    }
  }

  console.log(`\n${'═'.repeat(74)}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
