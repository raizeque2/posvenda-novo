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
const mes6 = payload['06/2026'] || {}

const comMeta8 = Object.entries(mes8)
  .filter(([, c]) => (Number(c.mp)||0) > 0 || (Number(c.mo)||0) > 0 || (Number(c.mpo)||0) > 0)

// ── Os 10 com valores diferentes de julho ────────────────────────────────────
console.log('\n── Os 10 com valores DIFERENTES de 07/2026 ────────────────────────')
for (const [nome, c8] of comMeta8) {
  const c7   = mes7[nome]
  if (!c7) continue
  const mp8  = Number(c8.mp) ||0; const mo8  = Number(c8.mo) ||0; const mpo8 = Number(c8.mpo)||0
  const mp7  = Number(c7.mp) ||0; const mo7  = Number(c7.mo) ||0; const mpo7 = Number(c7.mpo)||0
  if (mp8 === mp7 && mo8 === mo7 && mpo8 === mpo7) continue  // pula os idênticos

  const c6 = mes6[nome]
  const mp6  = c6 ? Number(c6.mp) ||0 : null
  const mo6  = c6 ? Number(c6.mo) ||0 : null
  const mpo6 = c6 ? Number(c6.mpo)||0 : null

  // Verifica se é idêntico a junho (outra fonte de cópia)
  const igualJun = c6 && mp8 === mp6 && mo8 === mo6 && mpo8 === mpo6
  const igualJulComZero = (mp8===0 && mo8===0 && mpo8===0)

  console.log(`\n${nome}`)
  console.log(`  08/2026: mp=${mp8}  mo=${mo8}  mpo=${mpo8}`)
  console.log(`  07/2026: mp=${mp7}  mo=${mo7}  mpo=${mpo7}`)
  if (c6) console.log(`  06/2026: mp=${mp6}  mo=${mo6}  mpo=${mpo6}`)

  if (igualJun)       console.log(`  → 🟠 IDÊNTICO a 06/2026 — possível cópia de junho`)
  else if (igualJulComZero) console.log(`  → ✅ Agosto com zeros (diferença: julho tinha meta > 0)`)
  else                console.log(`  → 🔵 Valor único — pode ser edição manual real`)
}

// ── O 1 "só em agosto" ────────────────────────────────────────────────────────
console.log('\n── O 1 colaborador apenas em 08/2026 ─────────────────────────────')
for (const [nome, c8] of comMeta8) {
  if (!mes7[nome]) {
    console.log(`\n${nome}`)
    console.log(`  08/2026: mp=${Number(c8.mp)||0}  mo=${Number(c8.mo)||0}  mpo=${Number(c8.mpo)||0}`)
    console.log(`  07/2026: (não existe)`)
    const c6 = mes6[nome]
    if (c6) console.log(`  06/2026: mp=${Number(c6.mp)||0}  mo=${Number(c6.mo)||0}  mpo=${Number(c6.mpo)||0}`)
    else console.log(`  06/2026: (não existe)`)
  }
}

// ── Hipótese: ts do doc vs quando foi deployado o fix ────────────────────────
console.log('\n── Análise de timestamp ──────────────────────────────────────────')
const tsDoc = new Date(backup.ts)
console.log(`Última gravação em config/metas: ${tsDoc.toLocaleString('pt-BR')} (${backup.ts})`)
console.log(`O backup foi feito às:           ${new Date().toLocaleString('pt-BR')} (agora)`)
console.log(``)
console.log(`Se o fix de espelharMes foi deployado ANTES de ${tsDoc.toLocaleString('pt-BR')},`)
console.log(`então a gravação das 15:06 foi por outra causa (Metas page ou Colaboradores).`)
console.log(``)
console.log(`Se o fix foi deployado DEPOIS, então os dados de 08/2026 vieram do espelharMes bugado.`)
