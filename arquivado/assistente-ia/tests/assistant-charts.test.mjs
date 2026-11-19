import test from 'node:test'
import assert from 'node:assert/strict'
import { salesFacts, chartReply } from '../functions/src/assistantCharts.js'
import { normalize, aggregate } from '../src/bi/model.js'
import { homeSummary } from '../src/analytics/home.js'
import { previewGeminiContext } from '../src/assistant/gemini-preview.js'

const month = '10/2026', now = new Date(2026, 9, 15, 12)
const pieces = [
  { dt: new Date(2026, 9, 1, 12), empresa: 'ARA', cat: 'VAREJO', responsavel: 'ANA COSTA', valor: 100 },
  { dt: new Date(2026, 9, 1, 12), empresa: 'ARA', cat: 'VAREJO', responsavel: 'ANA COSTA', valor: 20, eDevolucao: true },
  { dt: new Date(2026, 9, 3, 12), empresa: 'PEI', cat: 'WEB', responsavel: 'BIA', valor: 200 },
]
const services = [{ dt: new Date(2026, 9, 3, 12), empresa: 'ARA', consultor: 'ELISA', tecnico: 'FELIPE', mo: 300 }]
const rows = [...normalize(pieces), ...normalize(services, true)]

test('gráficos mensais usam as mesmas receitas líquidas e agrupamentos do BI, com MO uma vez', () => {
  const sales = salesFacts(rows, month)
  assert.equal(sales.total, 580)
  assert.deepEqual(sales.daily, aggregate(rows, { dimension: 'date', metric: 'value', limit: 31 }))
  assert.deepEqual(sales.channels, aggregate(rows, { dimension: 'channel', metric: 'value', limit: 40 }))
  const reply = chartReply({ month, sales }, 'Faça gráficos de vendas desse mês')
  assert.deepEqual(reply.charts.map(chart => chart.dimension), ['date', 'channel'])
  assert.equal(reply.charts[0].data.reduce((sum, point) => sum + point.value, 0), 580)
  assert.equal(reply.charts[0].period, month)
  assert.equal(sales.through, '2026-10-03')
  assert.equal(sales.daily.length, 2) // No invented zeros for missing or future dates.
})

test('pedido de pessoa, loja, canal e fonte mantém o recorte explícito e não duplica técnicos', () => {
  const sales = salesFacts(rows, month, 'Gráfico de peças da Ana Costa no varejo ARA')
  assert.equal(sales.total, 80)
  assert.match(sales.scope, /ANA COSTA/)
  assert.match(sales.scope, /VAREJO/)
  assert.ok(!JSON.stringify(sales).includes('BIA'))
  const mo = salesFacts(rows, month, 'Gráfico de mão de obra')
  assert.equal(mo.total, 300)
  assert.equal(mo.people.length, 1)
  assert.equal(mo.people[0].name, 'ELISA')
})

test('tipos pedidos são limitados aos componentes do BI; pizza com devolução negativa vira barras', () => {
  const sales = salesFacts(rows, month)
  assert.equal(chartReply({ month, sales }, 'Gráfico de área acumulado por dia').charts[0].type, 'area')
  assert.deepEqual(chartReply({ month, sales }, 'Gráfico acumulado por dia').charts[0].data.map(row => row.value), [80, 580])
  const negative = salesFacts([{ ...rows[0], value: -10 }], month)
  const chart = chartReply({ month, sales: negative }, 'Pizza de vendas por setor').charts[0]
  assert.equal(chart.type, 'bar')
  assert.match(chart.note, /negativ/)
  assert.equal(chartReply({ month, sales }, 'Ranking de vendas').charts[0].dimension, 'person')
  assert.equal(chartReply({ month, sales }, 'Pizza por setor').charts[0].type, 'pie')
  assert.deepEqual(chartReply({ month, sales }, 'Aumente a meta em 10%'), {})
})

test('período ausente, falta de dados e datas inválidas não viram gráficos fictícios', () => {
  const sales = salesFacts(rows, month)
  assert.equal(chartReply({ month, sales }, 'Gráficos de 09/2026').charts, undefined)
  assert.match(chartReply({ month, sales }, 'Gráficos do mês passado').chartNotice, /10\/2026/)
  assert.match(chartReply({ month, sales }, 'Gráfico de metas').chartNotice, /métrica/)
  assert.equal(chartReply({ month, sales }, 'Gráficos de vendas de outubro de 2025').charts, undefined)
  assert.match(chartReply({ month, sales: salesFacts([], month) }, 'Gráficos de vendas').chartNotice, /Sem vendas/)
  assert.deepEqual(salesFacts([{ ...rows[0], date: '2026-09-30' }, { ...rows[0], date: 'inválida' }], month).daily, [])
})

test('prévia envia agregados do mesmo recorte autorizado e exclui datas futuras, registros e emails', () => {
  const state = { pecasPorMes: { [month]: [...pieces, { ...pieces[0], dt: new Date(2026, 9, 31), valor: 999 }] }, oficinaPorMes: { [month]: services }, colaboradoresPorMes: {}, metasPorMes: {}, apelidoMap: {}, regras: {}, lojas: {} }
  const summary = homeSummary(state, { full: true, estados: ['AL'], now })
  const context = previewGeminiContext(summary, 'Gráficos de vendas')
  assert.equal(context.sales.total, 380)
  assert.ok(!JSON.stringify(context.sales).includes('BIA'))
  assert.ok(!JSON.stringify(context).includes('nrReq'))
  assert.equal(context.sales.through, '2026-10-03')
  const personal = previewGeminiContext(homeSummary(state, { full: false, name: 'ANA COSTA', now }), 'Gráficos de vendas')
  assert.equal(personal.sales.total, 80)
  const technician = previewGeminiContext(homeSummary(state, { full: false, name: 'FELIPE', now }), 'Gráficos de vendas')
  assert.equal(technician.sales.total, 300)
  assert.equal(technician.sales.people[0].name, 'FELIPE')
  assert.ok(!JSON.stringify(technician.sales).includes('ELISA'))
})
