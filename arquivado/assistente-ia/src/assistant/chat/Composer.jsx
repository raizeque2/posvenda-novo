import { PromptInput } from '../../components/ui/ai-chat-input'

export default function Composer({ provider, busy, ...props }) {
  return <div className="chat-composer"><PromptInput busy={busy} {...props}/><p className="chat-composer-note">{busy ? 'Uma consulta está em andamento.' : provider === 'local' ? 'Modo Local · nenhum dado sai deste navegador.' : `Pergunta, contexto autorizado e histórico recente são enviados ao ${provider === 'gemini' ? 'Gemini' : provider === 'claude' ? 'Claude' : provider === 'codex' ? 'Codex' : 'OpenAI'}.`}<span>Enter envia · Shift + Enter quebra linha</span></p></div>
}
