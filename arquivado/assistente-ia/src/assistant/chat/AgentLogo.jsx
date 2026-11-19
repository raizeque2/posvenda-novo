import { ProviderIcon } from '../../components/ui/provider-icon'

export const agentNames = { local: 'Local', claude: 'Claude', codex: 'Codex', openai: 'OpenAI', gemini: 'Gemini' }
export default function AgentLogo({ agent = 'local', size = 20, monochrome = false }) {
  return <span className={`chat-agent-logo${monochrome ? ' is-monochrome' : ''}`} style={{ width: size, height: size }} aria-hidden="true"><ProviderIcon provider={agent}/></span>
}
