/**
 * diag-investigacao-agosto.mjs — SOMENTE LEITURA. Não grava/altera nada.
 *
 * Investiga com dados reais:
 * 1. config/mesesDisponiveis (Peças/Oficina) — quais meses estão registrados e quando.
 * 2. config/estoqueControle (Estoque) — estado real: mesAtual, arquivosAtuais (hash/maxData/
 *    uploadedAt), fechamentos — para confirmar se a virada para agosto foi por conteúdo.
 * 3. Maio/2026 no Storage/estoqueControle — por que 13.575 itens mas R$ 0,00.
 *
 * Rodar a partir de functions/:
 *   node diag-investigacao-agosto.mjs
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

async function main() {
  console.log(`\n${'═'.repeat(74)}`)
  console.log(`  INVESTIGAÇÃO — agosto/2026: Peças/Oficina vs Estoque  [leitura, dados reais]`)
  console.log(`${'═'.repeat(74)}`)

  // ── [1] config/mesesDisponiveis — Peças e Oficina ───────────────────────────
  console.log(`\n[1] config/mesesDisponiveis (Peças e Oficina)`)
  const mesesSnap = await db.collection('config').doc('mesesDisponiveis').get()
  if (!mesesSnap.exists) {
    console.log('    Documento não existe.')
  } else {
    const d = mesesSnap.data()
    console.log(`    pecas   : ${JSON.stringify(d.pecas)}`)
    console.log(`    oficina : ${JSON.stringify(d.oficina)}`)
    const alt = d.alteracoes || {}
    console.log(`    alteracoes (timestamp por mês):`)
    for (const [mes, ts] of Object.entries(alt).sort()) {
      console.log(`      ${mes} : ${new Date(ts).toLocaleString('pt-BR')}`)
    }
    console.log(`\n    08/2026 presente em pecas?   ${d.pecas?.includes('08/2026') ? 'SIM' : 'NÃO'}`)
    console.log(`    08/2026 presente em oficina? ${d.oficina?.includes('08/2026') ? 'SIM' : 'NÃO'}`)
  }

  // ── [2] config/estoqueControle — estado real do mecanismo novo ──────────────
  console.log(`\n[2] config/estoqueControle (Estoque)`)
  const controleSnap = await db.collection('config').doc('estoqueControle').get()
  if (!controleSnap.exists) {
    console.log('    Documento não existe — nenhum upload passou pelo mecanismo novo ainda.')
  } else {
    const c = controleSnap.data()
    console.log(`    mesAtual: ${c.mesAtual}`)
    console.log(`\n    arquivosAtuais (janela rolante do mês corrente):`)
    for (const a of c.arquivosAtuais || []) {
      console.log(`      path      : ${a.path}`)
      console.log(`      hash      : ${a.hash}`)
      console.log(`      maxData   : ${a.maxData}  (${new Date(a.maxData).toLocaleDateString('pt-BR')})`)
      console.log(`      uploadedAt: ${new Date(a.uploadedAt).toLocaleString('pt-BR')}`)
      console.log(`      ---`)
    }
    console.log(`\n    fechamentos:`)
    for (const [mes, f] of Object.entries(c.fechamentos || {}).sort()) {
      if (f?.status === 'sem_dado') {
        console.log(`      ${mes} : SEM_DADO`)
      } else {
        console.log(`      ${mes} : path=${f.path}  congeladoEm=${new Date(f.congeladoEm).toLocaleString('pt-BR')}  origem=${f.origem}`)
      }
    }
  }

  // ── [3] Arquivos reais em Dados/Estoque/atual/ — confirmar conteúdo/nome ────
  console.log(`\n[3] Arquivos reais em Dados/Estoque/atual/ (Storage)`)
  const [filesAtual] = await bucket.getFiles({ prefix: 'Dados/Estoque/atual/' })
  for (const f of filesAtual) {
    console.log(`    ${f.name}   updated=${new Date(f.metadata.updated).toLocaleString('pt-BR')}   ${f.metadata.size} bytes`)
  }

  console.log(`\n    Arquivos em Dados/Estoque/fechamentos/`)
  const [filesFech] = await bucket.getFiles({ prefix: 'Dados/Estoque/fechamentos/' })
  for (const f of filesFech) {
    console.log(`    ${f.name}   updated=${new Date(f.metadata.updated).toLocaleString('pt-BR')}   ${f.metadata.size} bytes`)
  }

  // ── [4] Detalhe do payload do arquivo "atual" mais recente ──────────────────
  if (controleSnap.exists) {
    const c = controleSnap.data()
    const ultimo = (c.arquivosAtuais || [])[c.arquivosAtuais.length - 1]
    if (ultimo) {
      console.log(`\n[4] Payload do arquivo atual mais recente (${ultimo.path})`)
      const [buf] = await bucket.file(ultimo.path).download()
      const data = JSON.parse(buf.toString('utf8'))
      console.log(`    dataUpload              : ${data.dataUpload}`)
      console.log(`    dataMaximaMovimentacao  : ${data.dataMaximaMovimentacao}`)
      console.log(`    hash (no payload)       : ${data.hash}`)
      console.log(`    itens                   : ${data.itens?.length}`)
      console.log(`    resumo.custoTotal       : ${data.resumo?.custoTotal}`)
      // Amostra de datas reais dos primeiros itens
      console.log(`\n    Amostra dos 5 primeiros itens (dtEntrada/dtSaida reais no arquivo):`)
      for (const it of (data.itens || []).slice(0, 5)) {
        console.log(`      [${it.loja}] ${it.codigo}   dtEntrada=${it.dtEntrada}   dtSaida=${it.dtSaida}`)
      }
      // Confirma o cálculo de dataMaximaMovimentacao de forma independente
      let maxCalc = null
      for (const it of (data.itens || [])) {
        for (const campo of ['dtEntrada', 'dtSaida']) {
          const v = it[campo]
          if (!v) continue
          const d = new Date(v)
          if (isNaN(d) || d.getFullYear() < 1990) continue
          if (!maxCalc || d > maxCalc) maxCalc = d
        }
      }
      console.log(`\n    Recalculado agora, direto dos itens do arquivo: ${maxCalc?.toISOString()} (${maxCalc?.toLocaleDateString('pt-BR')})`)
      console.log(`    Bate com dataMaximaMovimentacao armazenado? ${maxCalc?.toISOString() === data.dataMaximaMovimentacao ? 'SIM' : 'NÃO — DIVERGE'}`)
    }
  }

  console.log(`\n${'═'.repeat(74)}`)
  console.log(`  [Ponto 3 será investigado em script separado — precisa achar onde maio está]`)
  console.log(`${'═'.repeat(74)}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
