import { ActionSearchBar, type Action } from './action-search-bar'
import { useEffect, useId, useRef, useState, type ComponentProps } from 'react'
import { ModelPicker } from './model-picker'
import { ArrowUp, Mic, Square, X, Check } from '../../icons/iconoir'
import './voice-input.css'

type PromptVoice = {
  phase: string
  active: boolean
  levels: number[]
  error: string
  toggle: () => void
  keep: () => void
  discard: () => void
}

type PromptInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  voice?: PromptVoice
  modelPicker: ComponentProps<typeof ModelPicker>
  searchActions?: Action[]
  onNavigateAction?: (action: Action) => void
  busy?: boolean
}
const prompts = ['Quem precisa da sua atenção hoje?', 'Quem mais vendeu neste mês?', 'Qual é o resumo da última data de vendas?', 'Quero revisar a meta de um colaborador.']

export function PromptInput({ value, onChange, onSubmit, voice, modelPicker, searchActions = [], onNavigateAction, busy = false }: PromptInputProps) {
  const inputId = useId(), [promptIndex, setPromptIndex] = useState(0), [focused, setFocused] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { const field = textarea.current; if (!field) return; field.style.height = ''; if (value) { field.style.height = 'auto'; field.style.height = `${Math.min(140, field.scrollHeight)}px` } }, [value])
  useEffect(() => {
    if (value || focused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setPromptIndex(index => (index + 1) % prompts.length), 5000)
    return () => window.clearInterval(timer)
  }, [value, focused])
  function submit() { if (value.trim() && !busy) { voice?.keep(); onSubmit() } }
  return <form className="assistant-input" onSubmit={e => { e.preventDefault(); submit() }}>
    <label className="sr-only" htmlFor={inputId}>Pergunte ao assistente</label>
<ActionSearchBar variant="prompt" actions={searchActions} query={value} onQueryChange={onChange} onNavigate={action=>onNavigateAction?.(action)} onAsk={submit} disabled={busy} renderInput={search=><textarea {...search} ref={textarea} id={inputId} value={value} maxLength={2000} placeholder={voice?.active ? 'Fale, o texto aparece aqui…' : prompts[promptIndex]} onFocus={() => { setFocused(true);search.onFocus() }} onBlur={e => { setFocused(false);search.onBlur(e) }} onChange={e => { if (voice?.phase !== 'idle') voice?.keep(); onChange(e.target.value) }} onKeyDown={search.onKeyDown}/>}/>
    {voice && voice.phase !== 'idle' && <div className="prompt-dictation">
      <div className="prompt-dictation-status"><span role="status">{voice.phase === 'starting' ? 'Aguardando microfone…' : voice.phase === 'listening' ? 'Ouvindo…' : 'Revise seu ditado'}</span>
        {voice.active && <div className="prompt-voice-wave" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} style={{ height: `${4 + (voice.levels[index] || 0) * 24}px` }}/>)}</div>}
      </div>
      <div className="prompt-dictation-actions"><button type="button" aria-label="Apagar ditado" title="Apagar ditado" onClick={() => { voice.discard(); textarea.current?.focus() }}><X size={17}/></button><button type="button" aria-label="Usar texto ditado" title="Usar texto e editar" onClick={() => { voice.keep(); textarea.current?.focus() }}><Check size={17}/><span>Usar texto</span></button></div>
    </div>}
    {voice?.active && <p className="prompt-voice-notice">O navegador pode processar seu áudio para transcrever. Você revisa antes de enviar.</p>}
    {voice?.error && <p className="prompt-voice-error" role="alert">{voice.error}</p>}
    <footer><ModelPicker {...modelPicker} busy={busy}/><div className="assistant-input-actions">
      {voice && <button type="button" className={`assistant-icon-action${voice.active ? ' is-recording' : ''}`} disabled={busy} onClick={voice.toggle} aria-pressed={voice.active} aria-label={voice.active ? 'Parar ditado' : 'Iniciar ditado'} title={voice.active ? 'Parar ditado' : 'Ditar mensagem'}>{voice.active ? <Square size={16}/> : <Mic size={18}/>}</button>}
      <button type="submit" className="prompt-send" aria-label="Enviar pergunta" disabled={busy || !value.trim()}><ArrowUp size={18}/></button>
    </div></footer>
  </form>
}
