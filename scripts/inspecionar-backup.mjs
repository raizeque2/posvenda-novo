import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')

const files  = readdirSync(join(ROOT, 'backups')).filter(f => f.startsWith('config-metas-backup')).sort()
const latest = files.at(-1)
const backup  = JSON.parse(readFileSync(join(ROOT, 'backups', latest), 'utf8'))
const payload = backup.payload

// Exemplo com meta em 07/2026
const mes7 = payload['07/2026'] || {}
const comMeta7 = Object.entries(mes7).find(([, c]) => (Number(c.mp) || 0) > 0)
if (comMeta7) {
  console.log('\n── Exemplo 07/2026 com mp > 0 ─────────────────')
  console.log(JSON.stringify(comMeta7[1], null, 2))
}

// Exemplo com meta em 06/2026
const mes6 = payload['06/2026'] || {}
const comMeta6 = Object.entries(mes6).find(([, c]) => (Number(c.mp) || 0) > 0)
if (comMeta6) {
  console.log('\n── Exemplo 06/2026 com mp > 0 ─────────────────')
  console.log(JSON.stringify(comMeta6[1], null, 2))
}

// 08/2026 — era espelharMes antes do fix?
const mes8 = payload['08/2026'] || {}
const comMeta8 = Object.values(mes8).filter(c => (Number(c.mp) || 0) > 0 || (Number(c.mo) || 0) > 0)
console.log(`\n── 08/2026: ${comMeta8.length} com meta > 0 de ${Object.keys(mes8).length} total ──`)
if (comMeta8.length > 0) {
  console.log(JSON.stringify(comMeta8[0], null, 2))
}
