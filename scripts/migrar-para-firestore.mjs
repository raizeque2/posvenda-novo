/**
 * SCRIPT DE MIGRAÇÃO — rode UMA VEZ no terminal
 *
 * Usa a chave de serviço (serviceAccountKey.json) para ter
 * permissão total de escrita no Firestore, sem precisar de login.
 *
 * Como rodar:
 *   1. Certifique-se que o arquivo serviceAccountKey.json está
 *      na mesma pasta que o package.json
 *   2. No terminal, dentro dessa pasta, rode:
 *        node scripts/migrar-para-firestore.mjs
 *   3. Aguarde: "✅ Migração concluída!"
 *   4. Pronto — não precisa rodar de novo.
 *
 * ⚠️  ATENÇÃO: se os dados já existirem no Firestore o script
 *      se recusa a sobrescrever. Use --force APENAS se tiver
 *      certeza que quer substituir tudo:
 *        node scripts/migrar-para-firestore.mjs --force
 */

import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Dados importados diretamente dos arquivos-fonte do app.
// Dessa forma o script e o app sempre usam os mesmos dados — sem cópias duplicadas.
import { METAS_POR_MES } from '../src/data/metas.js'
import {
  REGRA_PECAS,
  REGRA_OFICINA,
  LOJAS,
  COMISSAO_OPERACIONAL,
  COMISSAO_GESTAO,
} from '../src/data/regras.js'

// ── Inicializa o Firebase Admin ───────────────────────────────────────────────
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
} catch {
  console.error('❌ Arquivo serviceAccountKey.json não encontrado.')
  console.error('   Certifique-se que ele está na pasta raiz do projeto (ao lado do package.json).')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const FORCE = process.argv.includes('--force')

// ── Migração ──────────────────────────────────────────────────────────────────
async function migrar() {
  console.log('🚀 Iniciando migração para o Firestore...\n')

  // Checagem de segurança: se já há dados e não veio --force, aborta
  if (!FORCE) {
    const snap = await db.collection('config').doc('metas').get()
    if (snap.exists) {
      console.error('⛔ Dados já existem no Firestore.')
      console.error('')
      console.error('   Este script já foi executado anteriormente.')
      console.error('   Rodar novamente SOBRESCREVERIA todos os dados que você')
      console.error('   configurou no app (colaboradores, metas por mês, etc.).')
      console.error('')
      console.error('   Se tiver certeza que quer substituir tudo, rode com:')
      console.error('     node scripts/migrar-para-firestore.mjs --force')
      console.error('')
      console.error('   Na dúvida, NÃO use --force. Seus dados estão seguros.')
      process.exit(1)
    }
  } else {
    console.log('  ⚠️  Modo --force ativado. Os dados existentes serão substituídos.\n')
  }

  async function salvar(chave, dados) {
    await db.collection('config').doc(chave).set({
      payload: JSON.stringify(dados),
      ts: Date.now(),
    })
  }

  process.stdout.write('  📋 Subindo metas... ')
  await salvar('metas', METAS_POR_MES)
  console.log('✅')

  process.stdout.write('  🔧 Subindo regras de peças... ')
  await salvar('regra_pecas', REGRA_PECAS)
  console.log('✅')

  process.stdout.write('  🔧 Subindo regras de oficina... ')
  await salvar('regra_oficina', REGRA_OFICINA)
  console.log('✅')

  process.stdout.write('  🏪 Subindo lojas... ')
  await salvar('lojas', LOJAS)
  console.log('✅')

  process.stdout.write('  💰 Subindo comissão operacional... ')
  await salvar('comissao_operacional', COMISSAO_OPERACIONAL)
  console.log('✅')

  process.stdout.write('  💰 Subindo comissão gestão... ')
  await salvar('comissao_gestao', COMISSAO_GESTAO)
  console.log('✅')

  console.log('\n✅ Migração concluída! Todos os dados estão no Firestore.')
  console.log('   Pode fechar este terminal.')
  process.exit(0)
}

migrar().catch(e => {
  console.error('\n❌ Erro durante a migração:', e.message)
  process.exit(1)
})
