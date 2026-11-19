import { AppleActivityCard } from '../../components/ui/apple-activity-ring'
import { activityPeriods } from '../../analytics/activity.js'
import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts'
import useStore from '../../store.js'
import { FiltroAnoMes } from '../../components/DS.jsx'
import { fmtBRL2 as money } from '../../utils/formatacao.js'
import { availableMonths, monthKey, personMonth } from '../../analytics/personal.js'
import '../../theme/operations.css'

const labels={mp:'Peças',mo:'Mão de obra',mpo:'Peças de O.S.'}
const short=n=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(n)
export default function PersonalOverview({name}) {
  // Só os pedaços que a conta usa: assinar o store inteiro fazia esta tela
  // recalcular a cada mudança de filtro, upload ou carregamento.
  const pecasPorMes=useStore(s=>s.pecasPorMes),oficinaPorMes=useStore(s=>s.oficinaPorMes),colaboradoresPorMes=useStore(s=>s.colaboradoresPorMes),metasPorMes=useStore(s=>s.metasPorMes),bonificacoes=useStore(s=>s.bonificacoes),apelidoMap=useStore(s=>s.apelidoMap),regras=useStore(s=>s.regras),comissaoGestao=useStore(s=>s.comissaoGestao),lojas=useStore(s=>s.lojas)
  const state=useMemo(()=>({pecasPorMes,oficinaPorMes,colaboradoresPorMes,metasPorMes,bonificacoes,apelidoMap,regras,comissaoGestao,lojas}),[pecasPorMes,oficinaPorMes,colaboradoresPorMes,metasPorMes,bonificacoes,apelidoMap,regras,comissaoGestao,lojas])
  const [month,setMonth]=useState(monthKey(new Date())),[metric,setMetric]=useState(''),[range,setRange]=useState('month'),[selectedDay,setSelectedDay]=useState(null)
  const months=availableMonths(state), preliminary=useMemo(()=>personMonth(state,name,month,'mp'),[state,name,month])
  const options=['mp','mo','mpo'].filter(k=>preliminary.entry?.[k]>0 || (k==='mp'?preliminary.real: k==='mo'?preliminary.entry?.moreal:preliminary.entry?.pocoficina)>0)
  const activeMetric=options.includes(metric)?metric:options[0]||'mp'
  const d=useMemo(()=>activeMetric==='mp'?preliminary:personMonth(state,name,month,activeMetric),[state,name,month,activeMetric,preliminary])
  const history=useMemo(()=>months.map(m=>m===month?d:personMonth(state,name,m,activeMetric)).filter(p=>p.entry),[state,name,months.join(','),activeMetric,d,month])
  const points=(range==='month'?d.calendar.map(p=>({...p,label:p.label,target:d.target,value:p.real})):history.filter(h=>range==='year'?h.month.endsWith(month.split('/')[1]):true).map(h=>({label:h.month,target:h.target,value:h.cutoff?h.real:null,projection:h.month===month?h.projection:null}))).map(p=>({...p,below:p.value===null?null:Math.min(p.value,p.target||Infinity),above:p.value===null?null:Math.max(0,p.value-(p.target||Infinity))}))
  const daily=selectedDay?d.calendar.find(p=>p.day===selectedDay):null
  const hasSalesMethod=d.rows.some(r=>r.meioVenda||r['Meio de Venda'])
  const methods=Object.entries(d.rows.reduce((acc,r)=>{const key=r.meioVenda||r['Meio de Venda']||'Não informado';acc[key]=(acc[key]||0)+r.amount;return acc},{}))
  const pct=d.target>0?d.real/d.target*100:null
  return <section className="personal-overview" data-tour="personal-overview">
    <header className="operations-header"><div><p>Acompanhamento individual</p><h1>{name}</h1><span>{d.entry?.cargo||'Colaborador'}{d.entry?.cargoMovimento?` · ${d.entry.cargoMovimento}`:''}</span></div><FiltroAnoMes meses={months} value={month} onChange={v=>{setMonth(v);setSelectedDay(null)}}/></header>
    <div className="tab-nav">{options.map(k=><button key={k} className={`tab-btn ${k===activeMetric?'active':''}`} onClick={()=>{setMetric(k);setSelectedDay(null)}}>{labels[k]}</button>)}</div>
    <div className="operations-kpis" data-tour="personal-kpis">
      <article><span>Realizado · {labels[activeMetric]}</span><strong>{money(d.real)}</strong><small>{pct===null?'Meta não cadastrada':`${pct.toFixed(1)}% da meta de ${money(d.target)}`}</small></article>
      <article><span>Projeção do mês</span><strong>{d.projection===null?'—':money(d.projection)}</strong><small className={d.target&&d.projection<d.target?'status-attention':'status-good'}>{d.projection===null?'Sem base para projetar':d.target?`${d.projection>=d.target?'Acima':'Abaixo'} da meta em ${money(Math.abs(d.projection-d.target))}`:'Defina uma meta para comparar'}</small></article>
      <article><span>Falta para a meta</span><strong>{d.target?money(d.gap):'—'}</strong><small>{d.target?`${Math.max(0,100-(pct||0)).toFixed(1)}% restante`:'Sem meta neste mês'}</small></article>
      <article><span>Necessário por dia útil</span><strong>{d.needed===null||!d.target?'—':money(d.needed)}</strong><small>{d.remaining.toLocaleString('pt-BR')} dias úteis restantes na base</small></article>
    </div>
    <AppleActivityCard activities={activityPeriods(d,selectedDay)}/>
    <p className="data-caption">{d.cutoff?`Registros até ${d.cutoff.toLocaleDateString('pt-BR')}. ${d.remaining===0?'Período encerrado na base: projeção igual ao realizado.':d.historyMonths?`Projeção dos dias restantes combina o ritmo atual com a média por dia útil de ${d.historyPeriods.join(', ')} desta pessoa, na mesma métrica.`:'Sem histórico completo desta pessoa: projeção pelo ritmo atual.'} Sábado vale meio dia.`:'Sem registros carregados neste mês. Metas continuam visíveis.'}</p>
    <section className="operations-panel"><header><div><h2>Evolução pessoal</h2><p>{range==='month'?'Receita líquida acumulada e meta mensal':'Cada ponto usa a meta do próprio mês'} · {labels[activeMetric]}</p></div><select aria-label="Período da evolução pessoal" value={range} onChange={e=>setRange(e.target.value)}><option value="month">Mês selecionado</option><option value="year">Ano selecionado</option><option value="history">Todos os meses</option></select></header>
      <div className="personal-trend"><ResponsiveContainer width="100%" height="100%" initialDimension={{width:320,height:285}}><ComposedChart data={points} margin={{top:12,right:12,bottom:6,left:0}}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 4"/><XAxis dataKey="label" minTickGap={26} fontSize={11}/><YAxis tickFormatter={short} fontSize={11}/><Tooltip formatter={(value,key)=>[money(value),key]} contentStyle={{background:'var(--bg2)',borderColor:'var(--border)'}}/>
        <Area type="linear" dataKey="below" name="Realizado até a meta" stackId="sales" stroke="none" fill="#ef5964" fillOpacity={0.3}/><Area type="linear" dataKey="above" name="Excedente da meta" stackId="sales" stroke="none" fill="#23ae81" fillOpacity={0.5}/>
        <Line type="linear" dataKey="value" name="Realizado" stroke="var(--text2)" dot={false} strokeWidth={1.5}/><Line type="stepAfter" dataKey="target" name="Meta do mês" stroke="var(--text2)" strokeDasharray="5 4" dot={false}/><Line type="linear" dataKey="projection" name="Projeção" stroke="#929ca9" strokeDasharray="3 4" dot={false}/>
      </ComposedChart></ResponsiveContainer></div><div className="chart-key"><span>🔴 Abaixo da meta</span><span>🟢 Acima da meta</span><span>┄ Meta mensal</span><span>┄ Projeção cinza</span></div>
    </section>
    <div className="operations-columns"><section className="operations-panel"><header><div><h2>Vendas por dia</h2><p>{month} · Receita líquida · clique em um dia</p></div></header><div className="sales-calendar">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(v=><small key={v}>{v}</small>)}{Array.from({length:d.calendar[0]?.date.getDay()||0},(_,i)=><i key={`pad${i}`}/>)}{d.calendar.map(p=><button key={p.day} disabled={!p.observed} className={selectedDay===p.day?'selected':''} style={{'--day-intensity':p.amount>0?Math.min(.24,.05+.19*p.amount/Math.max(1,...d.calendar.map(c=>c.amount))):0}} onClick={()=>setSelectedDay(p.day)} aria-label={`${p.day}/${month}: ${p.recorded?money(p.amount):'sem registros'}${!p.observed?', fora da base':''}`}><b>{p.day}</b><span>{p.recorded?short(p.amount):'—'}</span></button>)}</div>{daily&&<div role="status" className="day-detail"><strong>{daily.day}/{month} · {money(daily.amount)}</strong><p>{daily.recorded?'Total líquido dos registros desse dia.':'Não há registros desse dia na base carregada.'}</p></div>}</section>
      <section className="operations-panel"><header><div><h2>Peças mais vendidas</h2><p>Receita líquida por produto · {month}</p></div></header>{d.products.length?<div className="personal-products"><ResponsiveContainer width="100%" height="100%" initialDimension={{width:320,height:285}}><BarChart data={d.products} layout="vertical"><XAxis type="number" tickFormatter={short} fontSize={10}/><YAxis type="category" dataKey="name" width={120} fontSize={11}/><Tooltip formatter={money}/><Bar dataKey="value" name="Receita líquida" fill="var(--honda)" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div>:<p className="data-caption">Sem peças atribuídas nesta métrica e período.</p>}<div className="sales-method"><h3>Meio da venda</h3>{hasSalesMethod?methods.map(([method,value])=><p key={method}>{method} · {money(value)}</p>):<p>A base atual não informa se a venda foi presencial, por WhatsApp ou por outro meio. O setor é registrado separadamente.</p>}</div></section></div>
    <HistoricoMetas history={history} month={month} onMonth={setMonth} />
  </section>
}

