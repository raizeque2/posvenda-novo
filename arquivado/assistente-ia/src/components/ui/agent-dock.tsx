"use client";

import './agent-dock.css'

type AgentDockProps = {
  agentName: string
  avatarSrc: string
  onOpenChat: () => void
  busy?: boolean
}

export function AgentDock({ agentName, avatarSrc, onOpenChat, busy = false }: AgentDockProps) {
  return <aside className="agent-dock no-print" aria-label="Assistente em qualquer página">
    <button type="button" className="agent-dock-identity" onClick={onOpenChat} aria-label={`Abrir conversa com o ${agentName.toLowerCase()}`} title={busy ? 'Assistente consultando · abrir conversa' : 'Abrir assistente'}>
      <img src={avatarSrc} width={36} height={36} alt=""/>
    </button>
  </aside>
}

export default AgentDock
