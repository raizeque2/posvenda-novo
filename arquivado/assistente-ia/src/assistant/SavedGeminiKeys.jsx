import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Plus, Settings2, Trash2 } from '../icons/iconoir'

export default function SavedGeminiKeys({ state, consent, onConsentChange, onConnect, onDisconnect, onManage, onContinue }) {
  const entries = state.savedKeys || []
  const [selected, setSelected] = useState(''), [adding, setAdding] = useState(false)
  const [key, setKey] = useState(''), [name, setName] = useState(''), [editing, setEditing] = useState(false), [deleting, setDeleting] = useState(false), [newName, setNewName] = useState('')
  const selectRef = useRef(null)
  useEffect(() => { setSelected(current => entries.some(entry => entry.id === current) ? current : state.activeKeyId || entries[0]?.id || '') }, [state.savedKeys, state.activeKeyId])
  const entry = entries.find(item => item.id === selected), active = entries.find(item => item.id === state.activeKeyId)
  const cloud = state.environment === 'firebase'
  const fresh = adding || !entries.length, disabled = state.busy || state.loading || !state.available
  async function connect(event) {
    event.preventDefault()
    const next = fresh ? { key, name, save: state.savingSupported } : { savedKeyId: selected }
    setKey('')
    await onConnect(next)
  }
  async function manage(action) {
    if (await onManage(action, { id: selected, ...(action === 'rename' ? { name: newName } : {}) })) {
      setEditing(false); setDeleting(false); selectRef.current?.focus()
    }
  }
  return <div className="saved-key-manager">
    <p>{state.connected ? `Em uso: ${active?.name || 'chave desta sessão'}.` : 'Escolha uma chave salva ou adicione uma nova.'}</p>
    {!state.available && <p role="status">{state.loading ? 'Verificando servidor local…' : 'Abra a prévia local com o Vite em execução para conectar uma chave.'}</p>}
    {!!entries.length && <div className="saved-key-selection">
      <label className="connection-key">Chave salva<select ref={selectRef} value={selected} disabled={disabled} onChange={event => { setSelected(event.target.value); setAdding(false); setEditing(false); setDeleting(false); setKey('') }}>
        {entries.map(item => <option key={item.id} value={item.id}>{item.name}{item.id === state.activeKeyId ? ' · em uso' : ''}</option>)}
      </select></label>
      <div className="saved-key-tools"><button type="button" disabled={disabled || !entry} onClick={() => { setEditing(true); setNewName(entry.name); setDeleting(false); setAdding(false); setKey('') }}><Settings2 size={14}/>Renomear</button><button type="button" disabled={disabled || !entry} onClick={() => { setDeleting(true); setEditing(false); setAdding(false); setKey('') }}><Trash2 size={14}/>Excluir</button><button type="button" disabled={disabled} onClick={() => { setAdding(true); setEditing(false); setDeleting(false); setName(''); setKey('') }}><Plus size={14}/>Nova chave</button></div>
    </div>}
    {editing ? <form className="saved-key-edit" onSubmit={event => { event.preventDefault(); void manage('rename') }}>
      <label className="connection-key">Novo nome<input autoFocus value={newName} maxLength={60} disabled={disabled} onChange={event => setNewName(event.target.value)}/></label>
      <div className="connection-actions"><button className="btn btn-primary" disabled={disabled || !newName.trim()} type="submit">Salvar nome</button><button className="btn btn-ghost" disabled={disabled} type="button" onClick={() => { setEditing(false); selectRef.current?.focus() }}>Cancelar</button></div>
    </form> : deleting ? <div className="saved-key-delete" role="group" aria-label="Confirmar exclusão da chave">
      <p>Excluir a chave “{entry?.name}” {cloud ? 'desta conta' : 'deste computador'}? Para usá-la novamente, será preciso cadastrá-la. {entry?.id === state.activeKeyId && 'A conexão atual será encerrada.'}</p>
      <div className="connection-actions"><button className="btn btn-danger" disabled={disabled} type="button" onClick={() => void manage('delete')}>Excluir chave</button><button className="btn btn-ghost" disabled={disabled} type="button" onClick={() => { setDeleting(false); selectRef.current?.focus() }}>Cancelar</button></div>
    </div> : <form onSubmit={connect}>
      {fresh && <div className="saved-key-fields">{state.savingSupported && <label className="connection-key">Nome da chave<input value={name} maxLength={60} disabled={disabled} placeholder="Ex.: Pessoal ou Trabalho" onChange={event => setName(event.target.value)} autoComplete="off"/></label>}<label className="connection-key">Chave do Gemini<input type="password" autoComplete="off" spellCheck={false} value={key} maxLength={256} disabled={disabled} onChange={event => setKey(event.target.value)} placeholder="Cole sua chave do AI Studio"/></label></div>}
      <p className="saved-key-storage">{cloud ? 'Salvas com criptografia no servidor e vinculadas à sua conta. A chave não é exibida depois de salva.' : state.savingSupported ? 'Salvas com criptografia neste Windows e navegador. Limpar cookies exige cadastrá-las novamente.' : 'Conexão temporária por até uma hora. Salvar chaves exige Windows.'}</p>
      {fresh && <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">Criar chave no Google AI Studio <ArrowRight size={13}/></a>}
      {fresh && <p className="saved-key-storage">Para testar grátis, use um projeto sem faturamento e dados fictícios. O Google pode usar o conteúdo para melhorar seus produtos.</p>}
      <label className="ai-consent"><input type="checkbox" checked={consent} disabled={disabled} onChange={event => onConsentChange(event.target.checked)}/> Autorizo validar a chave e enviar minhas perguntas, o trecho recente da conversa e os dados agregados de vendas e metas ao Gemini nesta sessão.</label>
      <div className="connection-actions"><button type="submit" className="btn btn-primary" disabled={disabled || !consent || (fresh ? (state.savingSupported && !name.trim()) || !key.trim() : !entry)}>{state.busy && <span className="ui-spinner" aria-hidden="true"/>}{state.busy ? 'Aguarde…' : fresh ? state.savingSupported ? 'Salvar e usar' : 'Conectar Gemini' : 'Usar chave'}</button>{adding && <button className="btn btn-ghost" disabled={disabled} type="button" onClick={() => { setAdding(false); setKey(''); selectRef.current?.focus() }}>Cancelar</button>}{state.connected && <button className="btn btn-ghost" disabled={disabled} type="button" onClick={onDisconnect}>Desconectar</button>}</div>
      {!state.savingSupported && state.available && <p>Salvar chaves está disponível no Windows. {state.connected && <button className="btn btn-ghost" type="button" disabled={!consent || disabled} onClick={onContinue}>Usar conexão atual</button>}</p>}
    </form>}
  </div>
}
