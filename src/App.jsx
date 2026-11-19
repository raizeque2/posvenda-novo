import Home from './pages/Home.jsx'
import PageLoading from './components/PageLoading.jsx'
import WorkspaceTools from './components/WorkspaceTools.jsx'
import { GradientBackground } from './components/ui/jade-sky'
import { useCallback, useEffect, useLayoutEffect, useState, useRef, Component, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from './firebase.js'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }
  static getDerivedStateFromError(e) {
    return { erro: e?.message || 'Erro desconhecido' }
  }
  render() {
    if (this.state.erro) return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#f4f6f9', gap: 12, padding: 24,
      }}>
        <div style={{ fontSize: 'var(--text-5xl)' }}>⚠️</div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: '#0f172a' }}>Algo deu errado</div>
        <div style={{
          fontSize: 'var(--text-sm2)', color: '#64748b', background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 8,
          padding: '10px 16px', maxWidth: 400, textAlign: 'center',
        }}>{this.state.erro}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '8px 24px', borderRadius: 8, border: 'none',
            background: '#cc0000', color: '#fff', fontWeight: 'var(--weight-semibold)',
            fontSize: 'var(--text-md)', cursor: 'pointer',
          }}
        >Recarregar</button>
      </div>
    )
    return this.props.children
  }
}
import logoSplash from './assets/Ativo 5@72x.png'
import _logoLogin from './assets/logo-login.webp'
// Pré-carrega o logo da tela de login antes do chunk Login.jsx ser descoberto
;(new Image()).src = _logoLogin
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ToastProvider } from './hooks/useToast.jsx'
import PrivateRoute from './components/PrivateRoute.jsx'
import Sidebar from './components/Sidebar.jsx'
import BottomBar from './components/BottomBar.jsx'
import EntradaApp from './components/EntradaApp.jsx'
import Footer01 from '@/components/ui/footer-01'
import { useRolagemSuave } from './hooks/useRolagemSuave.js'
import { NaoEncontrada } from './pages/StatusPages.jsx'
import './theme/shell.css'
const PersonalBI = lazy(() => import('./pages/PersonalBI.jsx'))
const Dashboard    = lazy(() => import('./pages/Dashboard.jsx'))
const Comissoes    = lazy(() => import('./pages/Comissoes.jsx'))
const Upload       = lazy(() => import('./pages/Upload.jsx'))
const Colaboradores= lazy(() => import('./pages/Colaboradores.jsx'))
const Metas        = lazy(() => import('./pages/Metas.jsx'))
const Equipes      = lazy(() => import('./pages/Equipes.jsx'))
const Regras       = lazy(() => import('./pages/Regras.jsx'))
const Acesso       = lazy(() => import('./pages/Acesso.jsx'))
const Snapshot     = lazy(() => import('./pages/Snapshot.jsx'))
const Login        = lazy(() => import('./pages/Login.jsx'))
const Registro     = lazy(() => import('./pages/Registro.jsx'))
const Desempenho   = lazy(() => import('./pages/Desempenho.jsx'))
const Estoque      = lazy(() => import('./pages/Estoque.jsx'))
const Atacado      = lazy(() => import('./pages/Atacado.jsx'))
const MonitorOS    = lazy(() => import('./pages/MonitorOS.jsx'))
const ResumoMensal = lazy(() => import('./pages/ResumoMensal.jsx'))
const DesignSystem = lazy(() => import('./pages/DesignSystem.jsx'))
const EsqueciSenha = lazy(() => import('./pages/EsqueciSenha.jsx'))
const AuthAcao     = lazy(() => import('./pages/AuthAcao.jsx'))
const VerificarEmail = lazy(() => import('./pages/VerificarEmail.jsx'))
const Painel       = lazy(() => import('./pv/Painel.js'))
const Canais       = lazy(() => import('./pv/Canais.js'))
const Organograma  = lazy(() => import('./pv/Organograma.js'))
const Conta        = lazy(() => import('./pv/Conta.js'))
const Geografico   = lazy(() => import('./pv/Geografico.js'))
const Conferencia  = lazy(() => import('./pv/Conferencia.js'))
const PainelNps    = lazy(() => import('./nps/PainelNps.jsx'))
const PesquisaNps  = lazy(() => import('./nps/Pesquisa.jsx'))
const ComentarNps  = lazy(() => import('./nps/Comentar.jsx'))
const CRMPage      = lazy(() => import('./crm/CRMPage.jsx'))
import useStore from './store.js'
import { MesStatusBadge } from './components/MesStatusBadge.jsx'
import { verificarVersaoServidor } from './services/firestoreService.js'

