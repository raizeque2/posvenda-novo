import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActionSearchBar } from './ui/action-search-bar'
import { StatusIsland } from './ui/kokonut-status-island'
import { useUploadTasks } from '../store/uploadTasks.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import useStore from '../store.js'
import { siteActions } from '../data/siteActions.js'

const Topo = lazy(() => import('../pv/Topo.js'))

export default function WorkspaceTools({onMenu}){
  const {pathname}=useLocation(),home=pathname==='/'
  const {role,setor}=useAuth(),permissoes=useStore(s=>s.permissoes)
  const actions=useMemo(()=>siteActions(role,permissoes,setor),[role,permissoes,setor])
  useEffect(()=>()=>useUploadTasks.getState().clear(),[])
  const [clock,setClock]=useState(()=>new Date())
  useEffect(()=>{const timer=setInterval(()=>setClock(new Date()),60000);return()=>clearInterval(timer)},[])
  const [query,setQuery]=useState(''),navigate=useNavigate(),tasks=useUploadTasks(state=>state.tasks),dismiss=useUploadTasks(state=>state.dismiss)
  useEffect(()=>{const shortcut=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!document.querySelector('[role="dialog"]')){event.preventDefault();document.querySelector('.workspace-tools input')?.focus()}};window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut)},[])
  // Ao rolar a página para baixo a barra encolhe e fica só com os ícones; volta ao
  // topo da página, ao focar a busca ou com texto digitado (ver shell.css → .is-compacta).
  const [rolou,setRolou]=useState(false),[focada,setFocada]=useState(false)
  useEffect(()=>{
    const main=document.querySelector('.layout-workspace > .main')
    // Histerese: compacta depois de 120px e só volta abaixo de 24px. Com um limite único, juntar
    // as barras encolhia a página (filtros de 2 linhas viram 1), a rolagem cruzava o limite de
    // novo e as barras ficavam piscando entre os dois estados.
    const medir=()=>{const y=Math.max(main?.scrollTop||0,window.scrollY||0);setRolou(v=>v?y>24:y>120)}
    medir();main?.addEventListener('scroll',medir,{passive:true});window.addEventListener('scroll',medir,{passive:true})
    return()=>{main?.removeEventListener('scroll',medir);window.removeEventListener('scroll',medir)}
  },[])
  // Faturamento: uma barra só. A topbar fica sempre compacta (só ícones) e mora no canto direito
  // da barra de filtros, que é a única fixa (shell.css → .is-junta). Ao focar a busca ela abre por cima.
  const junta=pathname==='/dashboard'
  // Celular: barra de largura cheia com o botão da sidebar e a busca só como lupa (abre ao tocar).
  const [celular,setCelular]=useState(()=>window.matchMedia('(max-width: 768px)').matches)
  useEffect(()=>{const m=window.matchMedia('(max-width: 768px)'),f=()=>setCelular(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f)},[])
  const compacta=(rolou||junta||celular)&&!focada&&!query
  const go=action=>{setQuery('');navigate(action.path)}
  const uploads=useMemo(()=>tasks.map(task=>({...task,action:task.status==='error'?{label:'Ver detalhes',onClick:()=>navigate('/upload')}:undefined})),[tasks,navigate])
  return <div className={`workspace-tools no-print${home?' workspace-tools-home':''}${compacta?' is-compacta':''}${junta?' is-junta':''}`} aria-label="Ferramentas do site" onFocus={e=>{if(e.target.closest('.action-search'))setFocada(true)}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocada(false)}} onClick={e=>{if(compacta&&e.target.closest('.action-search'))e.currentTarget.querySelector('.action-search input')?.focus()}}>
    {celular&&onMenu&&<button type="button" className="workspace-menu" onClick={onMenu} aria-label="Abrir menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg></button>}
    {home&&!celular&&<span className="workspace-page-title">Início</span>}
    <ActionSearchBar actions={actions} query={query} onQueryChange={setQuery} onNavigate={go}/>
    <div className="workspace-tools-end">{home&&<time className="workspace-date" dateTime={clock.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})}>{clock.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'numeric',month:'long'})}</time>}<StatusIsland tasks={uploads} onDismiss={dismiss}/><Suspense fallback={null}><Topo/></Suspense></div>
  </div>
}
