import { parseDateBR } from '../../utils/datas.js'
import { parseBR, fmtBRL, fmtPct } from '../../utils/formatacao.js'

/**
 * processarOS.js — Monitor de O.S. (oficina).
 * ─────────────────────────────────────────────────────────────────────────────
 * Lê o CSV de ordens de serviço em fluxo (exportado do ERP) e consolida UMA
 * linha por O.S. distinta (Empresa + Nº O.S.), somando os valores das várias
 * linhas de item/serviço que a mesma O.S. pode ter.
 *
 * Criticidade POR GRUPO (portado da ferramenta externa): cada O.S. cai num
 * grupo (detectado por palavra-chave no tipo/solicitação) e cada grupo tem seus
 * próprios cortes de dias em aberto → Normal / Moderado / Crítico / Extremo.
 * Processo judicial é categoria à parte. Grupos e cortes são editáveis nas
 * Regras da página (Firestore); os valores abaixo são o fallback/semente.
 * Dias e criticidade rodam na visualização (resumoOS), pois dependem de hoje e
 * dos cortes vigentes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Grupos semente — ORDEM = prioridade de detecção (específico → geral).
// `judicial:true` = categoria própria (não classifica por dias). Cortes em dias
// em aberto: Extremo > extremo; Crítico > critico; Moderado > moderado; senão Normal.
export const GRUPOS_DEFAULT = [
  { key: 'judicial',            label: 'Processo judicial',            judicial: true, keywords: ['processo judicial', 'judicial'] },
  { key: 'diagnostico_externo', label: 'Diagnóstico externo',          extremo: 16, critico: 12, moderado: 7,  keywords: ['diagnostico externo'] },
  { key: 'internas',            label: 'Internas',                     extremo: 16, critico: 12, moderado: 7,  keywords: ['interna', 'interno'] },
  { key: 'externo_expresso',    label: 'Externo expresso',             extremo: 16, critico: 12, moderado: 7,  keywords: ['externo expresso'] },
  { key: 'protecao_veicular',   label: 'Proteção veicular',            extremo: 20, critico: 15, moderado: 10, keywords: ['protecao veicular', 'apvs'] },
  { key: 'seguradora',          label: 'Seguradoras',                  extremo: 20, critico: 15, moderado: 10, keywords: ['seguradora', 'sinistro', 'franquia'] },
  { key: 'recall',              label: 'Recall',                       extremo: 15, critico: 10, moderado: 7,  keywords: ['recall'] },
  { key: 'revisao_periodica',   label: 'Revisão periódica / 7ª troca', extremo: 16, critico: 12, moderado: 7,  keywords: ['revisao periodica', 'periodica', '7 troca de oleo gratis', '7a troca de oleo gratis', 'setima troca de oleo gratis', 'troca de oleo gratis', 'oleo gratis'] },
  { key: 'campanha',            label: 'Campanha',                     extremo: 20, critico: 15, moderado: 7,  keywords: ['campanha'] },
  { key: 'garantia',            label: 'Garantia',                     extremo: 15, critico: 10, moderado: 7,  keywords: ['garantia'] },
  { key: 'revisao_1_2',         label: '1ª e 2ª revisão',              extremo: 16, critico: 12, moderado: 7,  keywords: ['1 revisao', '1a revisao', 'primeira revisao', '2 revisao', '2a revisao', 'segunda revisao'] },
  { key: 'diagnostico',         label: 'Diagnóstico',                  extremo: 16, critico: 12, moderado: 7,  keywords: ['diagnostico'] },
  { key: 'externo',             label: 'Externo',                      extremo: 16, critico: 12, moderado: 7,  keywords: ['externo'] },
  { key: 'outros',              label: 'Outros tipos',                 extremo: 20, critico: 15, moderado: 7,  keywords: [] }, // catch-all
]

// Situações que NÃO entram na foto (encerradas de vez). Editável nas Regras.
export const SITUACOES_EXCLUIDAS_DEFAULT = ['CANCELADA', 'CONCLUIDA']

export const CRITICIDADE_META = {
  normal:   { label: 'Normal',   cor: 'var(--text3)',        tag: 'gray'  },
  moderado: { label: 'Moderado', cor: 'var(--amber)',        tag: 'amber' },
  critico:  { label: 'Crítico',  cor: 'var(--orange)',       tag: 'amber' },
  extremo:  { label: 'Extremo',  cor: 'var(--red-critical)', tag: 'red'   },
  judicial: { label: 'Judicial', cor: 'var(--honda)',        tag: 'red'   },
}

const normAlto  = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
const normBaixo = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

function pegar(row, ...candidatos) {
  for (const c of candidatos) {
    if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') return row[c]
  }
  const alvos = candidatos.map(normAlto)
  for (const k of Object.keys(row)) {
    if (alvos.includes(normAlto(k))) return row[k]
  }
  return ''
}

/**
 * Consolida o CSV em O.S. distintas. Devolve um registro por O.S., com os
 * valores somados entre as linhas e os campos descritivos da primeira linha.
 */
