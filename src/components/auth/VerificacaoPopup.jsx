import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Turnstile from './Turnstile.jsx'

/**
 * Verificação da Cloudflare em popup no meio da tela, aberta só quando a pessoa envia o formulário.
 * Cada abertura monta um widget novo (o token é de uso único). Fica num portal no body porque o
 * card de vidro (backdrop-filter) prenderia o popup dentro dele.
 */
export default function VerificacaoPopup({ aberto, action, texto = 'Confirme que é você para continuar. Leva só um instante.', onToken, onFechar }) {
  const voltarFoco = useRef(null)
  useEffect(() => {
    if (!aberto) return
    voltarFoco.current = document.activeElement
    const tecla = e => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('keydown', tecla); voltarFoco.current?.focus?.() }
  }, [aberto])
  if (!aberto) return null
  return createPortal(
    <div className="auth-verif-fundo" onClick={onFechar}>
      <section className="auth-verif" role="dialog" aria-modal="true" aria-labelledby="auth-verif-titulo" onClick={e => e.stopPropagation()}>
        <h2 id="auth-verif-titulo">Verificação de segurança</h2>
        <p>{texto}</p>
        <Turnstile action={action} tema="dark" onToken={token => { if (token) onToken(token) }} />
        <button type="button" className="auth-link" onClick={onFechar}>Cancelar</button>
      </section>
    </div>,
    document.body,
  )
}
