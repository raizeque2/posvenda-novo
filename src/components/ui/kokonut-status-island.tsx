/*
MIT License

Copyright (c) 2025 kokonutUI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, X, ChevronDown } from '../../icons/iconoir'
import './kokonut-status-island.css'
export type IslandTask={id:string;label:string;detail?:string;status:'running'|'done'|'error';progress?:number;action?:{label:string;onClick:()=>void}}
export function StatusIsland({tasks,onDismiss,dismissAfter=6000}:{tasks:IslandTask[];onDismiss?:(id:string)=>void;dismissAfter?:number}){
  const [open,setOpen]=useState(false),[announcement,setAnnouncement]=useState(''),last=useRef(new Map<string,string>()),root=useRef<HTMLDivElement>(null),reduced=useReducedMotion()
  // Keep active work in front; completed/error tasks remain available in the stack.
  const current=tasks.filter(task=>task.status==='running').at(-1)||tasks.at(-1)
  useEffect(()=>{
    const changed=tasks.filter(task=>last.current.get(task.id)!==task.status)
    if(changed.length)setAnnouncement(changed.map(task=>`${task.label}: ${task.status==='done'?'concluído':task.status==='error'?'erro':'em andamento'}`).join('. '))
    last.current=new Map(tasks.map(task=>[task.id,task.status]))
  },[tasks])
  useEffect(()=>{
    if(open||!onDismiss)return
    const timers=tasks.filter(task=>task.status==='done').map(task=>window.setTimeout(()=>onDismiss(task.id),dismissAfter))
    return()=>timers.forEach(clearTimeout)
  },[tasks,open,onDismiss,dismissAfter])
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open])
  return <div className="status-island-slot" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false)}} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);root.current?.querySelector<HTMLButtonElement>('.status-island-trigger')?.focus()}}}>
    <output className="sr-only" aria-live="polite">{announcement}</output>
    <AnimatePresence>{current&&<motion.div className="status-island" initial={{opacity:0,y:reduced?0:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduced?0:.2}}>
      {tasks.length>1&&<div className="status-island-peek" aria-hidden="true"/>}
      <button className="status-island-trigger" type="button" aria-expanded={open} aria-label={`Importações: ${current.label}. ${tasks.length} tarefa(s). Ver detalhes`} onClick={()=>setOpen(value=>!value)}>
        <TaskIcon task={current}/><span>{current.label}<small>{current.detail}</small></span>{tasks.length>1&&<b>{tasks.length}</b>}<ChevronDown size={14}/>
      </button>
      <AnimatePresence>{open&&<motion.div className="status-island-list" initial={{opacity:0,y:reduced?0:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduced?0:.15}}>
        <header><strong>Importações</strong><button type="button" aria-label="Recolher importações" onClick={()=>{setOpen(false);root.current?.querySelector<HTMLButtonElement>('.status-island-trigger')?.focus()}}><X size={14}/></button></header>
        <ul>{tasks.map(task=><li key={task.id}><TaskIcon task={task}/><div><strong>{task.label}</strong><p>{task.detail}</p>{task.progress!==undefined&&task.status==='running'&&<progress max={1} value={Math.max(0,Math.min(1,task.progress))} aria-label={`Progresso de ${task.label}`}/>}</div>{task.action&&<button type="button" onClick={task.action.onClick}>{task.action.label}</button>}{task.status!=='running'&&onDismiss&&<button type="button" aria-label={`Dispensar ${task.label}`} onClick={()=>onDismiss(task.id)}><X size={14}/></button>}</li>)}</ul>
      </motion.div>}</AnimatePresence>
    </motion.div>}</AnimatePresence>
  </div>
}
function TaskIcon({task}:{task:IslandTask}){return task.status==='running'?<span className="island-spinner" aria-hidden="true"/>:task.status==='done'?<Check className="island-done" size={17} aria-hidden="true"/>:<span className="island-error" aria-hidden="true">!</span>}
