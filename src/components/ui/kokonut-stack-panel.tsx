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
import { useEffect, useRef, useState, type ReactNode, type ComponentProps } from 'react'
import { AnimatePresence, motion, useReducedMotion, useIsPresent } from 'motion/react'
import { Check, ArrowLeft as ChevronLeft, ArrowRight as ChevronRight } from '../../icons/iconoir'
import './kokonut-stack-panel.css'
export type StackRow={id:string;label:string;icon?:ReactNode;detail?:string;to?:string;selected?:boolean;checked?:boolean;trailing?:ReactNode;onSelect?:()=>void;tone?:'default'|'danger'}
export type StackPage={title:string;sections:{title?:string;rows:StackRow[];footer?:string}[]}
export function StackPanel({pages,root,className=''}:{pages:Record<string,StackPage>;root:string;className?:string}){
  const [stack,setStack]=useState([{page:root,from:''}]),[direction,setDirection]=useState(1),panel=useRef<HTMLDivElement>(null),focusTarget=useRef(''),reduced=useReducedMotion()
  const current=stack.at(-1)!,page=pages[current.page],parent=stack.length>1?pages[stack.at(-2)!.page]:null
  useEffect(()=>{if(stack.length>1)panel.current?.querySelector<HTMLButtonElement>('.stack-back')?.focus();},[current.page])
  function back(){if(stack.length<2)return;focusTarget.current=current.from;setDirection(-1);setStack(value=>value.length>1?value.slice(0,-1):value)}
  if(!page)return null
  return <div ref={panel} className={`stack-panel ${className}`} onKeyDown={event=>{if(event.key==='Escape'&&parent){event.preventDefault();event.stopPropagation();back()}}}>
    <header>{parent&&<button className="stack-back" type="button" onClick={back} aria-label={`Voltar para ${parent.title}`}><ChevronLeft size={16}/><span>Voltar</span></button>}<h2 aria-live="polite">{page.title}</h2></header>
    <AnimatePresence initial={false} mode="wait"><StackPageView className="stack-page" onAnimationComplete={()=>{if(!parent&&focusTarget.current){const row=panel.current?.querySelector<HTMLButtonElement>(`.stack-page:not([inert]) [data-stack-row="${CSS.escape(focusTarget.current)}"]`);if(row){row.focus();focusTarget.current=''}}}} key={current.page} initial={{x:reduced?0:direction*30,opacity:reduced?1:0}} animate={{x:0,opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:.16}} drag={parent&&!reduced?'x':false} dragConstraints={{left:0,right:0}} dragElastic={{left:0,right:.4}} dragSnapToOrigin onDragEnd={(_,info)=>{if(info.offset.x>75||info.velocity.x>500)back()}}>
      {page.sections.map((section,index)=><section key={section.title||index}>{section.title&&<h3>{section.title}</h3>}<ul>{section.rows.map(row=><li key={row.id}><button type="button" data-stack-row={row.id} disabled={!row.to&&!row.onSelect} aria-pressed={row.selected} role={row.checked===undefined?undefined:'switch'} aria-checked={row.checked} className={row.tone==='danger'?'stack-danger':''} onClick={()=>{if(row.to&&pages[row.to]){setDirection(1);setStack(value=>value.at(-1)?.page===row.to?value:[...value,{page:row.to!,from:row.id}])}else row.onSelect?.()}}>
        {row.icon}<span>{row.label}</span>{row.detail&&<small>{row.detail}</small>}{row.trailing}{row.selected&&<Check size={16}/>} {row.checked!==undefined&&<i className={`stack-switch${row.checked?' is-on':''}`} aria-hidden="true"/>}{row.to&&<ChevronRight size={16}/>}</button></li>)}</ul>{section.footer&&<p>{section.footer}</p>}</section>)}
    </StackPageView></AnimatePresence>
  </div>
}

function StackPageView(props:ComponentProps<typeof motion.div>){const present=useIsPresent();return <motion.div {...props} aria-hidden={!present||undefined} inert={present?undefined:''}/> }
