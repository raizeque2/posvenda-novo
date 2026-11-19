import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts'
import { AppleActivityCard } from '../../components/ui/apple-activity-ring'
import { FiltroAnoMes, EmptyState } from '../../components/DS.jsx'
import { BarChart2 } from '../../icons/iconoir'
import { activityPeriods } from '../../analytics/activity.js'
import { availableMonths, monthKey, personMonth } from '../../analytics/personal.js'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { fmtBRL2 as money } from '../../utils/formatacao.js'
import { resumoMeta } from './portal.logic.js'
import '../../theme/operations.css'
import './portal.css'

const labels = { mp: 'Peças', mo: 'Mão de obra', mpo: 'Peças de O.S.' }
const short = n => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

/**
 * Dashboard do colaborador: anéis de meta (dia, semana, mês + projeção),
 * números de quanto falta e do necessário por dia útil, evolução e calendário.
 * A pessoa só vê a si mesma; nada aqui sai do escopo do próprio perfil.
 */
export default function MeuDesempenho() {
  const { nome, nomeExibicao } = useAuth()
  const pecasPorMes = useStore(state => state.pecasPorMes)
  const oficinaPorMes = useStore(state => state.oficinaPorMes)
  const colaboradoresPorMes = useStore(state => state.colaboradoresPorMes)
  const metasPorMes = useStore(state => state.metasPorMes)
  const bonificacoes = useStore(state => state.bonificacoes)
  const apelidoMap = useStore(state => state.apelidoMap)
  const regras = useStore(state => state.regras)
  const comissaoGestao = useStore(state => state.comissaoGestao)
  const lojas = useStore(state => state.lojas)

  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [metric, setMetric] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)

  // Só os pedaços usados pela conta — o memo não depende do store inteiro.
  const dados = useMemo(() => ({ pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, bonificacoes, apelidoMap, regras, comissaoGestao, lojas }), [pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, bonificacoes, apelidoMap, regras, comissaoGestao, lojas])
  const months = useMemo(() => availableMonths(dados), [dados])
  const preliminar = useMemo(() => personMonth(dados, nome, month, 'mp'), [dados, nome, month])
  const options = ['mp', 'mo', 'mpo'].filter(k => preliminar.entry?.[k] > 0 || (k === 'mp' ? preliminar.real : k === 'mo' ? preliminar.entry?.moreal : preliminar.entry?.pocoficina) > 0)
  const activeMetric = options.includes(metric) ? metric : options[0] || 'mp'
  const d = useMemo(() => (activeMetric === 'mp' ? preliminar : personMonth(dados, nome, month, activeMetric)), [dados, nome, month, activeMetric, preliminar])
  const resumo = resumoMeta(d)
  const pontos = d.calendar.map(point => {
    const abaixo = point.real === null ? null : Math.min(point.real, point.target || Infinity)
    const acima = point.real === null ? null : Math.max(0, point.real - (point.target || Infinity))
    return { label: point.label, meta: point.target, real: point.real, projecao: point.projection, abaixo, acima }
  })
  const dia = selectedDay ? d.calendar.find(point => point.day === selectedDay) : null

  if (!nome) {
    return (
      <div className="page">
        <EmptyState icon={BarChart2} title="Perfil não vinculado" sub="Seu acesso não está ligado a um colaborador. Peça ao administrador para ajustar o cadastro." />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="operations-header">
        <div>
          <p>Acompanhamento individual</p>
          <h1>{nomeExibicao || nome}</h1>
          <span>{d.entry?.cargo || 'Colaborador'}{d.entry?.cargoMovimento ? ` · ${d.entry.cargoMovimento}` : ''}</span>
        </div>
        <FiltroAnoMes meses={months} value={month} onChange={value => { setMonth(value); setSelectedDay(null) }} />
      </div>

      <div className="tab-nav">
        {options.map(k => (
          <button key={k} className={`tab-btn ${k === activeMetric ? 'active' : ''}`} onClick={() => { setMetric(k); setSelectedDay(null) }}>{labels[k]}</button>
        ))}
      </div>

      <div className="operations-kpis">
        <article>
          <span>Realizado · {labels[activeMetric]}</span>
          <strong>{money(resumo.real)}</strong>
          <small>{resumo.pct === null ? 'Meta não cadastrada' : `${resumo.pct.toFixed(1)}% da meta de ${money(resumo.meta)}`}</small>
        </article>
        <article>
          <span>Projeção do mês</span>
          <strong>{resumo.projecao === null ? '—' : money(resumo.projecao)}</strong>
          <small className={resumo.meta && resumo.projecao !== null && resumo.projecao < resumo.meta ? 'status-attention' : 'status-good'}>
            {resumo.projecao === null ? 'Sem base para projetar' : resumo.meta ? `${resumo.projecao >= resumo.meta ? 'Acima' : 'Abaixo'} da meta em ${money(Math.abs(resumo.projecao - resumo.meta))}` : 'Defina uma meta para comparar'}
          </small>
        </article>
        <article>
          <span>Falta para a meta</span>
          <strong>{resumo.meta ? resumo.textoFalta : '—'}</strong>
          <small>{resumo.meta && resumo.pct !== null ? `${Math.max(0, 100 - resumo.pct).toFixed(1)}% restante` : 'Sem meta neste mês'}</small>
        </article>
        <article>
          <span>Necessário por dia útil</span>
          <strong>{resumo.textoNecessario}</strong>
          <small>{resumo.diasRestantes.toLocaleString('pt-BR')} dias úteis restantes na base</small>
        </article>
      </div>

      <AppleActivityCard activities={activityPeriods(d, selectedDay)} />

      {/* A barra de meta entra aqui quando o desenho novo chegar. */}
      <div className="portal-meta-placeholder" data-placeholder="meta-bar">
        <strong>Barra de meta</strong>
        Aguardando o desenho final. Os números de meta, falta e necessário por dia útil já estão nos cartões acima.
      </div>

      <p className="data-caption">
        {d.cutoff
          ? `Registros até ${d.cutoff.toLocaleDateString('pt-BR')}. ${d.remaining === 0 ? 'Período encerrado na base: projeção igual ao realizado.' : d.historyMonths ? `Projeção dos dias restantes combina o ritmo atual com a média por dia útil de ${d.historyPeriods.join(', ')}.` : 'Sem histórico completo: projeção pelo ritmo atual.'} Sábado vale meio dia.`
          : 'Sem registros carregados neste mês. As metas continuam visíveis.'}
      </p>

      <section className="operations-panel">
        <header><div><h2>Evolução no mês</h2><p>Receita líquida acumulada e meta mensal · {labels[activeMetric]}</p></div></header>
        <div className="personal-trend">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 285 }}>
            <ComposedChart data={pontos} margin={{ top: 12, right: 12, bottom: 6, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey="label" minTickGap={26} fontSize={11} />
              <YAxis tickFormatter={short} fontSize={11} />
              <Tooltip formatter={(value, key) => [money(value), key]} contentStyle={{ background: 'var(--bg2)', borderColor: 'var(--border)' }} />
              <Area type="linear" dataKey="abaixo" name="Realizado até a meta" stackId="vendas" stroke="none" fill="#ef5964" fillOpacity={0.3} />
              <Area type="linear" dataKey="acima" name="Excedente da meta" stackId="vendas" stroke="none" fill="#23ae81" fillOpacity={0.5} />
              <Line type="linear" dataKey="real" name="Realizado" stroke="var(--text2)" dot={false} strokeWidth={1.5} />
              <Line type="stepAfter" dataKey="meta" name="Meta do mês" stroke="var(--text2)" strokeDasharray="5 4" dot={false} />
              <Line type="linear" dataKey="projecao" name="Projeção" stroke="#929ca9" strokeDasharray="3 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-key"><span>🔴 Abaixo da meta</span><span>🟢 Acima da meta</span><span>┄ Meta mensal</span><span>┄ Projeção cinza</span></div>
      </section>

      <div className="operations-columns">
        <section className="operations-panel">
          <header><div><h2>Vendas por dia</h2><p>{month} · Receita líquida · clique em um dia</p></div></header>
          <div className="sales-calendar">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(diaSemana => <small key={diaSemana}>{diaSemana}</small>)}
            {Array.from({ length: d.calendar[0]?.date.getDay() || 0 }, (_, i) => <i key={`espaco${i}`} />)}
            {d.calendar.map(point => (
              <button
                key={point.day}
                disabled={!point.observed}
                className={selectedDay === point.day ? 'selected' : ''}
                style={{ '--day-intensity': point.amount > 0 ? Math.min(0.24, 0.05 + 0.19 * point.amount / Math.max(1, ...d.calendar.map(item => item.amount))) : 0 }}
                onClick={() => setSelectedDay(point.day)}
                aria-label={`${point.day}/${month}: ${point.recorded ? money(point.amount) : 'sem registros'}${!point.observed ? ', fora da base' : ''}`}
              >
                <b>{point.day}</b><span>{point.recorded ? short(point.amount) : '—'}</span>
              </button>
            ))}
          </div>
          {dia && (
            <div role="status" className="day-detail">
              <strong>{dia.day}/{month} · {money(dia.amount)}</strong>
              <p>{dia.recorded ? 'Total líquido dos registros desse dia.' : 'Não há registros desse dia na base carregada.'}</p>
            </div>
          )}
        </section>

        <section className="operations-panel">
          <header><div><h2>Peças mais vendidas</h2><p>Receita líquida por produto · {month}</p></div></header>
          {d.products.length ? (
            <div className="personal-products">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 285 }}>
                <BarChart data={d.products} layout="vertical">
                  <XAxis type="number" tickFormatter={short} fontSize={10} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                  <Tooltip formatter={money} />
                  <Bar dataKey="value" name="Receita líquida" fill="var(--honda)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="data-caption">Sem peças atribuídas nesta métrica e período.</p>
          )}
        </section>
      </div>
    </div>
  )
}
