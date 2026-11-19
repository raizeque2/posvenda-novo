/**
 * atacado.logic.js — agregações do canal Atacado, funções PURAS.
 * ─────────────────────────────────────────────────────────────────────────────
 * O "cliente de atacado" NÃO é cadastro novo: é o campo `Pessoa` das linhas de
 * peças com `cat === 'ATACADO'`. Cidade é o campo `Município`. Nada aqui inventa
 * dado — só recorta, normaliza e soma o que o motor de peças já entrega.
 *
 * Rendering fica nas Abas (tabela padrão/KpiCard); dias úteis, projeção e
 * líquido do canal vêm dos motores existentes (datas.js, dashboard.logic.js).
 * Este arquivo cobre só o que não existia: ranking de peça, de cliente,
 * inatividade e cobertura por cidade.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { norm } from '../../utils/normalizacao.js'
import { getMes, sortMesAno, parseMesAno } from '../../utils/datas.js'
import { ehCargoExterno } from '../../data/cargos.js'
import {parseBR} from '../../utils/formatacao.js'

export const CAT_ATACADO = 'ATACADO'

// Valor líquido de UMA linha: devolução entra negativa, igual ao calcLiquido do
// Dashboard (r.valor pode vir positivo mesmo em devolução — o sinal é a flag).
export const valLiq = r => (r.eDevolucao ? -Math.abs(r.valor || 0) : (r.valor || 0))
const qtdLiq=r=>{const raw=r.quantidade??r['Quantidade']??0;const value=typeof raw==='number'?raw:parseBR(raw);return r.eDevolucao?-Math.abs(value):value}

// Identidade do cliente = nome normalizado do campo Pessoa. Guardamos também o
// rótulo "bonito" (primeira grafia vista) para exibir sem caixa-alta forçada.
export const chaveCliente = r => norm(r['Pessoa'] || '')
export const chaveCidade  = r => norm(r['Município'] || '')

/**
 * Recorta as linhas ATACADO de um conjunto de meses, já achatadas, aplicando o
 * filtro de estado/loja pela loja da VENDA (r.empresa) — mesma régua do
 * Dashboard (recorta na venda, não no cadastro).
 */
export function linhasAtacado(pecasPorMes, { estado, lojas, lojasMap, tipoMercadoria, tipoMovimento, cidade } = {}) {
  const setLojas = lojas && lojas.length ? new Set(lojas) : null
  // tipoMercadoria é multi-seleção (lista); aceita também string legada por segurança.
  const listaTipoMerc = Array.isArray(tipoMercadoria) ? tipoMercadoria : (tipoMercadoria ? [tipoMercadoria] : [])
  const setTipoMerc = listaTipoMerc.length ? new Set(listaTipoMerc.map(t => norm(t))) : null
  const normCidade = cidade ? norm(cidade) : ''
  const out = []
  Object.values(pecasPorMes || {}).forEach(rows => rows.forEach(r => {
    if (r.cat !== CAT_ATACADO) return
    if (setLojas && !setLojas.has(r.empresa)) return
    if (estado && lojasMap?.[r.empresa]?.uf !== estado) return
    if (setTipoMerc && !setTipoMerc.has(norm(r.tipoMercadoria || ''))) return
    if (tipoMovimento && norm(r.tipoMovimento || r.tipoMov || '') !== norm(tipoMovimento)) return
    if (normCidade && chaveCidade(r) !== normCidade) return
    out.push(r)
  }))
  return out
}

// Uma "compra" é uma nota/número distinto. `Número` identifica o documento.
const numCompra = r => r['Número'] ? `${r.empresa||''}|${r['Número']}` : ''

