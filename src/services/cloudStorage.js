import { ref, uploadString, getBytes, listAll, getMetadata, deleteObject } from 'firebase/storage'
import { hasAdminDataAccess, authorizedData } from './authorizedAccess.js'
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore'
import { storage, db } from '../firebase.js'
import { dtFromISO, mesAtualStr } from '../utils/datas.js'
import { mesDe, proximoMes, cmpMes, mesCalendarioAtual } from '../utils/mesCalendario.js'
import { dataMaximaMovimentacao } from './processamento/processarObsoleto.js'

const PASTA = { pecas: 'Pecas', oficina: 'Oficina' }

// Retorna o timestamp (ms) do arquivo do mês no Storage (formato padrão MM-YYYY).
export async function pegarTsStorage(tipo, mes) {
  const pasta = PASTA[tipo] || tipo
  const chave = mes.replace('/', '-') // MM/YYYY → MM-YYYY
  try {
    const meta = await getMetadata(ref(storage, `Dados/${pasta}/${chave}.json`))
    return new Date(meta.updated).getTime()
  } catch {
    return null
  }
}

export async function salvarDadosStorage(tipo, mes, rows) {
  const serialized = rows.map(r => ({
    ...r,
    dt: r.dt instanceof Date ? r.dt.toISOString() : r.dt,
  }))
  const pasta = PASTA[tipo] || tipo
  const chave = mes.replace('/', '-') // MM/YYYY → MM-YYYY
  await uploadString(
    ref(storage, `Dados/${pasta}/${chave}.json`),
    JSON.stringify(serialized),
    'raw',
    { contentType: 'application/json' },
  )
}

export async function carregarDadosStorage(tipo, mes) {
  const pasta = PASTA[tipo] || tipo
  const [mm, yyyy] = mes.split('/') // mes = 'MM/YYYY'
  const chave = `${mm}-${yyyy}`     // MM-YYYY (formato padrão)

  const paths = [
    `Dados/${pasta}/${chave}.json`,      // MM-YYYY — padrão
    `Dados/${pasta}/${yyyy}-${mm}.json`, // YYYY-MM — fallback para arquivos antigos
    `dados/${tipo}/${chave}.json`,       // path legado muito antigo
  ]

  for (const path_ of paths) {
    try {
      const storageRef = ref(storage, path_)
      const rows = await hasAdminDataAccess() ? JSON.parse(new TextDecoder().decode(await getBytes(storageRef, 15000000))) : await authorizedData({ kind: 'file', path: path_ })
      if (!rows) continue
      return rows.map(r => ({ ...r, dt: dtFromISO(r.dt) }))
    } catch {
      continue
    }
  }
  return null
}

export async function listarMesesStorage(tipo) {
  const pasta = PASTA[tipo] || tipo
  const resultados = new Set()

  try {
    const listRef = ref(storage, `Dados/${pasta}/`)
    const result  = await listAll(listRef)
    result.items.forEach(item => {
      const nome = item.name.replace('.json', '')
      // Formato canônico do sistema é "MM/YYYY" (igual a getMes) — evita conflito
      // de formato no índice mesesDisponiveis que duplicaria o mês no carregamento.
      if (/^\d{2}-\d{4}$/.test(nome)) {
        const [mm, yyyy] = nome.split('-')
        resultados.add(`${mm}/${yyyy}`)
      } else if (/^\d{4}-\d{2}$/.test(nome)) {
        const [yyyy, mm] = nome.split('-')
        resultados.add(`${mm}/${yyyy}`)
      }
    })
  } catch {}

  return [...resultados].sort()
}

// ── Estoque ───────────────────────────────────────────────────────────────────
//
// Modelo (Etapas 2-4): cada upload é identificado pela MAIOR data de movimentação
// (dtEntrada/dtSaida) dentro do próprio arquivo — nunca pelo nome do arquivo ou
// por uma data digitada manualmente. Substitui o esquema de um arquivo por dia
// (Dados/Estoque/{data}.json), que causou o incidente de junho/2026 (upload de
// julho sobrescreveu o fechamento por confiança no nome).
//
// Estado vive em config/estoqueControle (Firestore):
//   { mesAtual: 'MM/YYYY', arquivosAtuais: [{path,hash,maxData,uploadedAt}, ...≤3],
//     fechamentos: { 'MM/YYYY': {path,congeladoEm,origem} | {status:'sem_dado'} } }

