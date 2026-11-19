import { doc, setDoc, getDoc, getDocs, collection, query, where, writeBatch, onSnapshot, runTransaction } from 'firebase/firestore'
import { db } from '../firebase.js'
import { hasAdminDataAccess, authorizedData } from './authorizedAccess.js'

// Versão (ts) de cada config na última leitura/gravação deste navegador. Os configs são um
// documento inteiro (ex.: todas as metas): sem essa checagem, duas pessoas salvando quase ao
// mesmo tempo faziam a última apagar em silêncio o que a outra tinha acabado de gravar.
const versaoConfig = new Map()
// Gravações feitas pelo servidor (função gestaoEquipe) já chegam aplicadas no estado local.
export const marcarVersaoConfig = (chave, ts) => { if (versaoConfig.has(chave)) versaoConfig.set(chave, ts) }
export class ConflitoConfigError extends Error {
  constructor(chave) { super(`Outra pessoa salvou "${chave}" enquanto você editava. Recarregue a página para ver as mudanças dela e refaça a sua.`); this.code = 'conflito'; this.chave = chave }
}

export async function salvarConfig(chave, dados) {
  try {
    const ref = doc(db, 'config', chave), ts = Date.now()
    await runTransaction(db, async tx => {
      const atual = await tx.get(ref)
      const vista = versaoConfig.get(chave)
      if (atual.exists() && vista != null && atual.data().ts !== vista) throw new ConflitoConfigError(chave)
      tx.set(ref, { payload: JSON.stringify(dados), ts })
    })
    versaoConfig.set(chave, ts)
  } catch (e) {
    console.error('Erro ao salvar no Firestore:', chave, e)
    throw e // Propaga o erro para o salvarConfigSeguro do store tratar
  }
}

// ── Bônus manual — documento por pessoa+mês (migrado de blob único em 02/09/2026) ──
// Coleção "bonificacoes", 1 documento por combinação nome+mês. Cada gravação toca
// só o documento da pessoa editada — nunca disputa com quem edita outra pessoa ao
// mesmo tempo, e não tem mais o teto de 1MB de um blob único crescendo pra sempre.
const BON_COL = 'bonificacoes'

