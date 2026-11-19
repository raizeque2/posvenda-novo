/**
 * ETAPA 1 — Migração: config/metas (misto) → config/colaboradores + config/metas (separados)
 *
 * Uso:
 *   node scripts/migrar-docs.mjs              ← só exporta backup + mostra resumo (dry-run)
 *   node scripts/migrar-docs.mjs --gravar     ← grava os dois novos documentos no Firestore
 *
 * Nunca apaga o documento antigo.
 *
 * Regra especial: meses em MESES_ZERAR entram com mp=mo=mpo=0 e metas={} em config/metas.
 * As metas serão definidas manualmente pela página de Metas após a migração.
 */

import { createRequire } from 'module'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const require = createRequire(import.meta.url)
const admin   = require('firebase-admin')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const GRAVAR      = process.argv.includes('--gravar')

// Meses cujas metas serão zeradas na migração — serão definidas manualmente depois.
const MESES_ZERAR = new Set(['07/2026', '08/2026'])

// ── Firebase Admin ─────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(readFileSync(join(ROOT, 'serviceAccountKey.json'), 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

// ── Campos que pertencem a cada documento ─────────────────────────────────────
const CAMPOS_CADASTRAL = new Set([
  'colaborador', 'apelido', 'loja', 'cargo', 'cargo_movimento',
  'centro_custo', 'salario_base', 'supervisor', 'ativo', 'mes',
])
const CAMPOS_META = new Set(['mp', 'mo', 'mpo', 'metas', 'mes', 'colaborador'])

