import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtBRL, fmtBRL2 } from '../../utils/formatacao.js'
import './comissoes-insights.css'

const short = value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

export function ComissoesInsights({ operational, management, history, mode, month }) {
  const people = useMemo(() => (mode === 'gestao'
    ? management.map(g => ({ name: g.colaborador, commission: g.comissao + g.bonusMoPropria + g.bonusPecasProprias, bonus: g.bonificacao + g.bonusIndicadores + g.bonusExtra, total: g.total }))
    : operational.map(p => ({ name: p.nome, commission: p.comTotal, bonus: p.bonCalc + p.bon, total: p.totalComBon })))
    .sort((a, b) => b.total - a.total), [operational, management, mode])
  const chart = people.slice(0, 8)
  const total = people.reduce((sum, p) => sum + p.total, 0)
  const commission = people.reduce((sum, p) => sum + p.commission, 0)
  const bonus = people.reduce((sum, p) => sum + p.bonus, 0)
  const trend = [...history].sort((a, b) => {
    const [monthA, yearA] = String(a.mes).split('/').map(Number)
    const [monthB, yearB] = String(b.mes).split('/').map(Number)
    return (yearA * 12 + monthA) - (yearB * 12 + monthB)
  }).slice(-6)
  if (!people.length) return null
  return <section className="commission-insights" aria-label="Visão das comissões">
    <div className="commission-insights-header"><div><span>VISÃO DE GESTÃO</span><h2>Comissões em foco</h2><p>{mode === 'gestao' ? 'Gestores' : 'Equipe operacional'} · {month} · Valores calculados conforme as regras do mês</p></div></div>
    <div className="commission-insights-kpis">
      <div><span>Total a receber</span><strong>{fmtBRL2(total)}</strong><small>{people.length} pessoa{people.length === 1 ? '' : 's'}</small></div>
      <div><span>Comissão</span><strong>{fmtBRL2(commission)}</strong><small>{total > 0 ? `${Math.round(commission / total * 100)}% do total` : '—'}</small></div>
      <div><span>Bonificações e bônus</span><strong>{fmtBRL2(bonus)}</strong><small>{total > 0 ? `${Math.round(bonus / total * 100)}% do total` : '—'}</small></div>
    </div>
    <div className="commission-insights-charts">
      <div><h3>Quem recebe mais</h3><p>Composição dos 8 maiores valores no filtro atual</p><div className="commission-insights-chart" style={{height: Math.max(230, chart.length * 38 + 35)}}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{width:320,height:285}}><BarChart data={chart} layout="vertical" margin={{top: 8,right: 18,bottom: 4,left: 8}}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6e9ef"/><XAxis type="number" tickFormatter={short} fontSize={11}/><YAxis type="category" dataKey="name" width={110} fontSize={10} tick={{fill:'#42506b'}}/><Tooltip formatter={value => fmtBRL(value)}/><Legend/><Bar dataKey="commission" stackId="total" name="Comissão" fill="#c40013" radius={[0,0,0,0]}/><Bar dataKey="bonus" stackId="total" name="Bônus" fill="#e8a857" radius={[0,4,4,0]}/>
        </BarChart></ResponsiveContainer>
      </div>
      </div>
      <div><h3>Evolução mensal</h3><p>Comissão e bonificação calculadas nos meses disponíveis</p><div className="commission-insights-chart" style={{height: 285}}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{width:320,height:285}}><AreaChart data={trend} margin={{top: 8,right: 18,bottom: 4,left: 4}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6e9ef"/><XAxis dataKey="mes" fontSize={11}/><YAxis tickFormatter={short} fontSize={11}/><Tooltip formatter={value => fmtBRL(value)}/><Legend/><Area type="monotone" dataKey="comTotal" name="Comissão" stroke="#c40013" strokeWidth={3} fill="#c40013" fillOpacity={0.16}/><Area type="monotone" dataKey="bonTotal" name="Bonificação" stroke="#e8a857" strokeWidth={2} fill="#e8a857" fillOpacity={0.12}/>
        </AreaChart></ResponsiveContainer>
      </div>
      </div>
    </div>
  </section>
}