export function processarOS(rows) {
  const porOS = new Map()

  for (const row of rows) {
    const empresa = String(pegar(row, 'Empresa')).trim()
    const nOS     = String(pegar(row, 'Nº O.S.', 'N° O.S.', 'Nro. O.S.', 'Numero O.S.', 'O.S.', 'OS')).trim()
    if (!nOS) continue
    const osId = empresa + '|' + nOS

    const servico    = parseBR(pegar(row, 'Total Serviço'))
    const revisao    = parseBR(pegar(row, 'Total Revisão'))
    const cortesia   = parseBR(pegar(row, 'Total Cortesia'))
    const mercadoria = parseBR(pegar(row, 'Total Mercadoria'))
    const valorTotal = parseBR(pegar(row, 'Valor Total'))
    const tipoOS     = String(pegar(row, 'Tipo O.S.')).trim()

    let os = porOS.get(osId)
    if (!os) {
      os = {
        osId, empresa, nOS,
        situacao:  normAlto(pegar(row, 'Situação', 'Situacao')),
        emissao:   parseDateBR(pegar(row, 'Data Emissão', 'Data Emissao')),
        conclusao: parseDateBR(pegar(row, 'Data Conclusão', 'Data Conclusao')),
        consultor: String(pegar(row, 'Consultor')).trim(),
        tecnico:   String(pegar(row, 'Técnico Nome', 'Tecnico Nome')).trim(),
        cliente:   String(pegar(row, 'Pessoa')).trim(),
        modelo:    String(pegar(row, 'Modelo')).trim(),
        placa:     String(pegar(row, 'Placa')).trim(),
        cor:       String(pegar(row, 'Cor')).trim(),
        solicitacao: String(pegar(row, 'Solicitação Cliente', 'Solicitacao Cliente')).trim(),
        aplicacao: String(pegar(row, 'Serviço Aplicação', 'Servico Aplicacao')).trim(),
        tipos: [],
        servico: 0, revisao: 0, cortesia: 0, mercadoria: 0, valorTotal: 0,
        linhas: [],
      }
      porOS.set(osId, os)
    }

    os.servico    += servico
    os.revisao    += revisao
    os.cortesia   += cortesia
    os.mercadoria += mercadoria
    os.valorTotal += valorTotal
    if (tipoOS && !os.tipos.includes(tipoOS)) os.tipos.push(tipoOS)
    os.linhas.push(row)
  }

  return [...porOS.values()].map(os => ({ ...os, tipoOS: os.tipos[0] || '' }))
}

/** Dias em aberto de uma O.S. até a data de referência (nunca negativo). */
export function diasEmAberto(os, dataRef = new Date()) {
  if (!(os.emissao instanceof Date) || isNaN(os.emissao)) return null
  return Math.max(0, Math.floor((dataRef - os.emissao) / 86400000))
}

/**
 * Detecta o grupo de uma O.S.: primeiro um override manual por Tipo O.S.
 * (tipoOverrides, definido nas Regras), senão a primeira palavra-chave que
 * casar, na ordem dos grupos. Cai em 'outros' se nada casar.
 */
