import { Suspense, lazy, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './entrada-app.css'

// Abertura do app: o logo do Pós-Venda em vidro líquido no meio da tela, fundo branco e
// logo vermelho. Uma vez por sessão do navegador; sai quando a animação termina de verdade
// (onComplete do componente, depois de carregar o logo) ou com um clique / Esc. Com movimento
// reduzido não aparece.
const GlassIconReveal = lazy(() => import('./ui/liquid-glass-logo-reveal').then(m => ({ default: m.GlassIconReveal })))
const CHAVE = 'pv_entrada_vista'
const SEGURANCA = 7000 // sem WebGL2 ou com a aba em segundo plano a animação não avisa o fim
const RESPIRO = 450 // o logo final fica um instante antes de a tela sair

function jaViu() {
  try { return sessionStorage.getItem(CHAVE) === '1' } catch { return false }
}

export default function EntradaApp() {
  const [fase, setFase] = useState(() => {
    if (jaViu() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'fim'
    return 'mostrando'
  })

  useEffect(() => {
    if (fase !== 'mostrando') return
    try { sessionStorage.setItem(CHAVE, '1') } catch { /* sem storage: mostra de novo na próxima vez */ }
    const sair = () => setFase('saindo')
    const t = setTimeout(sair, SEGURANCA)
    const tecla = e => { if (e.key === 'Escape') sair() }
    document.addEventListener('keydown', tecla)
    return () => { clearTimeout(t); document.removeEventListener('keydown', tecla) }
  }, [fase])

  useEffect(() => {
    if (fase !== 'saindo') return
    const t = setTimeout(() => setFase('fim'), 380)
    return () => clearTimeout(t)
  }, [fase])

  if (fase === 'fim') return null
  return createPortal(
    <div className={`entrada-app${fase === 'saindo' ? ' is-saindo' : ''}`} onClick={() => setFase('saindo')}>
      <Suspense fallback={<img className="entrada-app-estatico" src="/icon.png" alt="" />}>
        <GlassIconReveal
          className="entrada-app-vidro"
          logo="/icon.png"
          label="Pós-Venda"
          look="light"
          background="#ffffff"
          logoColor="#cc0000"
          loop={false}
          onComplete={() => setTimeout(() => setFase(f => (f === 'mostrando' ? 'saindo' : f)), RESPIRO)}
          tileSize={260}
        />
      </Suspense>
    </div>,
    document.body,
  )
}
