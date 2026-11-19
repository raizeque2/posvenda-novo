import {mainChannel,isVirtualAccount} from './revenueChannels.js'
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
const words = value => fold(value).replace(/[^A-Z0-9]+/g, ' ').trim()
const mentions = (question, value) => (` ${words(question)} `).includes(` ${words(value)} `)

// Input is the BI's normalized sales shape. Output contains aggregates only.
export function salesFacts(rows, month, question = '') {
  const [m, y] = month.split('/'), prefix = `${y}-${m}-`, q = fold(question)
  let scoped = rows.filter(row => ['pieces', 'services'].includes(row.source) && Number.isFinite(row.value) && (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date.startsWith(prefix)))
  const scope = []
  const source = /MAO DE OBRA|SERVIC/.test(q) && !/PECA/.test(q) ? 'services' : /PECA/.test(q) && !/MAO DE OBRA|SERVIC/.test(q) ? 'pieces' : ''
  if (source) { scoped = scoped.filter(row => row.source === source); scope.push(source === 'pieces' ? 'Peças' : 'Mão de obra') }
  const names = [...new Set(scoped.map(row => row.person).filter(Boolean))]
  const matches = names.filter(name => mentions(question, name))
  const firstNames = names.filter(name => words(name).split(' ').length > 1 && mentions(question, words(name).split(' ')[0]))
  const people = matches.length ? matches : firstNames.length === 1 ? firstNames : []
  if (people.length) { scoped = scoped.filter(row => people.some(person => fold(row.person) === fold(person))); scope.push(people.join(', ')) }
  for (const field of ['channel', 'store']) {
    const selected = [...new Set(scoped.map(row => row[field]).filter(Boolean))].filter(value => mentions(question, value))
    if (selected.length) { scoped = scoped.filter(row => selected.includes(row[field])); scope.push(selected.join(', ')) }
  }
  const group = (dimension, datedOnly = false) => {
    const groups = new Map()
    for (const row of scoped) {
      if (datedOnly && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue
      if(dimension==='person'&&(row.teamEligible===false||isVirtualAccount(row.person)))continue
      const name = (dimension==='channel'?mainChannel(row):row[dimension]) || 'Sem responsável', id = dimension === 'person' ? fold(name) : name
      const item = groups.get(id) || { name, value: 0, records: 0 }
      item.value += row.value; item.records++; groups.set(id, item)
    }
    return [...groups.values()].sort(dimension === 'date' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.value - a.value)
  }
  const daily = group('date', true).slice(0, 31)
  return { daily, channels: group('channel').slice(0, 40), people: group('person').slice(0, 300), total: scoped.reduce((sum, row) => sum + row.value, 0), through: daily.at(-1)?.name || null, undated: scoped.filter(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.date)).length, scope: scope.join(' · ') || 'Todos os dados autorizados' }
}

export const chartInstructions = 'A interface renderiza os gráficos interativos listados em context.visualizations, usando os dados agregados de context.sales. Quando houver visualizations, explique os resultados desses gráficos; não diga que não pode criar gráficos, não produza código, Mermaid, imagens ou gráficos em texto. Não invente séries, datas, metas ou projeções. Só o período e o recorte indicados em cada gráfico estão disponíveis. Se context.chartNotice existir, explique essa limitação. Dias sem registros não comprovam vendas zero; a última data não garante carga completa.'