// ── Aviso de versão nova (02/09/2026) ───────────────────────────────────────
// Substitui "pedir F5 na mão" quando alguém fica com uma aba aberta desde
// antes de um deploy: o próprio código ANTIGO, ainda rodando, pergunta de
// tempos em tempos se existe versão mais nova publicada (config/appVersion,
// atualizado pelo scripts/deploy.cjs) e avisa — nunca recarrega sozinho, pra
// nunca apagar um rascunho de bônus não salvo no meio da tela.
const VERSAO_CHECK_MS = 5 * 60 * 1000

function VersaoBanner() {
  const [novaVersao, setNovaVersao] = useState(false)

  useEffect(() => {
    const meuTs = typeof __BUILD_TS__ !== 'undefined' ? __BUILD_TS__ : 0
    let cancelado = false
    async function checar() {
      const tsServidor = await verificarVersaoServidor()
      if (!cancelado && tsServidor && tsServidor > meuTs) setNovaVersao(true)
    }
    checar()
    const id = setInterval(checar, VERSAO_CHECK_MS)
    window.addEventListener('focus', checar)
    return () => { cancelado = true; clearInterval(id); window.removeEventListener('focus', checar) }
  }, [])

  if (!novaVersao) return null
  return (
    <div className="no-print" style={{
      position: 'sticky', top: 0, zIndex: 500,
      background: 'var(--honda)', color: '#fff',
      padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      fontSize: 'var(--text-sm3)', fontWeight: 'var(--weight-medium)',
    }}>
      <span>Uma versão nova do sistema está disponível.</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#fff', color: 'var(--honda)', border: 'none', borderRadius: 6,
          padding: '4px 12px', fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-semibold)', cursor: 'pointer',
        }}
      >Atualizar agora</button>
    </div>
  )
}

function AppFooter() {
  const { loadingHistorico, progressoHistorico } = useStore()
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '?'
  return (
    <Footer01>
      <MesStatusBadge />
      {loadingHistorico && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)' }}>
          <span style={{
            display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
            border: '1.5px solid var(--accent)', borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }} />
          Carregando histórico… {progressoHistorico}%
        </span>
      )}
      <span style={{ opacity: 0.7 }}>versão {buildId}</span>
    </Footer01>
  )
}

