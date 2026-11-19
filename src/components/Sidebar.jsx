import { useState, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import useStore from '../store.js'
import useAbas from '../hooks/useAbas.js'
import { empresaAtual } from '../utils/empresa.js'
import logoPeIcon from '../assets/Ativo 3@72x.png'
import logoAlIcon from '../assets/IMG_0018-96.png'
import { ThemeToggle } from './ui/theme-toggle'
import WelcomeDialog from './WelcomeDialog.jsx'
import { Icon } from '../icons/iconoir'

const icon = name => <Icon name={name} size={19}/>
const IC = { dashboard:icon('reports'), star:icon('star'), fileText:icon('page'), users:icon('group'), percent:icon('percentage-circle'), target:icon('medal'), upload:icon('upload'), person:icon('user'), sliders:icon('settings-profiles'), shield:icon('shield-check'), box:icon('box'), menu:icon('home-simple'), logout:icon('log-out') }

// Lista, ordem e seções vêm da política de abas (functions/src/tabPolicy.js),
// a mesma usada pelas rotas, pela bottom bar e pelo servidor.

const ROLE_LABEL = {
  admin: 'Administrador', coordenador: 'Coordenador',
  supervisor: 'Supervisor', varejo: 'Varejo / Oficina',
  atacado: 'Atacado', oficina: 'Oficina',
}

function NavItem({ l, onFechar, recolhida }) {
  return (
    <NavLink
      to={l.path}
      end={l.path === '/'}
      title={recolhida ? l.label : undefined}
      aria-label={recolhida ? l.label : undefined}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      onClick={() => { if (window.innerWidth <= 768) onFechar?.() }}
    >
      <span className="nav-icon">{icon(l.icon)}</span>
      <span className="nav-label">{l.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ aberto, onFechar, onToggle }) {
  const loading = useStore(s => s.loading)
  const pecasPorMes = useStore(s => s.pecasPorMes)
  const { user, role, logout } = useAuth()

  const empresa = useMemo(() => empresaAtual(pecasPorMes), [pecasPorMes])

  const logoIcon = empresa === 'AL' ? logoAlIcon : logoPeIcon

  const { abas } = useAbas()
  const inicio = abas.find(l => l.path === '/')
  const visiveis = abas.filter(l => l.path !== '/')
  const secoes = [...new Set(visiveis.map(l => l.section))]
  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U'
  const { pathname } = useLocation()
  // Grupos fechados ficam salvos neste navegador.
  const [gruposFechados, setGruposFechados] = useState(() => { try { return JSON.parse(localStorage.getItem('pv_sidebar_grupos_fechados')) || [] } catch { return [] } })
  const alternarGrupo = sec => setGruposFechados(atual => {
    const novo = atual.includes(sec) ? atual.filter(s => s !== sec) : [...atual, sec]
    try { localStorage.setItem('pv_sidebar_grupos_fechados', JSON.stringify(novo)) } catch { /* sem armazenamento: só não lembra */ }
    return novo
  })

  return (
    <>
    {aberto && <div className="sidebar-backdrop" onClick={onFechar} />}
    <aside className={`sidebar${aberto ? ' sidebar-expanded' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Abrir/fechar menu">
          <img src={logoIcon} alt="logo" className="sidebar-logo-mark" />
          <span className="sidebar-toggle-label">Pós-Venda</span>
        </button>
        <button type="button" className="sidebar-recolher no-print" onClick={onToggle}
          aria-label={aberto ? 'Recolher menu' : 'Expandir menu'} title={aberto ? 'Recolher menu' : 'Expandir menu'} aria-expanded={aberto}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" />
            <path d={aberto ? 'M15.5 10 13.5 12l2 2' : 'M13.5 10l2 2-2 2'} />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" aria-label="Menu principal">
        {inicio && <div className="nav-section nav-section-top"><NavItem l={inicio} onFechar={onFechar} recolhida={!aberto} /></div>}
        {secoes.map(sec => {
          // Grupo fechado esconde os itens, menos a página aberta agora. Com a sidebar só de
          // ícones, todos os itens aparecem (não há rótulo para abrir o grupo).
          const fechado = aberto && gruposFechados.includes(sec)
          const itens = visiveis.filter(l => l.section === sec)
          const mostrar = fechado ? itens.filter(l => pathname === l.path || pathname.startsWith(l.path + '/')) : itens
          return (
            <div key={sec} className={`nav-section${fechado ? ' is-fechada' : ''}`}>
              <button type="button" className="nav-section-label nav-section-toggle" aria-expanded={!fechado} onClick={() => alternarGrupo(sec)}>
                <span>{sec}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {mostrar.map(l => (
                <NavItem key={l.path} l={l} onFechar={onFechar} recolhida={!aberto} />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Loading */}
      {loading && (
        <div className="sidebar-loading">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.2-8.55"/>
          </svg>
          <span className="nav-label">Processando…</span>
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-preferences no-print"><WelcomeDialog uid={user?.uid || 'guest'} onRevealMenu={()=>{if(!aberto)onToggle?.()}}/><div className="sidebar-theme"><span className="nav-label">Aparência</span><ThemeToggle/></div></div>
      <div className="sidebar-footer">
        <div className="sidebar-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-role">{ROLE_LABEL[role] ?? role}</div>
          <div className="sidebar-email">{user?.email}</div>
        </div>
        <button className="sidebar-logout" onClick={logout} title="Sair">
          {IC.logout}
        </button>
      </div>
    </aside>
    </>
  )
}