// Hash raso (FNV-1a) sobre os campos intrínsecos — NÃO inclui status/dias*
// (derivados da data de hoje, mudam sozinhos mesmo sem dado novo). Só detecta
// reenvio idêntico, não é criptográfico.
// Limitação conhecida: sensível à ORDEM dos itens no array — dois arquivos com
// o mesmo conteúdo mas linhas em ordem diferente geram hashes diferentes (não
// detecta a duplicata nesse caso). Aceitável por ora: o CSV de origem preserva
// a mesma ordem entre exportações consecutivas do mesmo dia.
function hashConteudo(itens) {
  let h = 0x811c9dc5
  for (const it of itens) {
    const s = `${it.loja}|${it.codigo}|${it.saldo}|${it.custoTotal}|` +
      `${it.dtEntrada instanceof Date ? it.dtEntrada.toISOString() : ''}|` +
      `${it.dtSaida   instanceof Date ? it.dtSaida.toISOString()   : ''}`
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  }
  return (h >>> 0).toString(16)
}

function serializarItens(itens) {
  return itens.map(r => ({
    ...r,
    dtEntrada: r.dtEntrada instanceof Date ? r.dtEntrada.toISOString() : null,
    dtSaida:   r.dtSaida   instanceof Date ? r.dtSaida.toISOString()   : null,
  }))
}

async function baixarJSON(path) {
  try {
    const data = await hasAdminDataAccess() ? JSON.parse(new TextDecoder().decode(await getBytes(ref(storage, path), 15000000))) : await authorizedData({ kind: 'file', path })
    if (!data) return null
    return {
      ...data,
      itens: (data.itens || []).map(r => ({
        ...r,
        dtEntrada: r.dtEntrada ? new Date(r.dtEntrada) : null,
        dtSaida:   r.dtSaida   ? new Date(r.dtSaida)   : null,
      })),
    }
  } catch { return null }
}

async function baixarJSONBruto(path) {
  try {
    if (!await hasAdminDataAccess()) throw Error('A operação exige administrador.')
    return new TextDecoder().decode(await getBytes(ref(storage, path), 15000000))
  } catch { return null }
}

const CONTROLE_REF = () => doc(db, 'config', 'estoqueControle')
async function lerControle() {
  if (await hasAdminDataAccess()) return getDoc(CONTROLE_REF())
  const value = await authorizedData({ kind: 'config', key: 'estoqueControle' })
  return { exists: () => !!value, data: () => value }
}

/**
 * Fechamento por calendário (Fase 1): garante que o estado em Firestore está
 * em dia com a data real de hoje — se `mesAtual` guardado já é um mês
 * passado, congela esse(s) mês(es) usando o último upload que existir para
 * cada um, apaga os candidatos perdedores da janela rolante, e avança
 * `mesAtual` até o mês corrente de verdade. Chamada tanto na leitura
 * (carregarPosicaoMes/listarMesesEstoque) quanto no upload — fechar um mês
 * não depende mais de alguém subir o mês seguinte, só do calendário ter
 * passado. Idempotente: se já está em dia, não faz nada.
 */
async function garantirFechamentoEmDia(estadoLido) {
  if (!await hasAdminDataAccess()) return estadoLido
  const mesCal = mesCalendarioAtual()
  if (!estadoLido.mesAtual || cmpMes(estadoLido.mesAtual, mesCal) >= 0) return estadoLido

  // Passo 1 (fora de transação — envolve Storage): calcula o que fechar e
  // copia o conteúdo vencedor de cada mês atrasado pro lugar permanente.
  let fechamentos = { ...(estadoLido.fechamentos || {}) }
  let mesCursor = estadoLido.mesAtual
  let arquivosDoMes = estadoLido.arquivosAtuais || []
  const arquivosParaApagar = []

  while (cmpMes(mesCursor, mesCal) < 0) {
    const vencedor = arquivosDoMes[arquivosDoMes.length - 1]
    if (vencedor) {
      const conteudo = await baixarJSONBruto(vencedor.path)
      if (conteudo != null) {
        const pathFechamento = `Dados/Estoque/fechamentos/${mesCursor.replace('/', '-')}.json`
        await uploadString(ref(storage, pathFechamento), conteudo, 'raw', { contentType: 'application/json' })
        fechamentos[mesCursor] = {
          path: pathFechamento, congeladoEm: Date.now(), origem: 'automatico',
          dataUltimoDado: vencedor.maxData, uploadedAtUltimoDado: vencedor.uploadedAt,
        }
      }
      arquivosParaApagar.push(...arquivosDoMes)
    } else {
      fechamentos[mesCursor] = { status: 'sem_dado' }
    }
    arquivosDoMes = [] // só o primeiro mês do laço pode ter arquivos; os seguintes são lacuna
    mesCursor = proximoMes(mesCursor)
  }

  // Passo 2 (dentro de transação): só grava se ninguém mais já avançou o
  // estado enquanto fazíamos o passo 1 — evita corrida entre duas abas ou
  // o robô rodando ao mesmo tempo logo após virar o mês.
  const estadoFinal = await runTransaction(db, async (tx) => {
    const snap = await tx.get(CONTROLE_REF())
    const atual = snap.exists() ? snap.data() : estadoLido
    if (atual.mesAtual && cmpMes(atual.mesAtual, mesCal) >= 0) return atual // outra chamada já fechou
    const novo = { ...atual, mesAtual: mesCal, arquivosAtuais: [], fechamentos }
    tx.set(CONTROLE_REF(), novo, { merge: true })
    return novo
  })

  // Limpeza dos perdedores no Storage — fora da transação, best-effort. Só
  // roda se FOMOS NÓS quem de fato fechou (evita apagar arquivo que outra
  // chamada concorrente ainda possa estar usando).
  if (estadoFinal.mesAtual === mesCal) {
    for (const item of arquivosParaApagar) { try { await deleteObject(ref(storage, item.path)) } catch {} }
  }

  return estadoFinal
}