function AppSplash() {
  const { carregando } = useAuth()
  const { loading } = useStore()
  const ativo = carregando || loading
  const CIRC = 2 * Math.PI * 38
  const progresso = carregando ? 15 : 30
  const msg = carregando ? 'Verificando acesso...' : 'Carregando configurações...'
  if (!ativo) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'color-mix(in srgb,var(--bg) 97%,transparent)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <div style={{ position: 'relative', width: 88, height: 88 }}>
        <svg width="88" height="88" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
          <circle cx="44" cy="44" r="38" fill="none" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${CIRC}`}
            strokeDashoffset={`${CIRC * (1 - progresso / 100)}`}
            style={{ stroke: 'var(--honda)', transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={logoSplash} alt="logo" style={{ width: '100%', objectFit: 'contain', opacity: 0.85 }} />
        </div>
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: '#64748b', letterSpacing: '0.3px' }}>{msg}</div>
    </div>
  )
}

function AppLayout() {
  const {pathname}=useLocation()
  const mainRef=useRef(null)
  useRolagemSuave(mainRef)
  // A página pode rolar no <main> (desktop) ou na janela (mobile/layout alto): zera os dois.
  useLayoutEffect(()=>{mainRef.current?.scrollTo({top:0});window.scrollTo(0,0)},[pathname])
  const { carregarDadosCloud, refreshMesAtual, ressincronizarMeses, publicarSnapshots, ultimaImportacao, loading, erroCloud, erroCloudDetalhe, loadingHistorico, progressoHistorico } = useStore()
  const { logout, role, user } = useAuth()
  const isOperacional = role === 'operacional'
  // No computador a sidebar lembra se a pessoa deixou recolhida (só ícones); no celular ela é gaveta e começa fechada.
  const recolhidaSalva = () => { try { return localStorage.getItem('pv_sidebar_recolhida') === '1' } catch { return false } }
  const [sidebarExpanded, setSidebarExpandedRaw] = useState(() => window.innerWidth > 768 && !recolhidaSalva())
  const setSidebarExpanded = useCallback(valor => setSidebarExpandedRaw(atual => {
    const novo = typeof valor === 'function' ? valor(atual) : valor
    if (window.innerWidth > 768) try { localStorage.setItem('pv_sidebar_recolhida', novo ? '0' : '1') } catch { /* sem armazenamento: só não lembra */ }
    return novo
  }), [])
  // Ao cruzar o breakpoint (girar o tablet, redimensionar), a sidebar acompanha.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const sync = () => setSidebarExpandedRaw(!media.matches && !recolhidaSalva())
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  // Com qualquer popup aberto, a página atrás não rola (antes dava para "sair" do popup
  // rolando). Vale para todos os modais: observa diálogos modais e overlays no DOM.
  useEffect(() => {
    const SELETOR = '[aria-modal="true"], .bi-overlay, .ui-modal-fundo, [data-radix-dialog-overlay], [role="dialog"][data-state="open"]'
    let agendado = 0
    const medir = () => { agendado = 0; document.documentElement.classList.toggle('trava-rolagem', !!document.querySelector(SELETOR)) }
    const obs = new MutationObserver(() => { if (!agendado) agendado = setTimeout(medir, 0) })
    obs.observe(document.body, { childList: true, subtree: true })
    medir()
    return () => { obs.disconnect(); clearTimeout(agendado); document.documentElement.classList.remove('trava-rolagem') }
  }, [])
  // E-mail próprio ainda não confirmado (logins curtos usam @posvenda.app e não recebem e-mail).
  const precisaVerificar = !!user?.email && user.emailVerified === false && !user.email.endsWith('@posvenda.app')

  // useLayoutEffect (não useEffect) de propósito: dispara ANTES da primeira
  // pintura da tela, não depois. `loading` começa `false` por padrão — com
  // useEffect normal, o React chega a pintar um quadro com a splash já
  // desligada mas os dados ainda vazios (o carregamento só marca loading:true
  // um instante depois) — esse quadro solto é o "flash de tela vazia" no F5.
  // Com useLayoutEffect isso roda antes do navegador pintar qualquer coisa,
  // então a splash cobre certinho desde o primeiro quadro em qualquer tela
  // (não só Comissões).
  useLayoutEffect(() => { carregarDadosCloud() }, [carregarDadosCloud])

  // Timer: a cada 10 minutos verifica se o mês atual mudou no Storage.
  // carregarMesAtualCSV compara o timestamp do arquivo — só baixa se houver mudança.
  useEffect(() => {
    const id = setInterval(() => refreshMesAtual(), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [refreshMesAtual])

  // Uploads (deste ou de outro dispositivo) atualizam mesesDisponiveis no Firestore.
  // onSnapshot detecta e re-sincroniza em segundo plano, SEM apagar o cache inteiro:
  // mês atual por timestamp + só os meses retroativos que mudaram. Sem splash.
  useEffect(() => {
    let primeira = true
    const unsub = onSnapshot(doc(db, 'config', 'mesesDisponiveis'), () => {
      if (primeira) { primeira = false; return }
      ressincronizarMeses()
    })
    return unsub
  }, [ressincronizarMeses])

  useEffect(() => {
    if (!ultimaImportacao) return
    publicarSnapshots().catch(e => console.error('Snap auto-publish:', e))
  }, [ultimaImportacao])


  if (erroCloud) {    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16,
        background: 'var(--bg)', color: 'var(--text2)',
      }}>
        <div style={{ fontSize: 'var(--text-5xl)' }}>⚠️</div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--red)' }}>Erro ao carregar</div>
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text3)', maxWidth: 340, textAlign: 'center' }}>{erroCloud}</div>
        {erroCloudDetalhe && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontFamily: 'monospace', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', maxWidth: 420, textAlign: 'center', wordBreak: 'break-word' }}>
            Detalhe: {erroCloudDetalhe}
          </div>
        )}
        <button
          onClick={() => carregarDadosCloud()}
          style={{
            marginTop: 8, padding: '8px 24px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 'var(--weight-semibold)',
            fontSize: 'var(--text-md)', cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
        <button
          onClick={logout}
          style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text3)', fontSize: 'var(--text-base)', cursor: 'pointer',
          }}
        >
          Sair
        </button>
      </div>
    )
  }

  return (
    <div className="layout layout-workspace">
      <GradientBackground className="layout-sky"/>
      <VersaoBanner />
      <Sidebar
        aberto={sidebarExpanded}
        onFechar={() => setSidebarExpanded(false)}
        onToggle={() => setSidebarExpanded(v => !v)}
      />
      <main className="main" ref={mainRef}>
        <WorkspaceTools onMenu={() => setSidebarExpanded(true)}/>
        {precisaVerificar && (
          <div className="aviso-verificacao no-print" role="status">
            <span>Confirme seu e-mail para conseguir recuperar a senha sozinho.</span>
            <Link to="/verificar-email">Verificar agora</Link>
          </div>
        )}
        <div className="page-transition" key={pathname}>
        <Suspense fallback={<PageLoading/>}>
        <Routes>
          {/* Toda área passa pela mesma política de abas (cargo + setor). Início é só do administrador. */}
          <Route path="/" index element={<PrivateRoute area><Home /></PrivateRoute>} />
          <Route path="/crm" element={<PrivateRoute area><CRMPage /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute area>{isOperacional ? <Desempenho /> : <Dashboard />}</PrivateRoute>} />
          <Route path="/desempenho" element={<PrivateRoute area><Desempenho /></PrivateRoute>} />
          <Route path="/perfil/:nome" element={<PrivateRoute area><Desempenho /></PrivateRoute>} />
          <Route path="/painel" element={<PrivateRoute area><Painel /></PrivateRoute>} />
          <Route path="/canais" element={<PrivateRoute area><Canais /></PrivateRoute>} />
          <Route path="/organograma" element={<PrivateRoute area><Organograma /></PrivateRoute>} />
          <Route path="/geografico" element={<PrivateRoute area><Geografico /></PrivateRoute>} />
          <Route path="/monitor-requisicoes" element={<PrivateRoute area><Conferencia tipo="requisicoes" /></PrivateRoute>} />
          <Route path="/monitor-reservas" element={<PrivateRoute area><Conferencia tipo="reservas" /></PrivateRoute>} />
          <Route path="/conta" element={<PrivateRoute area><Conta /></PrivateRoute>} />
          <Route path="/conta/:nome" element={<PrivateRoute area><Conta /></PrivateRoute>} />
          <Route path="/atacado" element={<PrivateRoute area><Atacado /></PrivateRoute>} />
          <Route path="/monitor-os" element={<PrivateRoute area><MonitorOS /></PrivateRoute>} />
          <Route path="/equipes" element={<PrivateRoute area><Equipes /></PrivateRoute>} />
          <Route path="/comissoes" element={<PrivateRoute area><Comissoes /></PrivateRoute>} />
          <Route path="/colaboradores" element={<PrivateRoute area><Colaboradores /></PrivateRoute>} />
          <Route path="/metas" element={<PrivateRoute area><Metas /></PrivateRoute>} />
          <Route path="/upload" element={<PrivateRoute area><Upload /></PrivateRoute>} />
          <Route path="/regras" element={<PrivateRoute area><Regras /></PrivateRoute>} />
          <Route path="/acesso" element={<PrivateRoute area><Acesso /></PrivateRoute>} />
          <Route path="/estoque" element={<PrivateRoute area><Estoque /></PrivateRoute>} />
          {/* /obsoleto era o path antigo do Estoque; mantido para links salvos. */}
          <Route path="/obsoleto" element={<Navigate to="/estoque" replace />} />
          <Route path="/resumo-mensal" element={<PrivateRoute area><ResumoMensal /></PrivateRoute>} />
          <Route path="/nps" element={<PrivateRoute area><PainelNps /></PrivateRoute>} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
        </Suspense>
        </div>
        <AppFooter />
      </main>
      <BottomBar />
      <EntradaApp />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter>
          <AppSplash />
          <Suspense fallback={<PageLoading fullPage/>}>
          <Routes>
            <Route path="/pessoal/:token" element={<PersonalBI />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registrar" element={<Registro />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/auth/acao" element={<AuthAcao />} />
            <Route path="/verificar-email" element={<VerificarEmail />} />
            {/* O portal do colaborador foi desativado (13/11/2026): o login do site é o único acesso. */}
            <Route path="/portal/*" element={<Navigate to="/login" replace />} />
            <Route path="/design" element={<DesignSystem />} />
            {/* Pesquisa NPS do cliente: pública, sem login (totem da loja e QR do celular). */}
            <Route path="/pesquisa" element={<PesquisaNps />} />
            <Route path="/pesquisa/comentar" element={<ComentarNps />} />
            <Route path="/r/:estado/:tipo/:token" element={<Snapshot />} />
            <Route path="/*" element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            } />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
