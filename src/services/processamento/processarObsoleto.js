import { csvCell } from '../../utils/csv.js'
import { parseDateBR } from '../../utils/datas.js'
import { parseBR } from '../../utils/formatacao.js'

// Thresholds: limite SUPERIOR de cada curva em dias
// Curva E = tudo acima de curvaD
export const THRESHOLDS_DEFAULT = { curvaA: 90, curvaB: 150, curvaC: 180, curvaD: 365 }

// Desconto sugerido para precificação de obsoletos (% sobre PV)
export const DESCONTO_DEFAULT = { curvaD: 10, curvaE: 20 }

export const CURVA_META = {
  CURVA_A: { label: 'Curva A', sublabel: 'Alto Giro',    cor: 'var(--green)', ordem: 0, obsoleto: false },
  CURVA_B: { label: 'Curva B', sublabel: 'Giro Normal',  cor: '#2563eb', ordem: 1, obsoleto: false },
  CURVA_C: { label: 'Curva C', sublabel: 'Alerta',       cor: 'var(--amber)', ordem: 2, obsoleto: false },
  CURVA_D: { label: 'Curva D', sublabel: 'Obsoleto',     cor: '#ea580c', ordem: 3, obsoleto: true  },
  CURVA_E: { label: 'Curva E', sublabel: 'Inativo',      cor: 'var(--red-critical)', ordem: 4, obsoleto: true  },
  SEM_DATA:{ label: 'Sem Data',sublabel: '—',            cor: '#64748b', ordem: 5, obsoleto: true  },
}

// Alias para compatibilidade com código existente
export const STATUS_META = CURVA_META

