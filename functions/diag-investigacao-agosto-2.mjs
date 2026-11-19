/**
 * diag-investigacao-agosto-2.mjs — SOMENTE LEITURA.
 *
 * Confirma: como config/estoqueControle não existe, o mecanismo novo nunca
 * rodou. Investiga o esquema ANTIGO (Dados/Estoque/{data}.json) para achar
 * os arquivos reais de agosto e maio, com evidência de conteúdo.
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

function parseData(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d) || d.getFullYear() < 1990 ? null : d
}

async function main() {
  console.log(`\n${'═'.repeat(74)}`)
  console.log(`  Esquema ANTIGO — Dados/Estoque/ (é este que está em produção hoje)`)
  console.log(`${'═'.repeat(74)}`)

  const [files] = await bucket.getFiles({ prefix: 'Dados/Estoque/' })
  const nomes = files
    .map(f => ({ nome: f.name.replace('Dados/Estoque/', ''), updated: f.metadata.updated, size: f.metadata.size }))
    .filter(f => f.nome && !f.nome.includes('/')) // só os arquivos diretos, não subpastas atual/ fechamentos/
    .sort((a, b) => a.nome.localeCompare(b.nome))

  console.log(`\n[1] Todos os arquivos diretos em Dados/Estoque/ (${nomes.length}):`)
  for (const f of nomes) {
    console.log(`    ${f.nome.padEnd(30)}  updated=${new Date(f.updated).toLocaleString('pt-BR')}  ${f.size} bytes`)
  }

  const nomeMaisRecente = [...nomes].sort((a, b) => b.nome.localeCompare(a.nome))[0]
  console.log(`\n[2] O que o código ATUAL em produção escolhe como "mais recente" (maior nome):`)
  console.log(`    "${nomeMaisRecente?.nome}"`)

  // ── Inspeciona o arquivo de agosto, se existir ──────────────────────────────
  const arquivoAgosto = nomes.find(f => f.nome.startsWith('2026-08'))
  if (arquivoAgosto) {
    console.log(`\n[3] Conteúdo real de Dados/Estoque/${arquivoAgosto.nome}`)
    const [buf] = await bucket.file(`Dados/Estoque/${arquivoAgosto.nome}`).download()
    const data = JSON.parse(buf.toString('utf8'))
    console.log(`    dataISO gravado no payload: ${data.dataISO}`)
    console.log(`    itens: ${data.itens?.length}`)
    let max = null
    for (const it of data.itens || []) {
      for (const c of ['dtEntrada', 'dtSaida']) {
        const d = parseData(it[c])
        if (d && (!max || d > max)) max = d
      }
    }
    console.log(`    Maior dtEntrada/dtSaida real dentro do arquivo: ${max ? max.toLocaleDateString('pt-BR') : '—'}`)
    console.log(`    Amostra dos 3 primeiros itens:`)
    for (const it of (data.itens || []).slice(0, 3)) {
      console.log(`      [${it.loja}] ${it.codigo}  dtEntrada=${it.dtEntrada}  dtSaida=${it.dtSaida}  custoTotal=${it.custoTotal}`)
    }
  } else {
    console.log(`\n[3] Nenhum arquivo "2026-08*" encontrado em Dados/Estoque/ direto.`)
  }

  // ── Investiga maio/2026 ──────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(74)}`)
  console.log(`  Investigação — maio/2026: 13.575 itens, R$ 0,00`)
  console.log(`${'═'.repeat(74)}`)

  const arquivosMaio = nomes.filter(f => f.nome.startsWith('2026-05'))
  console.log(`\n[4] Arquivos de maio/2026 encontrados: ${arquivosMaio.length}`)
  for (const f of arquivosMaio) console.log(`    ${f.nome}`)

  if (arquivosMaio.length) {
    const alvo = arquivosMaio[arquivosMaio.length - 1]
    console.log(`\n[5] Inspecionando o mais recente: ${alvo.nome}`)
    const [buf] = await bucket.file(`Dados/Estoque/${alvo.nome}`).download()
    const data = JSON.parse(buf.toString('utf8'))
    console.log(`    itens no arquivo: ${data.itens?.length}`)
    console.log(`    resumo salvo no payload: ${JSON.stringify(data.resumo)}`)

    // Confere os campos de custo reais dos itens
    const primeiros5 = (data.itens || []).slice(0, 5)
    console.log(`\n    Amostra bruta dos 5 primeiros itens (como estão gravados no JSON):`)
    for (const it of primeiros5) {
      console.log(`      ${JSON.stringify(it)}`)
    }

    const somaCusto = (data.itens || []).reduce((s, i) => s + (Number(i.custoTotal) || 0), 0)
    const comCustoZero = (data.itens || []).filter(i => !i.custoTotal || i.custoTotal === 0).length
    const comCustoPositivo = (data.itens || []).filter(i => i.custoTotal > 0).length
    console.log(`\n    Soma de custoTotal recalculada agora: ${somaCusto}`)
    console.log(`    Itens com custoTotal 0/ausente: ${comCustoZero} de ${data.itens?.length}`)
    console.log(`    Itens com custoTotal > 0: ${comCustoPositivo}`)

    // Tipos de dado
    if (primeiros5.length) {
      console.log(`\n    typeof custoTotal do 1º item: ${typeof primeiros5[0].custoTotal}`)
      console.log(`    Chaves presentes no 1º item: ${Object.keys(primeiros5[0]).join(', ')}`)
    }
  } else {
    console.log(`\n    Nenhum arquivo de maio encontrado no esquema antigo.`)
    console.log(`    Verificando pasta obsoleto/ também...`)
    const [filesObs] = await bucket.getFiles({ prefix: 'obsoleto/' })
    const maioObs = filesObs.filter(f => f.name.includes('2026-05'))
    for (const f of maioObs) console.log(`      ${f.name}`)
  }

  console.log(`\n${'═'.repeat(74)}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