/**
 * Processa um upload de estoque: decide, pelo conteúdo, se é reenvio do mês
 * corrente (janela rolante) ou dado de outro mês (rejeitado — use
 * retroativo:true). Antes de decidir, garante que o estado está em dia com
 * o calendário — fechar o mês anterior não depende mais deste upload ser do
 * mês seguinte.
 */
export async function processarUploadEstoque(itensProcessados, resumo, { retroativo = false, posicaoEm = null, motivo = '' } = {}) {
  const maxData = dataMaximaMovimentacao(itensProcessados)
  if (!maxData) throw new Error('Não foi possível identificar nenhuma data de movimentação válida no arquivo.')

  // Retroativo: mês-destino vem da coluna "Posição em" do CSV — não da maior data de
  // movimentação, que pode ser futura ao fechamento (ex: última saída em agosto num
  // retroativo de maio). Normal: continua usando a maior data de movimentação.
  const dataParaMes = retroativo && posicaoEm ? posicaoEm : maxData
  const mesArquivo  = mesDe(dataParaMes)
  const hash = hashConteudo(itensProcessados)
  const payloadStr = JSON.stringify({
    dataUpload: new Date().toISOString(),
    dataMaximaMovimentacao: maxData.toISOString(),
    hash, resumo,
    itens: serializarItens(itensProcessados),
  })

  if (retroativo) {
    if (!motivo || !motivo.trim()) throw new Error('Upload retroativo exige um motivo da correção.')
    return aplicarRetroativo(mesArquivo, payloadStr, motivo.trim())
  }

  const snapInicial  = await lerControle()
  const estadoBruto  = snapInicial.exists() ? snapInicial.data() : { mesAtual: null, arquivosAtuais: [], fechamentos: {} }
  await garantirFechamentoEmDia(estadoBruto)

  const mesCal = mesCalendarioAtual()
  if (mesArquivo !== mesCal) {
    const cmp = cmpMes(mesArquivo, mesCal)
    return {
      status: 'rejeitado',
      mensagem: cmp < 0
        ? `Este arquivo tem movimentação até ${maxData.toLocaleDateString('pt-BR')} (mês ${mesArquivo}), mas o mês corrente já é ${mesCal}. Se isso é uma correção proposital de um mês passado, marque "Upload retroativo".`
        : `Este arquivo tem data de movimentação no futuro (${mesArquivo}) — verifique o arquivo antes de subir novamente.`,
    }
  }

  // Escrita aditiva primeiro — nome único (timestamp), nunca conflita.
  const path = `Dados/Estoque/atual/${Date.now()}.json`
  await uploadString(ref(storage, path), payloadStr, 'raw', { contentType: 'application/json' })
  const novoItem = { path, hash, maxData: maxData.toISOString(), uploadedAt: Date.now() }

  const decisao = await runTransaction(db, async (tx) => {
    const snap = await tx.get(CONTROLE_REF())
    const estado = snap.exists() ? snap.data() : { mesAtual: mesCal, arquivosAtuais: [], fechamentos: {} }
    const ultimoAtual = estado.arquivosAtuais?.[estado.arquivosAtuais.length - 1]

    // Compara só com o último da janela rolante, não com os 3 — se alguém
    // reenviar um arquivo idêntico ao penúltimo/antepenúltimo, não detecta
    // como duplicata (aceitável por ora: o caso comum é reenviar o mais recente).
    if (ultimoAtual?.hash === hash) return { status: 'duplicado' }

    const listaCompleta = [...(estado.arquivosAtuais || []), novoItem]
    const novaLista = listaCompleta.slice(-3)
    const removidos = listaCompleta.slice(0, Math.max(0, listaCompleta.length - 3))
    tx.set(CONTROLE_REF(), { ...estado, mesAtual: mesCal, arquivosAtuais: novaLista }, { merge: true })
    return { status: 'rolling', removidos }
  })

  if (decisao.status === 'duplicado') {
    // Seguro apagar: é o arquivo que ACABAMOS de subir agora, não dado histórico.
    try { await deleteObject(ref(storage, path)) } catch {}
    return { status: 'duplicado', mensagem: 'Conteúdo idêntico ao já registrado — nenhuma alteração feita.' }
  }

  for (const antigo of decisao.removidos) { try { await deleteObject(ref(storage, antigo.path)) } catch {} }
  return { status: 'rolling', mensagem: `Estoque de ${mesArquivo} atualizado.` }
}

