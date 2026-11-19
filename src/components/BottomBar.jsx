import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import useAbas from '../hooks/useAbas.js'
import './bottom-bar.css'

const Icone = ({ nome, size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><use href={`/icons/iconoir.svg#${nome}`} /></svg>
// Rótulos curtos para caber na barra.
const CURTO = { '/dashboard': 'Vendas', '/desempenho': 'Desempenho', '/monitor-os': 'O.S.', '/monitor-requisicoes': 'Requisições', '/monitor-reservas': 'Reservas', '/geografico': 'Mapa', '/resumo-mensal': 'Fechamento', '/colaboradores': 'Pessoas', '/regras': 'Ajustes', '/painel': 'Painel' }

/**
 * Navegação inferior do celular. O botão central é o Início de cada perfil:
 * admin → faturamento da empresa (/dashboard); demais → o próprio desempenho.
 * Ao redor, as primeiras abas liberadas (ordem de Acessos) e "Mais" com o
 * restante, o perfil e sair. Nunca lista uma aba que a pessoa não pode abrir.
 */
export default function BottomBar() {
  const { abas, pode, inicio } = useAbas()
  const { logout, role } = useAuth()
  const { pathname } = useLocation()
  const [mais, setMais] = useState(false)
  const folha = useRef(null), botaoMais = useRef(null)
  // 3 abas + Início + Mais = 5 posições; Mais sempre existe (perfil e sair).
  const preferido = role === 'admin' ? '/dashboard' : '/desempenho'
  const central = pode(preferido) ? preferido : inicio
  const outras = abas.filter(a => a.path !== central)
  // A página "/" (Início do admin) fica no Mais: o botão central já é o Início da barra.
  const visiveis = outras.filter(a => a.path !== '/').slice(0, 3)
  const resto = outras.filter(a => !visiveis.includes(a))
  const restoAtivo = resto.some(a => a.path === '/' ? pathname === '/' : pathname.startsWith(a.path))
  const esquerda = visiveis.slice(0, 2), direita = visiveis.slice(2)

  useEffect(() => { setMais(false) }, [pathname])
  useEffect(() => {
    if (!mais) return
    folha.current?.querySelector('a,button')?.focus()
    const tecla = e => { if (e.key === 'Escape') { setMais(false); botaoMais.current?.focus() } }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [mais])

  const item = a => (
    <NavLink key={a.path} to={a.path} end={a.path === '/'} className={({ isActive }) => `bb-item${isActive ? ' is-ativo' : ''}`}>
      <span className="bb-icone"><Icone nome={a.icon} /></span>
      <span className="bb-rotulo">{CURTO[a.path] || a.label}</span>
    </NavLink>
  )

  return (
    <>
      <nav className="bottom-bar no-print" aria-label="Navegação principal">
        {esquerda.map(item)}
        <NavLink to={central} end={central === '/'} className={({ isActive }) => `bb-central${isActive ? ' is-ativo' : ''}`} aria-label="Início">
          <Icone nome="home-simple" size={26} />
        </NavLink>
        {direita.map(item)}
        {(
          <button ref={botaoMais} type="button" className={`bb-item${restoAtivo || mais ? ' is-ativo' : ''}`} aria-expanded={mais} aria-controls="bb-mais" onClick={() => setMais(v => !v)}>
            <span className="bb-icone"><Icone nome="more-horiz" /></span>
            <span className="bb-rotulo">Mais</span>
          </button>
        )}
      </nav>
      {mais && (
        <div className="bb-fundo no-print" onClick={() => setMais(false)}>
          <section id="bb-mais" ref={folha} className="bb-folha" role="dialog" aria-modal="true" aria-label="Mais opções" onClick={e => e.stopPropagation()}>
            <span className="bb-alca" aria-hidden="true" />
            {resto.length > 0 && <ul className="bb-lista">{resto.map(a => (
              <li key={a.path}><NavLink to={a.path} end={a.path === '/'} className={({ isActive }) => isActive ? 'is-ativo' : ''}><Icone nome={a.icon} size={20} />{a.label}</NavLink></li>
            ))}</ul>}
            <ul className="bb-lista bb-conta">
              <li><NavLink to="/conta"><Icone nome="user" size={20} />Meu perfil</NavLink></li>
              <li><button type="button" onClick={logout}><Icone nome="log-out" size={20} />Sair</button></li>
            </ul>
          </section>
        </div>
      )}
    </>
  )
}
