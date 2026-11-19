import StreamingText from '../../components/ui/streaming-text'
import ChangeConfirmation from './ChangeConfirmation.jsx'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ThumbsUp, ThumbsDown, Pencil, Copy, Check, Volume2, Square, RefreshCw, TriangleAlert, Download } from '../../icons/iconoir'
import { baixarRelatorio } from './answerReport.js'
import { fmtBRL2 as money } from '../../utils/formatacao.js'
import { safeChatHref } from '../conversations.js'
import AgentLogo, { agentNames } from './AgentLogo.jsx'
import AnalysisSources from './AnalysisSources.jsx'
const AnswerCharts = lazy(() => import('./AnswerCharts.jsx'))

export default function MessageBubble({ message, index, question, busy, canEdit, voice, onRetry, onEdit, onVote, onClose, onTarget, onInspect, onReconnect, onConfirmChange, onCancelChange }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(message.text || ''), [copied, setCopied] = useState(false), [copyError, setCopyError] = useState('')
  const user = message.role === 'user', agent = message.provider || 'local', pending = message.status === 'pending', failed = message.status === 'error'
  const [retrySeconds, setRetrySeconds] = useState(0)
  useEffect(() => {
    const update = () => setRetrySeconds(Math.max(0, Math.ceil(((message.retryAt || 0) - Date.now()) / 1000)))
    update()
    if (!(message.retryAt > Date.now())) return
    const timer = setInterval(() => { update(); if (message.retryAt <= Date.now()) clearInterval(timer) }, 1000)
    return () => clearInterval(timer)
  }, [message.retryAt])
  async function copy() { try { await navigator.clipboard.writeText(message.text || ''); setCopied(true); setCopyError('') } catch { setCopyError('Não foi possível copiar. Selecione o texto da resposta.') } }
  if (user) return <article className="chat-message-row chat-message-user"><div className="chat-user-content">{editing ? <form className="chat-edit-message" onSubmit={e => { e.preventDefault(); if (draft.trim()) { onEdit(index, draft); setEditing(false) } }}><label className="sr-only" htmlFor={`edit-${message.id}`}>Editar sua pergunta</label><textarea id={`edit-${message.id}`} maxLength={2000} autoFocus value={draft} onChange={e => setDraft(e.target.value)}/><div><button type="button" onClick={() => setEditing(false)}>Cancelar</button><button type="submit" disabled={busy || !draft.trim()}>Salvar e reenviar</button></div></form> : <><p>{message.text}</p><button type="button" className="chat-edit-trigger" disabled={busy} aria-label="Editar e reenviar pergunta" title="Editar e reenviar" onClick={() => { setDraft(message.text); setEditing(true) }}><Pencil size={14}/></button></>}</div></article>
  return <article className={`chat-message-row chat-message-agent${pending ? ' is-pending' : ''}${failed ? ' is-error' : ''}`} aria-busy={pending || message.status === 'streaming'}>
    <div className="chat-message-avatar"><AgentLogo agent={agent} size={21}/></div><div className="chat-agent-content"><header><span>{agentNames[agent]}</span>{message.model && message.model !== 'local' && <small>{message.model}</small>}</header>
      {pending ? <div className="chat-thinking" role="status"><span>Consultando os dados</span><i/><i/><i/></div> : <StreamingText text={message.text?.trim() || 'O agente não retornou texto. Tente novamente.'} startedAt={failed?undefined:message.revealStartedAt}>{(visibleText,done)=><>
        {failed && <div className="chat-message-error" role="alert"><TriangleAlert size={17}/><span>Não foi possível concluir esta consulta.</span></div>}
        <div className={`chat-markdown${message.status === 'streaming' ? ' is-streaming' : ''}`}><Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img']} urlTransform={safeChatHref} components={{ a: ({ node, ...props }) => props.href ? <a {...props} target="_blank" rel="noopener noreferrer"/> : <span>{props.children}</span>, table: ({ node, ...props }) => <div className="chat-markdown-table"><table {...props}/></div> }}>{visibleText}</Markdown></div>
        {done && (message.charts?.length > 0 || message.chart?.length > 0) && !failed && <Suspense fallback={<div className="chat-chart-loading" role="status">Carregando gráficos…</div>}><AnswerCharts charts={message.charts || [{ id: 'ranking', title: 'Ranking de peças líquidas', type: 'bar', data: message.chart, note: 'Valores registrados na consulta.' }]}/></Suspense>}
        {done && message.chartNotice && message.chartNotice !== message.text && !failed && <p className="chat-chart-notice" role="status">{message.chartNotice}</p>}
        {done && !failed && <AnalysisSources provenance={message.provenance} query={message.query} onInspect={onInspect}/>}
        {done && message.attention?.map((person, i) => <Link key={`${person.name}:${i}`} className="chat-answer-link" to={`/perfil/${encodeURIComponent(person.name)}`} onClick={onClose}>{person.name} · {person.metric} · projeção {money(person.projection)} / {money(person.target)} ↗</Link>)}
        {done && message.link && safeChatHref(message.link).startsWith('/') && <Link className="chat-answer-link" to={message.link} onClick={onClose}>Abrir página ↗</Link>}
        {done && message.proposal && <ChangeConfirmation message={message} busy={busy} canEdit={canEdit} onConfirm={onConfirmChange} onCancel={onCancelChange}/>}
        {done && message.action === 'target' && canEdit && <button type="button" className="chat-target-action" onClick={onTarget}>Preparar ajuste de meta</button>}
        {done && <div className={`chat-message-actions${failed ? ' is-visible' : ''}`} aria-label={`Ações da resposta de ${agentNames[agent]}`}>
          {voice.canRead && <button type="button" aria-label={voice.reading === message.id ? 'Parar leitura' : 'Ouvir resposta'} title={voice.reading === message.id ? 'Parar leitura' : 'Ouvir resposta'} onClick={() => voice.read(message.text, message.id)}>{voice.reading === message.id ? <Square size={15}/> : <Volume2 size={15}/>}</button>}
          {!failed && canEdit && <button type="button" aria-label="Baixar relatório em PDF" title="Baixar relatório (PDF)" onClick={() => baixarRelatorio(question, message).catch(() => setCopyError('Não foi possível gerar o relatório. Tente novamente.'))}><Download size={15}/></button>}
          <button type="button" aria-label={copied ? 'Resposta copiada' : 'Copiar resposta'} title={copied ? 'Copiado' : 'Copiar resposta'} onClick={copy}>{copied ? <Check size={15}/> : <Copy size={15}/>}</button>
          <button type="button" aria-label="Gostei da resposta" aria-pressed={message.vote === 'up'} title="Gostei" onClick={() => onVote(message.id, message.vote === 'up' ? null : 'up')}><ThumbsUp size={15}/></button>
          <button type="button" aria-label="Não gostei da resposta" aria-pressed={message.vote === 'down'} title="Não gostei" onClick={() => onVote(message.id, message.vote === 'down' ? null : 'down')}><ThumbsDown size={15}/></button>
          {failed && message.reconnect && onReconnect && <button type="button" onClick={() => onReconnect(agent)}>Reconectar {agentNames[agent]}</button>}
          <button type="button" disabled={busy || retrySeconds > 0} aria-label="Tentar resposta novamente" title="Tentar novamente com o agente selecionado" onClick={() => onRetry(index)}><RefreshCw size={15}/>{failed && <span>{retrySeconds > 0 ? `Tentar em ${retrySeconds}s` : 'Tentar novamente'}</span>}</button>
        </div>}{copyError && <small role="status">{copyError}</small>}
      </>}</StreamingText>}
    </div>
  </article>
}
