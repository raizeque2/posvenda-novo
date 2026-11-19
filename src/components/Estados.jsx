import './estados.css'

const ICONES = { vazio: 'folder', erro: 'warning-triangle', bloqueado: 'lock', semDados: 'database', busca: 'search' }

/**
 * Bloco de estado de uma área: lista vazia, erro, sem permissão ou sem dados.
 * Sempre ocupa o espaço da área com um fundo neutro hachurado — nunca um buraco
 * em branco que pareça falha de carregamento.
 */
export function Estado({ tipo = 'vazio', titulo, texto, children, compacto = false, icone }) {
  const role = tipo === 'erro' ? 'alert' : 'status'
  return (
    <div className={`estado estado-${tipo}${compacto ? ' estado-compacto' : ''}`} role={role}>
      <div className="estado-hachura" aria-hidden="true" />
      <div className="estado-conteudo">
        <span className="estado-icone" aria-hidden="true">
          {typeof icone === 'function' ? icone() : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><use href={`/icons/iconoir.svg#${icone || ICONES[tipo] || 'folder'}`} /></svg>}
        </span>
        {titulo && <strong>{titulo}</strong>}
        {texto && <p>{texto}</p>}
        {children && <div className="estado-acoes">{children}</div>}
      </div>
    </div>
  )
}

/** Esqueleto de cartões/painel para áreas carregando. */
export function Esqueleto({ cards = 3, painel = true, rotulo = 'Carregando' }) {
  return (
    <div className="estado-esqueleto" role="status" aria-live="polite">
      <span className="sr-only">{rotulo}…</span>
      <div aria-hidden="true" className="estado-esqueleto-cards" style={{ '--n': cards }}>
        {Array.from({ length: cards }, (_, i) => <div key={i} className="skeleton estado-esqueleto-card"><i /><b /></div>)}
      </div>
      {painel && <div aria-hidden="true" className="skeleton estado-esqueleto-painel" />}
    </div>
  )
}
