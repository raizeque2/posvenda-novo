import { useState } from 'react'
import { agentsOf, groupConversations } from '../conversations.js'
import { Layers, Settings2, Trash2, Check, X } from '../../icons/iconoir'
import AgentLogo, { agentNames } from './AgentLogo.jsx'

export default function ConversationList({ conversations, activeId, query, onSelect, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(null), [title, setTitle] = useState('')
  const groups = groupConversations(conversations.filter(chat => chat.messages.length), query)
  function save(id) { if (title.trim()) { onRename(id, title.trim().slice(0, 80)); setRenaming(null) } }
  return <div className="chat-conversation-list">
    {!groups.length && <p className="chat-history-empty">{query ? 'Nenhuma conversa encontrada.' : 'Suas conversas aparecerão aqui.'}</p>}
    {groups.map(group => <section key={group.label}><h3>{group.label}</h3><ul>{group.items.map(chat => {
      const agents = agentsOf(chat)
      return <li key={chat.id} className={chat.id === activeId ? 'is-active' : ''}>
        {renaming === chat.id ? <form className="chat-rename" onSubmit={e => { e.preventDefault(); save(chat.id) }}><input aria-label="Nome da conversa" maxLength={80} autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null) } }}/><button aria-label="Salvar nome" type="submit"><Check size={14}/></button><button aria-label="Cancelar nome" type="button" onClick={() => setRenaming(null)}><X size={14}/></button></form> : <>
          <button className="chat-conversation-open" type="button" aria-current={chat.id === activeId ? 'true' : undefined} onClick={() => onSelect(chat.id)} title={agents.length > 1 ? 'Conversa com múltiplos agentes' : agentNames[agents[0] || 'local']}>
            {agents.length > 1 ? <Layers size={17}/> : <AgentLogo agent={agents[0] || 'local'} size={17}/>}<span>{chat.title}</span>{chat.messages.some(m => m.status === 'pending') && <i className="chat-history-pending" aria-label="Consulta em andamento"/>}
          </button>
          <div className="chat-conversation-actions"><button type="button" aria-label={`Renomear ${chat.title}`} title="Renomear conversa" onClick={() => { setRenaming(chat.id); setTitle(chat.title) }}><Settings2 size={14}/></button><button type="button" aria-label={`Apagar ${chat.title}`} title="Apagar conversa desta sessão" onClick={() => onDelete(chat.id)}><Trash2 size={14}/></button></div>
        </>}
      </li>
    })}</ul></section>)}
  </div>
}
