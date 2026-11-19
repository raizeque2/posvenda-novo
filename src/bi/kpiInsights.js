import {matchesChannel} from './revenue.js'
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const move=(date,days)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+days,12)
export function kpiInsights(rows,history,channel,metric='value'){
  const lastByMonth=new Map(),daily=new Map()
  let latest='',earliest=''
  const collect=(row,current)=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date))return
    const month=row.date.slice(0,7)
    if(row.date>(lastByMonth.get(month)||''))lastByMonth.set(month,row.date)
    if(current&&row.date>latest)latest=row.date
    if(!matchesChannel(row,channel)||(metric==='quantity'&&row.quantity==null))return
    if(!earliest||row.date<earliest)earliest=row.date
    const amount=metric==='records'?row.recordCount??1:metric==='quantity'?row.quantity:row.value
    daily.set(row.date,(daily.get(row.date)||0)+amount)
  }
  for(const row of history)collect(row,false)
  for(const row of rows)collect(row,true)
  if(!latest)return []
  const end=new Date(`${latest}T12:00:00`),dates=[...daily.keys()]
  const total=(from,to)=>{let sum=0;for(const [day,value]of daily)if(day>=from&&day<=to)sum+=value;return sum}
  const compare=(start,finish,previousStart,previousEnd,label)=>{
    const from=dateKey(previousStart),to=dateKey(previousEnd)
    if(!earliest||earliest>from||!dates.some(day=>day>=from&&day<=to))return null
    for(let month=new Date(previousStart.getFullYear(),previousStart.getMonth(),1,12);month<=previousEnd;month=new Date(month.getFullYear(),month.getMonth()+1,1,12)){
      const requiredEnd=new Date(month.getFullYear(),month.getMonth()+1,0,12),endKey=dateKey(requiredEnd<previousEnd?requiredEnd:previousEnd)
      if((lastByMonth.get(dateKey(month).slice(0,7))||'')<endKey)return null
    }
    const value=total(dateKey(start),dateKey(finish)),previous=total(from,to)
    return {difference:value-previous,percent:previous>0?(value-previous)/previous*100:null,label}
  }
  const week=move(end,-6),previousMonth=new Date(end.getFullYear(),end.getMonth()-1,1,12),previousMonthEnd=new Date(end.getFullYear(),end.getMonth(),0,12)
  return [compare(end,end,move(end,-1),move(end,-1),`no dia ${latest.slice(8)}/${latest.slice(5,7)} vs. dia anterior`),compare(week,end,move(week,-7),move(end,-7),'nos últimos 7 dias vs. 7 anteriores'),compare(new Date(end.getFullYear(),end.getMonth(),1,12),end,previousMonth,new Date(previousMonth.getFullYear(),previousMonth.getMonth(),Math.min(end.getDate(),previousMonthEnd.getDate()),12),'no mês vs. mesmo período anterior')].filter(Boolean)
}