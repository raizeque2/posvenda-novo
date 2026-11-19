import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { revealText } from '../../assistant/reveal.js'
import './streaming-text.css'

/** Adapts the supplied word reveal to real answers; no demo loop or fictitious sources. */
export default function StreamingText({text,startedAt,children}:{text:string;startedAt?:number;children:(text:string,done:boolean)=>ReactNode}) {
  const reduced=useReducedMotion(),[now,setNow]=useState(Date.now),[skipped,setSkipped]=useState(false)
  useEffect(()=>{
    if(!startedAt||reduced||skipped||revealText(text,startedAt).done)return
    const timer=window.setInterval(()=>{const time=Date.now();setNow(time);if(revealText(text,startedAt,time).done)window.clearInterval(timer)},32)
    return()=>window.clearInterval(timer)
  },[text,startedAt,reduced,skipped])
  // Finish using current time on remount; a historical reply never starts over.
  const visible=revealText(text,startedAt,Math.max(now,Date.now()),!!reduced||skipped)
  return <div className={`streaming-text${visible.done?'':' is-revealing'}`} aria-busy={!visible.done} aria-live="off">
    {children(visible.text,visible.done)}
    {!visible.done&&<><span className="streaming-cursor" aria-hidden="true"/><button type="button" className="streaming-skip" aria-label="Mostrar resposta completa" onClick={()=>setSkipped(true)}>Mostrar tudo</button></>}
  </div>
}
