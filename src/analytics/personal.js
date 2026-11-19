import { buildRanking } from '../services/ranking/buildRanking.js'
import { norm, resolveNome } from '../utils/normalizacao.js'
import { feriadosPorUF, sortMesAno } from '../utils/datas.js'
import { LOJAS } from '../data/regras.js'

export const monthKey = d => `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
export function workWeight(date, holidays = []) {
  if (holidays.some(h => h.toDateString() === date.toDateString())) return 0
  return date.getDay() === 0 ? 0 : date.getDay() === 6 ? 0.5 : 1
}
export function monthProgress(month, cutoff, uf = '') {
  const [m,y] = month.split('/').map(Number), holidays = feriadosPorUF(uf,y)
  const end = new Date(y,m,0).getDate()
  const limit = cutoff ? (y*12+m === cutoff.getFullYear()*12+cutoff.getMonth()+1 ? cutoff.getDate() : y*12+m < cutoff.getFullYear()*12+cutoff.getMonth()+1 ? end : 0) : 0
  let total=0, elapsed=0
  for(let day=1;day<=end;day++){const w=workWeight(new Date(y,m-1,day),holidays);total+=w;if(day<=limit)elapsed+=w}
  return {total,elapsed,remaining:Math.max(0,total-elapsed),limit,end,holidays}
}
const dateOf = r => r.dt instanceof Date && !Number.isNaN(+r.dt) ? r.dt : null
const monthOrder = month => { const [m,y]=month.split('/').map(Number); return y*12+m }
export function latestDate(rows, now = new Date()) {
  const last=rows.reduce((latest,row)=>{const date=dateOf(row);return date&&date<=now&&(!latest||date>latest)?date:latest},null)
  return last ? new Date(last) : null
}
export function personalRows(state, name, month, metric='mp') {
  const matches=n=>norm(resolveNome(n,state.apelidoMap)||n)===norm(resolveNome(name,state.apelidoMap)||name)
  const p=state.pecasPorMes[month]||[], o=state.oficinaPorMes[month]||[]
  if(metric==='mo') {
    // Follow the same role priority as buildRanking, including people in both columns.
    const advisor=o.some(r=>matches(r.consultor))
    return o.filter(r=>matches(advisor?r.consultor:r.tecnico)).map(r=>({...r,amount:Number(r.mo)||0}))
  }
  if(metric==='mpo') return [
    ...p.filter(r=>String(r.cat).startsWith('OFICINA') && (matches(r.responsavel)||matches(r.tecnico))).map(r=>({...r,amount:r.eDevolucao?-Math.abs(r.valor):Number(r.valor)||0})),
    ...o.filter(r=>matches(r.consultor) && r.pocoficina).map(r=>({...r,amount:Number(r.pocoficina)||0})),
  ]
  return p.filter(r=>matches(r.responsavel)&&['VAREJO','ATACADO','WEB','TELEVENDAS'].includes(r.cat)).map(r=>({...r,amount:r.eDevolucao?-Math.abs(r.valor):Number(r.valor)||0}))
}
export function personalProjection(state, name, month, metric, real, progress, uf, now = new Date()) {
  const previous=[...new Set([...Object.keys(state.pecasPorMes),...Object.keys(state.oficinaPorMes)])].filter(candidate=>monthOrder(candidate)<monthOrder(month)&&monthOrder(month)-monthOrder(candidate)<=12).sort((a,b)=>monthOrder(b)-monthOrder(a))
  const history=[]
  for(const candidate of previous){
    const rows=personalRows(state,name,candidate,metric).filter(row=>dateOf(row)&&dateOf(row)<=now)
    if(!rows.length)continue
    const p=state.pecasPorMes[candidate]||[],o=state.oficinaPorMes[candidate]||[]
    const sources=(metric==='mp'?[p]:metric==='mo'?[o]:[p,o]).filter(source=>source.length)
    const periods=sources.map(source=>monthProgress(candidate,latestDate(source,now),uf))
    const period=periods[0]
    // Require source coverage through the last business day; sparse/partial months aren't completed history.
    if(!period||periods.some(item=>item.remaining>0||item.elapsed<=0)||period.total<=0)continue
    history.push({month:candidate,daily:rows.reduce((sum,row)=>sum+row.amount,0)/period.total})
    if(history.length===3)break
  }
  const historicalDaily=history.length?history.reduce((sum,item)=>sum+item.daily,0)/history.length:null
  const currentDaily=progress.elapsed>0?real/progress.elapsed:null
  const currentProjection=currentDaily===null?null:real+currentDaily*progress.remaining
  const currentWeight=progress.total?Math.min(1,progress.elapsed/progress.total):0
  const daily=currentDaily===null?null:historicalDaily===null?currentDaily:currentDaily*currentWeight+historicalDaily*(1-currentWeight)
  const projection=daily===null?null:real+daily*progress.remaining
  return {projection,currentProjection,historicalProjection:historicalDaily===null?null:historicalDaily*progress.total,historyMonths:history.length,historyPeriods:history.map(item=>item.month)}
}
export function personMonth(state, name, month, metric='mp', now=new Date()) {
  const observed=row=>!dateOf(row)||dateOf(row)<=now
  const p=(state.pecasPorMes[month]||[]).filter(observed),o=(state.oficinaPorMes[month]||[]).filter(observed)
  const resolved=resolveNome(name,state.apelidoMap)||name
  const ranking=buildRanking(p,o,month,state.colaboradoresPorMes,state.metasPorMes,state.bonificacoes,0,0,state.apelidoMap,state.regras?.[month]?.comissao,state.regras?.[month]?.gestao||state.comissaoGestao)
  const entry=ranking.find(c=>norm(c.nome)===norm(resolved))
  const rows=personalRows({...state,pecasPorMes:{...state.pecasPorMes,[month]:p},oficinaPorMes:{...state.oficinaPorMes,[month]:o}},resolved,month,metric)
  // A common source cutoff keeps a person with no recent sales visible.
  const cutoff=latestDate(metric==='mp'?p:metric==='mo'?o:[...p,...o],now), uf=(state.lojas?.[entry?.lojas?.[0]]||LOJAS[entry?.lojas?.[0]])?.uf||entry?.uf||''
  const progress=monthProgress(month,cutoff,uf)
  const real=metric==='mp'?(entry?.tp||0):metric==='mo'?(entry?.ehConsultor?entry.morealCons:entry?.morealTec)||0:(entry?.pocoficina||0)-(entry?.devPocoficina||0)
  const target=Number(entry?.[metric])||0, gap=Math.max(0,target-real)
  const forecast=personalProjection(state,resolved,month,metric,real,progress,uf,now),{projection}=forecast
  const [m,y]=month.split('/').map(Number), byDay=new Map()
  rows.forEach(r=>{const date=dateOf(r);if(date)byDay.set(date.getDate(),(byDay.get(date.getDate())||0)+r.amount)})
  let accumulated=0, elapsed=0
  const calendar=Array.from({length:progress.end},(_,i)=>{
    const day=i+1, date=new Date(y,m-1,day), amount=byDay.get(day)||0
    accumulated+=amount;elapsed+=workWeight(date,progress.holidays)
    const observed=!!cutoff&&day<=progress.limit, expected=progress.total?target*elapsed/progress.total:0
    return {day,date,label:String(day).padStart(2,'0'),amount,observed,recorded:byDay.has(day),real:observed?accumulated:null,target:expected,
      projection:projection!==null&&day>=progress.limit?real+(projection-real)*(progress.total>progress.elapsed?(elapsed-progress.elapsed)/(progress.total-progress.elapsed):0):null}
  })
  const products=new Map()
  rows.filter(r=>r.produto).forEach(r=>products.set(r.produto,(products.get(r.produto)||0)+r.amount))
  return {month,entry,rows,real,target,gap,...forecast,cutoff,...progress,calendar,needed:progress.remaining>0?gap/progress.remaining:null,products:[...products].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,7)}
}
export function availableMonths(state) {
  return [...new Set([...Object.keys(state.pecasPorMes),...Object.keys(state.oficinaPorMes),...Object.keys(state.metasPorMes),monthKey(new Date())])].sort(sortMesAno)
}
