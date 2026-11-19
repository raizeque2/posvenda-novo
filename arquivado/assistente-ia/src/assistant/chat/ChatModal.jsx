import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog'
import { Menu, Maximize2, ArrowDown } from '../../icons/iconoir'
import ChatSidebar from './ChatSidebar.jsx'
import ProviderSelect from './ProviderSelect.jsx'
import MessageBubble from './MessageBubble.jsx'
import Composer from './Composer.jsx'
import EmptyState from './EmptyState.jsx'
import './chat.css'

export default function ChatModal({ open, onOpenChange, mobile, returnFocus, name, provider, connections, conversations, activeId, messages, busy, canEdit, voice, onConnect, onProvider, onNew, onSelect, onRename, onDelete, onRetry, onEdit, onVote, onTarget, onInspect, onConfirmChange, onCancelChange, prompt, setPrompt, send, pickerProps, searchActions, onNavigateAction, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(!mobile), [fullscreen, setFullscreen] = useState(false), [unread, setUnread] = useState(false)
  const scroll = useRef(null), panel = useRef(null), nearBottom = useRef(true), previousId = useRef(activeId), menu = useRef(null)
  useEffect(() => { if (mobile) setSidebarOpen(false) }, [mobile])
  useEffect(() => {
    const changed = previousId.current !== activeId; previousId.current = activeId
    if (!open) return
    if (changed || nearBottom.current) { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; nearBottom.current = true; setUnread(false) }
    else setUnread(true)
  }, [messages, activeId, open])
  useEffect(() => { if (open && mobile && sidebarOpen) panel.current?.querySelector('.chat-history-search input')?.focus() }, [open, mobile, sidebarOpen])
  useEffect(()=>{
    const viewport=scroll.current,content=viewport?.querySelector('.chat-messages-content')
    if(!open||!content)return
    const observer=new ResizeObserver(()=>{if(nearBottom.current){viewport.scrollTop=viewport.scrollHeight}else setUnread(true)})
    observer.observe(content)
    return()=>observer.disconnect()
  },[open,activeId])
  function select(id) { onSelect(id); if (mobile) { setSidebarOpen(false); requestAnimationFrame(() => panel.current?.querySelector('.chat-composer textarea')?.focus()) } }
  function closeSidebar() { setSidebarOpen(false); requestAnimationFrame(() => menu.current?.focus()) }
  const failed = messages.at(-1)?.status === 'error'
  return <Dialog open={open} onOpenChange={onOpenChange} modal><DialogContent ref={panel} className={`chat-modal${sidebarOpen ? ' has-chat-sidebar' : ''}${fullscreen ? ' is-fullscreen' : ''}`} overlayClassName="chat-modal-overlay" onOpenAutoFocus={e => { e.preventDefault(); panel.current?.querySelector('.chat-composer textarea')?.focus({ preventScroll: true }) }} onCloseAutoFocus={e => { e.preventDefault(); const target = returnFocus.current?.isConnected ? returnFocus.current : document.querySelector('[data-tour="home-assistant"] textarea') || document.querySelector('.agent-dock-identity'); if (target?.isConnected) { const focus = target.disabled ? target.closest('form')?.querySelector('textarea') : target; focus?.focus({ preventScroll: true }) } }} onEscapeKeyDown={e => { if (mobile && sidebarOpen) { e.preventDefault(); closeSidebar() } }}>
    {sidebarOpen && <><ChatSidebar conversations={conversations} activeId={activeId} onSelect={select} onNew={() => { onNew(); if (mobile) setSidebarOpen(false) }} onRename={onRename} onDelete={onDelete} onConnect={onConnect} connections={connections} busy={busy} onClose={() => { closeSidebar() }}/>{mobile && <button type="button" className="chat-drawer-backdrop" aria-label="Fechar histórico" onClick={() => { closeSidebar() }}/>}</>}
    <div className="chat-main" inert={mobile && sidebarOpen ? '' : undefined} aria-hidden={mobile && sidebarOpen ? true : undefined}>
      <header className="chat-header"><button ref={menu} className="chat-menu-toggle" type="button" aria-label={sidebarOpen ? 'Recolher histórico de conversas' : 'Abrir histórico de conversas'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(v => !v)}><Menu size={19}/></button><div className="chat-header-title"><DialogTitle>Assistente do pós-venda</DialogTitle><span className={`chat-state${failed ? ' is-error' : ''}`} role="status"><i/>{busy ? 'Pensando…' : failed ? 'Erro na consulta' : 'Pronto para ajudar'}</span></div><div className="chat-header-tools"><ProviderSelect provider={provider} connections={connections} onSelect={onProvider} onConnect={onConnect} busy={busy}/><button type="button" className="chat-fullscreen" aria-label={fullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'} title={fullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'} aria-pressed={fullscreen} onClick={() => setFullscreen(v => !v)}><Maximize2 size={17}/></button></div></header>
      <DialogDescription className="sr-only">Converse com seu assistente, consulte o histórico desta sessão e revise propostas de metas antes de confirmar.</DialogDescription>
      <div className="chat-conversation-scroll" ref={scroll} role="log" aria-label="Conversa com o assistente" aria-live="polite" aria-relevant="additions text" onScroll={() => { const s = scroll.current; nearBottom.current = s.scrollHeight - s.clientHeight - s.scrollTop < 80; if (nearBottom.current) setUnread(false) }}>
        <div className="chat-messages-content">{!messages.length ? <EmptyState name={name} provider={provider} canEdit={canEdit} onSelect={send}/> : messages.map((message, index) => <MessageBubble key={message.id} message={message} index={index} question={messages.slice(0, index).findLast(item => item.role === 'user')?.text}busy={busy} canEdit={canEdit} voice={voice} onRetry={onRetry} onEdit={onEdit} onVote={onVote} onClose={() => onOpenChange(false)} onTarget={onTarget} onInspect={onInspect} onConfirmChange={onConfirmChange} onCancelChange={onCancelChange} onReconnect={onConnect}/>)}{children}</div>
      </div>
      {unread && <button className="chat-jump-latest" type="button" onClick={() => { scroll.current.scrollTop = scroll.current.scrollHeight; nearBottom.current = true; setUnread(false) }}><ArrowDown size={14}/>Novas mensagens</button>}
      <Composer searchActions={searchActions} onNavigateAction={onNavigateAction} provider={provider} value={prompt} onChange={setPrompt} onSubmit={() => send()} busy={busy} modelPicker={pickerProps} voice={voice}/>
    </div>
  </DialogContent></Dialog>
}
