import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')

const files  = readdirSync(join(ROOT, 'backups')).filter(f => f.startsWith('config-metas-backup')).sort()
const latest = files.at(-1)
const backup  = JSON.parse(readFileSync(join(ROOT, 'backups', latest), 'utf8'))
const payload = backup.payload

const meses = ['01/2026','02/2026','03/2026','04/2026','05/2026','06/2026','07/2026']

function meta(c) {
  return { mp: Number(c?.mp)||0, mo: Number(c?.mo)||0, mpo: Number(c?.mpo)||0 }
}
function str(m) {
  if (!m) return '(ausente)'
  return `mp=${String(m.mp).padStart(7)}  mo=${String(m.mo).padStart(6)}  mpo=${String(m.mpo).padStart(7)}`
}
function igual(a, b) {
  return a.mp === b.mp && a.mo === b.mo && a.mpo === b.mpo
}
function temMeta(m) { return m.mp > 0 || m.mo > 0 || m.mpo > 0 }

const mes7 = payload['07/2026'] || {}
const mes6 = payload['06/2026'] || {}

// ── Os 10 diferentes de junho: histórico completo ────────────────────────────
const diferentes = Object.entries(mes7)
  .filter(([,c]) => {
    const m7 = meta(c)
    const m6 = mes6[c.colaborador || Object.keys(payload['07/2026']).find(n => mes7[n] === c)]
    if (!temMeta(m7)) return false
    if (!m6) return false
    return !igual(m7, meta(m6))
  })
  .map(([nome, c]) => nome)

console.log('\n── Histórico completo dos 10 editados em julho ─────────────────────')
for (const nome of diferentes) {
  const linha = [nome.padEnd(40)]
  for (const m of meses) {
    const c = payload[m]?.[nome]
    const mt = c ? meta(c) : null
    if (mt && temMeta(mt)) {
      linha.push(`${m}: mp=${mt.mp} mo=${mt.mo} mpo=${mt.mpo}`)
    }
  }
  console.log('\n' + linha[0])
  for (let i = 1; i < linha.length; i++) console.log('  ' + linha[i])
}

// ── Padrão: mpo sumindo em julho ─────────────────────────────────────────────
console.log('\n── Análise do padrão: mpo em junho vs julho ────────────────────────')
let mpoSumiuEmJul = 0
let mpoNaoMudou   = 0
for (const [nome, c] of Object.entries(mes7)) {
  const m7 = meta(c)
  const c6 = mes6[nome]
  if (!c6) continue
  const m6 = meta(c6)
  if (m6.mpo > 0 && m7.mpo === 0) mpoSumiuEmJul++
  if (m6.mpo > 0 && m7.mpo > 0)   mpoNaoMudou++
}
console.log(`  Colaboradores com mpo > 0 em junho e mpo = 0 em julho: ${mpoSumiuEmJul}`)
console.log(`  Colaboradores com mpo > 0 em junho e mpo > 0 em julho: ${mpoNaoMudou}`)

// ── Os 52 idênticos a junho: são realistas ou suspeitos? ────────────────────
// Olha a evolução ao longo dos meses — se o valor mudou de maio p/ junho mas
// "travou" em julho, é suspeito de revert.
console.log('\n── Dos 52 idênticos a junho: evolução histórica (amostra de 8) ────')
const identicos = Object.entries(mes7)
  .filter(([nome, c]) => {
    const m7 = meta(c); const c6 = mes6[nome]
    if (!c6 || !temMeta(m7)) return false
    return igual(m7, meta(c6))
  })
  .map(([nome]) => nome)

// Pega 8 que tinham meta diferente em meses anteriores — esses são os suspeitos
let exibidos = 0
for (const nome of identicos) {
  if (exibidos >= 8) break
  const historico = meses.map(m => ({ m, c: payload[m]?.[nome] })).filter(({ c }) => c)
  const valores = historico.map(({ m, c }) => ({ m, mt: meta(c) })).filter(({ mt }) => temMeta(mt))
  if (valores.length < 2) continue

  // Verifica se houve mudança antes de junho mas travou em junho/julho
  const valoresDistintos = new Set(valores.map(v => `${v.mt.mp}-${v.mt.mo}-${v.mt.mpo}`))
  if (valoresDistintos.size === 1) continue // sempre igual — não é suspeito

  exibidos++
  console.log(`\n${nome}`)
  for (const { m, mt } of valores) {
    const flag = (m === '07/2026' || m === '06/2026') ? ' ←' : ''
    console.log(`  ${m}: ${str(mt)}${flag}`)
  }
}

// ── Resumo final ──────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('RESUMO PARA DECISÃO')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`115 colaboradores em julho:`)
console.log(`  53 zerados        → OK (sem meta definida)`)
console.log(`  10 editados       → aparecem diferentes de junho com histórico coerente`)
console.log(`  52 iguais a junho → AMBÍGUO: pode ser mantido igual OU revert`)
console.log(``)
console.log(`Sinal de revert: mpo sumiu em julho para ${mpoSumiuEmJul} consultores`)
console.log(`  (tinham mpo em junho, julho tem mpo=0 — isso NÃO é normal)`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