/**
 * Correção retroativa: ação deliberada para substituir o fechamento de um
 * mês JÁ FECHADO pelo calendário. Exige motivo escrito e faz backup de
 * auditoria do fechamento anterior antes de sobrescrever.
 */
async function aplicarRetroativo(mesArquivo, payloadStr, motivo) {
  const mesCal = mesCalendarioAtual()
  if (cmpMes(mesArquivo, mesCal) >= 0) {
    return {
      status: 'rejeitado',
      mensagem: `Upload retroativo só corrige meses já fechados pelo calendário (antes de ${mesCal}). Este arquivo pertence a ${mesArquivo} — use o upload normal.`,
    }
  }

  const snap = await lerControle()
  const estado = snap.exists() ? snap.data() : { mesAtual: null, fechamentos: {} }

  const pathFechamento = `Dados/Estoque/fechamentos/${mesArquivo.replace('/', '-')}.json`
  const existente = estado.fechamentos?.[mesArquivo]

  if (existente?.path) {
    const conteudoAnterior = await baixarJSONBruto(existente.path)
    if (conteudoAnterior != null) {
      const pathBackup = `Dados/Estoque/fechamentos_historico/${mesArquivo.replace('/', '-')}__corrigido_em_${Date.now()}.json`
      await uploadString(ref(storage, pathBackup), conteudoAnterior, 'raw', { contentType: 'application/json' })
    }
  }

  await uploadString(ref(storage, pathFechamento), payloadStr, 'raw', { contentType: 'application/json' })
  const fechamentos = { ...(estado.fechamentos || {}), [mesArquivo]: { path: pathFechamento, congeladoEm: Date.now(), origem: 'retroativo', motivo } }
  await setDoc(CONTROLE_REF(), { ...estado, fechamentos }, { merge: true })

  return { status: 'retroativo', mensagem: `Fechamento de ${mesArquivo} corrigido retroativamente (backup do anterior preservado). Motivo: "${motivo}"` }
}

/** Posição de estoque de um mês — do fechamento congelado, ou do arquivo
 *  "atual" mais recente se for o mês em andamento. Garante o fechamento por
 *  calendário antes de responder, mesmo que ninguém tenha subido nada ainda. */
export async function carregarPosicaoMes(mesAno) {
  const snap = await lerControle()
  if (!snap.exists()) return null
  const estado = await garantirFechamentoEmDia(snap.data())

  if (mesAno === estado.mesAtual) {
    const lista = estado.arquivosAtuais || []
    const ultimo = lista[lista.length - 1]
    // Mês corrente sem NENHUM upload ainda (ex: virou o mês e ninguém subiu
    // estoque de verdade pra ele) — sem_dado, não null. "null" também
    // significa "esse mês não existe pro sistema"; misturar os dois casos
    // fazia a tela de Estoque travar no último mês carregado ao selecionar
    // o mês corrente vazio (carregarMes via de vazio, não atualizava nada).
    if (!ultimo) return { semDado: true, congelado: false, itens: [] }
    const data = await baixarJSON(ultimo.path)
    return data ? { ...data, congelado: false } : null
  }

  const fechamento = estado.fechamentos?.[mesAno]
  if (!fechamento) return null
  if (fechamento.status === 'sem_dado') return { semDado: true, congelado: true, itens: [] }
  const data = await baixarJSON(fechamento.path)
  return data ? {
    ...data, congelado: true,
    origem: fechamento.origem, motivo: fechamento.motivo,
    dataUltimoDado: fechamento.dataUltimoDado,
  } : null
}

