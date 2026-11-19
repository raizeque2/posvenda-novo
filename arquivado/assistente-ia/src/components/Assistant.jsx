import { useUploadTasks } from '../store/uploadTasks.js'
import WorkspaceTools from './WorkspaceTools.jsx'
import { siteActions } from '../assistant/site-actions.js'
import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AgentDock } from './ui/agent-dock'
import { useAssistantVoice } from '../assistant/useAssistantVoice.js'
import { podeAcessar } from '../data/permissoes.js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import useStore from '../store.js'
import { PromptInput } from './ui/ai-chat-input'
import ConnectionsDialog from '../assistant/ConnectionsDialog.jsx'
import { newConversation, beginTurn, finishTurn, conversationContext } from '../assistant/conversations.js'
import { previewGemini } from '../assistant/gemini-preview.js'
import { isChangeQuestion } from '../../functions/src/assistantChangesPolicy.js'
import { homeSummary, localAnswer } from '../analytics/home.js'
import { fmtBRL2 as money } from '../utils/formatacao.js'
import { monthKey } from '../analytics/personal.js'
import { chartReply } from '../../functions/src/assistantCharts.js'
import { previewAnalysisContext } from '../assistant/analysis-preview.js'
import { assistantFailure } from '../assistant/errors.js'

const preview=import.meta.env.MODE==='preview'
const ChatModal=lazy(()=>import('../assistant/chat/ChatModal.jsx'))
const AssistantContext=createContext(null)
export function AssistantEntry() {
  const {prompt,setPrompt,send,pickerProps,busy,voice,actions,navigateAction}=useContext(AssistantContext)
  return <div data-tour="home-assistant"><PromptInput value={prompt} onChange={setPrompt} onSubmit={()=>send()} voice={voice} searchActions={actions} onNavigateAction={navigateAction} modelPicker={{...pickerProps,side:'bottom'}} busy={busy}/></div>
}
export function AssistantTools(){const {actions,send,navigateAction,busy}=useContext(AssistantContext);return <WorkspaceTools actions={actions} onAsk={send} onNavigate={navigateAction} busy={busy}/>}
export default function AssistantProvider({children}) {
  useEffect(()=>()=>useUploadTasks.getState().clear(),[])
  const {role,nome,estados,setor}=useAuth(),store=useStore(),canEdit=role==='admin'
  const {pathname}=useLocation(),navigate=useNavigate(),docked=pathname!=='/'
  const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width: 768px)').matches)
  useEffect(()=>{const media=window.matchMedia('(max-width: 768px)'),update=()=>setMobile(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[])
  const actions=useMemo(()=>siteActions(role,store.permissoes,setor),[role,store.permissoes,setor])
  function navigateAction(action){voice.cancelCapture();voice.cancelReading();setPrompt('');setOpen(false);navigate(action.path)}
  const full=role!=='operacional'&&podeAcessar(role,'/dashboard',store.permissoes,setor)
  const summary=useMemo(()=>homeSummary(store,{name:nome,full,estados}),[store,nome,full,estados])
  const [prompt,setPrompt]=useState(''),[open,setOpen]=useState(false),[connections,setConnections]=useState(false),[busy,setBusy]=useState(false),[provider,setProvider]=useState('local'),[status,setStatus]=useState(null),[consent,setConsent]=useState(false),[connectionChoice,setConnectionChoice]=useState(null),[thinking,setThinking]=useState(undefined),[model,setModel]=useState('local'),[pendingModel,setPendingModel]=useState(null)
  const [conversations,setConversations]=useState(()=>[newConversation()]),[selectedConversation,setSelectedConversation]=useState(null)
  const activeId=conversations.find(c=>c.id===selectedConversation)?.id||conversations[0].id,messages=conversations.find(c=>c.id===activeId).messages
  const [editor,setEditor]=useState(false),[person,setPerson]=useState(''),[channel,setChannel]=useState(''),[field,setField]=useState('mp'),[amount,setAmount]=useState(''),[error,setError]=useState('')
  const [authorizedProvider,setAuthorizedProvider]=useState(null)
  const [localGemini,setLocalGemini]=useState({available:false,connected:false,loading:false,busy:false})
  const returnFocus=useRef(null),sending=useRef(false)
  const localConnectionVersion=useRef(0),localMutation=useRef(false)
  const voice=useAssistantVoice({open,pathname,prompt,setPrompt})
  useEffect(()=>{if(mobile&&docked){setOpen(false);setConnections(false)}},[mobile,docked])
  function openChat(){if(!open)returnFocus.current=document.activeElement;setOpen(true)}
  // A bottom bar (mobile) abre o assistente pelo botão central.
  useEffect(()=>{const abrir=()=>{returnFocus.current=document.activeElement;setOpen(true)};window.addEventListener('posvenda:abrir-assistente',abrir);return()=>window.removeEventListener('posvenda:abrir-assistente',abrir)},[])
  function inspectAnalysis(query){const f=query.filters;store.setFiltrosGlobais({mes:query.months.at(-1),estado:f.state,lojas:f.stores,setor:f.channels,supervisor:f.supervisor,cargo:f.roles,busca:f.people.length===1?f.people[0]:f.search});setOpen(false);navigate('/dashboard')}
  function setMessages(update,id=activeId){setConversations(chats=>chats.map(chat=>chat.id===id?{...chat,updatedAt:Date.now(),messages:typeof update==='function'?update(chat.messages):update}:chat))}
  function selectConversation(id){voice.cancelCapture();voice.cancelReading();setSelectedConversation(id);setPrompt('');setEditor(false);setPerson('');setChannel('');setAmount('');setError('')}
  function startConversation(){const unused=conversations.find(chat=>!chat.messages.length),next=unused||newConversation();if(!unused)setConversations(chats=>[next,...chats]);selectConversation(next.id);requestAnimationFrame(()=>document.querySelector('.chat-composer textarea')?.focus())}
  function renameConversation(id,title){setConversations(chats=>chats.map(chat=>chat.id===id?{...chat,title,renamed:true}:chat))}
  function deleteConversation(id){const remaining=conversations.filter(chat=>chat.id!==id),next=remaining.length?remaining:[newConversation()];setConversations(next);if(activeId===id)selectConversation(next[0].id)}
  function vote(messageId,value){setMessages(current=>current.map(message=>message.id===messageId?{...message,vote:value}:message))}
  async function loadStatus(){
    if(!canEdit)return
    if(preview){
      const version=++localConnectionVersion.current
      setLocalGemini(current=>({...current,loading:true}))
      try{const result=await previewGemini('status');if(version!==localConnectionVersion.current)return;setLocalGemini(current=>({...current,...result,loading:false}));setStatus(current=>({...current,models:{...current?.models,gemini:result.models}}))}
      catch{if(version===localConnectionVersion.current)setLocalGemini(current=>({...current,available:false,connected:false,loading:false}))}
      return
    }
    const version=++localConnectionVersion.current
    setLocalGemini(current=>({...current,environment:'firebase',loading:true}))
    const results=await Promise.allSettled([httpsCallable(functions,'assistantStatus')({}),httpsCallable(functions,'assistantConnections')({action:'status'})])
    if(version!==localConnectionVersion.current)return
    const general=results[0].status==='fulfilled'?results[0].value.data:{},personal=results[1].status==='fulfilled'?results[1].value.data:null
    setLocalGemini(personal?{...personal,loading:false,busy:false}:{available:false,environment:'firebase',savingSupported:true,connected:false,loading:false,busy:false})
    setStatus({...general,models:{...general.models,...(personal?.connected?{gemini:personal.models}:{})}})
  }
  async function geminiConnection(action,data={}){return preview?previewGemini(action,data):(await httpsCallable(functions,'assistantConnections')({action,...data})).data}
  async function connectLocalGemini(credentials){
    if(!canEdit||!consent||busy||localMutation.current)return
    localMutation.current=true
    localConnectionVersion.current++
    setLocalGemini(current=>({...current,busy:true}));setError('')
    try{const result=await geminiConnection('connect',{...credentials,consent:true});localConnectionVersion.current++;const next=result.models.find(option=>option.id===model)||result.models[0];setLocalGemini({...result,available:true,busy:false,loading:false});setStatus(current=>({...current,models:{...current?.models,gemini:result.models}}));setProvider('gemini');setModel(next.id);setThinking(next.defaultThinking);setAuthorizedProvider('gemini');setPendingModel(null);setConnections(false);return true}
    catch(e){setError(e.message);setLocalGemini(current=>({...current,busy:false}))}
    finally{localMutation.current=false}
  }
  async function manageLocalGemini(action,data={}){
    if(!canEdit||busy||localMutation.current)return false
    localMutation.current=true
    localConnectionVersion.current++
    setLocalGemini(current=>({...current,busy:true}));setError('')
    try{const result=await geminiConnection(action,data);localConnectionVersion.current++;setLocalGemini({...result,loading:false,busy:false});setStatus(current=>({...current,models:{...current?.models,gemini:result.models}}));if(!result.connected&&provider==='gemini'){setProvider('local');setModel('local');setThinking(undefined);setAuthorizedProvider(null)}return true}
    catch(e){setError(e.message);setLocalGemini(current=>({...current,busy:false}));return false}
    finally{localMutation.current=false}
  }
  function inspectConnections(choice){voice.cancelCapture();voice.cancelReading();setConnectionChoice(typeof choice==='string'&&choice!=='local'?choice:null);setConnections(true);setConsent(false);setError('');void loadStatus()}
  const modelProviders=[{id:'local',name:'Local',models:[{id:'local',name:'Local',description:'Consultas demonstrativas à base do navegador'}]},{id:'gemini',name:'Gemini',models:status?.models?.gemini||[]},{id:'openai',name:'OpenAI',models:status?.models?.openai||[]},{id:'claude',name:'Claude',models:status?.models?.claude||[]},{id:'codex',name:'Codex',models:[]}]
  function chooseModel(id,owner,effort){if(owner!=='local'&&owner!==authorizedProvider){setPendingModel({id,owner,effort});inspectConnections(owner);return}setProvider(owner);setModel(id);setThinking(effort)}
  function confirmConnection(owner){if(owner==='local'){setProvider('local');setModel('local');setThinking(undefined);setAuthorizedProvider(null)}else{const options=status?.models?.[owner]||[];if((preview&&(owner!=='gemini'||!localGemini.connected))||!canEdit||!consent||!options.length)return;const next=options.find(m=>pendingModel?.owner===owner&&m.id===pendingModel.id)||options[0];setProvider(owner);setModel(next.id);setThinking(next.thinking?.includes(pendingModel?.effort)?pendingModel.effort:next.defaultThinking);setAuthorizedProvider(owner)}setPendingModel(null);setConnections(false)}
  const pickerProps={providers:modelProviders,value:model,provider,thinking,onValueChange:chooseModel,onConnect:inspectConnections,onInspect:loadStatus}
  async function send(value=prompt,replaceFrom) {
    if(!value.trim()||busy||sending.current)return
    sending.current=true;voice.cancelCapture()
    const conversationId=activeId,replyId=crypto.randomUUID(),agent=provider
    openChat();setPrompt('');setBusy(true);setError('');setEditor(false);setPerson('');setChannel('');setAmount('')
    setConversations(chats=>beginTurn(chats,conversationId,{id:crypto.randomUUID(),role:'user',text:value.trim()},{id:replyId,role:'assistant',provider:agent,model,status:'pending',text:''},Date.now(),replaceFrom))
    try{
      let prepared
      if(canEdit && isChangeQuestion(value)) {
        prepared=(await httpsCallable(functions,'assistantChanges')({action:'prepare',question:value})).data
        if(prepared.proposal || !prepared.needsModel || provider==='local') {
          setConversations(chats=>finishTurn(chats,conversationId,replyId,{...prepared,status:'complete',revealStartedAt:Date.now()}))
          return
        }
      }
      if(provider!=='local'&&authorizedProvider!==provider)throw Error('Autorize o envio em Conexões.')
      const previous=conversationContext(messages,replaceFrom)
      const request={question:value,consent:authorizedProvider===provider,model,thinking,...previous,pageFilters:store.filtrosGlobais}
      const context=provider==='local'||preview&&provider==='gemini'?previewAnalysisContext(store,value,{name:nome,full,estados,pageFilters:store.filtrosGlobais,previous:previous.previousQuery}):null
      const charts=provider==='local'?chartReply(context,value):{}
      const analyticLocal=context&&!/ATEN[CÇ][AÃ]O|PRECISA|ESTOQUE|(?:AJUST|ALTER|AUMENT|REDUZ).*META/i.test(value)
      const localReply=analyticLocal?{...charts,text:charts.chartNotice||`Receita líquida em ${context.month}: ${money(context.sales.total)}. ${charts.charts?'Os gráficos abaixo usam os dados e filtros indicados nas fontes.':'Confira o recorte e a atualização nas fontes desta resposta.'}`,query:context.query,provenance:context.provenance}:localAnswer(value,summary)
      let reply=provider==='local'?localReply:preview&&provider==='gemini'?await previewGemini('ask',{...request,keyId:localGemini.activeKeyId,context}):(await httpsCallable(functions,provider==='gemini'&&localGemini.environment==='firebase'&&localGemini.connected?'assistantPersonalGemini':{openai:'assistantOpenAI',claude:'assistantClaude',gemini:'assistantGemini'}[provider])({...request,...(provider==='gemini'&&localGemini.connected?{keyId:localGemini.activeKeyId}:{})})).data
      if(!reply.text?.trim())throw Error('Resposta vazia')
      if(reply.change && canEdit && isChangeQuestion(value)) {
        reply=(await httpsCallable(functions,'assistantChanges')({action:'prepare',question:value,change:reply.change})).data
      }
      setConversations(chats=>finishTurn(chats,conversationId,replyId,{...reply,status:'complete',revealStartedAt:Date.now()}))
    }catch(e){setConversations(chats=>finishTurn(chats,conversationId,replyId,{status:'error',...assistantFailure(e)}))}finally{sending.current=false;setBusy(false)}
  }
  function retry(index){const userIndex=messages.slice(0,index).findLastIndex(message=>message.role==='user');if(userIndex>=0)void send(messages[userIndex].text,userIndex)}
  function editAndSend(index,text){void send(text,index)}
  const connectionStates={local:{state:'connected',label:'Modo local ativo'},codex:{state:'disconnected',label:'Não conectado'},...Object.fromEntries(['claude','openai','gemini'].map(agent=>[agent,{state:authorizedProvider===agent?'connected':'disconnected',label:authorizedProvider===agent?'Conectado':'Desconectado'}]))}
  if(messages.at(-1)?.status==='error')connectionStates[messages.at(-1).provider]={state:'error',label:'Erro na consulta'}
  function selectProvider(agent){const options=modelProviders.find(p=>p.id===agent)?.models||[],next=options.find(m=>m.id===model)||options[0];if(next)chooseModel(next.id,agent,next.defaultThinking);else inspectConnections(agent)}
  const month=monthKey(new Date()),people=Object.values(store.colaboradoresPorMes[month]||{}).filter(c=>c.ativo!==false),selected=people.find(p=>p.colaborador===person),channels=(selected?.cargo_movimento||'').split(';').filter(Boolean)
  function prepare(){
    const next=Number(amount),metric=channel==='OS'?(field==='mpo'?'peças de O.S.':'mão de obra'):'peças'
    if(!canEdit||!selected||!channels.includes(channel)||amount.trim()===''||!Number.isFinite(next)||next<0||next>100000000){setError('Escolha uma pessoa, o setor e um valor válido.');return}
    void send(`Defina a meta de ${metric} de ${person} no setor ${channel} para R$ ${next.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`)
  }
  async function reviewChange(messageId,action){
    if(!canEdit||busy||sending.current)return
    const message=messages.find(item=>item.id===messageId),conversationId=activeId
    if(!message?.proposal||message.changeStatus==='applied'||message.changeStatus==='cancelled')return
    sending.current=true;setBusy(true)
    const patch=changes=>setMessages(items=>items.map(item=>item.id===messageId?{...item,...changes}:item),conversationId)
    patch({changeStatus:'saving',changeError:''})
    let result
    try{
      result=(await httpsCallable(functions,'assistantChanges')({action,id:message.proposal.id,...(action==='confirm'?{confirmed:true}:{})})).data
      patch({proposal:result.proposal,changeStatus:result.status,changeError:''})
      if(result.status==='applied'){
        try{await useStore.getState().carregarDadosCloud()}
        catch{patch({changeError:'Alteração salva. Recarregue a página para atualizar os indicadores.'})}
      }
    }catch(e){patch({changeStatus:'pending',changeError:e.message||'Não foi possível concluir. Tente novamente para conferir o resultado.'})}
    finally{sending.current=false;setBusy(false)}
  }
  return <AssistantContext.Provider value={{prompt,setPrompt,send,pickerProps,busy,setOpen,voice,actions,navigateAction}}>
    {children}
    {docked&&!mobile&&<AgentDock agentName="Assistente" avatarSrc="/illustrations/assistant.png" onOpenChat={openChat} busy={busy}/>}
    <Suspense fallback={<div role="status" className="assistant-loading">Abrindo assistente…</div>}>{open&&<ChatModal open={open} onOpenChange={setOpen} mobile={mobile} returnFocus={returnFocus} name={preview?'Bruno':nome||'Bruno'} provider={provider} connections={connectionStates} conversations={conversations} activeId={activeId} messages={messages} busy={busy} canEdit={canEdit} voice={voice} onConnect={inspectConnections} onProvider={selectProvider} onNew={startConversation} onSelect={selectConversation} onRename={renameConversation} onDelete={deleteConversation} onRetry={retry} onEdit={editAndSend} onVote={vote} onInspect={full?inspectAnalysis:undefined} onConfirmChange={id=>reviewChange(id,'confirm')} onCancelChange={id=>reviewChange(id,'cancel')} onTarget={()=>setEditor(true)} prompt={prompt} setPrompt={setPrompt} send={send} pickerProps={pickerProps} searchActions={actions} onNavigateAction={navigateAction}>
      {editor&&canEdit&&<section className="target-editor"><h3>Ajuste de meta · {month}</h3><div><label>Colaborador<select value={person} onChange={e=>{setPerson(e.target.value);setChannel('')}}><option value="">Selecione</option>{people.map(p=><option key={p.colaborador}>{p.colaborador}</option>)}</select></label><label>Setor<select value={channel} onChange={e=>{setChannel(e.target.value);setField(e.target.value==='OS'?'mo':'mp')}}><option value="">Selecione</option>{channels.map(c=><option key={c}>{c}</option>)}</select></label>{channel==='OS'&&<label>Métrica<select value={field} onChange={e=>{setField(e.target.value)}}><option value="mo">Mão de obra</option><option value="mpo">Peças de O.S.</option></select></label>}<label>Novo valor (R$)<input type="number" min="0" max="100000000" step="0.01" value={amount} onChange={e=>{setAmount(e.target.value)}}/></label></div><button className="btn btn-ghost" disabled={busy} onClick={prepare}>Revisar proposta</button><button className="btn btn-ghost" onClick={()=>{setEditor(false);setError('')}}>Cancelar</button></section>}
      {error&&<p role="alert">{error}</p>}</ChatModal>}</Suspense>
    <ConnectionsDialog open={connections} onOpenChange={setConnections} choice={connectionChoice} onChoiceChange={choice=>{setConnectionChoice(choice);setConsent(false);setError('')}} consent={consent} onConsentChange={setConsent} status={status} preview={preview} error={error} onConfirm={confirmConnection} localGemini={{...localGemini,busy:busy||localGemini.busy}} onLocalConnect={connectLocalGemini} onLocalDisconnect={()=>manageLocalGemini('disconnect')} onLocalManage={manageLocalGemini}/>
  </AssistantContext.Provider>
}
