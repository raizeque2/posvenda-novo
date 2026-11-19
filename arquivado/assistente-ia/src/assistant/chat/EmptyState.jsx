import { saudacaoBrasil } from '../../utils/time.js'
import { Suggestions } from '../../components/ui/suggestions'
import AgentLogo, { agentNames } from './AgentLogo.jsx'

export default function EmptyState({ name = 'Bruno', provider, canEdit, onSelect }) {
  return <div className="chat-empty-state"><div className="chat-empty-agent"><AgentLogo agent={provider} size={30}/><span>{agentNames[provider]}</span></div><h2>{saudacaoBrasil()}, {name.split(' ')[0]}.</h2><p>Por onde vamos começar?</p><Suggestions canEdit={canEdit} onSelect={onSelect}/></div>
}