const IcoH = ({ n, s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><use href={`/icons/iconoir.svg#${n}`} /></svg>
const situacaoMeta = h => !h.cutoff ? ['Sem base', 'neutro', 'minus'] : !h.target ? ['Sem meta', 'neutro', 'minus'] : h.real >= h.target ? ['Meta alcançada', 'ok', 'check-circle'] : h.month === monthKey(new Date()) ? ['Em andamento', 'andamento', 'clock'] : h.limit < h.end ? ['Base parcial', 'neutro', 'warning-circle'] : ['Abaixo da meta', 'risco', 'warning-triangle']

// Histórico de metas: resumo dos meses, barra de realizado × meta (traço = 100%) e situação
// com ícone. Clicar num mês leva a página para ele.
function HistoricoMetas({ history, month, onMonth }) {
  const validos = history.filter(h => h.cutoff && h.target)
  const batidos = validos.filter(h => h.real >= h.target).length
  const media = validos.length ? validos.reduce((s, h) => s + h.real / h.target, 0) / validos.length : null
  const melhor = validos.reduce((m, h) => (!m || h.real / h.target > m.real / m.target ? h : m), null)
  const topo = Math.max(1.2, ...validos.map(h => h.real / h.target))
  return (
    <section className="operations-panel hm">
      <header><div><h2>Histórico de metas</h2><p>Mesma pessoa e métrica, mês a mês · toque num mês para abrir</p></div></header>
      {validos.length > 0 && (
        <div className="hm-resumo">
          <article><i className="hm-ic is-ok"><IcoH n="trophy" /></i><div><span>Metas batidas</span><strong>{batidos} de {validos.length}</strong></div></article>
          <article><i className="hm-ic is-azul"><IcoH n="graph-up" /></i><div><span>Atingimento médio</span><strong>{Math.round(media * 100)}%</strong></div></article>
          {melhor && <article><i className="hm-ic is-ambar"><IcoH n="calendar" /></i><div><span>Melhor mês</span><strong>{melhor.month} · {Math.round(melhor.real / melhor.target * 100)}%</strong></div></article>}
        </div>
      )}
      <ol className="hm-lista">
        {[...history].reverse().map(h => {
          const [rotulo, tom, icone] = situacaoMeta(h)
          const pct = h.target && h.cutoff ? h.real / h.target : null
          return (
            <li key={h.month}>
              <button type="button" className={h.month === month ? 'is-atual' : undefined} aria-current={h.month === month ? 'true' : undefined} onClick={() => onMonth(h.month)}>
                <span className="hm-mes"><IcoH n="calendar" s={14} />{h.month}</span>
                <span className="hm-barra-area">
                  <span className="hm-valores"><b>{h.cutoff ? money(h.real) : 'Sem base'}</b><small>{h.target ? `meta ${money(h.target)}` : 'sem meta'}</small></span>
                  <span className={`hm-barra is-${tom}`}><i style={{ width: `${pct == null ? 0 : Math.min(100, pct / topo * 100)}%` }} /><em style={{ left: `${100 / topo}%` }} /></span>
                </span>
                <span className={`hm-pct is-${tom}`}>{pct == null ? '—' : `${(pct * 100).toFixed(1).replace('.', ',')}%`}</span>
                <span className={`hm-selo is-${tom}`}><IcoH n={icone} s={14} />{rotulo}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}