/** Ranking de clientes de um mês: faturamento, nº de compras, ticket médio. */
export function buildClientes(rowsMes) {
  const map = Object.create(null)
  rowsMes.forEach(r => {
    const k = chaveCliente(r); if (!k) return
    const c = map[k] || (map[k] = { cliente: r['Pessoa'], chave: k, faturamento: 0, compras: new Set(), cidade: r['Município'] || '' })
    c.faturamento += valLiq(r)
    if (numCompra(r)) c.compras.add(numCompra(r))
  })
  return Object.values(map).map(c => ({
    cliente: c.cliente, chave: c.chave, cidade: c.cidade,
    faturamento: c.faturamento,
    nCompras: c.compras.size,
    ticket: c.compras.size > 0 ? c.faturamento / c.compras.size : 0
  }))
}

/** Ranking de peças de um mês: código, descrição, quantidade, valor. */
export function buildPecas(rowsMes) {
  const map = Object.create(null)
  rowsMes.forEach(r => {
    const cod = r['Código Mercadoria'] || '—'
    const p = map[cod] || (map[cod] = { codigo: cod, descricao: r['Mercadoria'] || '', quantidade: 0, valor: 0 })
    p.quantidade += qtdLiq(r)
    p.valor += valLiq(r)
  })
  return Object.values(map)
}

/**
 * Histórico de itens comprados por um cliente nos últimos N meses: por peça,
 * quantidade e valor em cada mês. Alimenta a linha expandida em Clientes.
 */
export function histItensCliente(rows6m, chave, mesesJanela) {
  const setMeses = new Set(mesesJanela)
  const map = Object.create(null)
  rows6m.forEach(r => {
    if (chaveCliente(r) !== chave) return
    const mes = getMes(r.dt); if (!setMeses.has(mes)) return
    const cod = r['Código Mercadoria'] || '—'
    const p = map[cod] || (map[cod] = { codigo: cod, descricao: r['Mercadoria'] || '', porMes: {}, totalQtd: 0, totalValor: 0 })
    const cell = p.porMes[mes] || (p.porMes[mes] = { qtd: 0, valor: 0 })
    const q = qtdLiq(r)
    cell.qtd += q; cell.valor += valLiq(r)
    p.totalQtd += q; p.totalValor += valLiq(r)
  })
  return Object.values(map).sort((a, b) => b.totalValor - a.totalValor)
}

// Milissegundos por dia — para recência.
const DIA_MS = 86400000

/**
 * Base de inatividade: para cada cliente que já comprou no período carregado,
 * última compra (data e valor da nota) e valor médio MENSAL histórico.
 * `anchor` é a data de referência (última data presente nos dados) contra a
 * qual a recência é medida.
 */
export function baseInatividade(rowsAll, anchor) {
  const map = Object.create(null)
  rowsAll.forEach(r => {
    const k = chaveCliente(r); if (!k || !(r.dt instanceof Date)) return
    const c = map[k] || (map[k] = {
      cliente: r['Pessoa'], chave: k, cidade: r['Município'] || '',
      ultima: null, ultimaValorNota: 0, ultimaNum: null,
      totalHist: 0, meses: new Set()
    })
    c.totalHist += valLiq(r)
    c.meses.add(getMes(r.dt))
    if (!c.ultima || r.dt > c.ultima) { c.ultima = r.dt; c.ultimaNum = numCompra(r) }
  })
  // Valor da última NOTA (soma das linhas daquele Número naquele dia)
  rowsAll.forEach(r => {
    const c = map[chaveCliente(r)]
    if (c && c.ultimaNum && numCompra(r) === c.ultimaNum && r.dt instanceof Date && +r.dt === +c.ultima) {
      c.ultimaValorNota += valLiq(r)
    }
  })
  return Object.values(map).map(c => ({
    cliente: c.cliente, chave: c.chave, cidade: c.cidade,
    ultima: c.ultima, ultimaValor: c.ultimaValorNota,
    diasSemComprar: Math.floor((anchor - c.ultima) / DIA_MS),
    valorMedio: c.meses.size > 0 ? c.totalHist / c.meses.size : 0
  }))
}

/** Divide a base em faixas de inatividade pelos cortes configurados (dias). */
export function faixasInatividade(base, { corte1, corte2, corte3 }) {
  const acima = d => base.filter(c => c.diasSemComprar > d)
  return { f1: acima(corte1), f2: acima(corte2), f3: acima(corte3) }
}

