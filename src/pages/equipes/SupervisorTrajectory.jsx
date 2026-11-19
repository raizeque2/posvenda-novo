import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtBRL } from '../../utils/formatacao.js'

const metrics = {
  parts: { label: 'Peças', real: 'tp', projection: 'projP', target: 'metaP' },
  labor: { label: 'Mão de obra', real: 'realMO', projection: 'projMO', target: 'metaMO' },
  serviceParts: { label: 'Peças O.S.', real: 'realMPO', projection: 'projMPO', target: 'metaMPO' },
}
const palette = ['#c40013', '#2e79b7', '#2c9578', '#9161c9', '#d98934', '#354b6b', '#bc5782', '#617c39']

export function SupervisorTrajectory({ teams, daysElapsed, daysInMonth }) {
  const [metric, setMetric] = useState('parts')
  const definition = metrics[metric]
  const eligible = teams.filter(team => team[definition.target] > 0)
  const progress = daysInMonth > 0 ? Math.round(daysElapsed / daysInMonth * 100) : 0
  const points = ['Início', 'Atual', 'Projeção'].map((stage, index) => {
    const point = { stage }
    eligible.forEach((team, i) => { point[`team${i}`] = index === 0 ? 0 : Math.round(100 * (index === 1 ? team[definition.real] : team[definition.projection]) / team[definition.target]) })
    return point
  })
  return <section className="card supervisor-trajectory" aria-label="Trajetória das metas por supervisor" style={{marginBottom:12,padding:16}}>
    <div className="card-header" style={{padding:0,marginBottom:8}}><div><h2 className="card-title">Trajetória dos supervisores</h2><p style={{fontSize:12,color:'var(--text2)',margin:'5px 0'}}>Cada linha representa uma equipe. A projeção usa o ritmo de vendas do mês; a meta é 100%.</p></div><label style={{marginLeft:'auto',fontSize:12}}>Métrica <select aria-label="Métrica dos supervisores" value={metric} onChange={e=>setMetric(e.target.value)} style={{display:'block',padding:7,background:'var(--bg2)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:7}}>{Object.entries(metrics).map(([value,item])=><option key={value} value={value}>{item.label}</option>)}</select></label></div>
    {eligible.length ? <><div style={{height:285,width:'100%'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{top:10,right:20,left:0,bottom:8}}><CartesianGrid strokeDasharray="3 3" stroke="#e6e9ef"/><XAxis dataKey="stage" fontSize={11}/><YAxis tickFormatter={n=>`${n}%`} fontSize={11}/><Tooltip formatter={(value, key)=>[`${value}% da meta`,eligible[Number(key.replace('team',''))]?.supervisor || key]}/><Legend formatter={value=>eligible[Number(value.replace('team',''))]?.supervisor || value}/><ReferenceLine y={100} stroke="#596579" strokeDasharray="5 4" label={{value:'Teto da meta',position:'insideTopRight',fill:'#596579',fontSize:10}}/>{eligible.map((team,i)=><Line key={team.supervisor} type="linear" dataKey={`team${i}`} stroke={palette[i%palette.length]} strokeWidth={2.5} dot={{r:4}} name={team.supervisor}/>)}</LineChart></ResponsiveContainer></div><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{eligible.map((team,i)=><div key={team.supervisor} style={{border:'1px solid var(--border)',borderLeft:`3px solid ${palette[i%palette.length]}`,borderRadius:6,padding:'7px 10px',fontSize:11}}><strong>{team.supervisor}</strong><div>Atual {fmtBRL(team[definition.real])} · Projeção {fmtBRL(team[definition.projection])}</div><div>Meta {fmtBRL(team[definition.target])}</div></div>)}</div><small style={{color:'var(--text3)'}}>Período decorrido: {progress}% dos dias úteis. Projeções não são valores realizados.</small></> : <p className="note">Não há metas de {definition.label.toLowerCase()} para as equipes filtradas.</p>}
  </section>
}
