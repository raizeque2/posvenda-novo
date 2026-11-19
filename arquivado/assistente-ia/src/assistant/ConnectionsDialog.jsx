import SavedGeminiKeys from './SavedGeminiKeys.jsx'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { ProviderIcon } from '../components/ui/provider-icon'
import { ArrowRight } from '../icons/iconoir'
import './connections.css'

const providers = [{ id:'local', name:'Modo local', description:'Consultar a base no navegador' }, { id:'gemini', name:'Gemini', description:'Google · modelos com cota gratuita' }, { id:'openai', name:'OpenAI', description:'Modelos da OpenAI' }, { id:'claude', name:'Claude', description:'Modelos da Anthropic' }, { id:'codex', name:'ChatGPT / Codex', description:'Acesso pela sua conta' }]
export default function ConnectionsDialog({ open, onOpenChange, choice, onChoiceChange, consent, onConsentChange, status, preview, error, onConfirm, localGemini, onLocalConnect, onLocalDisconnect, onLocalManage }) {
  const chosen = providers.find(p => p.id === choice), configured = status?.models?.[choice] || [], local = choice === 'gemini' && (preview || localGemini?.environment === 'firebase' && localGemini?.available)
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="connections-dialog">
    <DialogTitle>Conectar uma IA</DialogTitle><DialogDescription>Escolha como conversar com o assistente.</DialogDescription>
    <div className={`connection-provider-grid${chosen ? ' has-provider-choice' : ''}`}>{providers.map(p => <button key={p.id} type="button" disabled={localGemini?.busy} className={`connection-provider${choice === p.id ? ' is-selected' : ''}`} aria-pressed={choice === p.id} title={p.name} onClick={() => { if (p.id === 'local') onConfirm('local'); else onChoiceChange(p.id) }}><ProviderIcon provider={p.id}/><span><strong>{p.name}</strong><small>{p.description}</small></span><ArrowRight size={14}/></button>)}</div>
    {chosen && choice !== 'local' && <section className="connection-detail" aria-label={`Conectar ${chosen.name}`}>
      <header><ProviderIcon provider={choice}/><strong>{chosen.name}</strong></header>
      {choice === 'codex' ? <p>A conexão por conta ChatGPT / Codex está fora desta versão.</p> : <>
        {local ? <SavedGeminiKeys key={open ? 'open' : 'closed'} state={localGemini} consent={consent} onConsentChange={onConsentChange} onConnect={onLocalConnect} onDisconnect={onLocalDisconnect} onManage={onLocalManage} onContinue={() => onConfirm(choice)}/> : <>
          <p>{preview ? 'Disponível na versão conectada. Nesta prévia, conecte o Gemini ou use o modo local.' : configured.length ? `${configured.length} modelo(s) autorizado(s) pelo administrador.` : 'O administrador precisa configurar a conexão antes de usá-la.'}</p>
          <label className="ai-consent"><input type="checkbox" checked={consent} onChange={e => onConsentChange(e.target.checked)}/> Autorizo enviar minhas perguntas, o trecho recente da conversa e os dados agregados de vendas e metas ao {chosen.name} nesta sessão.</label>
          <div className="connection-actions"><button type="button" className="btn btn-primary" disabled={!consent || preview || !configured.length} onClick={() => onConfirm(choice)}>Conectar {chosen.name}</button></div>
        </>}
      </>}
    </section>}
    {error && <p role="alert">{error}</p>}
  </DialogContent></Dialog>
}
