// Migra config/bonificacoes + config/bonAudit (blob único) para a coleção
// "bonificacoes" (um documento por pessoa+mês).
//
// SEMPRE roda em modo simulação por padrão — só mostra o que faria, não grava
// nada. Só grava de verdade com a flag --commit, e mesmo assim faz backup dos
// blobs originais ANTES de tocar em qualquer coisa.
//
// Uso:
//   node scripts/migrar-bonificacoes.cjs             (simula, não grava nada)
//   node scripts/migrar-bonificacoes.cjs --commit     (faz backup e grava de verdade)
const admin = require('firebase-admin')
const path = require('path')

const COMMIT = process.argv.includes('--commit')

const sa = require(path.join(__dirname, '..', 'serviceAccountKey.json'))
admin.initializeApp({ credential: admin.credential.cert(sa) })
const db = admin.firestore()

function bonDocId(chave) {
  return chave.replace(/\|\|/g, '__').replace(/\//g, '-')
}

async function main() {
  const [snapBonif, snapAudit] = await Promise.all([
    db.collection('config').doc('bonificacoes').get(),
    db.collection('config').doc('bonAudit').get(),
  ])
  if (!snapBonif.exists && !snapAudit.exists) {
    console.log('Nada pra migrar — config/bonificacoes e config/bonAudit não existem.')
    return
  }
  const bonificacoes = snapBonif.exists ? JSON.parse(snapBonif.data().payload) : {}
  const bonAudit     = snapAudit.exists ? JSON.parse(snapAudit.data().payload) : {}

  const todasChaves = new Set([...Object.keys(bonificacoes), ...Object.keys(bonAudit)])
  const docs = []
  for (const chave of todasChaves) {
    const sep = chave.lastIndexOf('||')
    if (sep === -1) { console.warn('Chave sem "||", pulando:', chave); continue }
    const nome = chave.slice(0, sep)
    const mes  = chave.slice(sep + 2)
    const audit = bonAudit[chave] || {}
    docs.push({
      id: bonDocId(chave),
      data: {
        nome, mes,
        valor: bonificacoes[chave] ?? 0,
        por: audit.por || '', em: audit.em || 0, obs: audit.obs || '',
        historico: audit.historico || [],
      },
    })
  }

  console.log(`Encontradas ${todasChaves.size} chaves. ${docs.length} documentos serão criados.`)
  console.log('Amostra (5 primeiras):')
  docs.slice(0, 5).forEach(d => console.log(`  ${d.id} ←`, JSON.stringify(d.data)))

  if (!COMMIT) {
    console.log('\n[SIMULAÇÃO] Nada foi gravado. Rode com --commit para migrar de verdade.')
    return
  }

  // 1) Backup dos blobs originais, com timestamp — nunca sobrescreve um
  //    backup anterior, e nunca mexe no dado migrado antes de confirmar que
  //    o backup foi gravado.
  const agora = Date.now()
  await db.collection('config').doc(`bonificacoes_backup_${agora}`).set(snapBonif.exists ? snapBonif.data() : {})
  await db.collection('config').doc(`bonAudit_backup_${agora}`).set(snapAudit.exists ? snapAudit.data() : {})
  console.log(`Backup gravado em config/bonificacoes_backup_${agora} e config/bonAudit_backup_${agora}.`)

  // 2) Grava a coleção nova em lotes de 400 (limite do Firestore é 500 por batch).
  const LOTE = 400
  for (let i = 0; i < docs.length; i += LOTE) {
    const batch = db.batch()
    for (const d of docs.slice(i, i + LOTE)) {
      batch.set(db.collection('bonificacoes').doc(d.id), d.data)
    }
    await batch.commit()
    console.log(`Gravados ${Math.min(i + LOTE, docs.length)}/${docs.length}...`)
  }

  // 3) Verifica: conta quantos documentos existem agora na coleção nova.
  const confSnap = await db.collection('bonificacoes').get()
  console.log(`\nVerificação: ${confSnap.size} documentos na coleção "bonificacoes" (esperado: ${docs.length}).`)
  if (confSnap.size !== docs.length) {
    console.error('⚠️  A contagem não bate — CONFIRA antes de remover o blob antigo ou liberar em produção.')
    process.exitCode = 1
  } else {
    console.log('✓ Contagem bate. Migração concluída.')
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