export function detectarGrupo(os, grupos = GRUPOS_DEFAULT, tipoOverrides = {}) {
  for (const t of os.tipos || []) {
    const ov = tipoOverrides[normAlto(t)]
    if (ov) { const g = grupos.find(x => x.key === ov); if (g) return g }
  }
  const texto = normBaixo([...(os.tipos || []), os.aplicacao, os.solicitacao].join(' '))
  for (const g of grupos) {
    if ((g.keywords || []).some(k => texto.includes(k))) return g
  }
  return grupos.find(g => g.key === 'outros') || grupos[grupos.length - 1]
}

/** Grupo de um Tipo O.S. isolado (usado na aba Regras para listar/mover tipos). */
export function grupoDoTipo(tipo, grupos = GRUPOS_DEFAULT, tipoOverrides = {}) {
  return detectarGrupo({ tipos: [tipo], aplicacao: '', solicitacao: '' }, grupos, tipoOverrides)
}

/** Classifica a antiguidade dentro do grupo: normal|moderado|critico|extremo|judicial. */
export function classificarCriticidade(grupo, dias) {
  if (grupo?.judicial) return 'judicial'
  if (dias === null) return 'normal'
  if (dias > (grupo?.extremo  ?? 20)) return 'extremo'
  if (dias > (grupo?.critico  ?? 15)) return 'critico'
  if (dias > (grupo?.moderado ?? 7))  return 'moderado'
  return 'normal'
}

// ── Filtros rápidos por tipo de O.S. (portados da ferramenta externa) ────────
// Todos os marcados se somam (E): "excluir" tira os grupos; "apenas" mantém só eles.
export const FILTROS_RAPIDOS = [
  { key: 'semJudicial',   modo: 'excluir', label: 'Sem processo judicial',           grupos: ['judicial'] },
  { key: 'semSeguradora', modo: 'excluir', label: 'Sem seguradoras e proteção',      grupos: ['seguradora', 'protecao_veicular'] },
  { key: 'semInternas',   modo: 'excluir', label: 'Sem internas',                    grupos: ['internas'] },
  { key: 'soTecnico',     modo: 'apenas',  label: 'Só diagnóstico, garantia e recall', grupos: ['diagnostico', 'diagnostico_externo', 'garantia', 'recall'] },
  { key: 'soDiagnostico', modo: 'apenas',  label: 'Só diagnóstico',                  grupos: ['diagnostico'] },
  { key: 'soGarantia',    modo: 'apenas',  label: 'Só garantia e recall',            grupos: ['garantia', 'recall'] },
  { key: 'soSeguradora',  modo: 'apenas',  label: 'Só seguradoras',                  grupos: ['seguradora'] },
  { key: 'soProtecao',    modo: 'apenas',  label: 'Só proteção veicular',            grupos: ['protecao_veicular'] },
  { key: 'soInternas',    modo: 'apenas',  label: 'Só internas',                     grupos: ['internas'] },
]

function passaFiltrosRapidos(o, ativosKeys, minDias) {
  for (const f of FILTROS_RAPIDOS) {
    if (!ativosKeys.includes(f.key)) continue
    const noGrupo = f.grupos.includes(o.grupoKey)
    if (f.modo === 'excluir' && noGrupo) return false
    if (f.modo === 'apenas' && !noGrupo) return false
  }
  if (minDias && (o.dias ?? 0) < minDias) return false
  return true
}

// ── Prioridade de ação (score 0–100, portado da ferramenta externa) ──────────
const ALERT_POINTS  = { extremo: 30, critico: 23, moderado: 13, judicial: 20, normal: 0 }
const STATUS_POINTS = { parada: 10, pendente: 8, aberta: 6, pronta: 3, faturamento: 2, neutral: 4 }
const GROUP_POINTS  = { diagnostico: 10, diagnostico_externo: 10, judicial: 10, garantia: 8, recall: 8, seguradora: 7, protecao_veicular: 7, campanha: 6, externo: 5, externo_expresso: 4, internas: 4, revisao_periodica: 3, revisao_1_2: 2, outros: 4 }
const NIVEL_META = { urgente: { label: 'Urgente', tag: 'red' }, alta: { label: 'Alta', tag: 'amber' }, media: { label: 'Média', tag: 'amber' }, monitorar: { label: 'Monitorar', tag: 'gray' } }