// Recipes are allowlisted; the model never supplies chart code or numeric series.
export function chartReply(context, question) {
  const q = fold(question)
  if (context.query) {
    if (context.query.visualization.requested && /QUANTIDADE|TICKET|MARGEM|COMISSAO|ESTOQUE|PROJECAO/.test(q)) return { chartNotice: 'Esta consulta disponibiliza séries de receita de vendas. A métrica solicitada precisa ser consultada na página correspondente.' }
    return analysisCharts(context)
  }
  if (!/GRAFIC|EVOLU|PARTICIP|DISTRIB|RANKING|MAIS VEND|VENDE MAIS|VENDAS|PIZZA|ROSCA|BARRAS/.test(q) || /AJUST|ALTER.*META|AUMENT.*META/.test(q)) return {}
  if (/QUANTIDADE|TICKET|MARGEM|COMISSAO|ESTOQUE|PROJECAO/.test(q) || (/META/.test(q) && !/VENDAS/.test(q))) return { chartNotice: 'Os gráficos disponíveis nesta consulta representam receita de vendas. Esta métrica precisa ser consultada na página correspondente.' }
  const explicit = question.match(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/)
  const months = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
  const namedMonth = months.findIndex(name => mentions(question, name))
  const year = question.match(/\b20\d{2}\b/)?.[0]
  if ((explicit && `${explicit[1].padStart(2, '0')}/${explicit[2]}` !== context.month) || (year && year !== context.month.split('/')[1]) || /MES PASSADO|MES ANTERIOR|ULTIMOS.*(?:MESES|DIAS)|HOJE|ONTEM|SEMANA|TRIMESTRE|POR ANO/.test(q) || (namedMonth >= 0 && namedMonth + 1 !== Number(context.month.split('/')[0]))) return { chartNotice: `Esta consulta dispõe de gráficos apenas do mês ${context.month}. O período solicitado não está neste contexto.` }
  const sales = context.sales
  if (!sales) return { chartNotice: 'As séries de vendas não estão disponíveis nesta consulta.' }
  const ranking = /RANKING|MAIS VEND|VENDE MAIS|COLABORADOR|POR PESSOA/.test(q), channels = /POR SETOR|POR CANAL|PARTICIP|DISTRIB|PIZZA|ROSCA/.test(q), daily = /POR DIA|DIARI|EVOLU|ACUMUL/.test(q)
  const dimensions = ranking ? ['person'] : channels && !daily ? ['channel'] : daily && !channels ? ['date'] : ['date', 'channel']
  const requestedType = /BARRA/.test(q) ? 'bar' : /AREA/.test(q) ? 'area' : /LINHA/.test(q) ? 'line' : /PIZZA/.test(q) ? 'pie' : /ROSCA/.test(q) ? 'donut' : null
  const charts = dimensions.flatMap(dimension => {
    let data = (sales[{ date: 'daily', channel: 'channels', person: 'people' }[dimension]] || []).slice(0, dimension === 'person' ? 8 : dimension === 'date' ? 31 : 40)
    if (!data.length) return []
    const accumulated = dimension === 'date' && /ACUMUL/.test(q)
    if (accumulated) { let total = 0; data = data.map(row => ({ ...row, value: total += row.value })) }
    let type = requestedType || (dimension === 'date' ? 'line' : 'bar'), note = 'Receita líquida · peças + mão de obra, sem duplicar técnicos. Apenas registros disponíveis.'
    if (sales.scope !== 'Todos os dados autorizados') note = `Receita líquida · ${sales.scope}. Apenas registros disponíveis.`
    if ((type === 'pie' || type === 'donut') && data.some(row => row.value < 0)) { type = 'bar'; note += ' Barras preservam os valores negativos das devoluções.' }
    if (sales.undated && dimension === 'date') note += ` ${sales.undated} registro(s) sem data ficam fora desta série.`
    return [{ id: dimension, dimension, type, title: dimension === 'date' ? accumulated ? 'Vendas acumuladas' : 'Evolução diária das vendas' : dimension === 'channel' ? 'Vendas por setor' : 'Maiores vendas por colaborador · até 8 pessoas', period: context.month, scope: sales.scope, through: sales.through, note, total: accumulated ? data.at(-1).value : data.reduce((sum, row) => sum + row.value, 0), data }]
  })
  return charts.length ? { charts } : { chartNotice: `Sem vendas registradas para este recorte em ${context.month}.` }
}

function analysisCharts(context) {
  const { query, sales } = context, view = query.visualization
  if (!view.requested) return {}
  if (!sales || !sales.daily.length && !sales.channels.length) return { chartNotice: 'Sem vendas disponíveis para os períodos e filtros desta consulta.' }
  const dimensions = view.dimension === 'overview' ? query.months.length > 1 ? ['month'] : ['date', 'channel'] : [view.dimension]
  const charts = dimensions.flatMap(dimension => {
    let data = (sales[{ month: 'periods', date: 'daily', channel: 'channels', person: 'people' }[dimension]] || []).slice(0, dimension === 'person' ? 8 : dimension === 'date' ? 93 : 40)
    if (!data.length) return []
    const accumulated = dimension === 'date' && view.accumulated
    if (accumulated) { let total = 0; data = data.map(row => ({ ...row, value: total += row.value })) }
    let type = view.type || (dimension === 'date' ? 'line' : 'bar')
    if (['pie', 'donut'].includes(type) && data.some(row => row.value < 0)) type = 'bar'
    return [{ id: dimension, dimension, type, title: dimension === 'month' ? 'Comparativo de vendas por mês' : dimension === 'date' ? accumulated ? 'Vendas acumuladas' : 'Evolução diária das vendas' : dimension === 'channel' ? 'Vendas por setor' : 'Maiores vendas por colaborador · até 8 pessoas', period: context.month, scope: sales.scope, through: sales.through, note: 'Receita líquida dos dados autorizados. Devoluções descontadas e mão de obra contada uma vez. Consulte as fontes e os valores abaixo.', total: accumulated ? data.at(-1).value : data.reduce((sum, row) => sum + row.value, 0), data }]
  })
  return charts.length ? { charts } : { chartNotice: 'Não há série disponível para esta combinação.' }
}

export function chartContext(context, question) {
  const reply = chartReply(context, question)
  return { ...context, visualizations: reply.charts?.map(({ data, ...chart }) => chart) || [], ...(reply.chartNotice ? { chartNotice: reply.chartNotice } : {}) }
}
