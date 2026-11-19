import PersonalOverview from './desempenho/PersonalOverview.jsx'
import MeuDesempenho from './desempenho/MeuDesempenho.jsx'
import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import useStore from '../store.js'
import { useDesempenho } from '../hooks/useDesempenho.js'
import { EmptyState } from '../components/DS.jsx'
import { DropdownMenu } from '../components/ui/dropdown-menu'
import { User, BarChart2 } from '../icons/iconoir'

export default function Desempenho() {
  const { role, nome: nomeAuth } = useAuth()
  const { colaboradoresPorMes } = useStore()
  const { nome: nomeParam } = useParams()
  const navigate = useNavigate()
  const isAdmin      = role === 'admin'
  const isSupervisor = role === 'coordenador' || role === 'supervisor'
  const viaLink      = !!nomeParam

  const [nomeSelecionado, setNomeSelecionado] = useState(null)
  const nomeAtivo = (isAdmin || isSupervisor) ? (nomeSelecionado || nomeParam || nomeAuth || '') : (nomeAuth || '')
  const [view,setView]=useState('geral')

  const listaColabs = useMemo(() => {
    if (!isAdmin && !isSupervisor) return []
    const nomes = new Set()
    Object.values(colaboradoresPorMes).forEach(mes =>
      Object.values(mes).forEach(d => { if (d.colaborador) nomes.add(d.colaborador) })
    )
    return [...nomes].sort()
  }, [colaboradoresPorMes, isAdmin, isSupervisor])

  const opcoesPessoa = useMemo(() => (isAdmin || isSupervisor) ? [
    ...(nomeAuth ? [{ value: nomeAuth, label: `${nomeAuth} (você)` }] : []),
    ...listaColabs.filter(n => n !== nomeAuth).map(n => ({ value: n, label: n })),
  ] : [], [isAdmin, isSupervisor, nomeAuth, listaColabs])

  // Visão geral no celular funciona como app: sem topbar de busca e sem abas no topo
  // (o detalhamento abre pelo botão no fim da página). Ver shell.css → html.tela-app.
  useEffect(() => {
    document.documentElement.classList.toggle('tela-app', view === 'geral')
    return () => document.documentElement.classList.remove('tela-app')
  }, [view])

  const d = useDesempenho(nomeAtivo, false)
  const semDados = !d.temPecas && !d.temOficina && !d.meuEntry

  return (
    <div className="page">
      {viaLink && (
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 'var(--text-sm2)', fontFamily: 'var(--font)', fontWeight: 'var(--weight-medium)', marginBottom: 8, padding: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--honda)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
        >← Voltar</button>
      )}

      {(isAdmin || isSupervisor) && view !== 'geral' && (
        <div className="filters-bar dash-top-bar">
          <div style={{ minWidth: 260 }}>
            <DropdownMenu
              value={nomeAtivo}
              onChange={v => setNomeSelecionado(v || null)}
              ariaLabel="Selecionar colaborador"
              placeholder="Selecione um colaborador"
              options={opcoesPessoa}
            />
          </div>
        </div>
      )}

      {!nomeAtivo ? (
        <EmptyState icon={User} title="Perfil não vinculado" sub="Seu usuário não está vinculado a um colaborador. Peça ao administrador para ajustar seu cadastro." />
      ) : semDados ? (
        <EmptyState icon={BarChart2} title="Sem dados" sub={`Nenhum dado encontrado para ${d.nomeResolvido || nomeAtivo}.`} />
      ) : (
        <>
          <div className="tab-nav desempenho-abas"><button className={`tab-btn ${view==='geral'?'active':''}`} onClick={()=>setView('geral')}>Visão geral</button><button className={`tab-btn ${view==='personal'?'active':''}`} onClick={()=>setView('personal')}>Acompanhamento</button></div>
          {view==='geral' && <MeuDesempenho key={nomeAtivo} nome={d.nomeResolvido||nomeAtivo} onDetalhes={()=>setView('personal')} pessoas={opcoesPessoa} nomeSelecionado={nomeAtivo} onTrocarPessoa={v=>setNomeSelecionado(v||null)}/>}
          {view==='personal' && <PersonalOverview key={nomeAtivo} name={d.nomeResolvido||nomeAtivo}/>}
        </>
      )}
    </div>
  )
}
