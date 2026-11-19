import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Search, ArrowRight } from '../../icons/iconoir'
import { searchActions } from '../../data/siteActions.js'
import './action-search-bar.css'

export type Action = { id:string;path:string;label:string;section?:string;keywords?:string[] }
/** Busca de páginas do site (barra do topo). */
export function ActionSearchBar({actions,query,onQueryChange,onNavigate}:{actions:Action[];query:string;onQueryChange:(value:string)=>void;onNavigate:(action:Action)=>void}) {
  const id=useId(),[open,setOpen]=useState(false),[active,setActive]=useState(0),reduced=useReducedMotion(),root=useRef<HTMLDivElement>(null)
  const items=searchActions(actions,query) as Action[]
  const shown=open
  useEffect(()=>{setActive(0);if(query.trim())setOpen(true)},[query])
  useEffect(()=>{if(shown&&active>=0)document.getElementById(`${id}-${active}`)?.scrollIntoView({block:'nearest'})},[active,shown,id])
  function choose(index:number){const action=items[index];if(!action)return;setOpen(false);setActive(0);onNavigate(action)}
  function key(event:KeyboardEvent){
    if(event.nativeEvent.isComposing)return
    if(event.key==='Escape'){if(shown){event.preventDefault();event.stopPropagation();setOpen(false)}return}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(index=>(index+(event.key==='ArrowDown'?1:-1)+items.length)%Math.max(1,items.length));return}
    if(event.key==='Enter'){event.preventDefault();choose(shown&&active>=0?active:0)}
  }
  return <div ref={root} className="action-search action-search-top">
    <div className="action-search-field"><Search size={17} aria-hidden="true"/><input role="combobox" aria-label="Buscar página" aria-expanded={shown} aria-controls={id} aria-activedescendant={shown&&active>=0?`${id}-${active}`:undefined} aria-autocomplete="list"
      onFocus={()=>setOpen(true)} onBlur={event=>{if(!root.current?.contains(event.relatedTarget as Node))setOpen(false)}} onKeyDown={key}
      value={query} maxLength={200} placeholder="Buscar no site…" onChange={event=>{onQueryChange(event.target.value);setOpen(true)}}/></div>
    <AnimatePresence>{shown&&<motion.div className="action-search-menu" initial={{opacity:0,y:reduced?0:-5}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduced?0:.16}}>
      <div role="listbox" id={id} aria-label="Páginas">{items.map((action,index)=><button type="button" role="option" tabIndex={-1} aria-selected={active===index} id={`${id}-${index}`} key={action.id} onMouseDown={event=>event.preventDefault()} onPointerMove={()=>setActive(index)} onClick={()=>choose(index)}>
        <span className="action-search-glyph"><Search size={15}/></span><span><strong>{action.label}</strong><small>{action.section}</small></span><ArrowRight size={14}/>
      </button>)}{!items.length&&<p className="action-search-vazio">Nenhuma página encontrada.</p>}</div><footer>↑ ↓ para escolher <span>Esc fecha</span></footer>
    </motion.div>}</AnimatePresence>
  </div>
}
