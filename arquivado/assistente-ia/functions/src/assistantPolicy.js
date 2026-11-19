export function isAssistantAdmin(profile) {
  return profile?.role==='admin' && profile?.ativo!==false
}
export function allowedAssistantStore(profile,store,stores) {
  const states=profile.estados?.length?profile.estados:profile.estado?[profile.estado]:null
  return !states || states.includes(stores[store]?.uf)
}
export function validateQuestion(data) {
  if(data?.consent!==true||typeof data.question!=='string'||!data.question.trim()||data.question.length>2000) throw Error('Autorize o envio e escreva uma pergunta de até 2.000 caracteres.')
  return data.question.trim()
}
export function applyTargetProposal(proposal,record,currentMonth) {
  const {person,channel,field,old,next,month}=proposal||{}
  if(!record||person!==record.colaborador||month!==currentMonth)throw Error('Colaborador ou período inválido. Apenas o mês atual pode ser alterado pelo assistente.')
  const channels=String(record.cargo_movimento||'').split(';').map(c=>c.trim()).filter(Boolean)
  if(!channels.includes(channel)||!['mp','mo','mpo'].includes(field)||(channel!=='OS'&&field!=='mp')||(channel==='OS'&&field==='mp'))throw Error('Setor ou métrica inválidos.')
  if(typeof next!=='number'||!Number.isFinite(next)||next<0||next>100000000||typeof old!=='number'||!Number.isFinite(old)||old<0||next===old)throw Error('Informe um novo valor válido entre zero e R$ 100 milhões.')
  const before=Number(record.metas?.[channel]?.[field]??record[field])||0
  if(before!==old)throw Error('A meta mudou desde a revisão. Prepare uma nova proposta.')
  const metas=record.metas?structuredClone(record.metas):Object.fromEntries(channels.map(c=>[c,{mp:Number(record.mp)||0,mo:Number(record.mo)||0,mpo:Number(record.mpo)||0}]))
  metas[channel]={...metas[channel],[field]:Math.round(next*100)/100}
  return {...record,metas}
}
