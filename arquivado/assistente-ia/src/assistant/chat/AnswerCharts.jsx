import { useId, useState } from 'react'
import { Chart } from '../../bi/Chart.jsx'
import { fmtBRL2 as money } from '../../utils/formatacao.js'

const types = { line: 'Linhas', bar: 'Barras', area: 'Área', donut: 'Rosca', pie: 'Pizza' }
const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : 'Sem data'

function AnswerChart({ chart }) {
  const [selected, setSelected] = useState(null), id = useId()
  const data = (chart.data || []).filter(row => typeof row.name === 'string' && Number.isFinite(row.value)).slice(0, chart.dimension === 'date' ? 93 : 40)
  const negative = data.some(row => row.value < 0)
  const requested = selected || chart.type, type = types[requested] && !(negative && ['pie', 'donut'].includes(requested)) ? requested : 'bar'
  return <figure className="chat-sales-chart">
    <figcaption><div><strong>{chart.title}</strong><small>{chart.period} · {chart.scope || 'Dados disponíveis'}</small></div><label htmlFor={id}><span className="sr-only">Tipo de gráfico: {chart.title}</span><select id={id} value={type} onChange={event => setSelected(event.target.value)}>{Object.entries(types).map(([value, label]) => <option key={value} value={value} disabled={negative && ['pie', 'donut'].includes(value)}>{label}</option>)}</select></label></figcaption>
    <div className="chat-sales-chart-summary"><strong>{money(chart.total ?? data.reduce((sum, row) => sum + row.value, 0))}</strong><span>Total exibido · registros até {dateLabel(chart.through)}</span></div>
    <div className="chat-sales-chart-plot"><Chart data={data} type={type} color="var(--honda)" options={{ legend: type === 'pie' || type === 'donut' }}/></div>
    <p>{chart.note}</p>
  </figure>
}

export default function AnswerCharts({ charts }) {
  return <div className="chat-sales-charts">{charts.slice(0, 3).map((chart, index) => <AnswerChart key={chart.id || index} chart={chart}/>)}</div>
}
