import { useEffect } from 'react'

// Rolagem suave da roda do mouse no <main> (no desktop é ele que rola). Leve de propósito:
// um único requestAnimationFrame só enquanto há movimento, nada rodando parado.
// Fica de fora: touchpad (já é suave e tem inércia própria), toque, Ctrl+roda (zoom),
// rolagem horizontal, popups abertos (html.trava-rolagem), áreas internas que rolam
// sozinhas (tabelas, listas) e quem pediu menos movimento no sistema.
export function useRolagemSuave(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let alvo = el.scrollTop, quadro = 0

    const rolaSozinho = (no, dy) => {
      for (let n = no; n && n !== el; n = n.parentElement) {
        const { overflowY } = getComputedStyle(n)
        if (!/(auto|scroll)/.test(overflowY) || n.scrollHeight <= n.clientHeight + 1) continue
        if (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true
      }
      return false
    }
    let posto = null
    const passo = () => {
      const atual = el.scrollTop
      // Algo de fora pulou a rolagem (troca de página volta ao topo): abandona a animação.
      if (posto !== null && Math.abs(atual - posto) > 2) { alvo = atual; posto = null; quadro = 0; return }
      const falta = alvo - atual
      if (Math.abs(falta) < 0.5) { el.scrollTop = alvo; posto = null; quadro = 0; return }
      el.scrollTop = atual + falta * 0.18
      // Bateu no limite (topo/fim): para em vez de insistir.
      if (el.scrollTop === atual) { alvo = atual; posto = null; quadro = 0; return }
      posto = el.scrollTop
      quadro = requestAnimationFrame(passo)
    }
    const roda = ev => {
      if (ev.ctrlKey || ev.defaultPrevented || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return
      if (document.documentElement.classList.contains('trava-rolagem')) return
      if (el.scrollHeight <= el.clientHeight || getComputedStyle(el).overflowY === 'visible') return
      // Roda de mouse vem em "degraus" grandes; touchpad, em valores pequenos e quebrados.
      const linhas = ev.deltaMode === 1
      if (!linhas && (Math.abs(ev.deltaY) < 40 || !Number.isInteger(ev.deltaY))) return
      if (rolaSozinho(ev.target, ev.deltaY)) return
      ev.preventDefault()
      if (!quadro) { alvo = el.scrollTop; posto = null }
      const max = el.scrollHeight - el.clientHeight
      alvo = Math.max(0, Math.min(max, alvo + ev.deltaY * (linhas ? 40 : 1)))
      if (!quadro) quadro = requestAnimationFrame(passo)
    }
    // Outra coisa rolou a página (troca de rota, âncora, teclado): o alvo acompanha.
    const rolou = () => { if (!quadro) alvo = el.scrollTop }
    el.addEventListener('wheel', roda, { passive: false })
    el.addEventListener('scroll', rolou, { passive: true })
    return () => { el.removeEventListener('wheel', roda); el.removeEventListener('scroll', rolou); cancelAnimationFrame(quadro) }
  }, [ref])
}
