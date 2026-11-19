import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
const logo = '/icon.png'
import './auth.css'

/** Moldura das telas públicas: formulário à esquerda, painel da marca à direita. */
export default function AuthShell({ title, subtitle, children, painel }) {
  return (
    <main className="auth-page">
      <section className="auth-col">
        <Link to="/login" className="auth-brand" aria-label="Pós-Venda — ir para o login">
          <img src={logo} alt="" width="36" height="36" />
          <span>Pós-Venda</span>
        </Link>
        <div className="auth-form-wrap">
          <header className="auth-head auth-enter">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </header>
          {children}
        </div>
        <footer className="auth-foot">Pernambuco Motos · Alagoas Motos</footer>
      </section>
      <aside className="auth-panel" aria-hidden="true">
        <div className="auth-panel-inner">
          {/* Foto real da loja de fundo; a print é do próprio sistema com dados fictícios (prévia). */}
          <img className="auth-panel-foto" src="/auth/loja-alagoas-motos.webp" alt="" decoding="async" fetchPriority="low" />
          <div className="auth-panel-texto">
            <h2>{painel.titulo}</h2>
            <p>{painel.texto}</p>
          </div>
          <div className="auth-panel-vidro">
            <img src="/auth/sistema-faturamento.webp" alt="" width="1440" height="900" decoding="async" />
          </div>
        </div>
      </aside>
    </main>
  )
}

/** Lista de escolha no visual do sistema (substitui o <select> nativo). Teclado: ↑ ↓ Enter Esc. */
export function AuthSelect({ id, value, onChange, options, placeholder = 'Escolha…', disabled, invalid }) {
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(-1)
  const [pos, setPos] = useState(null)
  const raiz = useRef(null), lista = useRef(null)
  // A lista abre num portal no body (o card de vidro desenharia os campos por cima dela)
  // e acompanha o campo ao rolar ou redimensionar.
  useEffect(() => {
    if (!aberto) return
    const medir = () => { const r = raiz.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width }) }
    const fora = e => { if (!raiz.current?.contains(e.target) && !lista.current?.contains(e.target)) setAberto(false) }
    medir()
    window.addEventListener('scroll', medir, true); window.addEventListener('resize', medir)
    document.addEventListener('mousedown', fora)
    return () => { window.removeEventListener('scroll', medir, true); window.removeEventListener('resize', medir); document.removeEventListener('mousedown', fora) }
  }, [aberto])
  const abrir = () => { setAtivo(Math.max(0, options.indexOf(value))); setAberto(true) }
  const escolher = op => { onChange(op); setAberto(false); raiz.current?.querySelector('button')?.focus() }
  function tecla(e) {
    if (disabled) return
    if (e.key === 'Escape' && aberto) { e.preventDefault(); setAberto(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!aberto) { abrir(); return }
      setAtivo(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
      return
    }
    if ((e.key === 'Enter' || e.key === ' ') && aberto && ativo >= 0) { e.preventDefault(); escolher(options[ativo]) }
  }
  return (
    <div ref={raiz} className={`auth-menu${aberto ? ' is-aberto' : ''}`} onKeyDown={tecla}>
      <button type="button" id={id} className="auth-menu-botao" disabled={disabled} aria-haspopup="listbox" aria-expanded={aberto} aria-controls={`${id}-lista`} aria-invalid={invalid || undefined}
        onClick={() => aberto ? setAberto(false) : abrir()}>
        <span className={value ? '' : 'auth-menu-vazio'}>{value || placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {aberto && pos && createPortal(
        <ul ref={lista} id={`${id}-lista`} className="auth-menu-lista" style={{ top: pos.top, left: pos.left, width: pos.width }} role="listbox" aria-labelledby={id} aria-activedescendant={ativo >= 0 ? `${id}-op-${ativo}` : undefined}>
          {options.map((op, i) => (
            <li key={op} id={`${id}-op-${i}`} role="option" aria-selected={op === value} className={i === ativo ? 'is-ativo' : undefined}
              onMouseDown={e => e.preventDefault()} onMouseEnter={() => setAtivo(i)} onClick={() => escolher(op)}>
              {op}
              {op === value && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className={`auth-field auth-enter${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <small id={`${id}-hint`} className="auth-hint">{hint}</small>}
      {error && <small id={`${id}-erro`} className="auth-field-error" role="alert">{error}</small>}
    </div>
  )
}

export function PasswordInput({ id, value, onChange, autoComplete = 'current-password', disabled, describedBy, ...rest }) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="auth-password">
      <input id={id} type={visivel ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} disabled={disabled} aria-describedby={describedBy} {...rest} />
      <button type="button" className="auth-eye" onClick={() => setVisivel(v => !v)} aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visivel} disabled={disabled}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" />
          {visivel && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  )
}

export function Alerta({ tipo = 'erro', children }) {
  if (!children) return null
  return <div className={`auth-alert is-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>{children}</div>
}

export function SubmitButton({ loading, disabled, children, loadingText }) {
  return (
    <button type="submit" className="auth-submit auth-enter" disabled={loading || disabled} aria-busy={loading || undefined}>
      {loading ? <><span className="ui-spinner" aria-hidden="true" />{loadingText}</> : children}
    </button>
  )
}

/** Converte "usuario" em e-mail interno, mantendo e-mails completos. */
export const emailDeLogin = valor => {
  const v = String(valor || '').trim()
  return v.includes('@') ? v.toLowerCase() : `${v.toLowerCase()}@posvenda.app`
}
