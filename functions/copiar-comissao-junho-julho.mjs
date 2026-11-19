/**
 * copiar-comissao-junho-julho.mjs
 *
 * Copia percentuais de comissão operacional de 06/2026 para 07/2026,
 * apenas nos campos zerados ou ausentes em julho.
 *
 * Rodar a partir de functions/:
 *   node copiar-comissao-junho-julho.mjs            ← preview (não altera nada)
 *   node copiar-comissao-junho-julho.mjs --aplicar  ← aplica após ver o preview
 *
 * Credenciais: usa GOOGLE_APPLICATION_CREDENTIALS ou Application Default Credentials.
 * Se necessário: gcloud auth application-default login
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))

const JUNHO = '06/2026'
const JULHO = '07/2026'
const CAMPOS = ['cp', 'cpo', 'cmo']
const UFS_ALVO = ['PE', 'AL']

if (!getApps().length) initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

function pct(v) {
  return v != null ? (v * 100).toFixed(2) + '%' : '—'
}

async function main() {
  const aplicar      = process.argv.includes('--aplicar')
  const diagnostico  = process.argv.includes('--diagnostico')

  // 1. Ler documento
  const snap = await db.collection('config').doc('regras').get()
  if (!snap.exists) {
    console.error('Documento config/regras não encontrado.')
    process.exit(1)
  }

  const regras = JSON.parse(snap.data().payload || '{}')
  const junhoComissao = regras[JUNHO]?.comissao || []
  const julhoComissao = regras[JULHO]?.comissao || []

  if (!junhoComissao.length) {
    console.error(`Nenhuma entrada de comissão em ${JUNHO}.`)
    process.exit(1)
  }
  if (!regras[JULHO]) {
    console.error(`Mês ${JULHO} não existe em config/regras. Crie-o primeiro na UI.`)
    process.exit(1)
  }

  // MODO DIAGNÓSTICO — imprime os dois arrays e sai
  if (diagnostico) {
    const fmt = (arr, label) => {
      console.log(`\n=== ${label} (${arr.length} entradas) ===`)
      for (const e of arr) {
        console.log(`  [${e.uf}] ${e.cargo.padEnd(40)} cp=${pct(e.cp)}  cpo=${pct(e.cpo)}  cmo=${pct(e.cmo)}`)
      }
    }
    fmt(junhoComissao, `JUNHO ${JUNHO}`)
    fmt(julhoComissao, `JULHO ${JULHO}`)
    const soJunho = junhoComissao.filter(jn => !julhoComissao.find(jl => jl.uf === jn.uf && jl.cargo === jn.cargo))
    const soJulho = julhoComissao.filter(jl => !junhoComissao.find(jn => jn.uf === jl.uf && jn.cargo === jl.cargo))
    if (soJunho.length) {
      console.log(`\n=== Só em JUNHO (sem par em julho) ===`)
      for (const e of soJunho) console.log(`  [${e.uf}] ${e.cargo}`)
    }
    if (soJulho.length) {
      console.log(`\n=== Só em JULHO (sem par em junho) ===`)
      for (const e of soJulho) console.log(`  [${e.uf}] ${e.cargo}`)
    }
    return
  }

  // 2. Calcular mudanças
  const mudancas = []
  const sem_par = []

  for (const jn of junhoComissao) {
    if (!UFS_ALVO.includes(jn.uf)) continue
    const jl = julhoComissao.find(e => e.uf === jn.uf && e.cargo === jn.cargo)
    if (!jl) {
      sem_par.push(jn)
      continue
    }
    const campos_zerados = CAMPOS.filter(c => !jl[c] || jl[c] === 0)
    if (!campos_zerados.length) continue
    mudancas.push({ uf: jn.uf, cargo: jn.cargo, campos: campos_zerados, junhoEntry: jn, julhoEntry: jl })
  }

  // 3. Exibir preview
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  PREVIEW — Comissão Operacional: ${JUNHO} → ${JULHO}`)
  console.log(`${'─'.repeat(60)}`)

  // 3a. Campos zerados a atualizar (cargos que já existem em julho)
  const porUF = UFS_ALVO.reduce((acc, uf) => ({ ...acc, [uf]: [] }), {})
  for (const m of mudancas) porUF[m.uf].push(m)

  console.log(`\n  ── Atualizar campos zerados (cargos que já existem em julho) ──`)
  for (const uf of UFS_ALVO) {
    const lista = porUF[uf]
    console.log(`\n  ${uf}: ${lista.length} cargo(s) a atualizar`)
    if (!lista.length) {
      console.log('    (todos os campos já preenchidos)')
      continue
    }
    for (const m of lista) {
      console.log(`    ${m.cargo}`)
      for (const c of m.campos) {
        console.log(`      ${c.padEnd(5)} : julho=${pct(m.julhoEntry[c])}  ←  junho=${pct(m.junhoEntry[c])}`)
      }
    }
  }

  // 3b. Entradas inteiras a criar (cargos que só existem em junho)
  const sem_par_alvo = sem_par // já filtrado por UFS_ALVO no laço acima
  console.log(`\n  ── Criar entradas novas em julho (copiadas de junho) ──`)
  if (!sem_par_alvo.length) {
    console.log('\n    (nenhum cargo novo a criar)')
  } else {
    const porUFNovo = UFS_ALVO.reduce((acc, uf) => ({ ...acc, [uf]: [] }), {})
    for (const e of sem_par_alvo) porUFNovo[e.uf]?.push(e)
    for (const uf of UFS_ALVO) {
      const lista = porUFNovo[uf]
      if (!lista.length) continue
      console.log(`\n  ${uf}: ${lista.length} cargo(s) a criar`)
      for (const e of lista) {
        console.log(`    + ${e.cargo.padEnd(42)} cp=${pct(e.cp)}  cpo=${pct(e.cpo)}  cmo=${pct(e.cmo)}`)
      }
    }
  }

  const totalAtualizacoes = mudancas.length
  const totalCriacoes     = sem_par_alvo.length
  const totalGeral        = totalAtualizacoes + totalCriacoes

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  Atualizações de campos : ${totalAtualizacoes}`)
  console.log(`  Entradas novas         : ${totalCriacoes}`)
  console.log(`  Total de operações     : ${totalGeral}`)
  console.log(`${'─'.repeat(60)}`)

  if (!totalGeral) {
    console.log('\n  Nada a fazer.')
    return
  }

  if (!aplicar) {
    console.log('\n  → Nenhuma alteração feita (modo preview).')
    console.log('  → Para aplicar, rode com:  node copiar-comissao-junho-julho.mjs --aplicar\n')
    return
  }

  // 4. Aplicar mudanças
  // 4a. Atualizar campos zerados em cargos existentes
  for (const m of mudancas) {
    const idx = regras[JULHO].comissao.findIndex(e => e.uf === m.uf && e.cargo === m.cargo)
    if (idx < 0) continue
    for (const c of m.campos) {
      regras[JULHO].comissao[idx][c] = m.junhoEntry[c]
    }
  }

  // 4b. Criar entradas inteiras copiadas de junho
  for (const e of sem_par_alvo) {
    regras[JULHO].comissao.push({ uf: e.uf, cargo: e.cargo, cp: e.cp, cpo: e.cpo, cmo: e.cmo })
  }

  await db.collection('config').doc('regras').set({
    payload: JSON.stringify(regras),
    ts: Date.now(),
  })

  console.log(`\n  ✓ ${totalAtualizacoes} campo(s) atualizados, ${totalCriacoes} entrada(s) criadas — salvo em config/regras.\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
