import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')

const files  = readdirSync(join(ROOT, 'backups')).filter(f => f.startsWith('config-metas-backup')).sort()
const latest = files.at(-1)
const backup  = JSON.parse(readFileSync(join(ROOT, 'backups', latest), 'utf8'))
const payload = backup.payload

const mes7 = payload['07/2026'] || {}
const mes6 = payload['06/2026'] || {}
const mes5 = payload['05/2026'] || {}

function meta(c) {
  return { mp: Number(c?.mp)||0, mo: Number(c?.mo)||0, mpo: Number(c?.mpo)||0 }
}
function igual(a, b) {
  return a.mp === b.mp && a.mo === b.mo && a.mpo === b.mpo
}
function str(m) { return `mp=${m.mp}  mo=${m.mo}  mpo=${m.mpo}` }
function temMeta(m) { return m.mp > 0 || m.mo > 0 || m.mpo > 0 }

// ── Estatísticas de julho vs junho ───────────────────────────────────────────
const nomes7 = Object.keys(mes7)

let identicoJun   = 0  // julho igual a junho (possível revert)
let diferenteJun  = 0  // julho diferente de junho
let semMetaJul    = 0  // julho zerado
let somenteJul    = 0  // só em julho (novo colaborador)
const exemplosIgualJun = []
const exemplosDifJun   = []

for (const nome of nomes7) {
  const m7 = meta(mes7[nome])
  const m6 = mes6[nome] ? meta(mes6[nome]) : null

  if (!temMeta(m7)) { semMetaJul++; continue }

  if (!m6) { somenteJul++; continue }

  if (igual(m7, m6)) {
    identicoJun++
    if (exemplosIgualJun.length < 5) exemplosIgualJun.push({ nome, m7, m6 })
  } else {
    diferenteJun++
    if (exemplosDifJun.length < 5) exemplosDifJun.push({ nome, m7, m6, m5: mes5[nome] ? meta(mes5[nome]) : null })
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('ANÁLISE DE 07/2026 vs 06/2026')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Total em 07/2026   : ${nomes7.length} colaboradores`)
console.log(`  Com meta zerada  : ${semMetaJul}  (normal — sem meta definida)`)
console.log(`  Idênticos a Jun  : ${identicoJun}  ← possível revert ou meta mantida`)
console.log(`  Diferentes de Jun: ${diferenteJun}  ← foram editados em julho`)
console.log(`  Só em julho      : ${somenteJul}  (não existiam em junho)`)

// ── Exemplos de julho IDÊNTICO a junho ──────────────────────────────────────
console.log('\n── 5 exemplos: julho = junho ───────────────────────────────────────')
for (const { nome, m7, m6 } of exemplosIgualJun) {
  console.log(`\n${nome}`)
  console.log(`  07/2026: ${str(m7)}`)
  console.log(`  06/2026: ${str(m6)}`)
}

// ── Exemplos de julho DIFERENTE de junho ────────────────────────────────────
console.log('\n── 5 exemplos: julho ≠ junho (editados) ───────────────────────────')
for (const { nome, m7, m6, m5 } of exemplosDifJun) {
  console.log(`\n${nome}`)
  if (m5) console.log(`  05/2026: ${str(m5)}`)
  console.log(`  06/2026: ${str(m6)}`)
  console.log(`  07/2026: ${str(m7)}`)
  // Verifica se julho = algum mês anterior diferente de junho
  const igMai = m5 && igual(m7, m5)
  if (igMai) console.log(`  → ⚠️  Igual a maio (possível segundo revert)`)
}

// ── Colaboradores que estão em junho mas não em julho ───────────────────────
const nomesEmJunNaoJul = Object.keys(mes6).filter(n => !mes7[n])
console.log(`\n── Colaboradores em 06/2026 mas AUSENTES em 07/2026 ────────────────`)
console.log(`  Total: ${nomesEmJunNaoJul.length}`)
if (nomesEmJunNaoJul.length > 0 && nomesEmJunNaoJul.length <= 10) {
  for (const nome of nomesEmJunNaoJul) {
    const m6 = meta(mes6[nome])
    console.log(`  ${nome}: ${str(m6)}`)
  }
} else if (nomesEmJunNaoJul.length > 10) {
  for (const nome of nomesEmJunNaoJul.slice(0, 10)) {
    const m6 = meta(mes6[nome])
    console.log(`  ${nome}: ${str(m6)}`)
  }
  console.log(`  ... e mais ${nomesEmJunNaoJul.length - 10}`)
}

// ── Colaboradores que estão em julho mas não em junho ───────────────────────
const nomesEmJulNaoJun = Object.keys(mes7).filter(n => !mes6[n])
console.log(`\n── Colaboradores em 07/2026 mas AUSENTES em 06/2026 ────────────────`)
console.log(`  Total: ${nomesEmJulNaoJun.length}`)
if (nomesEmJulNaoJun.length <= 10) {
  for (const nome of nomesEmJulNaoJun) {
    const m7 = meta(mes7[nome])
    console.log(`  ${nome}: ${str(m7)}`)
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`VEREDITO: dos ${nomes7.length} colaboradores de julho,`)
console.log(`  ${diferenteJun + somenteJul} têm valores distintos de junho → editados ou novos`)
console.log(`  ${identicoJun} são idênticos a junho → mantidos ou revertidos`)
console.log(`  ${semMetaJul} estão zerados`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
