// Regra de gestor (comissão, bonificação, metas e indicadores). Compartilhada pelo app
// (src/services/ranking/gestaoPolicy.js reexporta) e pelo servidor (assistantChangesPolicy),
// para a validação ser a mesma nos dois lados.
const norm = s => s ? String(s).replace(/^﻿/, '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim() : ''

export const GESTAO_CANAIS={tp:'Peças total',mo:'Mão de obra',pocoficina:'Peças de O.S.',varejo:'Varejo',atacado:'Atacado',web:'Web',televendas:'Televendas'}
export const GESTAO_METRICAS={pctFaturamento:'Faturamento da base',pctMO:'Mão de obra da equipe',pctP:'Peças total da equipe',pctVarejo:'Varejo da equipe',pctAtacado:'Atacado da equipe',pctWeb:'Web da equipe',pctTelevendas:'Televendas da equipe',pctPecasOS:'Peças de O.S. da equipe',pctMOProprio:'Mão de obra própria'}
export const GESTAO_OPERADORES={gte:'Maior ou igual',gt:'Maior que',lte:'Menor ou igual',lt:'Menor que'}
export function meetsThreshold(value,threshold,operator='gte'){
  if(typeof value!=='number'||!Number.isFinite(value)||!Number.isFinite(threshold))return false
  return operator==='gte'?value>=threshold:operator==='gt'?value>threshold:operator==='lte'?value<=threshold:operator==='lt'?value<threshold:false
}
export function validateGestaoPolicy(cfg){
  const number=(v,label,max=1e12)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)throw Error(`${label}: informe um número válido entre 0 e ${max}.`)}
  for(const key of ['comissao','bonificacao','bonusMoPropria','bonusPecasProprias'])if(cfg[key]!==undefined)number(cfg[key],key,1)
  if(cfg.bonusMinimo!==undefined)number(cfg.bonusMinimo,'Faturamento mínimo',10)
  if(!['equipe','equipe_mais_propria',undefined].includes(cfg.baseCalculo))throw Error('Base de cálculo inválida.')
  if(!Array.isArray(cfg.canaisBase)||!cfg.canaisBase.length||cfg.canaisBase.some(c=>!Object.hasOwn(GESTAO_CANAIS,c))||new Set(cfg.canaisBase).size!==cfg.canaisBase.length)throw Error('Escolha canais válidos para o faturamento.')
  if(cfg.canaisBase.includes('tp')&&cfg.canaisBase.some(c=>['varejo','atacado','web','televendas'].includes(c)))throw Error('Peças total já inclui varejo, atacado, web e televendas. Escolha o total ou os canais separados.')
  for(const [canal,meta] of Object.entries(cfg.metasCanais||{})){if(!Object.hasOwn(GESTAO_CANAIS,canal))throw Error('Canal de meta inválido.');number(meta,'Meta')}
  if(!Array.isArray(cfg.indicadores)||cfg.indicadores.length>30)throw Error('Use até 30 indicadores.')
  const keys=new Set()
  for(const ind of cfg.indicadores){
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(ind.chave)||['bonusExtra','comissaoExtra','__proto__','constructor','prototype'].includes(ind.chave)||keys.has(ind.chave))throw Error('Cada indicador deve ter uma identificação única válida.')
    keys.add(ind.chave)
    if(typeof ind.nome!=='string'||!ind.nome.trim()||ind.nome.length>120)throw Error('Informe o nome de cada indicador (até 120 caracteres).')
    if(!['auto','manual','valor'].includes(ind.tipo))throw Error('Tipo de indicador inválido.')
    number(ind.pct??0,'Bônus do indicador',1)
    if(ind.tipo!=='manual'){
      number(ind.threshold??1,'Limite do indicador',ind.tipo==='auto'?10:1e12)
      if(!Object.hasOwn(GESTAO_OPERADORES,ind.operador??'gte'))throw Error('Comparação inválida.')
      if(ind.tipo==='auto'&&!Object.hasOwn(GESTAO_METRICAS,ind.autoKey))throw Error('Métrica automática inválida.')
    }
  }
  return cfg
}

// Replace one person's policy in one month; a stale editor must reload instead of overwriting.
export function applyGestaoPolicy(rules,mes,nome,expected,next){
  if(!/^(0[1-9]|1[0-2])\/20\d{2}$/.test(mes))throw Error('Mês inválido.')
  validateGestaoPolicy(next)
  const index=rules[mes]?.gestao?.findIndex(cfg=>norm(cfg.colaborador)===norm(nome))??-1
  if(index<0)throw Error('Gestor não encontrado neste mês.')
  if(norm(next.colaborador)!==norm(nome))throw Error('A regra deve permanecer com o mesmo gestor.')
  if(JSON.stringify(rules[mes].gestao[index])!==JSON.stringify(expected))throw Error('Esta regra foi alterada por outra sessão. Feche e abra a edição novamente.')
  return {...rules,[mes]:{...rules[mes],gestao:rules[mes].gestao.map((cfg,i)=>i===index?structuredClone(next):cfg)}}
}
