import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { GradientBackground } from '../../components/ui/jade-sky'
import { useAuth } from '../../contexts/AuthContext.jsx'
import useStore from '../../store.js'
import { empresaAtual } from '../../utils/empresa.js'
import logoPeIcon from '../../assets/Ativo 3@72x.png'
import logoAlIcon from '../../assets/IMG_0018-96.png'
import { Icon, Menu, ArrowUpRight } from '../../icons/iconoir'
import { iniciais } from './portal.logic.js'
import MeuDesempenho from './MeuDesempenho.jsx'
import VisaoGeral from './VisaoGeral.jsx'
import MinhaEquipe from './MinhaEquipe.jsx'
import MeuPerfil from './MeuPerfil.jsx'

const icon = name => <Icon name={name} size={19} />
const icone = { desempenho: icon('graph-up'), geral: icon('reports'), equipe: icon('group'), perfil: icon('user'), sair: icon('log-out') }

function itens(supervisor) {
  return [
    { to: '/portal/desempenho', icon: icone.desempenho, label: 'Meu desempenho', section: 'Meu espaço' },
    { to: '/portal/visao-geral', icon: icone.geral, label: 'Visão geral', section: 'Meu espaço' },
    ...(supervisor ? [{ to: '/portal/equipe', icon: icone.equipe, label: 'Minha equipe', section: 'Gestão' }] : []),
    { to: '/portal/perfil', icon: icone.perfil, label: 'Meu perfil', section: 'Configurações' },
  ]
}

/**
 * Área logada do portal. Reaproveita a sidebar colapsável, o fundo e o
 * cabeçalho móvel do sistema; as páginas alternam entre "Meu desempenho",
 * "Visão geral" (leitura), a equipe do supervisor e o próprio perfil.
 */
export default function PortalArea() {
  const { role, nome, nomeExibicao, foto, portal, logout } = useAuth()
  const carregarDadosCloud = useStore(state => state.carregarDadosCloud)
  const pecasPorMes = useStore(state => state.pecasPorMes)
  const erroCloud = useStore(state => state.erroCloud)
  const { pathname } = useLocation()
  const supervisor = role === 'supervisor'
  const [aberto, setAberto] = useState(() => typeof window !== 'undefined' && window.innerWidth > 768)

  useLayoutEffect(() => { carregarDadosCloud() }, [carregarDadosCloud])
  useEffect(() => { if (window.innerWidth <= 768) setAberto(false) }, [pathname])

  const empresa = useMemo(() => empresaAtual(pecasPorMes), [pecasPorMes])
  const logo = empresa === 'AL' ? logoAlIcon : logoPeIcon
  const visiveis = itens(supervisor)
  const secoes = [...new Set(visiveis.map(item => item.section))]
  const exibicao = nomeExibicao || nome || ''

  if (portal !== true) return <Navigate to="/" replace />

  return (
    <div className="layout layout-workspace">
      <GradientBackground className="layout-sky" />
      {aberto && <div className="sidebar-backdrop" onClick={() => setAberto(false)} />}
      <aside className={`sidebar${aberto ? ' sidebar-expanded' : ''}`}>
        <div className="sidebar-logo">
          <button className="sidebar-toggle" onClick={() => setAberto(v => !v)} aria-label="Abrir/fechar menu">
            <img src={logo} alt="logo" className="sidebar-logo-mark" />
            <span className="sidebar-toggle-label">Pós-Venda</span>
          </button>
        </div>
        <nav className="sidebar-nav">
          {secoes.map(secao => (
            <div key={secao} className="nav-section">
              <div className="nav-section-label">{secao}</div>
              {visiveis.filter(item => item.section === secao).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => { if (window.innerWidth <= 768) setAberto(false) }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-avatar">{foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : iniciais(exibicao)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-role">{supervisor ? 'Supervisor' : 'Colaborador'}</div>
            <div className="sidebar-email">{exibicao}</div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Sair">{icone.sair}</button>
        </div>
      </aside>

      <main className="main">
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setAberto(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <span className="mobile-title">Portal</span>
          <button className="mobile-logout-btn" onClick={logout}>Sair</button>
        </header>
        {erroCloud && (
          <div className="page" style={{ paddingBottom: 0 }}>
            <p role="alert" style={{ background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--red)', fontSize: 'var(--text-base)', margin: 0 }}>
              {erroCloud} <button className="btn btn-ghost btn-sm" onClick={carregarDadosCloud}>Tentar novamente</button>
            </p>
          </div>
        )}
        <div className="page-transition" key={pathname}>
          <Routes>
            <Route path="desempenho" element={<MeuDesempenho />} />
            <Route path="visao-geral" element={<VisaoGeral />} />
            <Route path="equipe" element={supervisor ? <MinhaEquipe /> : <Navigate to="/portal/desempenho" replace />} />
            <Route path="perfil" element={<MeuPerfil />} />
            <Route path="*" element={<Navigate to="/portal/desempenho" replace />} />
          </Routes>
        </div>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', padding: '0 20px 18px', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>
          <ArrowUpRight size={12} /> Portal do colaborador · dados do seu escopo de acesso
        </div>
      </main>
    </div>
  )
}
