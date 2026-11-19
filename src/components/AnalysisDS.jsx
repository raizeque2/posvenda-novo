// Adapters for the imported analysis pages; visuals come from the existing DS.
import {useEffect, useMemo, useState} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {FiltersBar,FiltroAnoMes,FiltroDropdown,FormDropdown,Td as Cell,KpiStrip as Strip} from './DS.jsx'
export * from './DS.jsx'
export function Modal({title,onClose,children,footer,maxWidth=640}){
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose?.()}}><Dialog.Portal>
    <Dialog.Overlay style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,.45)',backdropFilter:'blur(8px)'}}/>
    <Dialog.Content aria-describedby={undefined} style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:2001,width:'calc(100vw - 32px)',maxWidth,maxHeight:'90dvh',overflow:'auto',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius-xl)',padding:24,boxShadow:'0 20px 70px #0003'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:20}}><Dialog.Title asChild><div className="card-title">{title||'Detalhes'}</div></Dialog.Title><Dialog.Close className="btn btn-ghost btn-sm" aria-label="Fechar">×</Dialog.Close></div>
      {children}{footer&&<div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}>{footer}</div>}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}

export function BarraFiltros({meses,mes,onMes,estados,estado,onEstado,filtros=[],busca,onBusca,placeholderBusca,temFiltro,onLimpar}) {
  return <FiltersBar>
    {onMes&&<FiltroAnoMes meses={meses||[]} value={mes} onChange={onMes}/>}
    {onEstado&&<FiltroDropdown label="Estado" options={estados||[]} value={estado} onChange={onEstado}/>}
    {filtros.map((f,i)=><FiltroDropdown key={`${f.label}-${i}`} {...f} options={(f.options||[]).map(option=>typeof option==='string'?{value:option,label:option}:option)}/>)}
    {onBusca&&<input className="form-input analysis-search" aria-label={placeholderBusca||'Buscar'} placeholder={placeholderBusca||'Buscar…'} value={busca||''} onChange={e=>onBusca(e.target.value)}/>}
    {temFiltro&&<button type="button" className="btn btn-ghost btn-sm" onClick={onLimpar}>Limpar</button>}
  </FiltersBar>
}
export function useSorter(rows,getters,initial={}) {
  const [sort,setSort]=useState({col:initial.col||'',dir:initial.dir||'asc'})
  const sorted=useMemo(()=>{
    const get=getters[sort.col];if(!get)return rows
    return [...rows].sort((a,b)=>{
      const x=get(a),y=get(b),v=typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),'pt-BR',{numeric:true})
      return sort.dir==='asc'?v:-v
    })
  },[rows,getters,sort])
  return {sorted,sort,toggle:col=>setSort(s=>({col,dir:s.col===col&&s.dir==='asc'?'desc':'asc'}))}
}
export function Th({col,label,sort,toggle,children,...props}) {
  const active=sort?.col===col
  return <th aria-sort={active?(sort.dir==='asc'?'ascending':'descending'):'none'} style={{textAlign:props.num?'right':props.center?'center':'left',...props.style}}><button type="button" className="analysis-sort" onClick={()=>toggle?.(col)}>{label||children}<span aria-hidden="true"> {active?(sort.dir==='asc'?'↑':'↓'):'↕'}</span></button></th>
}
export function Td({nome,destaque,style,...props}){return <Cell {...props} style={{...(nome?{whiteSpace:'normal',minWidth:140}:{}),...(destaque?{fontWeight:700}:{}),...style}}/>}
export function KpiStrip({kpis,...props}) {
  return <div className="analysis-kpis">{kpis.map(k=><button type="button" className="analysis-kpi" key={k.label} disabled={!k.onClick} onClick={k.onClick}><Strip {...props} kpis={[k]}/></button>)}</div>
}
export function IconButton({icon:Icon,title,...props}) {return <button type="button" className="btn btn-ghost btn-sm" aria-label={title} title={title} {...props}><Icon size={16}/></button>}
export function SeletorUnico({mostrarLimpar,...props}) {return <FormDropdown {...props}/>}
export function SeletorMultiplo({options,value=[],onChange}) {
  return <div className="analysis-chips">{options.map(option=><button type="button" key={option} className={`filter-chip${value.includes(option)?' active':''}`} aria-pressed={value.includes(option)} onClick={()=>onChange(value.includes(option)?value.filter(v=>v!==option):[...value,option])}>{option}</button>)}</div>
}
export function useTablePage(rows,size=100){
  const [index,setIndex]=useState(0),pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(index,pages-1)
  const first=rows[0]?.chave||rows[0]?.codigo||rows[0]?.cidade||''
  useEffect(()=>setIndex(0),[rows.length,first])
  return {visible:rows.slice(current*size,(current+1)*size),controls:rows.length>size?<div className="analysis-pagination"><span>{current*size+1}–{Math.min((current+1)*size,rows.length)} de {rows.length}</span><button type="button" className="btn btn-ghost btn-sm" disabled={!current} onClick={()=>setIndex(current-1)}>Anterior</button><button type="button" className="btn btn-ghost btn-sm" disabled={current===pages-1} onClick={()=>setIndex(current+1)}>Próxima</button></div>:null}
}
export function ValorInput({value,onSave,readOnly,min=0,max=Infinity,largura=80}) {
  const [draft,setDraft]=useState(String(value??'')),[error,setError]=useState('')
  useEffect(()=>setDraft(String(value??'')),[value])
  async function save(){const next=Number(draft);if(!Number.isInteger(next)||next<min||next>max){setError(`Informe um inteiro entre ${min} e ${max}.`);return}try{if(next!==Number(value))await onSave(next);setError('')}catch(e){setError(e.message)}}
  return <span><input className="form-input" type="number" aria-label="Valor" value={draft} min={min} max={max} step={1} readOnly={readOnly} style={{width:largura}} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(!readOnly)void save()}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>{error&&<span role="alert" className="note">{error}</span>}</span>
}