// "NOME||MM/AAAA" → "NOME__MM-AAAA" — Firestore não aceita "/" em ID de documento.
function bonDocId(chave) {
  return chave.replace(/\|\|/g, '__').replace(/\//g, '-')
}

// Reconstrói o formato que o resto do app já espera — { chave: valor } e
// { chave: {por,em,obs,historico} } — a partir dos documentos individuais.
// Mantém TODOS os componentes que já consomem bonificacoes/bonAudit (buildRanking,
// useDesempenho, useEquipes, useDashboard, histórico de Comissões) sem precisar
// mudar nada neles: só a camada de carregamento mudou.
function reconstituirMapas(docsData) {
  const bonificacoes = {}
  const bonAudit = {}
  for (const d of docsData) {
    const chave = `${d.nome}||${d.mes}`
    bonificacoes[chave] = d.valor || 0
    bonAudit[chave] = { por: d.por || '', em: d.em || 0, obs: d.obs || '', historico: d.historico || [] }
  }
  return { bonificacoes, bonAudit }
}

// Carrega TODO o histórico de bônus (todos os meses) — usado uma vez no boot
// do app (carregarDadosCloud), porque o histórico de Comissões precisa somar
// todos os meses de uma vez. Na escala atual (algumas centenas de lançamentos
// acumulados) isso é barato; se um dia crescer para milhares de documentos,
// vale paginar por mês em vez de carregar tudo de uma vez.
export async function carregarBonificacoes() {
  try {
    if (!await hasAdminDataAccess()) return reconstituirMapas(await authorizedData({ kind: 'bonuses' }))
    const snap = await comTimeout(getDocs(collection(db, BON_COL)), FIRESTORE_TIMEOUT_MS)
    return reconstituirMapas(snap.docs.map(d => d.data()))
  } catch (e) {
    console.error('Erro ao carregar bonificações:', e)
    return { bonificacoes: {}, bonAudit: {} }
  }
}

/**
 * Grava um lote de bônus (1 ou várias pessoas de uma vez) com um `writeBatch`
 * — atômico (tudo ou nada), mas cada gravação é o documento de UMA pessoa, não
 * um blob compartilhado. Duas pessoas salvando colaboradores diferentes NUNCA
 * disputam nada, não importa quantas estejam salvando ao mesmo tempo.
 *
 * O histórico (valor anterior) exige saber o valor atual — por isso há uma
 * leitura antes da escrita (em paralelo, uma por chave, fora de transação).
 * Isso não contende com ninguém: só fica desatualizado no caso raríssimo de
 * DUAS pessoas editando a MESMA pessoa no MESMO mês no mesmíssimo instante —
 * cenário coberto pelo aviso em tempo real na tela (ver escutarBonificacoesMes),
 * que avisa quem está editando se o valor mudou por baixo enquanto isso.
 */
export async function salvarBonificacoesLote(alteracoes, usuario) {
  const refs = alteracoes.map(({ nome, mes }) => doc(db, BON_COL, bonDocId(`${nome}||${mes}`)))
  const snaps = await Promise.all(refs.map(ref => getDoc(ref)))

  const batch = writeBatch(db)
  const gravados = []
  alteracoes.forEach(({ nome, mes, valor, obs }, i) => {
    const atual = snaps[i].exists() ? snaps[i].data() : null
    const historico = atual
      ? [...(atual.historico || []), { valor: atual.valor ?? 0, por: atual.por, em: atual.em, obs: atual.obs }]
      : []
    const novo = { nome, mes, valor: Number(valor) || 0, por: usuario || '', em: Date.now(), obs: obs || '', historico }
    batch.set(refs[i], novo)
    gravados.push(novo)
  })

  try {
    await batch.commit()
  } catch (e) {
    console.error('Erro ao gravar bônus em lote:', alteracoes.map(a => `${a.nome}||${a.mes}`), e)
    throw e
  }
  return reconstituirMapas(gravados)
}

// Escuta em tempo real só as entradas do MÊS ativo (não a coleção inteira —
// meses fechados não estão sendo editados ao vivo, escutar todos pagaria
// leitura à toa). onMudanca recebe o mapa inteiro do mês (pra mesclar no
// estado global) + só as MUDANÇAS deste evento específico ({chave, por} — pra
// dar pra avisar quem tem rascunho aberto só das pessoas realmente afetadas
// E excluir a própria pessoa que acabou de salvar, não todo mundo que já
// existia no mês nem o autor da própria mudança). Retorna a função de
// unsubscribe; quem chama cancela ao desmontar/trocar de mês (Comissoes.jsx).
export function escutarBonificacoesMes(mes, onMudanca) {
  let closed = false, unsubscribe
  hasAdminDataAccess().then(admin => {
    if (closed) return
    if (!admin) { authorizedData({ kind: 'bonuses' }).then(rows => { if (!closed) onMudanca({ ...reconstituirMapas(rows.filter(row => row.mes === mes)), alteracoes: [] }) }).catch(() => {}); return }
    unsubscribe = subscribeBonuses(mes, onMudanca)
  }).catch(() => {})
  return () => { closed = true; unsubscribe?.() }
}
function subscribeBonuses(mes, onMudanca) {
  const q = query(collection(db, BON_COL), where('mes', '==', mes))
  return onSnapshot(q, snap => {
    const alteracoes = snap.docChanges()
      .filter(c => c.type === 'added' || c.type === 'modified')
      .map(c => ({ chave: `${c.doc.data().nome}||${c.doc.data().mes}`, por: c.doc.data().por || '' }))
    onMudanca({ ...reconstituirMapas(snap.docs.map(d => d.data())), alteracoes })
  }, e => console.error('Erro ao escutar bonificações do mês:', mes, e))
}

const FIRESTORE_TIMEOUT_MS = 10000

function comTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('firestore-timeout')), ms)),
  ])
}

