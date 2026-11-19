import { useRef, useState } from 'react'
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '../../components/ui/dialog'
import { RainbowButton } from '../../components/ui/rainbow-button'
import { Plus,Trash2,SlidersHorizontal } from '../../icons/iconoir'
import { GESTAO_CANAIS,GESTAO_METRICAS,GESTAO_OPERADORES,validateGestaoPolicy } from '../../services/ranking/gestaoPolicy.js'
import { salvarPoliticaGestao } from '../../services/gestaoPolicyService.js'
import useStore from '../../store.js'
import { fmtBRL2,fmtPct } from '../../utils/formatacao.js'
import './gestao-policy.css'

const rateFields={comissao:'Comissão',bonificacao:'Bonificação',bonusMoPropria:'Bônus M.O própria',bonusPecasProprias:'Bônus peças próprias'}
const operatorLabels={gte:'≥',gt:'>',lte:'≤',lt:'<'}
const readNumber=value=>value===''?NaN:Number(value)
export function indicadorCondicao(ind){return ind.tipo==='manual'?'Confirmação manual':`${ind.tipo==='auto'?(GESTAO_METRICAS[ind.autoKey]||ind.autoKey):'Valor informado'} ${operatorLabels[ind.operador||'gte']} ${ind.tipo==='auto'?fmtPct(ind.threshold??1):ind.threshold??0}`}