function statusKey(situacao) {
  const n = normBaixo(situacao)
  if (n.includes('faturamento')) return 'faturamento'
  if (n.includes('parad'))       return 'parada'
  if (n.includes('pendente'))    return 'pendente'
  if (n.includes('pronta'))      return 'pronta'
  if (n.includes('aberta'))      return 'aberta'
  return 'neutral'
}
function valuePoints(total) {
  if (total >= 20000) return 20
  if (total >= 10000) return 17
  if (total >= 5000)  return 13
  if (total >= 2000)  return 9
  if (total >= 500)   return 5
  return total > 0 ? 2 : 0
}

/** Score de prioridade 0–100 + nível + motivos de uma O.S. já classificada. */
export function calcPrioridade(o) {
  const dias  = o.dias || 0
  const total = o.valorTotal || 0
  const daysP   = Math.min(30, Math.round(dias * 1.5))
  const alertP  = ALERT_POINTS[o.criticidade] || 0
  const valueP  = valuePoints(total)
  const statusP = STATUS_POINTS[statusKey(o.situacao)] ?? 4
  const groupP  = GROUP_POINTS[o.grupoKey] ?? 4
  const score = Math.min(100, daysP + alertP + valueP + statusP + groupP)
  const componentes = { dias: daysP, criticidade: alertP, valor: valueP, status: statusP, tipo: groupP }
  const nivel = score >= 75 ? 'urgente' : score >= 55 ? 'alta' : score >= 35 ? 'media' : 'monitorar'
  const motivos = []
  if (daysP) motivos.push(`${dias} dias`)
  if (o.criticidade && o.criticidade !== 'normal') motivos.push(CRITICIDADE_META[o.criticidade]?.label || o.criticidade)
  if (total > 0) motivos.push(fmtBRL(total))
  if (statusKey(o.situacao) !== 'neutral') motivos.push(o.situacao)
  if (o.grupoLabel) motivos.push(o.grupoLabel)
  return { score, nivel, nivelLabel: NIVEL_META[nivel].label, nivelTag: NIVEL_META[nivel].tag, motivos, componentes }
}

/**
 * Mudanças entre a carga anterior e a atual. Recebe as duas listas JÁ
 * classificadas (resumoOS().ativos) com os mesmos filtros. "Saiu do crítico" =
 * era crítica/extrema e agora reduziu de faixa ou deixou de aparecer no arquivo.
 */
export function compararFotos(atuais, anteriores) {
  const ant = new Map(anteriores.map(o => [o.osId, o]))
  const atu = new Map(atuais.map(o => [o.osId, o]))
  const crit = o => !!o && (o.criticidade === 'critico' || o.criticidade === 'extremo')
  return {
    novas:          atuais.filter(o => !ant.has(o.osId)),
    statusAlterado: atuais.filter(o => ant.has(o.osId) && ant.get(o.osId).situacao !== o.situacao),
    valorAlterado:  atuais.filter(o => ant.has(o.osId) && Math.abs((ant.get(o.osId).valorTotal || 0) - (o.valorTotal || 0)) >= 0.01),
    novasCriticas:  atuais.filter(o => crit(o) && !crit(ant.get(o.osId))),
    sairamCritico:  anteriores.filter(o => crit(o) && !crit(atu.get(o.osId)))
      .map(o => ({ ...(atu.get(o.osId) || o), saida: atu.has(o.osId) ? 'reduziu de faixa' : 'saiu do arquivo' })),
  }
}

// Ordem dos cards de status (igual à ferramenta); "Em faturamento" aparece mesmo zerado.
const ORDEM_SITUACAO = ['EM FATURAMENTO', 'ABERTA', 'FECHADA', 'PRONTA', 'PARADA', 'PENDENTE']

/**
 * Resumo da foto já filtrada (estado/loja/responsável aplicados antes).
 * `regras` traz grupos, overrides e situações excluídas; `dataRef` é "hoje";
 * `supervisorMap` mapeia norm(consultor) → supervisor (para agrupar por supervisor).
 */
