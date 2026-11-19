/**
 * diag-datas-junho.mjs — SOMENTE LEITURA. Não grava nada.
 *
 * Inspeciona o arquivo de fechamento de junho:
 *  1. Reporta os nomes REAIS dos campos de cada item.
 *  2. Varre todos os itens e encontra a MAIOR data de movimentação.
 *  3. Conclui se o arquivo é fiel a 30/06 ou já tem movimentação posterior.
 *
 * Rodar a partir de functions/:
 *   node diag-datas-junho.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))

const BUCKET = 'posvenda-bi.firebasestorage.app'
const PREFIXO = '2026-06'
const CORTE = new Date(2026, 5, 30, 23, 59, 59) // 30/06/2026 fim do dia

if (!getApps().length) initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET })
const bucket = getStorage().bucket(BUCKET)

// Nomes candidatos de campos de data (o processamento grava dtEntrada/dtSaida,
// mas confirmamos direto no dado para não presumir).
const CAND_DATA = ['dtEntrada', 'dtSaida', 'dataEntrada', 'dataSaida', 'ultimaEntrada', 'ultimaSaida']

function parseData(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d) ? null : d
}

function inspecionar(nomeArquivo, itens) {
  console.log(`\n${'─'.repeat(66)}`)
  console.log(`  ${nomeArquivo}  —  ${itens.length} itens`)
  console.log(`${'─'.repeat(66)}`)

  // 1. Nomes reais dos campos (a partir do 1º item e da união de chaves)
  const chaves = new Set()
  for (const it of itens.slice(0, 200)) Object.keys(it).forEach(k => chaves.add(k))
  const camposData = [...chaves].filter(k =>
    CAND_DATA.includes(k) || /(^dt|data|entrada|saida|saída)/i.test(k)
  )
  console.log(`\n  Campos presentes no item (amostra):`)
  console.log(`    ${[...chaves].join(', ')}`)
  console.log(`\n  Campos de data de movimentação detectados: ${camposData.join(', ') || '(nenhum)'}`)
  if (itens[0]) {
    console.log(`  Exemplo (item 1):`)
    for (const c of camposData) console.log(`    ${c} = ${JSON.stringify(itens[0][c])}`)
  }

  // 2. Varredura: maior data de movimentação entre TODOS os itens
  let maxData = null, maxCampo = null, maxItem = null
  let comData = 0, semData = 0
  for (const it of itens) {
    let temAlguma = false
    for (const c of camposData) {
      const d = parseData(it[c])
      if (!d) continue
      if (d.getFullYear() < 1990) continue // ignora datas-sentinela absurdas
      temAlguma = true
      if (!maxData || d > maxData) { maxData = d; maxCampo = c; maxItem = it }
    }
    if (temAlguma) comData++; else semData++
  }

  console.log(`\n  Itens com ao menos uma data: ${comData}   |   sem data: ${semData}`)
  if (maxData) {
    console.log(`  MAIOR data de movimentação: ${maxData.toLocaleDateString('pt-BR')} (campo "${maxCampo}")`)
    console.log(`    no item: ${maxItem.codigo || maxItem.Codigo || '?'} — ${(maxItem.descricao || maxItem.Descricao || '').slice(0, 40)} [loja ${maxItem.loja || '?'}]`)
  } else {
    console.log(`  Nenhuma data de movimentação válida encontrada.`)
  }

  // Quantos itens têm movimentação DEPOIS de 30/06
  let posCorte = 0
  const exemplosPos = []
  for (const it of itens) {
    for (const c of camposData) {
      const d = parseData(it[c])
      if (d && d > CORTE) {
        posCorte++
        if (exemplosPos.length < 5) exemplosPos.push({ c, d, it })
        break
      }
    }
  }
  console.log(`\n  Itens com movimentação POSTERIOR a 30/06/2026: ${posCorte}`)
  for (const e of exemplosPos) {
    console.log(`    ${e.d.toLocaleDateString('pt-BR')} (${e.c}) — ${e.it.codigo || '?'} [${e.it.loja || '?'}]`)
  }

  // 4. Conclusão
  console.log(`\n  CONCLUSÃO:`)
  if (!maxData) {
    console.log(`    Sem datas para avaliar.`)
  } else if (maxData <= CORTE) {
    console.log(`    Maior data <= 30/06/2026 → arquivo FIEL a 30/06 (sem movimentação de julho).`)
  } else {
    console.log(`    Maior data POSTERIOR a 30/06/2026 → arquivo tem movimentação DEPOIS do fechamento.`)
  }
  return maxData
}

async function main() {
  console.log(`\n${'═'.repeat(66)}`)
  console.log(`  INVESTIGAÇÃO — datas de movimentação nos arquivos de junho  [leitura]`)
  console.log(`${'═'.repeat(66)}`)

  const [files] = await bucket.getFiles({ prefix: 'Dados/Estoque/' })
  const nomes = files.map(f => f.name.replace('Dados/Estoque/', '').replace('.json', '')).filter(Boolean)
  const junho = nomes.filter(n => n.startsWith(PREFIXO)).sort()
  const maisRecente = junho[junho.length - 1]

  // Arquivos-alvo: o de 30/06 e o mais recente de junho (se diferente)
  const alvos = new Set()
  if (junho.includes('2026-06-30')) alvos.add('2026-06-30')
  alvos.add(maisRecente)

  for (const nome of alvos) {
    const [buf] = await bucket.file(`Dados/Estoque/${nome}.json`).download()
    const raw = JSON.parse(buf.toString('utf8'))
    inspecionar(`Dados/Estoque/${nome}.json`, raw.itens || [])
  }

  console.log(`\n${'═'.repeat(66)}`)
  console.log(`  Nada foi gravado.`)
  console.log(`${'═'.repeat(66)}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
