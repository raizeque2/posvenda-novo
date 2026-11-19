import {matchesChannel} from './revenue.js'
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from './Chart.jsx'

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

export function periodTrend(rows, channel, metric, target, windowDays, now = new Date(), historicalRows = [], comparisonDays = windowDays) {
  const records = rows.filter(row => matchesChannel(row,channel) && row.date !== 'Sem data' && (metric !== 'quantity' || row.quantity != null))
  if (!records.length) return { points: [], total: 0, projected: 0, target, delta: null }
  const allRecords = [...historicalRows, ...records].filter(row => matchesChannel(row,channel) && row.date !== 'Sem data' && (metric !== 'quantity' || row.quantity != null))
  const last = records.reduce((value, row) => row.date > value ? row.date : value, '')
  const [year, month] = last.split('-').map(Number)
  const monthEnd = new Date(year, month, 0)
  const currentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const latestInBase = rows.reduce((value, row) => row.date !== 'Sem data' && row.date > value ? row.date : value, last)
  const cutoff = currentMonth ? new Date(year, month - 1, Math.min(now.getDate(), Number(latestInBase.slice(8, 10)), monthEnd.getDate())) : monthEnd
  const start = addDays(cutoff, -windowDays + 1)
  const daily = new Map()
  for (const row of allRecords) {
    const value = metric === 'records' ? 1 : metric === 'quantity' ? row.quantity : row.value
    daily.set(row.date, (daily.get(row.date) || 0) + value)
  }
  const total = records.filter(row => row.date <= dayKey(cutoff)).reduce((sum, row) => sum + (metric === 'records' ? 1 : metric === 'quantity' ? row.quantity : row.value), 0)
  const elapsed = Math.max(1, cutoff.getDate())
  const average = total / elapsed
  const projected = currentMonth ? average * monthEnd.getDate() : total
  const points = []
  for (let date = start; date <= monthEnd; date = addDays(date, 1)) {
    const observed = date <= cutoff
    points.push({ day: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date), actual: observed ? (daily.get(dayKey(date)) || 0) : null, projection: observed ? null : average, target: target > 0 ? target / monthEnd.getDate() : null })
  }
  const recentStart = addDays(cutoff, -comparisonDays + 1)
  const previousEnd = addDays(recentStart, -1)
  const previousStart = addDays(previousEnd, -comparisonDays + 1)
  const prior = allRecords.filter(row => row.date >= dayKey(previousStart) && row.date <= dayKey(previousEnd))
  const recent = allRecords.filter(row => row.date >= dayKey(recentStart) && row.date <= dayKey(cutoff))
  const periodValue = list => list.reduce((sum, row) => sum + (metric === 'records' ? 1 : metric === 'quantity' ? row.quantity : row.value), 0)
  const priorValue = periodValue(prior)
  const delta = priorValue > 0 ? (periodValue(recent) / priorValue - 1) * 100 : null
  return { points, total, projected, target, delta }
}

// Mês atual até o dia N contra o mesmo trecho (dias 1 a N) do mês passado: faturamento,
// quantidade de vendas (nº de requisição/O.S. distintos; sem número, conta a linha) e média diária.
export function comparativoMensal(rows, historicalRows, channel, now = new Date()) {
  const todos = [...historicalRows, ...rows].filter(row => matchesChannel(row, channel) && row.date !== 'Sem data')
  const doCanal = rows.filter(row => matchesChannel(row, channel) && row.date !== 'Sem data')
  if (!doCanal.length) return null
  const last = doCanal.reduce((v, row) => row.date > v ? row.date : v, '')
  const [ano, mes] = last.split('-').map(Number)
  const fimMes = new Date(ano, mes, 0).getDate()
  const corrente = now.getFullYear() === ano && now.getMonth() + 1 === mes
  const latest = rows.reduce((v, row) => row.date !== 'Sem data' && row.date > v ? row.date : v, last)
  const dia = corrente ? Math.min(now.getDate(), Number(latest.slice(8, 10)), fimMes) : fimMes
  const anterior = new Date(ano, mes - 2, 1)
  const diaAnterior = Math.min(dia, new Date(anterior.getFullYear(), anterior.getMonth() + 1, 0).getDate())
  const prefixo = (a, m) => `${a}-${String(m).padStart(2, '0')}-`
  const resumo = (pref, ate) => {
    const lista = todos.filter(row => row.date.startsWith(pref) && Number(row.date.slice(8, 10)) <= ate)
    const valor = lista.reduce((s, row) => s + (Number(row.value) || 0), 0)
    const docs = new Set(), semDoc = lista.filter(row => row.value > 0 && !row.doc).length
    for (const row of lista) if (row.value > 0 && row.doc) docs.add(`${row.store}|${row.doc}`)
    return { valor, vendas: docs.size + semDoc, media: valor / Math.max(1, ate), temDados: lista.length > 0 }
  }
  const atual = resumo(prefixo(ano, mes), dia)
  const passado = resumo(prefixo(anterior.getFullYear(), anterior.getMonth() + 1), diaAnterior)
  const delta = (a, b) => passado.temDados && b > 0 ? (a / b - 1) * 100 : null
  return {
    dia, atual, passado,
    deltas: { valor: delta(atual.valor, passado.valor), vendas: delta(atual.vendas, passado.vendas), media: delta(atual.media, passado.media) },
  }
}