function _strip(k) {
  return (k || '').replace(/﻿/g, '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function findCol(row, ...candidates) {
  const keys = Object.keys(row)
  for (const c of candidates) {
    const match = keys.find(k => _strip(k) === _strip(c))
    if (match) return match
  }
  return null
}

function parseDataValida(str) {
  const dt = parseDateBR(str)
  if (!dt || !(dt instanceof Date) || isNaN(dt)) return null
  if (dt.getFullYear() < 1990) return null
  return dt
}

export function processarEstoque(rows, thresholds = THRESHOLDS_DEFAULT, dataRef = new Date()) {
  if (!rows?.length) return []

  const t = { ...THRESHOLDS_DEFAULT, ...thresholds }
  const sample = rows[0]

  const colLoja    = findCol(sample, 'Loja', 'Filial', 'Empresa', 'Unidade')
  const colCodigo  = findCol(sample, 'Código Mercadoria', 'Codigo Mercadoria', 'Código', 'Codigo', 'Cod. Peça', 'Part Number')
  const colDesc    = findCol(sample, 'Descrição Mercadoria', 'Descricao Mercadoria', 'Descrição', 'Descricao', 'Mercadoria')
  const colTipo    = findCol(sample, 'Tipo Mercadoria', 'Tipo', 'Categoria')
  const colSaldo   = findCol(sample, 'Saldo Contábil', 'Saldo Contabil', 'Estoque', 'Qtde', 'Quantidade')
  const colCustoU  = findCol(sample, 'Custo Md.Contábil', 'Custo Md.Contabil', 'Custo Médio', 'Custo Medio', 'Custo Unit', 'Custo Unitário')
  const colCustoT  = findCol(sample, 'Custo Total', 'Valor Total', 'Total Custo')
  const colPvBase  = findCol(sample, 'Valor Base Venda', 'Preco Venda', 'Preço Venda', 'Valor Venda')
  const colPvTotal = findCol(sample, 'Base Venda Total', 'Total Venda')
  const colEntrada = findCol(sample, 'Última Entrada', 'Ultima Entrada', 'Dt. Entrada', 'Data Entrada')
  const colSaida   = findCol(sample, 'Última Saída', 'Ultima Saida', 'Última Saida', 'Dt. Saída', 'Data Saída', 'Data Saida')

  // Bloqueio duro, sem exceção: se nenhuma coluna de custo for encontrada, todo
  // item seria gravado com custo zero silenciosamente (foi o que aconteceu com
  // o upload de maio/2026). Recusa o arquivo inteiro em vez de processar errado.
  if (!colCustoU && !colCustoT) {
    throw new Error('Coluna de custo não encontrada neste arquivo — verifique o CSV antes de continuar.')
  }

  const hoje = dataRef instanceof Date ? dataRef : new Date()

  function diasDesde(dt) {
    if (!dt) return null
    return Math.floor((hoje - dt) / (1000 * 60 * 60 * 24))
  }

  function classificar(dias) {
    if (dias === null) return 'SEM_DATA'
    if (dias <= t.curvaA) return 'CURVA_A'
    if (dias <= t.curvaB) return 'CURVA_B'
    if (dias <= t.curvaC) return 'CURVA_C'
    if (dias <= t.curvaD) return 'CURVA_D'
    return 'CURVA_E'
  }

  return rows
    .filter(row => colCodigo && row[colCodigo]?.trim())
    .map(row => {
      const dtEntrada     = colEntrada ? parseDataValida(row[colEntrada]) : null
      const dtSaida       = colSaida   ? parseDataValida(row[colSaida])   : null
      const diasSaida     = diasDesde(dtSaida)
      const diasEntrada   = diasDesde(dtEntrada)
      const ambos         = [diasSaida, diasEntrada].filter(d => d !== null)
      const diasReferencia = ambos.length > 0 ? Math.min(...ambos) : null

      const saldo   = parseFloat(String(row[colSaldo] || '0').replace(',', '.')) || 0
      const custoU  = parseBR(row[colCustoU])
      const custoT  = parseBR(row[colCustoT]) || (custoU * saldo)
      const pvUnit  = parseBR(row[colPvBase])
      const pvTot   = parseBR(row[colPvTotal]) || (pvUnit * saldo)

      return {
        loja:          (colLoja   ? row[colLoja]   : '').trim(),
        codigo:        (colCodigo ? row[colCodigo] : '').trim(),
        descricao:     (colDesc   ? row[colDesc]   : '').trim(),
        tipo:          (colTipo   ? row[colTipo]   : '').trim(),
        saldo,
        custoUnitario: custoU,
        custoTotal:    custoT,
        pvUnitario:    pvUnit,
        pvTotal:       pvTot,
        dtEntrada,
        dtSaida,
        diasSaida,
        diasEntrada,
        diasReferencia,
        status: classificar(diasReferencia),
      }
    })
    .filter(r => r.saldo > 0)
}

// Extrai a data da coluna "Posição em" do CSV retroativo — identifica a que mês
// o arquivo pertence sem depender da maior data de movimentação (que pode ser futura).
export function extrairPosicaoEm(rows) {
  if (!rows?.length) return null
  const col = findCol(rows[0], 'Posição em', 'Posicao em', 'Data Posição', 'Data Posicao', 'Dt. Posição')
  if (!col) return null
  const dt = parseDateBR(rows[0][col])
  return dt && !isNaN(dt) ? dt : null
}

// Maior data de movimentação (dtEntrada/dtSaida) entre todos os itens de um upload.
// Usada para identificar a que mês um arquivo de estoque realmente pertence —
// substitui a confiança no nome do arquivo ou numa data digitada manualmente.
// Espera itens já processados por processarEstoque (dtEntrada/dtSaida como Date).
export function dataMaximaMovimentacao(itens) {
  let max = null
  for (const it of itens) {
    for (const dt of [it.dtEntrada, it.dtSaida]) {
      if (!(dt instanceof Date) || isNaN(dt)) continue
      if (dt.getFullYear() < 1990) continue // datas-sentinela absurdas do ERP
      if (!max || dt > max) max = dt
    }
  }
  return max
}

// Reprocessa curvas a partir das datas (compatibilidade com dados antigos no Storage)
// dataRef: data de referência para contagem de dias parados — default "hoje" preserva
// o comportamento atual (estoque vigente). Snapshots históricos devem passar a própria
// data do snapshot para não derivar com o passar do tempo.
export function reprocessarCurvas(itens, thresholds = THRESHOLDS_DEFAULT, dataRef = new Date()) {
  const t   = { ...THRESHOLDS_DEFAULT, ...thresholds }
  const hoje = dataRef instanceof Date ? dataRef : new Date()

  function classificar(dias) {
    if (dias === null) return 'SEM_DATA'
    if (dias <= t.curvaA) return 'CURVA_A'
    if (dias <= t.curvaB) return 'CURVA_B'
    if (dias <= t.curvaC) return 'CURVA_C'
    if (dias <= t.curvaD) return 'CURVA_D'
    return 'CURVA_E'
  }

  return itens.map(item => {
    const diasSaida   = item.dtSaida   instanceof Date ? Math.floor((hoje - item.dtSaida)   / 86400000) : null
    const diasEntrada = item.dtEntrada instanceof Date ? Math.floor((hoje - item.dtEntrada) / 86400000) : null
    const ambos       = [diasSaida, diasEntrada].filter(d => d !== null)
    const diasReferencia = ambos.length > 0 ? Math.min(...ambos) : null
    return { ...item, diasSaida, diasEntrada, diasReferencia, status: classificar(diasReferencia) }
  })
}

export function resumoEstoque(itens) {
  const totalItens = itens.length
  const custoTotal = itens.reduce((s, r) => s + r.custoTotal, 0)
  const pvTotal    = itens.reduce((s, r) => s + r.pvTotal,    0)

  const porStatus = {}
  for (const st of Object.keys(CURVA_META)) {
    const grupo = itens.filter(r => r.status === st)
    porStatus[st] = {
      itens: grupo.length,
      custo: grupo.reduce((s, r) => s + r.custoTotal, 0),
      pv:    grupo.reduce((s, r) => s + r.pvTotal,    0),
    }
  }

  const obsoletos   = itens.filter(r => CURVA_META[r.status]?.obsoleto)
  const obsItens    = obsoletos.length
  const obsCusto    = obsoletos.reduce((s, r) => s + r.custoTotal, 0)
  const obsPv       = obsoletos.reduce((s, r) => s + r.pvTotal,    0)
  const pctObsoleto = custoTotal > 0 ? obsCusto / custoTotal : 0

  const lojas = [...new Set(itens.map(r => r.loja))].sort()
  const porLoja = lojas.map(loja => {
    const grupo = itens.filter(r => r.loja === loja)
    const obs   = grupo.filter(r => CURVA_META[r.status]?.obsoleto)
    const curvas = {}
    for (const st of Object.keys(CURVA_META)) {
      const g = grupo.filter(r => r.status === st)
      curvas[st] = { itens: g.length, custo: g.reduce((s, r) => s + r.custoTotal, 0), pv: g.reduce((s, r) => s + r.pvTotal, 0) }
    }
    const custoGrupo = grupo.reduce((s, r) => s + r.custoTotal, 0)
    const obsCusto   = obs.reduce((s, r) => s + r.custoTotal, 0)
    return {
      loja,
      totalItens:   grupo.length,
      custoTotal:   custoGrupo,
      pvTotal:      grupo.reduce((s, r) => s + r.pvTotal,    0),
      obsItens:     obs.length,
      obsCusto,
      obsPv:        obs.reduce((s, r) => s + r.pvTotal,    0),
      pctObsoleto:  custoGrupo > 0 ? obsCusto / custoGrupo : 0,
      curvas,
    }
  })

  const tipos = [...new Set(itens.map(r => r.tipo).filter(Boolean))].sort()
  const porTipo = tipos.map(tipo => {
    const grupo = itens.filter(r => r.tipo === tipo)
    const obs   = grupo.filter(r => CURVA_META[r.status]?.obsoleto)
    return {
      tipo,
      totalItens:  grupo.length,
      custoTotal:  grupo.reduce((s, r) => s + r.custoTotal, 0),
      pvTotal:     grupo.reduce((s, r) => s + r.pvTotal,    0),
      obsItens:    obs.length,
      obsCusto:    obs.reduce((s, r) => s + r.custoTotal, 0),
      pctObsoleto: grupo.length > 0 ? obs.length / grupo.length : 0,
    }
  })

  return { totalItens, custoTotal, pvTotal, porStatus, porLoja, porTipo, obsItens, obsCusto, obsPv, pctObsoleto }
}

export function exportarEstoqueCSV(itens, cols) {
  const fmtDt  = dt => dt instanceof Date ? dt.toLocaleDateString('pt-BR') : '—'
  const fmtN   = v  => v != null ? String(Number(v).toFixed(2)).replace('.', ',') : '0'
  const fmtPct = v  => v > 0 ? `${(v * 100).toFixed(1)}%` : '—'
  const q = csvCell

  // uma coluna por loja de destino quando "Transferível" está ativo
  const lojasDestino = cols?.transferivel
    ? [...new Set(itens.flatMap(r => (r.sugestoes || []).map(s => s.loja)))].sort()
    : []

  const cab = [
    'Loja', 'Código', 'Descrição', 'Tipo', 'Qtde',
    ...(cols?.custoUnit  !== false ? ['Custo Unit.'] : []),
    'Custo Total',
    ...(cols?.pvUnit     ? ['PV Unit.']        : []),
    ...(cols?.pvTotal    !== false ? ['PV Total'] : []),
    ...(cols?.margem     ? ['Margem %']        : []),
    ...(cols?.dtEntrada  ? ['Última Entrada']  : []),
    ...(cols?.dtSaida    ? ['Última Saída']    : []),
    ...(cols?.dias       ? ['Dias']            : []),
    'Curva',
    ...lojasDestino.map(l => `→ ${l}`),
  ]

  const linhas = itens.map(r => {
    const margem = r.pvTotal > 0 ? (r.pvTotal - r.custoTotal) / r.pvTotal : null
    const destinosItem = new Set((r.sugestoes || []).map(s => s.loja))
    return [
      q(r.loja), q(r.codigo), q(r.descricao), q(r.tipo), q(r.saldo),
      ...(cols?.custoUnit  !== false ? [q(fmtN(r.custoUnitario))] : []),
      q(fmtN(r.custoTotal)),
      ...(cols?.pvUnit     ? [q(fmtN(r.pvUnitario))]           : []),
      ...(cols?.pvTotal    !== false ? [q(fmtN(r.pvTotal))]    : []),
      ...(cols?.margem     ? [q(fmtPct(margem))]               : []),
      ...(cols?.dtEntrada  ? [q(fmtDt(r.dtEntrada))]           : []),
      ...(cols?.dtSaida    ? [q(fmtDt(r.dtSaida))]             : []),
      ...(cols?.dias       ? [q(r.diasReferencia ?? '—')]       : []),
      q(CURVA_META[r.status]?.label ?? r.status),
      ...lojasDestino.map(l => destinosItem.has(l) ? '"✓"' : '""'),
    ].join(';')
  })

  return [cab.join(';'), ...linhas].join('\n')
}
