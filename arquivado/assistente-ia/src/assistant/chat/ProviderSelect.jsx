import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, ArrowRight, Check } from '../../icons/iconoir'
import AgentLogo, { agentNames } from './AgentLogo.jsx'

export default function ProviderSelect({ provider, connections, onSelect, onConnect, busy }) {
  return <Popover.Root><Popover.Trigger className="chat-provider-select" type="button" disabled={busy} aria-label="Escolher agente"><AgentLogo agent={provider} size={17}/>{agentNames[provider] || provider}<ChevronDown size={12}/></Popover.Trigger><Popover.Portal><Popover.Content className="chat-provider-panel" sideOffset={8} align="end" collisionPadding={12} aria-label="Agentes disponíveis">
    {['local', 'gemini', 'claude', 'openai', 'codex'].map(agent => { const connection = connections[agent] || { label: 'Desconectado', state: 'disconnected' }; return <Popover.Close key={agent} asChild><button type="button" className="chat-provider-option" onClick={() => connection.state === 'connected' ? onSelect(agent) : onConnect(agent)}><AgentLogo agent={agent} size={20}/><span><strong>{agentNames[agent]}</strong><small>{connection.label}</small></span>{agent === provider ? <Check size={15}/> : <ArrowRight size={15}/>}</button></Popover.Close> })}
  </Popover.Content></Popover.Portal></Popover.Root>
}