/**
 * Queda de frequência: mês atual vs média dos 3 meses anteriores. Sinaliza
 * quem tinha histórico (média > 0) e caiu pelo menos `quedaPct`%. Inclui quem
 * zerou (caiu 100%). Retorna média, atual e a queda relativa.
 */
export function quedaFrequencia(rowsAll, mesAtivo, quedaPct) {
  const [mm, aa] = mesAtivo.split('/').map(Number)
  const anteriores = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(aa, mm - 1 - i, 1)
    anteriores.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`)
  }
  const porCliente = Object.create(null)
  rowsAll.forEach(r => {
    const k = chaveCliente(r); if (!k) return
    const mes = getMes(r.dt)
    const c = porCliente[k] || (porCliente[k] = { cliente: r['Pessoa'], chave: k, cidade: r['Município'] || '', atual: 0, ant: [0, 0, 0] })
    if (mes === mesAtivo) c.atual += valLiq(r)
    const idx = anteriores.indexOf(mes)
    if (idx >= 0) c.ant[idx] += valLiq(r)
  })
  const lim = 1 - quedaPct / 100
  return Object.values(porCliente).map(c => {
    const media = (c.ant[0] + c.ant[1] + c.ant[2]) / 3
    const queda = media > 0 ? (media - c.atual) / media : 0
    return { ...c, media, queda }
  }).filter(c => c.media > 0 && c.atual <= c.media * lim)
}

/** Cobertura: faturamento e nº de clientes por cidade (campo Município). */
export function buildCobertura(rowsMes) {
  const map = Object.create(null)
  rowsMes.forEach(r => {
    const cidade = (r['Município'] || '—').trim() || '—'
    const k = norm(cidade)
    const c = map[k] || (map[k] = { cidade, uf: r['UF'] || '', faturamento: 0, clientes: new Set() })
    c.faturamento += valLiq(r)
    const cli = chaveCliente(r); if (cli) c.clientes.add(cli)
  })
  return Object.values(map).map(c => ({ cidade: c.cidade, uf: c.uf, faturamento: c.faturamento, nClientes: c.clientes.size }))
}

/** Evolução dos últimos N meses: líquido do canal por mês (para o gráfico/tira). */
export function evolucaoMeses(pecasPorMes, mesesJanela, escopo) {
  return mesesJanela.map(mes => {
    const rows = linhasAtacado({ [mes]: pecasPorMes[mes] || [] }, escopo)
    return { mes, liquido: rows.reduce((s, r) => s + valLiq(r), 0) }
  })
}

/** Últimos N meses (mais antigo→recente) até mesAtivo, a partir dos meses com dado. */
export function janelaMeses(pecasPorMes, mesAtivo, n) {
  const todos = Object.keys(pecasPorMes || {}).filter(m => sortMesAno(m, mesAtivo) <= 0).sort(sortMesAno)
  return todos.slice(-n)
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNÇÕES NOVAS — Aba Geral (reaproveitadas também por Peças)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrupamento UNIVERSAL de vendas por dimensão.
 * dimensao: 'peca' | 'tipoMercadoria' | 'cidade' | 'cliente'
 * Retorna [{ chave, label, faturamento, quantidade, nClientes }] ordenado por faturamento desc.
 */
export function buildAgrupamento(rows, dimensao) {
  const keyFns = {
    peca:            r => r['Código Mercadoria'] || '—',
    tipoMercadoria:  r => r.tipoMercadoria || '—',
    cidade:          r => (r['Município'] || '—').trim() || '—',
    cliente:         r => chaveCliente(r) || '—',
  }
  const labelFns = {
    peca:            r => r['Mercadoria'] || r['Código Mercadoria'] || '—',
    tipoMercadoria:  r => r.tipoMercadoria || '—',
    cidade:          r => (r['Município'] || '—').trim() || '—',
    cliente:         r => r['Pessoa'] || '—',
  }
  const keyFn   = keyFns[dimensao]   || keyFns.peca
  const labelFn = labelFns[dimensao] || labelFns.peca
  const map = Object.create(null)
  rows.forEach(r => {
    const k = norm(keyFn(r))
    const g = map[k] || (map[k] = { chave: k, label: labelFn(r), faturamento: 0, quantidade: 0, clientes: new Set() })
    g.faturamento += valLiq(r)
    g.quantidade += qtdLiq(r)
    const cli = chaveCliente(r)
    if (cli) g.clientes.add(cli)
  })
  return Object.values(map)
    .map(g => ({ chave: g.chave, label: g.label, faturamento: g.faturamento, quantidade: g.quantidade, nClientes: g.clientes.size }))
    .sort((a, b) => b.faturamento - a.faturamento)
}

/**
 * Distribuição do intervalo entre compras consecutivas de cada cliente.
 * Retorna { p25, p50, p75, media, n } (dias). n = total de intervalos medidos.
 */
export function intervaloComprasStats(rowsAll) {
  const porCliente = Object.create(null)
  rowsAll.forEach(r => {
    const k = chaveCliente(r); if (!k || !(r.dt instanceof Date)) return
    const num = numCompra(r); if (!num) return
    ;(porCliente[k] || (porCliente[k] = {}))[num] = Math.min(porCliente[k]?.[num] ?? Infinity, +r.dt)
  })
  const intervalos = []
  for (const datas of Object.values(porCliente)) {
    const ts = Object.values(datas).sort((a, b) => a - b)
    for (let i = 1; i < ts.length; i++) {
      const dias = Math.round((ts[i] - ts[i - 1]) / DIA_MS)
      if (dias > 0) intervalos.push(dias)
    }
  }
  if (intervalos.length === 0) return { p25: 0, p50: 0, p75: 0, media: 0, n: 0 }
  intervalos.sort((a, b) => a - b)
  const pctl = p => intervalos[Math.min(Math.floor(intervalos.length * p), intervalos.length - 1)]
  const media = intervalos.reduce((s, v) => s + v, 0) / intervalos.length
  return { p25: pctl(0.25), p50: pctl(0.5), p75: pctl(0.75), media: Math.round(media), n: intervalos.length }
}

/**
 * Carteira (clientes dos últimos 12m) e positivação (% que comprou no mês).
 */
export function clientesCarteira(rowsAll, mesAtivo, mesesCarteira) {
  const setCarteira = new Set(mesesCarteira)
  const carteira = new Set()
  const positivados = new Set()
  rowsAll.forEach(r => {
    const k = chaveCliente(r); if (!k) return
    const mes = getMes(r.dt)
    if (setCarteira.has(mes)) carteira.add(k)
    if (mes === mesAtivo) positivados.add(k)
  })
  const nCarteira = carteira.size
  const nPositivados = [...positivados].filter(k => carteira.has(k)).length
  return { carteira: nCarteira, positivados: nPositivados, positivacao: nCarteira > 0 ? nPositivados / nCarteira : 0 }
}

/**
 * Clientes novos e reativados no mês.
 * Novo = primeira compra de ATACADO em todo o histórico disponível.
 * Reativado = já tinha compra anterior e a primeira compra do mês veio depois
 * de mais de `corteAtivo` dias sem comprar.
 */
export function novosReativados(rowsAll, mesAtivo, corteAtivo) {
  const porCliente = Object.create(null)
  rowsAll.forEach(r => {
    const k = chaveCliente(r); if (!k || !(r.dt instanceof Date)) return
    const c = porCliente[k] || (porCliente[k] = { meses: new Set(), primeiraGlobal: Infinity, ultimaAntes: -Infinity })
    c.meses.add(getMes(r.dt))
    const t = +r.dt
    if (t < c.primeiraGlobal) c.primeiraGlobal = t
    if (getMes(r.dt) !== mesAtivo && t > c.ultimaAntes) c.ultimaAntes = t
  })
  let novos = 0, reativados = 0
  for (const c of Object.values(porCliente)) {
    if (!c.meses.has(mesAtivo)) continue
    if (getMes(new Date(c.primeiraGlobal)) === mesAtivo) { novos++; continue }
    if (c.ultimaAntes > -Infinity) {
      const { mes, ano } = parseMesAno(mesAtivo)
      const inicioMes = +new Date(ano, mes - 1, 1)
      const diasSem = Math.round((inicioMes - c.ultimaAntes) / DIA_MS)
      if (diasSem > corteAtivo) reativados++
    }
  }
  return { novos, reativados }
}

/** % do faturamento líquido nos 10 maiores clientes. */
export function concentracaoTop10(clientes) {
  if (clientes.length === 0) return 0
  const sorted = [...clientes].sort((a, b) => b.faturamento - a.faturamento)
  const total = sorted.reduce((s, c) => s + c.faturamento, 0)
  if (total <= 0) return 0
  const top = sorted.slice(0, 10).reduce((s, c) => s + c.faturamento, 0)
  return top / total
}

/** Média de itens (linhas distintas de peça) por nota no mês. */
export function itensPorNota(rowsMes) {
  const notas = {}
  rowsMes.forEach(r => {
    const num = numCompra(r); if (!num) return
    const n = notas[num] || (notas[num] = new Set())
    n.add(r['Código Mercadoria'] || r['Mercadoria'] || '?')
  })
  const vals = Object.values(notas)
  if (vals.length === 0) return 0
  return vals.reduce((s, set) => s + set.size, 0) / vals.length
}

/**
 * Evolução 12 meses com meta, margem, bruto, devoluções e líquido.
 * Retorna [{ mes, bruto, devol, liquido, meta, margem }].
 */
export function evolucao12mComMeta(pecasPorMes, meses12, escopo, metasPorCanal) {
  return meses12.map(mes => {
    const rows = linhasAtacado({ [mes]: pecasPorMes[mes] || [] }, escopo)
    const bruto = rows.filter(r => !r.eDevolucao).reduce((s, r) => s + (r.valor || 0), 0)
    const devol = rows.filter(r => r.eDevolucao).reduce((s, r) => s + Math.abs(r.valor || 0), 0)
    const liquido = bruto - devol
    const custo = rows.reduce((s, r) => s + (r.custo || 0), 0)
    const margem = liquido > 0 ? (liquido - custo) / liquido : 0
    const meta = metasPorCanal?.[mes] || 0
    return { mes, bruto, devol, liquido, meta, margem }
  })
}

/**
 * Ranking de vendedores com positivação por vendedor.
 * Separa EXTERNO e BALCÃO pelo cargo da folha (ehCargoExterno).
 * periodo: 'mes' (rowsMes) | '12m' (rows12m).
 */
export function buildVendedores(rows, colaboradoresMap) {
  const map = Object.create(null)
  rows.forEach(r => {
    const vendedor = norm(r.responsavel || r.vendedor || r['Vendedor'] || '')
    if (!vendedor) return
    const v = map[vendedor] || (map[vendedor] = {
      vendedor: r.responsavel || r.vendedor || r['Vendedor'] || '',
      chave: vendedor,
      faturamento: 0,
      clientes: new Set(),
      notas: new Set(),
      cargo: '',
    })
    v.faturamento += valLiq(r)
    const cli = chaveCliente(r); if (cli) v.clientes.add(cli)
    const num = numCompra(r); if (num) v.notas.add(num)
  })
  return Object.values(map).map(v => {
    const colab = colaboradoresMap?.[v.chave]
    const cargo = colab?.cargo || v.cargo || ''
    const externo = ehCargoExterno(cargo)
    return {
      vendedor: v.vendedor,
      chave: v.chave,
      faturamento: v.faturamento,
      positivacao: v.clientes.size,
      ticketMedio: v.notas.size > 0 ? v.faturamento / v.notas.size : 0,
      cargo,
      tipo: externo ? 'EXTERNO' : 'BALCÃO',
    }
  }).sort((a, b) => b.faturamento - a.faturamento)
}