/**
 * Status leve de um mês do Estoque — só metadados (Firestore), sem baixar o
 * array de itens do Storage. Usado pelo badge de "fechado com dados até X" —
 * seria desperdício baixar milhares de itens só pra mostrar uma data.
 */
export async function obterStatusEstoqueMes(mesAno) {
  const snap = await lerControle()
  if (!snap.exists()) return null
  const estado = await garantirFechamentoEmDia(snap.data())

  if (mesAno === estado.mesAtual) {
    const lista = estado.arquivosAtuais || []
    const ultimo = lista[lista.length - 1]
    if (!ultimo) return { congelado: false, semDado: true, dataUltimoDado: null }
    return { congelado: false, semDado: false, dataUltimoDado: ultimo.maxData, uploadedAt: ultimo.uploadedAt }
  }

  const fechamento = estado.fechamentos?.[mesAno]
  if (!fechamento) return null
  if (fechamento.status === 'sem_dado') return { congelado: true, semDado: true, dataUltimoDado: null }
  return {
    congelado: true, semDado: false,
    dataUltimoDado: fechamento.dataUltimoDado || null,
    origem: fechamento.origem, motivo: fechamento.motivo,
    congeladoEm: fechamento.congeladoEm,
  }
}

/** Lista os meses conhecidos pelo sistema novo, com status. Garante o
 *  fechamento por calendário antes de montar a lista. */
export async function listarMesesEstoque() {
  const snap = await lerControle()
  if (!snap.exists()) return []
  const estado = await garantirFechamentoEmDia(snap.data())
  const meses = new Set([...Object.keys(estado.fechamentos || {}), estado.mesAtual].filter(Boolean))
  return [...meses].sort(cmpMes).map(mesAno => ({
    mesAno,
    atual:   mesAno === estado.mesAtual,
    semDado: estado.fechamentos?.[mesAno]?.status === 'sem_dado',
  }))
}

// ── Estoque — LEGADO (um arquivo por dia) ───────────────────────────────────
// Só para a migração da Etapa 5 ler os arquivos diários já existentes.
// Não são mais chamadas pelo fluxo ativo depois dos arquivos 3 e 4 desta ronda.

export async function salvarEstoque(dataISO, itens, resumo) {
  const payload = { dataISO, resumo, itens }
  await uploadString(ref(storage, `Dados/Estoque/${dataISO}.json`), JSON.stringify(payload), 'raw', { contentType: 'application/json' })
}

export async function listarSnapshotsEstoque() {
  if (!await hasAdminDataAccess()) return authorizedData({ kind: 'stockIndex' })
  const resultados = new Set()
  try {
    const result = await listAll(ref(storage, 'Dados/Estoque/'))
    result.items.map(item => item.name.replace('.json', '')).forEach(d => resultados.add(d))
  } catch {}
  try {
    const result = await listAll(ref(storage, 'obsoleto/'))
    result.items.map(item => item.name.replace('.json', '')).forEach(d => resultados.add(d))
  } catch {}
  return [...resultados].sort().reverse()
}

export async function carregarEstoque(dataISO) {
  for (const path_ of [`Dados/Estoque/${dataISO}.json`, `obsoleto/${dataISO}.json`]) {
    const data = await baixarJSON(path_)
    if (data) return data
  }
  return null
}

// ── Regras de estoque ─────────────────────────────────────────────────────────

export async function carregarRegrasEstoque() {
  try {
    const snap = await getDoc(doc(db, 'configuracoes', 'regrasEstoque'))
    return snap.exists() ? snap.data() : null
  } catch { return null }
}

export async function salvarRegrasEstoque(regras) {
  await setDoc(doc(db, 'configuracoes', 'regrasEstoque'), regras)
}

// ── Última atualização ────────────────────────────────────────────────────────

export async function obterUltimasAtualizacoes() {
  const chave = mesAtualStr().replace('/', '-')
  async function tsArquivo(caminho) {
    try {
      const meta = await getMetadata(ref(storage, caminho))
      return meta.updated
    } catch { return null }
  }
  async function tsEstoqueAtual() {
    try {
      const snap = await lerControle()
      if (!snap.exists()) return null
      const lista = snap.data().arquivosAtuais || []
      const ultimo = lista[lista.length - 1]
      return ultimo ? new Date(ultimo.uploadedAt).toISOString() : null
    } catch { return null }
  }
  const [pecas, oficina, estoque] = await Promise.all([
    tsArquivo(`Dados/Pecas/${chave}.json`),
    tsArquivo(`Dados/Oficina/${chave}.json`),
    tsEstoqueAtual(),
  ])
  return { pecas, oficina, estoque }
}
