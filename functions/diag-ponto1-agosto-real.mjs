/**
 * diag-ponto1-agosto-real.mjs — SOMENTE LEITURA. Não grava nada.
 *
 * Investiga o upload real de estoque feito hoje (ainda 31/07/2026) que abriu
 * agosto/2026 como mês corrente. Sem supor causa — só evidência.
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
  console.log(`  PONTO 1 — Investigação da virada para agosto (dado real)  [leitura]`)
  console.log(`${'═'.repeat(74)}`)

  // ── [4] Estado real gravado agora em config/estoqueControle ─────────────────
  const controleSnap = await db.collection('config').doc('estoqueControle').get()
  if (!controleSnap.exists) {
    console.log('\n  config/estoqueControle NÃO existe. O upload real ainda não rodou ou falhou.')
    return
  }
  const c = controleSnap.data()
  console.log(`\n[4] config/estoqueControle — estado real agora`)
  console.log(`    mesAtual: ${c.mesAtual}`)
  console.log(`\n    arquivosAtuais:`)
  for (const a of c.arquivosAtuais || []) {
    console.log(`      path       : ${a.path}`)
    console.log(`      maxData    : ${a.maxData}`)
    console.log(`      uploadedAt : ${new Date(a.uploadedAt).toISOString()}  (${new Date(a.uploadedAt).toLocaleString('pt-BR')} horário local do servidor deste script)`)
  }
  console.log(`\n    fechamentos:`)
  for (const [mes, f] of Object.entries(c.fechamentos || {}).sort()) {
    if (f?.status === 'sem_dado') console.log(`      ${mes} : SEM_DADO`)
    else console.log(`      ${mes} : path=${f.path}  congeladoEm=${new Date(f.congeladoEm).toISOString()}  origem=${f.origem}`)
  }

  // ── [1] dataMaximaMovimentacao real, do payload do arquivo ──────────────────
  const ultimo = (c.arquivosAtuais || [])[c.arquivosAtuais.length - 1]
  if (!ultimo) { console.log('\n  Sem arquivo atual — nada mais a investigar.'); return }

  console.log(`\n[1] dataMaximaMovimentacao real armazenada no payload do arquivo ${ultimo.path}`)
  const [buf] = await bucket.file(ultimo.path).download()
  const data = JSON.parse(buf.toString('utf8'))
  console.log(`    dataUpload             : ${data.dataUpload}`)
  console.log(`    dataMaximaMovimentacao : ${data.dataMaximaMovimentacao}`)
  console.log(`    Em horário local BR (UTC-3): ${new Date(data.dataMaximaMovimentacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
  console.log(`    Em UTC                      : ${new Date(data.dataMaximaMovimentacao).toUTCString()}`)
  console.log(`    itens no arquivo: ${data.itens?.length}`)

  // ── [2] Itens com dtEntrada/dtSaida >= 01/08/2026 ────────────────────────────
  const corteAgosto = new Date('2026-08-01T00:00:00.000Z') // qualquer instante já em 01/08 UTC
  const itensAgosto = []
  for (const it of data.itens || []) {
    for (const campo of ['dtEntrada', 'dtSaida']) {
      const v = it[campo]
      if (!v) continue
      const d = new Date(v)
      if (isNaN(d)) continue
      if (d >= corteAgosto) {
        itensAgosto.push({ loja: it.loja, codigo: it.codigo, campo, valor: v })
      }
    }
  }
  console.log(`\n[2] Itens com dtEntrada/dtSaida em 01/08/2026 ou depois (UTC >= 2026-08-01T00:00:00Z): ${itensAgosto.length}`)
  for (const it of itensAgosto.slice(0, 30)) {
    console.log(`    [${it.loja}] ${it.codigo}  ${it.campo}=${it.valor}`)
  }
  if (itensAgosto.length > 30) console.log(`    ... e mais ${itensAgosto.length - 30}`)

  // ── [3] Checagem de timezone: qual é o "fingerprint" das horas UTC gravadas ──
  // Uploads feitos a partir de parseDateBR (numérico, local) sempre produzem
  // T03:00:00.000Z para meia-noite local no Brasil (UTC-3). Se algum item tiver
  // um horário UTC diferente desse padrão, é sinal de parsing inconsistente.
  console.log(`\n[3] Checagem de padrão de horário UTC (fingerprint de timezone)`)
  const horarios = {}
  for (const it of data.itens || []) {
    for (const campo of ['dtEntrada', 'dtSaida']) {
      const v = it[campo]
      if (!v) continue
      const hora = v.split('T')[1]?.slice(0, 8)
      if (!hora) continue
      horarios[hora] = (horarios[hora] || 0) + 1
    }
  }
  console.log(`    Distribuição de horários UTC entre todas as datas do arquivo:`)
  for (const [h, n] of Object.entries(horarios).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${h}  →  ${n} ocorrências`)
  }
  console.log(`\n    Fingerprint esperado para "meia-noite local Brasil" = 03:00:00.000`)

  // Item(ns) especificamente de agosto: qual o horário UTC deles?
  if (itensAgosto.length) {
    console.log(`\n    Horário UTC específico dos itens de agosto encontrados:`)
    const horasAgosto = new Set(itensAgosto.map(i => i.valor.split('T')[1]?.slice(0, 8)))
    console.log(`      ${[...horasAgosto].join(', ')}`)
  }

  console.log(`\n${'═'.repeat(74)}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