export async function carregarConfig(chave) {
  if (!await hasAdminDataAccess()) {
    if (!['colaboradores', 'metas', 'regras', 'lojas', 'regra_pecas', 'regra_oficina', 'comissao_operacional', 'comissao_gestao', 'permissoes', 'estoqueControle', 'gestaoManual', 'ihs_mapeamento','regrasOS','atacadoConfig'].includes(chave)) return null
    // An unavailable gateway must show a cloud error, not an apparently empty business.
    return authorizedData({ kind: 'config', key: chave })
  }
  try {
    const snap = await comTimeout(getDoc(doc(db, 'config', chave)), FIRESTORE_TIMEOUT_MS)
    if (snap.exists()) versaoConfig.set(chave, snap.data().ts ?? null)
    return snap.exists() ? JSON.parse(snap.data().payload) : null
  } catch { return null }
}

export async function salvarSnapshot(chave, dados) {
  try {
    await setDoc(doc(db, 'snapshots', chave), { payload: JSON.stringify(dados), ts: Date.now() })
  } catch (e) {
    console.error('Erro ao salvar snapshot:', chave, e)
    throw e
  }
}

export async function carregarSnapshot(chave) {
  const snap = await comTimeout(getDoc(doc(db, 'snapshots', chave)), FIRESTORE_TIMEOUT_MS)
  if (snap.exists()) return JSON.parse(snap.data().payload)
  return null
}

/**
 * Carrega as configurações estáticas que foram migradas do código para o Firestore.
 * Retorna os dados ou null se ainda não existirem (app usa o fallback dos arquivos JS).
 */
export async function carregarConfiguracoes() {
  const [regra_pecas, regra_oficina, lojas, comissao_operacional, comissao_gestao] =
    await Promise.all([
      carregarConfig('regra_pecas'),
      carregarConfig('regra_oficina'),
      carregarConfig('lojas'),
      carregarConfig('comissao_operacional'),
      carregarConfig('comissao_gestao'),
    ])

  return { regra_pecas, regra_oficina, lojas, comissao_operacional, comissao_gestao }
}

export async function carregarMesesDisponiveis() {
  try {
    const snap = await comTimeout(getDoc(doc(db, 'config', 'mesesDisponiveis')), FIRESTORE_TIMEOUT_MS)
    if (snap.exists()) {
      const d = snap.data()
      if ((d.pecas?.length || 0) + (d.oficina?.length || 0) > 0) return d
    }
    return null
  } catch { return null }
}

export async function registrarMesesDisponiveis(tipo, mesesNovos) {
  try {
    const atual = await carregarMesesDisponiveis() || { pecas: [], oficina: [] }
    const lista = [...new Set([...(atual[tipo] || []), ...mesesNovos])].sort()
    // Registra o instante da alteração de cada mês enviado. Outros dispositivos
    // comparam esse timestamp com o cache local e rebaixam SÓ os meses alterados.
    const alteracoes = { ...(atual.alteracoes || {}) }
    const agora = Date.now()
    mesesNovos.forEach(m => { alteracoes[m] = agora })
    await setDoc(doc(db, 'config', 'mesesDisponiveis'), { ...atual, [tipo]: lista, alteracoes })
  } catch {}
}

export async function limparMesesDisponiveis() {
  try {
    await setDoc(doc(db, 'config', 'mesesDisponiveis'), { pecas: [], oficina: [] })
  } catch {}
}

// ── Controle de versão (02/09/2026) ────────────────────────────────────────────
// A cada deploy, scripts/pos-deploy.cjs grava o timestamp do build em
// config/appVersion. O app já rodando compara com o próprio __BUILD_TS__
// (embutido no bundle em tempo de build, ver vite.config.js) e avisa — sem
// forçar reload — se detectar que existe uma versão mais nova no ar. Isso é o
// que substitui "pedir pra dar F5" manualmente quando alguém fica com uma aba
// aberta desde antes de um deploy.
export async function verificarVersaoServidor() {
  try {
    const snap = await comTimeout(getDoc(doc(db, 'config', 'appVersion')), FIRESTORE_TIMEOUT_MS)
    return snap.exists() ? (snap.data().ts || null) : null
  } catch {
    return null
  }
}
