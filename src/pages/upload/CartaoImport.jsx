import { useRef, useState } from 'react'
import { Icon } from '../../icons/iconoir'

// Cartão de importação no formato de anexo: ícone colorido, nome, situação numa linha,
// ações à direita e barra de progresso embaixo enquanto envia. Aceita arrastar e soltar.
// estado: 'pronto' | 'enviando' | 'ok' | 'erro'
export default function CartaoImport({ icone, cor, titulo, detalhe, estado = 'pronto', onArquivo, onTentar, onLimpar, desabilitado, accept = '.csv' }) {
  const input = useRef(null)
  const [arrastando, setArrastando] = useState(false)
  const bloqueado = desabilitado || estado === 'enviando'
  return (
    <li className={`imp-card is-${estado}${arrastando ? ' is-drag' : ''}${bloqueado ? ' is-bloqueado' : ''}`} style={{ '--imp-cor': cor }}
      onDragOver={e => { e.preventDefault(); if (!bloqueado) setArrastando(true) }}
      onDragLeave={() => setArrastando(false)}
      onDrop={e => { e.preventDefault(); setArrastando(false); if (!bloqueado) onArquivo(e.dataTransfer.files[0]) }}>
      <button type="button" className="imp-alvo" disabled={bloqueado} onClick={() => input.current?.click()} aria-label={`Importar ${titulo}`}>
        <span className="imp-icone" aria-hidden="true"><Icon name={icone} size={18} /><small>CSV</small></span>
        <span className="imp-texto"><strong>{titulo}</strong><small>{detalhe}</small></span>
        {estado !== 'enviando' && <span className="imp-enviar" aria-hidden="true"><Icon name="upload" size={16} /></span>}
      </button>
      {estado === 'erro' && onTentar && <button type="button" className="imp-acao" onClick={onTentar} aria-label={`Tentar de novo: ${titulo}`} title="Tentar de novo"><Icon name="refresh-double" size={15} /></button>}
      {(estado === 'ok' || estado === 'erro') && onLimpar && <button type="button" className="imp-acao" onClick={onLimpar} aria-label={`Limpar aviso: ${titulo}`} title="Limpar"><Icon name="xmark" size={15} /></button>}
      {estado === 'enviando' && <span className="imp-progresso" role="progressbar" aria-label={`Enviando ${titulo}`}><i /></span>}
      <input ref={input} type="file" accept={accept} hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onArquivo(f) }} />
    </li>
  )
}
