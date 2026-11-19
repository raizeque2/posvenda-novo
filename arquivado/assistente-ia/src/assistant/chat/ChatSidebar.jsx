import { useState } from 'react'
import { Plus, Search, Plug, X } from '../../icons/iconoir'
import ConversationList from './ConversationList.jsx'
import AgentLogo, { agentNames } from './AgentLogo.jsx'

export default function ChatSidebar({ conversations, activeId, onSelect, onNew, onRename, onDelete, onConnect, connections, onClose, busy }) {
  const [query, setQuery] = useState('')
  return <aside className="chat-sidebar" aria-label="Histórico de conversas">
    <header><span>Assistente<span className="chat-sidebar-caption">Pós-venda</span></span><button type="button" className="chat-sidebar-close" aria-label="Recolher histórico" onClick={onClose}><X size={18}/></button></header>
    <button type="button" className="chat-new-conversation" onClick={() => { setQuery(''); onNew() }}><Plus size={18}/>Nova conversa</button>
    <label className="chat-history-search"><Search size={16}/><input aria-label="Buscar conversas" placeholder="Buscar conversas" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button type="button" aria-label="Limpar busca de conversas" onClick={() => setQuery('')}><X size={13}/></button>}</label>
    <ConversationList conversations={conversations} activeId={activeId} query={query} onSelect={onSelect} onRename={onRename} onDelete={onDelete}/>
    <footer><div className="chat-sidebar-connections">{['gemini', 'claude', 'codex', 'local'].map(agent => <button type="button" key={agent} onClick={() => onConnect(agent === 'local' ? undefined : agent)} aria-label={`${agentNames[agent]}: ${connections[agent]?.label || 'Desconectado'}`} title={connections[agent]?.label || 'Desconectado'}><AgentLogo agent={agent} size={16}/><span>{agentNames[agent]}</span><small>{agent === 'local' ? 'Ativo' : connections[agent]?.state === 'connected' ? 'Conectado' : connections[agent]?.state === 'error' ? 'Erro' : 'Desconectado'}</small><i className={`chat-connection-dot ${connections[agent]?.state || 'disconnected'}`} aria-hidden="true"/></button>)}</div><button type="button" className="chat-sidebar-settings" disabled={busy} onClick={() => onConnect()}><Plug size={17}/>Conexões</button><small>Histórico apenas nesta sessão.</small></footer>
  </aside>
}
