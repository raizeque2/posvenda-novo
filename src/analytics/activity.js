import { workWeight } from './personal.js'
export function activityPeriods(d, selectedDay) {
  const day=d.calendar.find(point=>point.day===(selectedDay || d.limit))
  const base=!!d.cutoff, validDay=base&&day?.observed, target=Number(d.target)||0
  const dailyTarget=validDay&&d.total>0?target/d.total*workWeight(day.date,d.holidays):0
  // Monday–Sunday, clipped to this month so another month's goal is never borrowed.
  const monday=day?day.day-(day.date.getDay()+6)%7:0
  const week=day?d.calendar.filter(point=>point.day>=monday&&point.day<=monday+6):[]
  const validWeek=base&&week.some(point=>point.observed)
  const weekTarget=d.total>0?target/d.total*week.reduce((sum,point)=>sum+workWeight(point.date,d.holidays),0):0
  const projection=base&&Number.isFinite(d.projection)?d.projection:null
  return [
    {id:'month',label:'Mês',current:base?d.real:null,target,color:'#ef4b63',note:d.month,projection,projectionPercent:projection!==null&&target>0?projection/target*100:null},
    {id:'week',label:'Semana',current:validWeek?week.filter(point=>point.observed).reduce((sum,point)=>sum+point.amount,0):null,target:weekTarget,color:'#16a873',note:week.length?`${String(week[0].day).padStart(2,'0')}–${String(week.at(-1).day).padStart(2,'0')}/${d.month} · semana no mês`:'Sem semana na base'},
    {id:'day',label:'Dia',current:validDay?day.amount:null,target:dailyTarget,color:'#319ac2',note:day?`${String(day.day).padStart(2,'0')}/${d.month}`:'Sem dia na base'},
  ].map(period=>({...period,percent:period.current!==null&&period.target>0?period.current/period.target*100:null}))
}
