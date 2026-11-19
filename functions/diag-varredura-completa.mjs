/**
 * diag-varredura-completa.mjs — SOMENTE LEITURA. Não grava nada.
 *
 * 1. Varre TODOS os arquivos diários de junho no Storage, procurando algum
 *    que seja fiel a junho (maior dtEntrada/dtSaida <= 30/06/2026).
 * 2. Roda a mesma varredura (maior dtEntrada/dtSaida) nos arquivos de julho
 *    existentes, para ver se também têm nome divergente do conteúdo.
 *
 * Rodar a partir de functions/:
 *   node diag-varredura-completa.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))

const BUCKET = 'posvenda-bi.firebasestorage.app'

if (!getApps().length) initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET })
const bucket = getStorage().bucket(BUCKET)

function parseData(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d) || d.getFullYear() < 1990 ? null : d
}

// Maior dtEntrada/dtSaida entre todos os itens do arquivo
function maiorData(itens) {
  let max = null, campo = null
  for (const it of itens) {
    for (const c of ['dtEntrada', 'dtSaida']) {
      const d = parseData(it[c])
      if (d && (!max || d > max)) { max = d; campo = c }
    }
  }
  return { max, campo }
}

async function baixarEInspecionar(nome) {
  const [buf] = await bucket.file(`Dados/Estoque/${nome}.json`).download()
  const raw = JSON.parse(buf.toString('utf8'))
  const itens = raw.itens || []
  const { max, campo } = maiorData(itens)
  return { nome, totalItens: itens.length, maiorData: max, campo }
}

async function main() {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  VARREDURA COMPLETA — nome do arquivo vs. conteúdo real  [leitura]`)
  console.log(`${'═'.repeat(70)}`)

  const [files] = await bucket.getFiles({ prefix: 'Dados/Estoque/' })
  const nomes = files.map(f => f.name.replace('Dados/Estoque/', '').replace('.json', '')).filter(Boolean).sort()

  // ── Parte A: todos os arquivos diários de JUNHO ────────────────────────────
  const junho = nomes.filter(n => n.startsWith('2026-06'))
  const corteJunho = new Date(2026, 5, 30, 23, 59, 59)

  console.log(`\n[A] Todos os arquivos diários de junho/2026 (${junho.length} arquivos)`)
  console.log(`    Procurando algum com maior dtEntrada/dtSaida <= 30/06/2026 (foto fiel)\n`)

  let fielEncontrado = null
  for (const nome of junho) {
    const r = await baixarEInspecionar(nome)
    const fiel = r.maiorData && r.maiorData <= corteJunho
    const diasFuturo = r.maiorData ? Math.round((r.maiorData - corteJunho) / 86400000) : null
    const marca = fiel ? '✓ FIEL' : (r.maiorData ? `✗ +${diasFuturo}d além de 30/06` : '? sem data')
    console.log(`    ${r.nome}.json   itens=${String(r.totalItens).padStart(6)}   maior mov.=${r.maiorData ? r.maiorData.toLocaleDateString('pt-BR') : '—'}   ${marca}`)
    if (fiel && !fielEncontrado) fielEncontrado = r
  }

  console.log(`\n    ${fielEncontrado ? `✓ Arquivo fiel encontrado: ${fielEncontrado.nome}.json` : '✗ NENHUM arquivo de junho é fiel — todos têm movimentação além de 30/06.'}`)

  // ── Parte B: arquivos de JULHO ──────────────────────────────────────────────
  const julho = nomes.filter(n => n.startsWith('2026-07'))
  console.log(`\n[B] Arquivos diários de julho/2026 (${julho.length} arquivos)`)
  console.log(`    Mesma checagem: nome do arquivo vs. maior dtEntrada/dtSaida real\n`)

  for (const nome of julho) {
    const r = await baixarEInspecionar(nome)
    const [ny, nm, nd] = nome.split('-').map(Number)
    const dataNoNome = new Date(ny, nm - 1, nd, 23, 59, 59)
    const divergente = r.maiorData && r.maiorData > dataNoNome
    const diasAlem = divergente ? Math.round((r.maiorData - dataNoNome) / 86400000) : 0
    const marca = !r.maiorData ? '? sem data' : divergente ? `✗ DIVERGE +${diasAlem}d além do nome` : '✓ coerente com o nome'
    console.log(`    ${r.nome}.json   itens=${String(r.totalItens).padStart(6)}   maior mov.=${r.maiorData ? r.maiorData.toLocaleDateString('pt-BR') : '—'}   ${marca}`)
  }

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  Nada foi gravado.`)
  console.log(`${'═'.repeat(70)}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
