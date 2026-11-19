import { norm } from '../utils/normalizacao.js'
import { getMetaCanal } from '../pages/metas/metas.logic.js'
import { applyTargetProposal } from '../../functions/src/assistantPolicy.js'
export function targetIntent(question,state,month) {
  const q=norm(question)
  if(!/AJUST|ALTER|AUMENT|REDUZ|DIMINU/.test(q)||!/META/.test(q))return null
  const people=Object.values(state.colaboradoresPorMes[month]||{}).filter(c=>c.ativo!==false)
  let matches=people.filter(c=>q.includes(norm(c.colaborador)))
  if(!matches.length)matches=people.filter(c=>q.split(/[^A-Z0-9]+/).includes(norm(c.colaborador).split(' ')[0]))
  if(matches.length!==1)return {action:'target'}
  const person=matches[0],record={...person,...state.metasPorMes[month]?.[person.colaborador]},channels=(person.cargo_movimento||'').split(';').map(c=>c.trim()).filter(Boolean)
  const channel=channels.find(c=>q.includes(c))||(channels.length===1?channels[0]:null)
  if(!channel)return {action:'target',person:person.colaborador}
  const field=channel==='OS'?/MAO DE OBRA|SERVICO|\bMO\b/.test(q)?'mo':/PECAS/.test(q)?'mpo':null:'mp'
  if(!field)return {action:'target',person:person.colaborador,channel}
  const old=getMetaCanal(record,channel,field),percent=q.match(/(\d+(?:[.,]\d+)?)\s*%/),absolute=q.match(/\b(PARA|EM)\s*(?:R\$\s*)?(\d[\d.]*(?:,\d{1,2})?)/)
  const sign=/REDUZ|DIMINU/.test(q)?-1:1
  let next
  if(percent)next=old*(1+sign*Number(percent[1].replace(',','.'))/100)
  else if(absolute){const n=Number(absolute[2].replaceAll('.','').replace(',','.'));next=absolute[1]==='PARA'?n:old+sign*n}
  else return {action:'target',person:person.colaborador,channel,field}
  next=Math.round(next*100)/100
  const proposal={person:person.colaborador,channel,field,old,next,month}
  try{applyTargetProposal(proposal,record,month);return {action:'target',...proposal}}catch{return {action:'target',person:person.colaborador,channel,field}}
}
