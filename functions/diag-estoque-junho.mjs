/**
 * diag-estoque-junho.mjs — SOMENTE LEITURA. Não grava nada.
 *
 * Importa as funções REAIS do app (reprocessarCurvas, resumoEstoque) e reproduz
 * a tela Estoque → Histórico ("Posição por Mês") para 06/2026, comparando o
 * obsoleto com data-base 30/06/2026 vs data de hoje.
 *
 * Rodar a partir de functions/:
 *   node diag-estoque-junho.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { reprocessarCurvas, resumoEstoque } from '../src/services/processamento/processarObsoleto.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))

const BUCKET = 'posvenda-bi.firebasestorage.app'
const PREFIXO = '2026-06'

if (!getApps().length) initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET })
const db = getFirestore()
const bucket = getStorage().bucket(BUCKET)

const brl = v => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = v => (v * 100).toFixed(1) + '%'

async function main() {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  DIAGNÓSTICO — Estoque Obsoleto 06/2026 (Posição por Mês)  [leitura]`)
  console.log(`${'═'.repeat(70)}`)

  // Último arquivo de junho
  const [files] = await bucket.getFiles({ prefix: 'Dados/Estoque/' })
  const nomes = files.map(f => f.name.replace('Dados/Estoque/', '').replace('.json', '')).filter(Boolean)
  const junho = nomes.filter(n => n.startsWith(PREFIXO)).sort()
  const ultimoJunho = junho[junho.length - 1]
  console.log(`\n  Arquivo usado: Dados/Estoque/${ultimoJunho}.json`)

  const [buf] = await bucket.file(`Dados/Estoque/${ultimoJunho}.json`).download()
  const raw = JSON.parse(buf.toString('utf8'))

  // Reproduz carregarEstoque: converte dtEntrada/dtSaida de string ISO → Date,
  // igual ao app. Sem isso, reprocessarCurvas trata tudo como SEM_DATA.
  const data = {
    ...raw,
    itens: (raw.itens || []).map(r => ({
      ...r,
      dtEntrada: r.dtEntrada ? new Date(r.dtEntrada) : null,
      dtSaida:   r.dtSaida   ? new Date(r.dtSaida)   : null,
    })),
  }

  // Thresholds reais (configuracoes/regrasEstoque)
  let regrasEstoque = {}
  try {
    const rs = await db.collection('configuracoes').doc('regrasEstoque').get()
    if (rs.exists) regrasEstoque = rs.data() || {}
  } catch {}

  const dataRef3006 = new Date(2026, 5, 30, 23, 59, 59) // 30/06/2026 fim do dia
  const hoje = new Date()

  // A tela Histórico NÃO aplica pecas_filtro — usa resumoEstoque direto sobre os itens,
  // opcionalmente filtrados por loja. Reproduzimos exatamente isso.
  const calc = (dataRef, loja) => {
    const itens0 = reprocessarCurvas(data.itens, regrasEstoque, dataRef)
    const itens = loja ? itens0.filter(i => i.loja === loja) : itens0
    const res = resumoEstoque(itens)
    return { totalItens: res.totalItens, custoTotal: res.custoTotal, obsCusto: res.obsCusto, pctObsoleto: res.pctObsoleto }
  }

  const linha = (label, r) =>
    console.log(`    ${label.padEnd(22)} itens=${String(r.totalItens).padStart(6)}  custo=${brl(r.custoTotal).padStart(16)}  obsoleto=${brl(r.obsCusto).padStart(15)}  ${pct(r.pctObsoleto).padStart(7)}`)

  console.log(`\n  ── TODAS as lojas (sem filtro) ──`)
  linha('base 30/06/2026', calc(dataRef3006, null))
  linha(`hoje ${hoje.toLocaleDateString('pt-BR')}`, calc(hoje, null))

  console.log(`\n  ── Somente ARA ──`)
  linha('base 30/06/2026', calc(dataRef3006, 'ARA'))
  linha(`hoje ${hoje.toLocaleDateString('pt-BR')}`, calc(hoje, 'ARA'))

  // Todas as lojas individualmente, base 30/06 — para localizar o print
  console.log(`\n  ── Por loja, base 30/06/2026 ──`)
  const lojas = [...new Set(data.itens.map(i => i.loja).filter(Boolean))].sort()
  for (const loja of lojas) linha(loja, calc(dataRef3006, loja))

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  Nada foi gravado. Compare "obsoleto base 30/06" com o print.`)
  console.log(`${'═'.repeat(70)}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
