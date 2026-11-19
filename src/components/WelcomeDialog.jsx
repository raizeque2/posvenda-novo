import { RainbowButton } from './ui/rainbow-button'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowLeft, ArrowRight, CircleHelp, X } from '../icons/iconoir'
import { useAuth } from '../contexts/AuthContext.jsx'
import useStore from '../store.js'
import { podeAcessar } from '../data/permissoes.js'
import '../theme/tour.css'

const allSteps=[
  {path:'/',selector:'[data-tour="home-summary"]',title:'O pulso da operação',text:'Veja a receita da última data carregada, pessoas com movimentação e alertas de metas. A data da base fica explícita: dados atrasados não significam queda de vendas.'},
  {path:'/',selector:'[data-tour="home-shortcuts"]',title:'Cada página a um clique',text:'Os cartões abrem as áreas liberadas para sua conta. Abaixo deles, Atenção aponta projeções que merecem acompanhamento individual.'},
  {path:'/desempenho',selector:'[data-tour="personal-kpis"]',title:'Uma pessoa por vez',text:'Acompanhe realizado, projeção, quanto falta e quanto precisa vender por dia útil. Mais abaixo estão a evolução em área, o calendário de vendas e as metas de cada mês.'},
  {path:'/dashboard',selector:'.dash-bi-slot',title:'Seu próprio BI',text:'Escolha a visão salva, toque em Personalizar para arrastar e redimensionar os blocos e abra Configurar em cada um para escolher dados e formatos. O botão Salvar, à direita da barra, mantém as mudanças.'},
  {path:'/metas',selector:'[data-tour="metas-filters"]',title:'Metas com menos distrações',text:'Os ícones abrem filtros por estado, loja, supervisor e cargo. Sugerir metas abre um bloco separado; revise os valores na tabela antes de salvar.'},
  {path:'/comissoes',selector:'[data-tour="commission-filters"]',title:'Comissões em foco',text:'Os totais aparecem nos cartões e a evolução mensal agora usa área. Os filtros compactos deixam mais espaço para os resultados.'},
  {path:null,selector:'.sidebar-theme',title:'Claro ou escuro',text:'Escolha a aparência mais confortável. Sua preferência fica salva neste navegador. Você pode rever este tour em Novidades.'},
]
export default function WelcomeDialog({uid,onRevealMenu}) {
  const {role,setor}=useAuth(),permissions=useStore(s=>s.permissoes),navigate=useNavigate(),location=useLocation()
  const steps=useMemo(()=>allSteps.filter(s=>!s.path||podeAcessar(role,s.path,permissions,setor)),[role,permissions,setor])
  const key=`posvenda-welcome-home-2026-10:${uid}`
  const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[rect,setRect]=useState(null)
  const [seen,setSeen]=useState(()=>{try{return localStorage.getItem(key)==='seen'}catch{return false}})
  const returnFocus=useRef(null),content=steps[index]||steps[0]
  function close(){setOpen(false);setSeen(true);try{localStorage.setItem(key,'seen')}catch{};requestAnimationFrame(()=>returnFocus.current?.focus())}
  function start(){setIndex(0);setOpen(true)}
  // O tour guiado só abre quando a pessoa pede (Novidades / Rever apresentação). Antes ele abria
  // sozinho junto com o onboarding de boas-vindas, sobrepondo os dois e navegando para outra página.
  useEffect(()=>{try{setSeen(localStorage.getItem(key)==='seen')}catch{setSeen(false)}},[key])
  useEffect(()=>{window.addEventListener('posvenda:start-tour',start);return()=>window.removeEventListener('posvenda:start-tour',start)},[])
  useEffect(()=>{if(open&&content.path&&location.pathname!==content.path)navigate(content.path)},[open,index,content.path])
  useEffect(()=>{
    if(!open)return
    if(content.selector==='.sidebar-theme'&&window.innerWidth<=768)onRevealMenu?.()
    let target=null,scrolled=false
    function update(){
      target=document.querySelector(content.selector)
      if(!target){setRect(null);return}
      if(!scrolled){target.scrollIntoView({block:'center',behavior:'instant'});scrolled=true}
      const r=target.getBoundingClientRect();if(!r.width||!r.height){setRect(null);return};const top=Math.max(8,r.top-7),left=Math.max(8,r.left-7)
      setRect({top,left,width:Math.max(0,Math.min(window.innerWidth-8,r.right+7)-left),height:Math.max(0,Math.min(window.innerHeight-8,r.bottom+7)-top)})
    }
    update();const observer=new MutationObserver(update);observer.observe(document.getElementById('root'),{childList:true,subtree:true});window.addEventListener('resize',update);window.addEventListener('scroll',update,true);window.addEventListener('transitionend',update,true)
    return()=>{observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);window.removeEventListener('transitionend',update,true)}
  },[open,index,location.pathname,content.selector])
  return <><RainbowButton ref={returnFocus} className={`sidebar-news${seen ? '' : ' sidebar-news-unread'}`} type="button" aria-label="Novidades" title="Novidades" onClick={start}><CircleHelp size={16}/><span className="nav-label">Novidades {!seen&&<i className="news-dot" aria-hidden="true"/>}</span></RainbowButton><DialogPrimitive.Root open={open} onOpenChange={v=>v?start():close()}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="tour-overlay"/><div className="tour-spotlight" aria-hidden="true" style={rect||{inset:0,border:0,borderRadius:0}}/><DialogPrimitive.Content className="tour-panel" style={rect&&window.innerWidth<=600&&rect.top>window.innerHeight/2?{top:64,bottom:'auto'}:undefined} onCloseAutoFocus={e=>{e.preventDefault();returnFocus.current?.focus()}}><span className="news-shimmer">Novidades · {index+1} de {steps.length}</span><DialogPrimitive.Title>{content.title}</DialogPrimitive.Title><DialogPrimitive.Description>{content.text}</DialogPrimitive.Description><button className="tour-close" aria-label="Fechar tour" onClick={close}><X size={17}/></button><footer><button className="btn btn-ghost btn-sm" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ArrowLeft size={14}/>Voltar</button><button className="btn btn-ghost btn-sm" onClick={close}>Pular</button><button className="btn btn-primary btn-sm" onClick={()=>index===steps.length-1?close():setIndex(i=>i+1)}>{index===steps.length-1?'Concluir':'Próximo'}<ArrowRight size={14}/></button></footer></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root></>
}