function toNum(v) {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// ── Leitura ───────────────────────────────────────────────────────────────────
console.log('\n📖 Lendo config/metas do Firestore...')
const snap = await db.collection('config').doc('metas').get()

if (!snap.exists) {
  console.error('❌ Documento config/metas não encontrado.')
  process.exit(1)
}

const raw      = snap.data()
const payload  = JSON.parse(raw.payload)
const tsOrig   = raw.ts

// ── Backup local ──────────────────────────────────────────────────────────────
const backupDir  = join(ROOT, 'backups')
mkdirSync(backupDir, { recursive: true })
const hoje       = new Date()
const stamp      = `${hoje.getFullYear()}${String(hoje.getMonth()+1).padStart(2,'0')}${String(hoje.getDate()).padStart(2,'0')}_${String(hoje.getHours()).padStart(2,'0')}${String(hoje.getMinutes()).padStart(2,'0')}`
const backupPath = join(backupDir, `config-metas-backup-${stamp}.json`)
writeFileSync(backupPath, JSON.stringify({ ts: tsOrig, payload }, null, 2), 'utf8')
console.log(`✅ Backup salvo em: backups/config-metas-backup-${stamp}.json`)

// ── Separação ─────────────────────────────────────────────────────────────────
const colaboradoresPorMes = {}
const metasPorMes         = {}

const meses = Object.keys(payload).sort()

const stats = {
  meses: meses.length,
  totalColabs: 0,
  comMetaPerCanal: 0,
  comMetaFlat: 0,
  semMeta: 0,
  zeradosPorMes: {},   // { '07/2026': N, '08/2026': N }
  camposExtras: [],
}

for (const mes of meses) {
  const mesData = payload[mes]
  if (!mesData || typeof mesData !== 'object') continue

  colaboradoresPorMes[mes] = {}
  metasPorMes[mes]         = {}

  for (const [nome, c] of Object.entries(mesData)) {
    if (!c || typeof c !== 'object') continue
    stats.totalColabs++

    // ── Parte cadastral ──────────────────────────────────────────────────────
    colaboradoresPorMes[mes][nome] = {
      colaborador:     c.colaborador     ?? nome,
      apelido:         c.apelido         ?? '',
      loja:            c.loja            ?? '',
      cargo:           c.cargo           ?? '',
      cargo_movimento: c.cargo_movimento ?? '',
      centro_custo:    c.centro_custo    ?? '',
      salario_base:    c.salario_base    ?? '',
      supervisor:      c.supervisor      ?? '',
      ativo:           c.ativo !== false,
      mes,
    }

    // ── Parte meta ───────────────────────────────────────────────────────────
    const temPerCanal = c.metas && typeof c.metas === 'object' && Object.keys(c.metas).length > 0
    const temFlat     = (toNum(c.mp) > 0 || toNum(c.mo) > 0 || toNum(c.mpo) > 0)

    if (MESES_ZERAR.has(mes)) {
      // Metas zeradas intencionalmente — serão definidas manualmente depois
      stats.zeradosPorMes[mes] = (stats.zeradosPorMes[mes] || 0) + 1
      metasPorMes[mes][nome] = { colaborador: c.colaborador ?? nome, mp: 0, mo: 0, mpo: 0, metas: {}, mes }
    } else {
      if (temPerCanal) stats.comMetaPerCanal++
      else if (temFlat) stats.comMetaFlat++
      else              stats.semMeta++

      metasPorMes[mes][nome] = {
        colaborador: c.colaborador ?? nome,
        mp:          toNum(c.mp),
        mo:          toNum(c.mo),
        mpo:         toNum(c.mpo),
        metas:       (temPerCanal ? c.metas : {}),
        mes,
      }
    }

    // ── Detectar campos desconhecidos (nem cadastral nem meta) ───────────────
    for (const campo of Object.keys(c)) {
      if (!CAMPOS_CADASTRAL.has(campo) && !CAMPOS_META.has(campo)) {
        const chave = `${campo} (em ${mes}/${nome})`
        if (!stats.camposExtras.includes(campo)) stats.camposExtras.push(campo)
      }
    }
  }
}

// ── Salvar resultado para inspeção mesmo em dry-run ───────────────────────────
const resultDir = join(ROOT, 'backups')
writeFileSync(join(resultDir, `config-colaboradores-novo-${stamp}.json`), JSON.stringify({ ts: Date.now(), payload: colaboradoresPorMes }, null, 2), 'utf8')
writeFileSync(join(resultDir, `config-metas-novo-${stamp}.json`),         JSON.stringify({ ts: Date.now(), payload: metasPorMes },         null, 2), 'utf8')
console.log(`📄 Prévia gravada em backups/ para inspeção antes de qualquer escrita no Firestore.`)

// ── Resumo ────────────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('RESUMO DA MIGRAÇÃO')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Meses encontrados  : ${stats.meses}  (${meses.join(' | ')})`)
console.log(`Total colaboradores: ${stats.totalColabs}`)
console.log(``)
console.log(`config/metas — meses preservados:`)
console.log(`  Com meta per-canal (novo formato) : ${stats.comMetaPerCanal}`)
console.log(`  Com meta flat mp/mo/mpo            : ${stats.comMetaFlat}`)
console.log(`  Sem nenhuma meta (zeros normais)   : ${stats.semMeta}`)
if (Object.keys(stats.zeradosPorMes).length > 0) {
  console.log(``)
  console.log(`config/metas — meses ZERADOS intencionalmente:`)
  for (const [m, n] of Object.entries(stats.zeradosPorMes)) {
    console.log(`  🟡 ${m}: ${n} colaboradores → mp=0  mo=0  mpo=0  metas={}`)
  }
}
if (stats.camposExtras.length > 0) {
  console.log(`\n⚠️  Campos fora do padrão detectados: ${stats.camposExtras.join(', ')}`)
} else {
  console.log('\n✅ Nenhum campo fora do padrão detectado.')
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// ── Verificação: todos os meses em ambas as saídas ────────────────────────────
const mesesColabs = Object.keys(colaboradoresPorMes).sort()
const mesesMetas  = Object.keys(metasPorMes).sort()
const ok = JSON.stringify(mesesColabs) === JSON.stringify(mesesMetas)
console.log(`\nCoerência meses: ${ok ? '✅ OK' : '❌ DIVERGÊNCIA — verifique antes de gravar'}`)

for (const mes of meses) {
  const nC = Object.keys(colaboradoresPorMes[mes] || {}).length
  const nM = Object.keys(metasPorMes[mes]         || {}).length
  const iguais = nC === nM ? '✅' : '⚠️ '
  console.log(`  ${iguais} ${mes}: ${nC} colaboradores | ${nM} registros de meta`)
}

// ── Gravação (só com --gravar) ────────────────────────────────────────────────
if (!GRAVAR) {
  console.log('\n🔍 DRY-RUN — nenhum dado foi gravado no Firestore.')
  console.log('   Para gravar: node scripts/migrar-docs.mjs --gravar\n')
  process.exit(0)
}

console.log('\n🚀 Gravando config/colaboradores no Firestore...')
await db.collection('config').doc('colaboradores').set({
  payload: JSON.stringify(colaboradoresPorMes),
  ts: Date.now(),
})
console.log('✅ config/colaboradores gravado.')

console.log('🚀 Gravando config/metas (novo formato) no Firestore...')
await db.collection('config').doc('metas').set({
  payload: JSON.stringify(metasPorMes),
  ts: Date.now(),
})
console.log('✅ config/metas (novo formato) gravado.')

console.log('\n✅ MIGRAÇÃO CONCLUÍDA.')
console.log('   O documento antigo NÃO foi apagado — backup disponível em backups/\n')
process.exit(0)