const pct = v => `${v >= 0 ? '▲ +' : '▼ '}${v.toFixed(1).replace('.', ',')}%`
export function ComparativoMes({ rows, historicalRows, channel }) {
  const c = comparativoMensal(rows, historicalRows, channel)
  if (!c) return null
  const itens = [
    ['Faturamento', money(c.atual.valor), c.deltas.valor, 'graph-up'],
    ['Quantidade de vendas', new Intl.NumberFormat('pt-BR').format(c.atual.vendas), c.deltas.vendas, 'shopping-bag'],
    ['Média diária', money(c.atual.media), c.deltas.media, 'calendar'],
  ]
  return <div className="bi-kpi-comparativo" aria-label={`Comparação com os dias 1 a ${c.dia} do mês passado`}>
    {itens.map(([rotulo, valor, d, icone]) => <div key={rotulo}>
      <i aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><use href={`/icons/iconoir.svg#${icone}`}/></svg></i>
      <span><span>{rotulo}</span><strong>{valor}</strong><small className={d == null ? undefined : d >= 0 ? 'bi-delta-sobe' : 'bi-delta-desce'}>{d == null ? 'Sem base no mês passado' : `${pct(d)} vs. mês passado`}</small></span>
    </div>)}
    <p>Dias 1 a {c.dia} deste mês contra os mesmos dias do mês passado.</p>
  </div>
}

export function KpiTrends({ rows, historicalRows = [], channel, metric, target, days, onDaysChange, comparisonDays, onComparisonChange, chartType, onChartTypeChange }) {
  const result = periodTrend(rows, channel, metric, target, days, new Date(), historicalRows, comparisonDays)
  const fmt = metric === 'value' ? money : value => new Intl.NumberFormat('pt-BR').format(value)
  return <div className="bi-kpi-trend">
    <div className="bi-kpi-trend-controls"><label>Exibir <select aria-label={`Período do gráfico ${channel}`} value={days} onChange={event => onDaysChange(Number(event.target.value))}><option value={7}>7 dias</option><option value={30}>30 dias</option></select></label><label>Comparar <select aria-label={`Comparação do gráfico ${channel}`} value={comparisonDays} onChange={event => onComparisonChange(Number(event.target.value))}><option value={7}>Semana</option><option value={30}>Mês</option><option value={90}>Trimestre</option></select></label><label>Formato <select aria-label={`Formato do gráfico ${channel}`} value={chartType} onChange={event => onChartTypeChange(event.target.value)}><option value="line">Linhas</option><option value="bar">Barras</option><option value="area">Área</option></select></label></div>
    {result.points.length ? <>
      <div className="bi-kpi-trend-grafico"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={result.points} margin={{top:5,right:12,bottom:0,left:0}}><CartesianGrid strokeDasharray="3 3" stroke="#e6e9ef"/><XAxis dataKey="day" fontSize={9} interval="preserveStartEnd"/><YAxis tickFormatter={n => new Intl.NumberFormat('pt-BR',{notation:'compact'}).format(n)} fontSize={9} width={42}/><Tooltip formatter={(value, name) => [fmt(value), name === 'actual' ? 'Realizado' : name === 'projection' ? 'Projeção diária' : 'Meta diária']}/>{chartType === 'bar' ? <Bar dataKey="actual" fill="#c40013" maxBarSize={18}/> : chartType === 'area' ? <Area type="monotone" dataKey="actual" stroke="#c40013" fill="#f8cfd3" strokeWidth={2} connectNulls={false}/> : <Line type="monotone" dataKey="actual" stroke="#c40013" strokeWidth={2.5} dot={false} connectNulls={false}/>}<Line type="monotone" dataKey="projection" stroke="#8893a4" strokeWidth={2} strokeDasharray="5 3" dot={false}/><Line type="linear" dataKey="target" stroke="#54657b" strokeDasharray="3 3" strokeWidth={1.5} dot={false}/></ComposedChart></ResponsiveContainer></div>
      <div className="bi-kpi-trend-legend"><span>● Realizado</span><span>┄ Projeção</span><span>┄ Meta</span></div>
      <div className="bi-kpi-trend-summary"><span>Projetado no mês <strong>{fmt(result.projected)}</strong></span>{target > 0 && <span>Faltam <strong>{fmt(Math.max(0, target - result.total))}</strong> · {Math.max(0, Math.round((1 - result.total / target) * 100))}%</span>}<span className={result.delta == null ? undefined : result.delta >= 0 ? 'bi-delta-sobe' : 'bi-delta-desce'}>{result.delta == null ? `Sem base no período anterior` : `${result.delta >= 0 ? '▲ +' : '▼ '}${result.delta.toFixed(1).replace('.', ',')}% ante ${comparisonDays === 7 ? 'a semana' : comparisonDays === 30 ? 'o mês' : 'o trimestre'} anterior`}</span></div>
      <small>Projeção pela média diária do mês; não é venda confirmada.</small>
    </> : <p>Sem vendas com data neste canal.</p>}
  </div>
}
