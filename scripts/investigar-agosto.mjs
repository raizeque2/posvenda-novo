import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')

const files  = readdirSync(join(ROOT, 'backups')).filter(f => f.startsWith('config-metas-backup')).sort()
const latest = files.at(-1)
const backup  = JSON.parse(readFileSync(join(ROOT, 'backups', latest), 'utf8'))
const payload = backup.payload

const mes8 = payload['08/2026'] || {}
const mes7 = payload['07/2026'] || {}

// Colaboradores de agosto com alguma meta > 0
const comMeta8 = Object.entries(mes8)
  .filter(([, c]) => (Number(c.mp)||0) > 0 || (Number(c.mo)||0) > 0 || (Number(c.mpo)||0) > 0)
  .sort(([a], [b]) => a.localeCompare(b))

console.log(`\n08/2026: ${comMeta8.length} colaboradores com meta > 0 (de ${Object.keys(mes8).length} total)\n`)

// Compara 5 exemplos com julho
let identicoJulho = 0
let diferenteJulho = 0
let somenteAgosto = 0

const exemplos = comMeta8.slice(0, 5)

console.log('── 5 exemplos ─────────────────────────────────────────────────────')
for (const [nome, c8] of exemplos) {
  const c7 = mes7[nome]
  const mp8  = Number(c8.mp)  || 0
  const mo8  = Number(c8.mo)  || 0
  const mpo8 = Number(c8.mpo) || 0
  const mp7  = c7 ? Number(c7.mp)  || 0 : null
  const mo7  = c7 ? Number(c7.mo)  || 0 : null
  const mpo7 = c7 ? Number(c7.mpo) || 0 : null

  const igual = c7 && mp8 === mp7 && mo8 === mo7 && mpo8 === mpo7
  const status = !c7 ? '⚠️  SÓ em agosto' : igual ? '🔴 IDÊNTICO a julho' : '🟡 Diferente de julho'

  console.log(`\n${nome}`)
  console.log(`  08/2026: mp=${mp8}  mo=${mo8}  mpo=${mpo8}`)
  if (c7) {
    console.log(`  07/2026: mp=${mp7}  mo=${mo7}  mpo=${mpo7}`)
  } else {
    console.log(`  07/2026: (não existe)`)
  }
  console.log(`  → ${status}`)
}

// Estatística completa
console.log('\n── Comparação completa dos 63 ────────────────────────────────────────')
for (const [nome, c8] of comMeta8) {
  const c7   = mes7[nome]
  const mp8  = Number(c8.mp)  || 0
  const mo8  = Number(c8.mo)  || 0
  const mpo8 = Number(c8.mpo) || 0
  const mp7  = c7 ? Number(c7.mp)  || 0 : null
  const mo7  = c7 ? Number(c7.mo)  || 0 : null
  const mpo7 = c7 ? Number(c7.mpo) || 0 : null

  if (!c7) { somenteAgosto++; continue }
  if (mp8 === mp7 && mo8 === mo7 && mpo8 === mpo7) identicoJulho++
  else diferenteJulho++
}

console.log(`  Idênticos a 07/2026   : ${identicoJulho}  🔴 provável cópia indevida`)
console.log(`  Diferentes de 07/2026 : ${diferenteJulho}  🟡 possível edição manual posterior`)
console.log(`  Só em agosto (sem jul) : ${somenteAgosto}  ⚠️  novo colaborador`)

// Timestamp do documento original
const dataDoc = new Date(backup.ts)
console.log(`\nTimestamp do doc original: ${dataDoc.toLocaleString('pt-BR')}`)
console.log('(Se for anterior ao fix de espelharMes, os valores idênticos são contaminação)\n')
