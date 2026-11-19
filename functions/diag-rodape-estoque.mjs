/**
 * diag-rodape-estoque.mjs — SOMENTE LEITURA. Não grava nada.
 *
 * Investiga por que o rodapé mostrou "atualizado hoje" em Estoque sem upload real.
 * Reproduz obterUltimasAtualizacoes/tsEstoqueMaisRecente (cloudStorage.js) e compara
 * com a metadata REAL de todos os arquivos em Dados/Estoque/.
 *
 * Rodar a partir de functions/:
 *   node diag-rodape-estoque.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))

const BUCKET = 'posvenda-bi.firebasestorage.app'

if (!getApps().length) initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET })
const bucket = getStorage().bucket(BUCKET)

async function main() {
  console.log(`\n${'═'.repeat(74)}`)
  console.log(`  DIAGNÓSTICO — Rodapé "Estoque atualizado" (Etapa 1)  [leitura]`)
  console.log(`${'═'.repeat(74)}`)

  const [files] = await bucket.getFiles({ prefix: 'Dados/Estoque/' })

  console.log(`\n  Total de objetos em Dados/Estoque/: ${files.length}`)

  // Lista TODOS os nomes — inclusive qualquer coisa que não siga o padrão YYYY-MM-DD.json
  const registros = files.map(f => {
    const nome = f.name.replace('Dados/Estoque/', '')
    const meta = f.metadata
    return {
      nome,
      padraoData: /^\d{4}-\d{2}-\d{2}\.json$/.test(nome),
      updated: meta.updated ? new Date(meta.updated) : null,
      timeCreated: meta.timeCreated ? new Date(meta.timeCreated) : null,
      size: meta.size,
    }
  })

  // Arquivos fora do padrão esperado
  const foraDoPadrao = registros.filter(r => !r.padraoData)
  console.log(`\n[1] Arquivos que NÃO seguem o padrão YYYY-MM-DD.json: ${foraDoPadrao.length}`)
  for (const r of foraDoPadrao) {
    console.log(`    "${r.nome}"   updated=${r.updated?.toLocaleString('pt-BR') || '—'}   criado=${r.timeCreated?.toLocaleString('pt-BR') || '—'}   ${r.size} bytes`)
  }

  // ── Reproduz EXATAMENTE a lógica atual de tsEstoqueMaisRecente ──────────────
  // sort por nome (string) descendente, pega o primeiro
  const porNomeDesc = [...registros].sort((a, b) => b.nome.localeCompare(a.nome))
  const escolhidoPeloCodigo = porNomeDesc[0]

  console.log(`\n[2] O que o código ATUAL escolhe (maior nome, ordem alfabética):`)
  console.log(`    "${escolhidoPeloCodigo.nome}"`)
  console.log(`    updated (o que o rodapé mostra) = ${escolhidoPeloCodigo.updated?.toLocaleString('pt-BR') || '—'}`)

  // ── O que é REALMENTE o mais recente por timestamp real ─────────────────────
  const porUpdatedDesc = [...registros].filter(r => r.updated).sort((a, b) => b.updated - a.updated)
  const maisRecenteReal = porUpdatedDesc[0]

  console.log(`\n[3] O que é REALMENTE o arquivo modificado mais recentemente (por metadata.updated):`)
  console.log(`    "${maisRecenteReal.nome}"`)
  console.log(`    updated = ${maisRecenteReal.updated.toLocaleString('pt-BR')}`)

  const divergem = escolhidoPeloCodigo.nome !== maisRecenteReal.nome
  console.log(`\n[4] O arquivo escolhido pelo código é o mesmo que foi realmente modificado por último?`)
  console.log(`    ${divergem ? 'NÃO — DIVERGE' : 'SIM — coincidem'}`)

  // Top 10 por data de modificação real, para visão geral
  console.log(`\n[5] Top 10 arquivos por modificação REAL mais recente:`)
  for (const r of porUpdatedDesc.slice(0, 10)) {
    console.log(`    ${r.updated.toLocaleString('pt-BR').padEnd(20)}  "${r.nome}"`)
  }

  // Compara "hoje" com o que o rodapé mostraria
  const hoje = new Date()
  const diffHorasEscolhido = escolhidoPeloCodigo.updated ? (hoje - escolhidoPeloCodigo.updated) / 3600000 : null
  console.log(`\n[6] Agora: ${hoje.toLocaleString('pt-BR')}`)
  console.log(`    Diferença entre agora e o "updated" do arquivo escolhido pelo código: ${diffHorasEscolhido != null ? diffHorasEscolhido.toFixed(1) + 'h' : '—'}`)
  if (diffHorasEscolhido != null && diffHorasEscolhido < 24) {
    console.log(`    → Isso é "hoje" no rodapé (menos de 24h) — mesmo que não tenha sido um upload real de estoque de hoje.`)
  }

  console.log(`\n${'═'.repeat(74)}`)
  console.log(`  Nada foi gravado.`)
  console.log(`${'═'.repeat(74)}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
