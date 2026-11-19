/** Apple Activity Card, adapted from @kokonutui (MIT, 2025-06-26). */
import { useId, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { fmtBRL2 as money } from '../../utils/formatacao.js'
import './apple-activity-ring.css'
type ActivityData={id:string;label:string;current:number|null;target:number;percent:number|null;color:string;note:string;projection?:number|null;projectionPercent?:number|null}
export function AppleActivityCard({activities,title='Suas metas em movimento',className=''}:{activities:ActivityData[];title?:string;className?:string}){
  const id=useId().replaceAll(':',''),reduced=useReducedMotion()
  return <section className={`activity-card ${className}`} aria-label={title}>
    <header><h2>{title}</h2><p>Mês, semana e dia. O traço claro no anel do mês mostra a projeção da pessoa.</p></header>
    <div className="activity-content"><div className="activity-rings" aria-hidden="true"><svg viewBox="0 0 220 220">
      {activities.map((activity,index)=>{const radius=94-index*27,circumference=2*Math.PI*radius,progress=Math.min(1,Math.max(0,(activity.percent||0)/100)),forecast=activity.projectionPercent==null?null:projectionArc(radius,progress,activity.projectionPercent/100);return <g key={activity.id}>
        <defs><linearGradient id={`${id}-${activity.id}`}><stop stopColor={activity.color}/><stop offset="100%" stopColor={activity.color} stopOpacity=".7"/></linearGradient></defs>
        <circle cx="110" cy="110" r={radius} fill="none" stroke={activity.color} strokeOpacity=".12" strokeWidth="18"/>
        {forecast&&<motion.path className="activity-projection-arc" d={forecast} fill="none" stroke={activity.color} strokeWidth="14" strokeLinecap="round" strokeDasharray="1 19" initial={reduced?false:{opacity:0}} animate={{opacity:.32}} transition={{duration:reduced?0:.7}}/>}
        <motion.circle cx="110" cy="110" r={radius} fill="none" stroke={`url(#${id}-${activity.id})`} strokeWidth="18" strokeLinecap="round" strokeDasharray={circumference} initial={reduced?false:{strokeDashoffset:circumference}} animate={{strokeDashoffset:circumference*(1-progress)}} transition={{duration:reduced?0:.9,delay:reduced?0:index*.08}} transform="rotate(-90 110 110)"/>
      </g>})}
    </svg></div><dl>{activities.map(activity=><div key={activity.id} className={activity.percent!==null&&activity.percent>=100?'is-achieved':''} style={{'--activity-color':activity.color} as CSSProperties}>
      <dt><i aria-hidden="true"/>{activity.label}<span>{activity.percent===null?'—':`${activity.percent.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`}</span></dt>
      <dd>{activity.current===null?'Sem base':money(activity.current)} <small>/ {activity.target>0?money(activity.target):'Sem meta'}</small></dd>
      {activity.id==='month'&&<p className="activity-forecast">{activity.projection==null?'Sem base para projetar':`Projeção: ${money(activity.projection)}${activity.projectionPercent==null?'':` · ${activity.projectionPercent.toLocaleString('pt-BR',{maximumFractionDigits:1})}% da meta`}`}</p>}
      <p>{activity.note} · {activity.percent===null?'Sem comparação disponível':activity.percent>=100?'Objetivo alcançado':'Em acompanhamento'}</p>
    </div>)}</dl></div>
  </section>
}

function projectionArc(radius:number,start:number,end:number){
  const from=Math.max(0,Math.min(1,start)),to=Math.max(0,Math.min(.999999,end))
  if(!Number.isFinite(to)||to<=from)return null
  const point=(ratio:number)=>{const angle=ratio*2*Math.PI-Math.PI/2;return [110+radius*Math.cos(angle),110+radius*Math.sin(angle)]}
  const [x1,y1]=point(from),[x2,y2]=point(to)
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${to-from>.5?1:0} 1 ${x2} ${y2}`
}
