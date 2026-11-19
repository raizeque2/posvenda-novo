import { buildRanking } from '../services/ranking/buildRanking.js'
import { norm, resolveNome } from '../utils/normalizacao.js'
import { LOJAS } from '../data/regras.js'
import { latestDate, monthKey, monthProgress, personalProjection } from './personal.js'

export function homeSummary(state, {name='',full=false,estados=null,now=new Date()}={}) {
  const sameName=value=>norm(resolveNome(value,state.apelidoMap)||value)===norm(resolveNome(name,state.apelidoMap)||name)
  const month=monthKey(now), permitted=r=>!estados?.length||estados.includes((state.lojas?.[r.empresa]||LOJAS[r.empresa])?.uf)
  const observed=r=>permitted(r)&&(!(r.dt instanceof Date)||r.dt<=now)
  const pieces=(state.pecasPorMes[month]||[]).filter(observed), services=(state.oficinaPorMes[month]||[]).filter(observed)
  const filteredConfig=source=>Object.fromEntries(Object.entries(source||{}).filter(([,c])=>!estados?.length||estados.includes((state.lojas?.[c.loja]||LOJAS[c.loja])?.uf)))
  const ranking=buildRanking(pieces,services,month,{[month]:filteredConfig(state.colaboradoresPorMes[month])},{[month]:filteredConfig(state.metasPorMes[month])},state.bonificacoes,0,0,state.apelidoMap,state.regras?.[month]?.comissao,state.regras?.[month]?.gestao||state.comissaoGestao).filter(p=>full||sameName(p.nome))
  const historicState=estados?.length?{...state,pecasPorMes:Object.fromEntries(Object.entries(state.pecasPorMes).map(([key,rows])=>[key,rows.filter(permitted)])),oficinaPorMes:Object.fromEntries(Object.entries(state.oficinaPorMes).map(([key,rows])=>[key,rows.filter(permitted)]))}:state
  const scopedPieces=full?pieces:pieces.filter(r=>sameName(r.responsavel)), scopedServices=full?services:services.filter(r=>sameName(r.consultor)||sameName(r.tecnico))
  const cutoff=latestDate(full?[...pieces,...services]:[...scopedPieces,...scopedServices],now)
  const daily=r=>cutoff&&r.dt instanceof Date&&r.dt.toDateString()===cutoff.toDateString()
  const net=r=>r.eDevolucao?-Math.abs(Number(r.valor)||0):Number(r.valor)||0
  const salesPieces=scopedPieces.filter(r=>['VAREJO','ATACADO','WEB','TELEVENDAS'].includes(r.cat)||String(r.cat).startsWith('OFICINA'))
  const revenue=salesPieces.filter(daily).reduce((a,r)=>a+net(r),0)+scopedServices.filter(daily).reduce((a,r)=>a+(Number(r.mo)||0),0)
  const attention=ranking.flatMap(p=>{
    const uf=(state.lojas?.[p.lojas?.[0]]||LOJAS[p.lojas?.[0]])?.uf||p.uf||''
    const metrics=[{key:'mp',metric:'Peças',target:p.mp,real:p.tp},{key:'mo',metric:'Mão de obra',target:p.mo,real:p.ehConsultor?p.morealCons:p.morealTec},{key:'mpo',metric:'Peças de O.S.',target:p.mpo,real:(p.pocoficina||0)-(p.devPocoficina||0)}]
    return metrics.filter(m=>m.target>0).map(m=>{const progress=monthProgress(month,latestDate(m.key==='mp'?pieces:m.key==='mo'?services:[...pieces,...services],now),uf);return {...m,name:p.nome,...personalProjection(historicState,p.nome,month,m.key,m.real||0,progress,uf,now)}}).filter(m=>m.projection!==null&&m.projection<m.target)
  }).sort((a,b)=>a.projection/a.target-b.projection/b.target)
  const top=ranking.map(p=>({name:p.nome,value:p.tp||0})).filter(p=>p.value>0).sort((a,b)=>b.value-a.value)
  const names=new Set([...salesPieces.flatMap(r=>[r.responsavel,...(String(r.cat).startsWith('OFICINA')?[r.tecnico]:[])]),...scopedServices.flatMap(r=>[r.consultor,r.tecnico])].filter(Boolean).map(value=>norm(resolveNome(value,state.apelidoMap)||value)))
  const moving=ranking.filter(p=>names.has(norm(p.nome)))
  return {month,cutoff,revenue,ranking,attention,top,moving,chartPerson:full?null:name,chartRows:{pieces:scopedPieces,services:scopedServices},records:salesPieces.filter(daily).length+scopedServices.filter(daily).length,people:moving.length,full}
}

export function localAnswer(question, summary) {
  const q=norm(question), money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n)
  if(/AJUST|AUMENT|REDUZ|ALTER/.test(q)&&/META/.test(q)) return {text:'Para ajustar uma meta, selecione a pessoa, a métrica e o novo valor. Você verá a proposta antes de confirmar.',action:'target'}
  if(/ATENCAO|MELHORAR|DESEMPENHO|PRECISA/.test(q)) return {text:summary.attention.length?`${new Set(summary.attention.map(p=>p.name)).size} pessoa(s) com projeção abaixo da meta. Verifique as oportunidades e a atualização da base antes de decidir.`:'Nenhuma projeção abaixo da meta foi encontrada na base disponível. Pessoas sem meta ou sem base não são classificadas.',attention:summary.attention.slice(0,8)}
  if(/QUEM|MAIS VENDE|RANKING|LIDER/.test(q)) return {text:summary.top.length?`${summary.top[0].name} lidera a receita líquida de peças no mês, com ${money(summary.top[0].value)}.`:'Não há vendas de peças carregadas neste mês.',chart:summary.top.slice(0,6)}
  if(/ESTOQUE/.test(q)) return {text:'Veja o status do estoque na página de início e abra Estoque para consultar itens parados, curvas e transferências. O resumo depende da posição de estoque carregada.',link:'/estoque'}
  if(/VENDA|RESUMO|DIA|HOJE|ACONTEC/.test(q)) return {text:summary.cutoff?`Na última data registrada (${summary.cutoff.toLocaleDateString('pt-BR')}): ${money(summary.revenue)} de receita líquida de peças e mão de obra, em ${summary.records} linhas da base. No mês, ${summary.people} colaborador(es) têm movimentação. Não representa necessariamente o dia de hoje.`:'Ainda não há registros carregados neste mês.'}
  return {text:'Nesta demonstração local posso mostrar o resumo do dia, quem mais vende peças, pessoas que merecem atenção e preparar ajustes de metas. Para perguntas livres, configure um provedor em Conexões. Nenhum dado sai deste navegador no modo local.'}
}