export function GestaoPolicyEditor({gestor,mes}){
  const [draft,setDraft]=useState(null),[review,setReview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const expected=useRef(null),saving=useRef(false)
  function open(){expected.current=structuredClone(gestor.config);setDraft({...structuredClone(gestor.config),canaisBase:gestor.config.canaisBase||['tp'],indicadores:gestor.config.indicadores||[],metasCanais:gestor.config.metasCanais||{}});setReview(null);setError('')}
  const set=(field,value)=>{setError('');setDraft(d=>({...d,[field]:value}))}
  const updateIndicator=(index,patch)=>set('indicadores',draft.indicadores.map((ind,i)=>i===index?{...ind,...patch}:ind))
  function prepare(event){
    event.preventDefault();setError('')
    try{
      const next={...draft,metasCanais:Object.fromEntries(Object.entries(draft.metasCanais).filter(([,value])=>value!=='').map(([key,value])=>[key,readNumber(value)]))}
      for(const field of Object.keys(rateFields))next[field]=readNumber(draft[field]??0)
      if(draft.bonusMinimo===undefined)delete next.bonusMinimo;else next.bonusMinimo=readNumber(draft.bonusMinimo)
      next.indicadores=draft.indicadores.map(ind=>({...ind,pct:readNumber(ind.pct??0),...(ind.tipo!=='manual'?{threshold:readNumber(ind.threshold??1)}:{})}))
      validateGestaoPolicy(next);setReview(next)
    }catch(e){setError(e.message)}
  }
  async function save(){
    if(saving.current)return;saving.current=true;setBusy(true);setError('')
    try{
      const state=useStore.getState(),fallback=state.regras[mes]||{gestao:state.comissaoGestao}
      const regras=await salvarPoliticaGestao({mes,nome:gestor.colaborador,expected:expected.current,next:review,fallback})
      useStore.setState(state=>({regras:{...state.regras,...regras}}));setDraft(null)
    }catch(e){setError(e.message||'Não foi possível salvar. Tente novamente.')}finally{saving.current=false;setBusy(false)}
  }
  return <><button type="button" className="btn btn-ghost btn-sm gestao-policy-trigger" onClick={open}><SlidersHorizontal size={15}/>Editar metas e indicadores</button><Dialog open={!!draft} onOpenChange={value=>{if(!value&&!saving.current)setDraft(null)}}><DialogContent className="gestao-policy-editor" onEscapeKeyDown={e=>{if(busy)e.preventDefault()}} onPointerDownOutside={e=>{if(busy)e.preventDefault()}}>
    <DialogTitle>{review?'Confirmar alteração':'Metas e indicadores'}</DialogTitle>
    <DialogDescription>{gestor.colaborador} · {mes}. A alteração vale somente para esta pessoa neste mês e recalcula sua remuneração.</DialogDescription>
    {error&&<p role="alert" className="gestao-policy-error">{error}</p>}
    {draft&&!review&&<form onSubmit={prepare}>
      <fieldset><legend>Faturamento e metas específicas</legend><label>Base de cálculo<select className="form-input" value={draft.baseCalculo||'equipe'} onChange={e=>set('baseCalculo',e.target.value)}><option value="equipe">Somente equipe</option><option value="equipe_mais_propria">Equipe + vendas próprias</option></select></label>
      <p>Selecione os canais que compõem o faturamento base. Peças total já inclui varejo, atacado, web e televendas.</p>
      <div className="gestao-policy-checks">{Object.entries(GESTAO_CANAIS).map(([key,label])=><label key={key}><input type="checkbox" checked={draft.canaisBase.includes(key)} onChange={e=>set('canaisBase',e.target.checked?[...draft.canaisBase,key]:draft.canaisBase.filter(c=>c!==key))}/>{label}</label>)}</div>
      <p>Deixe a meta vazia para usar a soma das metas da equipe. Zero significa sem meta.</p><div className="gestao-policy-grid">{Object.entries(GESTAO_CANAIS).map(([key,label])=><label key={key}>Meta {label} (R$)<input className="form-input" type="number" min="0" max="1000000000000" step="0.01" placeholder="Da equipe" value={draft.metasCanais[key]??''} onChange={e=>set('metasCanais',{...draft.metasCanais,[key]:e.target.value})}/></label>)}</div></fieldset>
      <fieldset><legend>Percentuais sobre o realizado</legend><div className="gestao-policy-grid">{Object.entries(rateFields).map(([key,label])=><label key={key}>{label} (%)<input className="form-input" type="number" min="0" max="100" step="0.01" required value={draft[key]===''?'':Number(((draft[key]??0)*100).toFixed(6))} onChange={e=>set(key,e.target.value===''?'':Number(e.target.value)/100)}/></label>)}</div></fieldset>
      <fieldset><legend>Condição para receber bônus</legend><label className="gestao-policy-checkbox"><input type="checkbox" checked={draft.bonusMinimo!==undefined} onChange={e=>set('bonusMinimo',e.target.checked?.95:undefined)}/>Exigir faturamento mínimo</label>{draft.bonusMinimo!==undefined&&<label>Percentual mínimo da meta de faturamento (%)<input className="form-input" type="number" min="0" max="1000" step="0.01" required value={draft.bonusMinimo===''?'':Number((draft.bonusMinimo*100).toFixed(6))} onChange={e=>set('bonusMinimo',e.target.value===''?'':Number(e.target.value)/100)}/></label>}<p>Abaixo do mínimo, bonificação, bônus próprios, indicadores e bônus extra ficam zerados. A comissão permanece. Sem meta de faturamento, os bônus condicionados não são liberados.</p></fieldset>
      <fieldset><legend>Indicadores</legend>{draft.indicadores.map((ind,index)=><div className="gestao-policy-indicator" key={ind.chave}>
        <div className="gestao-policy-indicator-title"><label>Nome<input className="form-input" required maxLength={120} value={ind.nome} onChange={e=>updateIndicator(index,{nome:e.target.value})}/></label><button type="button" className="btn btn-ghost btn-sm" aria-label={`Remover indicador ${ind.nome}`} onClick={()=>set('indicadores',draft.indicadores.filter((_,i)=>i!==index))}><Trash2 size={16}/></button></div>
        <div className="gestao-policy-grid"><label>Avaliação<select className="form-input" value={ind.tipo} onChange={e=>updateIndicator(index,{tipo:e.target.value,autoKey:ind.autoKey||'pctMO',threshold:1})}><option value="auto">Automática · % da meta</option><option value="valor">Valor informado</option><option value="manual">Sim / não manual</option></select></label><label>Bônus (% do faturamento)<input className="form-input" type="number" min="0" max="100" step="0.01" required value={ind.pct===''?'':Number(((ind.pct??0)*100).toFixed(6))} onChange={e=>updateIndicator(index,{pct:e.target.value===''?'':Number(e.target.value)/100})}/></label>
        {ind.tipo==='auto'&&<label>Métrica<select className="form-input" value={ind.autoKey} onChange={e=>updateIndicator(index,{autoKey:e.target.value})}>{Object.entries(GESTAO_METRICAS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
        {ind.tipo!=='manual'&&<><label>Comparação<select className="form-input" value={ind.operador||'gte'} onChange={e=>updateIndicator(index,{operador:e.target.value})}>{Object.entries(GESTAO_OPERADORES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>{ind.tipo==='auto'?'Limite (% da meta)':'Limite do valor'}<input className="form-input" type="number" min="0" max={ind.tipo==='auto'?1000:1e12} step="0.01" required value={ind.threshold===''?'':ind.tipo==='auto'?Number(((ind.threshold??1)*100).toFixed(6)):ind.threshold??0} onChange={e=>updateIndicator(index,{threshold:e.target.value===''?'':Number(e.target.value)/(ind.tipo==='auto'?100:1)})}/></label></>}
        </div></div>)}<button type="button" className="btn btn-ghost btn-sm" disabled={draft.indicadores.length>=30} onClick={()=>set('indicadores',[...draft.indicadores,{chave:`ind_${crypto.randomUUID().replaceAll('-','')}`,nome:'Novo indicador',tipo:'auto',autoKey:'pctMO',threshold:1,operador:'gte',pct:0}])}><Plus size={15}/>Adicionar indicador</button></fieldset>
      <footer><button className="btn btn-ghost" type="button" onClick={()=>setDraft(null)}>Cancelar</button><RainbowButton type="submit">Revisar alterações</RainbowButton></footer>
    </form>}
    {review&&<div className="gestao-policy-review"><p>Confira a regra antes de aplicar. Nenhum outro mês ou gestor será alterado.</p><dl><dt>Faturamento base</dt><dd>{review.baseCalculo==='equipe_mais_propria'?'Equipe + próprias':'Equipe'} · {review.canaisBase.map(c=>GESTAO_CANAIS[c]).join(', ')}</dd>{Object.entries(GESTAO_CANAIS).map(([key,label])=><div key={key}><dt>Meta {label}</dt><dd>{review.metasCanais[key]===undefined?'Soma da equipe':fmtBRL2(review.metasCanais[key])}</dd></div>)}{Object.entries(rateFields).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{fmtPct(expected.current[key]||0,2)} → {fmtPct(review[key]||0,2)}</dd></div>)}<dt>Liberação de bônus</dt><dd>{review.bonusMinimo===undefined?'Sem condição de faturamento':`A partir de ${fmtPct(review.bonusMinimo,2)} da meta de faturamento`}</dd></dl><h3>Indicadores após salvar</h3>{review.indicadores.map(ind=><p key={ind.chave}><strong>{ind.nome}</strong> · {indicadorCondicao(ind)} · bônus {fmtPct(ind.pct,2)}</p>)}{!review.indicadores.length&&<p>Nenhum indicador.</p>}<footer><button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setReview(null)}>Voltar à edição</button><RainbowButton disabled={busy} onClick={save}>{busy?'Salvando…':'Confirmar alteração'}</RainbowButton></footer></div>}
  </DialogContent></Dialog></>
}