export function resumoOS(osList, { regras = {}, dataRef = new Date(), supervisorMap = {}, filtrosRapidos = [], minDias = 0 } = {}) {
  const grupos       = (Array.isArray(regras.grupos) && regras.grupos.length) ? regras.grupos : GRUPOS_DEFAULT
  const tipoOverrides = regras.tipoOverrides || {}
  const excluidas    = new Set((regras.situacoesExcluidas || SITUACOES_EXCLUIDAS_DEFAULT).map(normAlto))

  const ativos = osList
    .filter(os => !excluidas.has(os.situacao))
    .map(os => {
      const dias  = diasEmAberto(os, dataRef)
      const grupo = detectarGrupo(os, grupos, tipoOverrides)
      const criticidade = classificarCriticidade(grupo, dias)
      const supervisor = supervisorMap[normAlto(os.consultor)] || os.consultor || '(sem supervisor)'
      const base = { ...os, dias, grupoKey: grupo.key, grupoLabel: grupo.label, criticidade, judicial: !!grupo.judicial, supervisor }
      return { ...base, prioridade: calcPrioridade(base) }
    })
    .filter(o => passaFiltrosRapidos(o, filtrosRapidos, minDias))

  const ehCritica = o => o.criticidade === 'critico' || o.criticidade === 'extremo'
  const totalOS   = ativos.length
  const extremas  = ativos.filter(o => o.criticidade === 'extremo').length
  const criticas  = ativos.filter(o => o.criticidade === 'critico').length
  const moderadas = ativos.filter(o => o.criticidade === 'moderado').length
  const judiciais = ativos.filter(o => o.judicial).length
  const diasValidos = ativos.map(o => o.dias).filter(d => d !== null)
  const mediaDias = diasValidos.length ? Math.round(diasValidos.reduce((s, d) => s + d, 0) / diasValidos.length) : 0

  // Resumo por situação da O.S.
  const porSituacao = {}
  for (const o of ativos) {
    const k = o.situacao || '(sem situação)'
    if (!porSituacao[k]) porSituacao[k] = { situacao: k, nOS: 0, servico: 0, mercadoria: 0, valorTotal: 0 }
    const g = porSituacao[k]
    g.nOS += 1; g.servico += o.servico; g.mercadoria += o.mercadoria; g.valorTotal += o.valorTotal
  }

  // Por supervisor (do consultor) → lojas.
  const porResponsavel = {}
  for (const o of ativos) {
    const resp = o.supervisor
    if (!porResponsavel[resp]) porResponsavel[resp] = { responsavel: resp, nOS: 0, criticas: 0, lojas: {} }
    const r = porResponsavel[resp]
    r.nOS += 1; if (ehCritica(o)) r.criticas += 1
    const loja = o.empresa || '(sem loja)'
    if (!r.lojas[loja]) r.lojas[loja] = { loja, nOS: 0, criticas: 0 }
    r.lojas[loja].nOS += 1; if (ehCritica(o)) r.lojas[loja].criticas += 1
  }

  // Ranking crítico por loja.
  const porLoja = {}
  for (const o of ativos) {
    const loja = o.empresa || '(sem loja)'
    if (!porLoja[loja]) porLoja[loja] = { loja, total: 0, criticas: 0, valorParado: 0, abertas: 0 }
    porLoja[loja].total += 1
    if (statusKey(o.situacao) === 'aberta') porLoja[loja].abertas += 1
    porLoja[loja].valorParado += o.valorTotal
    if (ehCritica(o)) porLoja[loja].criticas += 1
  }
  const rankingLoja = Object.values(porLoja)
    .map(l => ({ ...l, pctCritico: l.total > 0 ? l.criticas / l.total : 0 }))
    .sort((a, b) => b.pctCritico - a.pctCritico || b.criticas - a.criticas)

  // Concentração por grupo.
  const porGrupo = {}
  for (const o of ativos) {
    const k = o.grupoKey
    if (!porGrupo[k]) porGrupo[k] = { key: k, label: o.grupoLabel, quantidade: 0, somaDias: 0, criticas: 0, valorParado: 0 }
    const g = porGrupo[k]
    g.quantidade += 1
    g.somaDias += (o.dias || 0)
    g.valorParado += o.valorTotal
    if (ehCritica(o)) g.criticas += 1
  }
  const concentracaoGrupo = Object.values(porGrupo)
    .map(g => ({ ...g, mediaDias: g.quantidade > 0 ? Math.round(g.somaDias / g.quantidade) : 0 }))
    .sort((a, b) => b.quantidade - a.quantidade)

  // Prioridade de ação — O.S. ranqueadas pelo score.
  const prioridadeLista = [...ativos].sort((a, b) => b.prioridade.score - a.prioridade.score)

  // Pontos de atenção — alertas automáticos.
  const criticasList = ativos.filter(ehCritica)
  const maisAntiga = ativos.reduce((m, o) => (o.dias || 0) > (m?.dias || -1) ? o : m, null)
  const consCount = {}
  criticasList.forEach(o => { const c = o.consultor || '—'; consCount[c] = (consCount[c] || 0) + 1 })
  const topCons  = Object.entries(consCount).sort((a, b) => b[1] - a[1])[0]
  const topLoja  = rankingLoja.find(l => l.criticas > 0)
  const maiorVal = ativos.reduce((m, o) => (o.valorTotal || 0) > (m?.valorTotal || -1) ? o : m, null)
  const grupoCount = {}
  criticasList.forEach(o => { grupoCount[o.grupoLabel] = (grupoCount[o.grupoLabel] || 0) + 1 })
  const topGrupo = Object.entries(grupoCount).sort((a, b) => b[1] - a[1])[0]
  // `os` = O.S. que o card abre ao clicar (quando faz sentido).
  const pontosAtencao = []
  if (maisAntiga && maisAntiga.dias != null) pontosAtencao.push({ tipo: 'danger', icon: '⚠', titulo: `O.S. mais antiga: ${maisAntiga.nOS}`, texto: `${maisAntiga.dias} dias · ${maisAntiga.empresa} · ${maisAntiga.consultor}`, os: maisAntiga })
  if (topCons)  pontosAtencao.push({ tipo: 'warning', icon: '●', titulo: `Maior concentração crítica: ${topCons[0]}`, texto: `${topCons[1]} O.S. críticas ou extremamente críticas` })
  if (topLoja)  pontosAtencao.push({ tipo: 'danger', icon: '◆', titulo: `Maior percentual crítico: ${topLoja.loja}`, texto: `${fmtPct(topLoja.pctCritico, 1)} da carteira · ${topLoja.criticas} de ${topLoja.total} O.S.` })
  if (maiorVal && maiorVal.valorTotal > 0) pontosAtencao.push({ tipo: 'warning', icon: 'R$', titulo: `Maior valor parado: O.S. ${maiorVal.nOS}`, texto: `${fmtBRL(maiorVal.valorTotal)} · ${maiorVal.empresa} · ${maiorVal.dias ?? '—'} dias em oficina`, os: maiorVal, acao: `Abrir O.S. ${maiorVal.nOS}` })
  if (topGrupo) pontosAtencao.push({ tipo: 'warning', icon: '%', titulo: `Concentração crítica: ${topGrupo[0]}`, texto: `Representa ${fmtPct(topGrupo[1] / criticasList.length, 1)} das O.S. críticas · ${topGrupo[1]} de ${criticasList.length}` })

  // Status em ordem fixa, com "Em faturamento" sempre presente (mesmo zerado).
  if (!porSituacao['EM FATURAMENTO']) porSituacao['EM FATURAMENTO'] = { situacao: 'EM FATURAMENTO', nOS: 0, servico: 0, mercadoria: 0, valorTotal: 0 }
  const ordemSit = s => { const i = ORDEM_SITUACAO.indexOf(s); return i < 0 ? 99 : i }

  return {
    ativos,
    totalOS, extremas, criticas, moderadas, judiciais,
    criticasExtremas: criticas + extremas,
    pctCriticasExtremas: totalOS > 0 ? (criticas + extremas) / totalOS : 0,
    mediaDias,
    porSituacao: Object.values(porSituacao).sort((a, b) => ordemSit(a.situacao) - ordemSit(b.situacao) || b.nOS - a.nOS),
    porResponsavel: Object.values(porResponsavel)
      .map(r => ({ ...r, lojas: Object.values(r.lojas).sort((a, b) => b.nOS - a.nOS) }))
      .sort((a, b) => b.criticas - a.criticas || b.nOS - a.nOS),
    rankingLoja,
    concentracaoGrupo,
    prioridadeLista,
    pontosAtencao,
  }
}
