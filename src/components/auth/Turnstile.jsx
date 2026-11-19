import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import './auth.css'

// Chave pública do widget já criado na Cloudflare. Pode ser trocada por
// VITE_TURNSTILE_SITE_KEY. Na prévia local usa a chave de teste oficial da
// Cloudflare (sempre aprova), para não depender do domínio cadastrado no widget.
const PREVIEW_TEST_KEY = '1x00000000000000000000AA'
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
  || (import.meta.env.MODE === 'preview' ? PREVIEW_TEST_KEY : '0x4AAAAAAF1RLVfPpjAbF-8f')
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let loader = null
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!loader) loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.defer = true
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(Error('turnstile'))
    script.onerror = () => { loader = null; script.remove(); reject(Error('turnstile')) }
    document.head.appendChild(script)
  })
  return loader
}

/**
 * Widget Turnstile com renderização explícita.
 * onToken(token|null) recebe o token válido, ou null quando expira/falha.
 * O pai chama ref.reset() depois de cada envio (o token é de uso único).
 */
const Turnstile = forwardRef(function Turnstile({ action, onToken, tema }, ref) {
  const box = useRef(null), widget = useRef(null), callback = useRef(onToken)
  const [status, setStatus] = useState('carregando') // carregando | pronto | ok | expirado | erro
  callback.current = onToken

  useImperativeHandle(ref, () => ({
    reset() {
      callback.current?.(null)
      if (window.turnstile && widget.current != null) { setStatus('pronto'); window.turnstile.reset(widget.current) }
    },
  }), [])

  useEffect(() => {
    let vivo = true
    loadTurnstile().then(turnstile => {
      if (!vivo || !box.current) return
      widget.current = turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        language: 'pt-br',
        theme: tema || (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
        size: 'flexible',
        retry: 'auto',
        'refresh-expired': 'auto',
        callback: token => { setStatus('ok'); callback.current?.(token) },
        'expired-callback': () => { setStatus('expirado'); callback.current?.(null) },
        'timeout-callback': () => { setStatus('expirado'); callback.current?.(null) },
        'error-callback': () => { setStatus('erro'); callback.current?.(null) },
      })
      setStatus('pronto')
    }).catch(() => vivo && setStatus('erro'))
    return () => {
      vivo = false
      if (window.turnstile && widget.current != null) { try { window.turnstile.remove(widget.current) } catch { /* já removido */ } }
      widget.current = null
    }
  }, [action])

  function tentarDeNovo() {
    callback.current?.(null)
    if (window.turnstile && widget.current != null) { setStatus('pronto'); window.turnstile.reset(widget.current); return }
    setStatus('carregando')
    loadTurnstile().then(() => setStatus('pronto')).catch(() => setStatus('erro'))
  }

  return (
    <div className="auth-turnstile" data-status={status}>
      <div ref={box} className="auth-turnstile-box" />
      {status === 'carregando' && <p className="auth-turnstile-msg" role="status"><span className="ui-spinner" aria-hidden="true" /> Carregando verificação de segurança…</p>}
      {status === 'expirado' && <p className="auth-turnstile-msg" role="status">A verificação expirou e está sendo renovada.</p>}
      {status === 'erro' && (
        <p className="auth-turnstile-msg is-erro" role="alert">
          Não foi possível carregar a verificação de segurança.
          <button type="button" className="auth-link" onClick={tentarDeNovo}>Tentar novamente</button>
        </p>
      )}
    </div>
  )
})

export default Turnstile
