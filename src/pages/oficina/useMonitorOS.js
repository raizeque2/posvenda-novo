import { useState, useEffect, useMemo } from 'react'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { carregarFotoOS, carregarRegrasOS } from '../../services/osMonitor.js'
import { resumoOS, compararFotos } from '../../services/processamento/processarOS.js'

const normU = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()

export function useMonitorOS({ demo = false } = {}) {
  const { role } = useAuth()
  const { filtrosGlobais, setFiltrosGlobais, colaboradoresPorMes,lojas:LOJAS } = useStore()
  const canEdit = role === 'admin' && !demo

  const [aba, setAba]               = useState('visao')
  const [carregando, setCarregando] = useState(true)
  const [erro,setErro]=useState('')
  const [revision,setRevision]=useState(0)
  const [registros, setRegistros]   = useState([])
  const [infoFoto, setInfoFoto]     = useState(null)
  const [anterior, setAnterior]     = useState(null) // foto da carga anterior
  const [historico, setHistorico]   = useState([])   // apuração por carga
  const [regras, setRegras]         = useState({})
  const [supervisorSel, setSupervisorSel] = useState('')
  const [busca, setBusca]           = useState('')
  const [filtrosRapidos, setFiltrosRapidos] = useState([])
  const [minDias, setMinDias]       = useState(0)
  const toggleFiltroRapido = key => setFiltrosRapidos(fs => fs.includes(key) ? fs.filter(k => k !== key) : [...fs, key])

  const estadoSel = filtrosGlobais.estado
  const lojasSel  = filtrosGlobais.lojas

  useEffect(() => {
    const update=()=>setRevision(v=>v+1)
    window.addEventListener('posvenda:os-updated',update)
    return()=>window.removeEventListener('posvenda:os-updated',update)
  },[])
  useEffect(() => {
    let cancelado = false
    async function init() {
      setCarregando(true)
      setErro('')
      try {
      const [cargas, rg] = await Promise.all([carregarFotoOS(), carregarRegrasOS()])
      if (cancelado) return
      const foto = cargas.foto
      setRegistros(foto?.registros || [])
      setInfoFoto(foto ? { ts: foto.ts, dataArquivo: foto.dataArquivo } : null)
      setAnterior(cargas.anterior)
      setHistorico(cargas.historico || [])
      setRegras(rg || {})
      }catch(error){if(!cancelado)setErro(error.message||'Não foi possível carregar as O.S.')}
      finally{if(!cancelado)setCarregando(false)}
    }
    init()
    return () => { cancelado = true }
  }, [revision])

  // Mapa consultor → supervisor (cadastro de colaboradores do mês), igual Equipes.
  const mesCad = filtrosGlobais.mes || Object.keys(colaboradoresPorMes).sort().pop() || ''
  const supervisorMap = useMemo(() => {
    const m = {}
    for (const c of Object.values(colaboradoresPorMes[mesCad] || {})) {
      if (!c.supervisor) continue
      if (c.colaborador) m[normU(c.colaborador)] = c.supervisor
      if (c.apelido)     m[normU(c.apelido)]     = c.supervisor
    }
    return m
  }, [colaboradoresPorMes, mesCad])
  const supervisorDe = o => supervisorMap[normU(o.consultor)] || o.consultor || '(sem supervisor)'

  const todasLojas = useMemo(() => [...new Set(registros.map(o => o.empresa))].filter(Boolean).sort(), [registros])
  const tiposConhecidos = useMemo(() => [...new Set(registros.flatMap(o => o.tipos || []))].filter(Boolean).sort(), [registros])

  const optsEstado = useMemo(() => {
    const ufs = new Set(todasLojas.map(l => LOJAS[l]?.uf).filter(Boolean))
    return [...ufs].sort().map(uf => ({ value: uf, label: Object.values(LOJAS).find(l => l.uf === uf)?.estado || uf }))
  }, [todasLojas,LOJAS])

  const optsLojas = useMemo(() => {
    const bse = estadoSel ? todasLojas.filter(l => LOJAS[l]?.uf === estadoSel) : todasLojas
    return bse.map(l => ({ value: l, label: LOJAS[l]?.un ? `${l} – ${LOJAS[l].un}` : l }))
  }, [todasLojas, estadoSel,LOJAS])

  const optsSupervisor = useMemo(() => {
    const s = new Set(registros.map(o => supervisorDe(o)))
    return [...s].filter(Boolean).sort().map(v => ({ value: v, label: v }))
  }, [registros, supervisorMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Base dos KPIs/cards: estado + loja + supervisor (a busca é só da tabela).
  // Mesmo recorte vale para a foto anterior, para comparar maçã com maçã.
  const recortar = lista => {
    let r = lista
    if (estadoSel) r = r.filter(o => LOJAS[o.empresa]?.uf === estadoSel)
    if (lojasSel.length > 0) r = r.filter(o => lojasSel.includes(o.empresa))
    if (supervisorSel) r = r.filter(o => supervisorDe(o) === supervisorSel)
    return r
  }
  const base = useMemo(() => recortar(registros), [registros, estadoSel, lojasSel, supervisorSel, supervisorMap,LOJAS])

  const opcoesResumo = { regras, supervisorMap, filtrosRapidos, minDias }
  const resumo = useMemo(
    () => resumoOS(base, { ...opcoesResumo, dataRef: new Date() }),
    [base, regras, supervisorMap, filtrosRapidos, minDias] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Mudanças desde a carga anterior (anterior classificada na data dela).
  const mudancas = useMemo(() => {
    if (!anterior?.registros?.length) return null
    const rAnt = resumoOS(recortar(anterior.registros), { ...opcoesResumo, dataRef: new Date(anterior.ts) })
    return compararFotos(resumo.ativos, rAnt.ativos)
  }, [anterior, resumo, estadoSel, lojasSel, supervisorSel,supervisorMap,LOJAS])

  // Tabela detalhada: resumo.ativos + busca por cliente/placa/nº O.S.
  const detalhe = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return resumo.ativos
    return resumo.ativos.filter(o =>
      o.cliente?.toLowerCase().includes(q) ||
      o.placa?.toLowerCase().includes(q) ||
      o.nOS?.toLowerCase().includes(q)
    )
  }, [resumo.ativos, busca])

  const temFiltro = !!estadoSel || lojasSel.length > 0 || !!supervisorSel || !!busca || filtrosRapidos.length > 0 || minDias > 0
  function clearFiltros() {
    setFiltrosGlobais({ estado: '', lojas: [] })
    setSupervisorSel('')
    setBusca('')
    setFiltrosRapidos([])
    setMinDias(0)
  }

  return {
    aba, setAba,
    carregando, erro, recarregar:()=>setRevision(v=>v+1),
    temDados: registros.length > 0,
    totalArquivo: registros.length,
    filtrosRapidos, setFiltrosRapidos, toggleFiltroRapido, minDias, setMinDias,
    infoFoto,
    infoAnterior: anterior ? { ts: anterior.ts } : null,
    historico, mudancas,
    resumo, detalhe,
    regras, setRegras,
    tiposConhecidos,
    canEdit,
    estadoSel, optsEstado, onEstado: v => setFiltrosGlobais({ estado: v === estadoSel ? '' : v, lojas: [] }),
    lojasSel, optsLojas, onLojas: v => setFiltrosGlobais({ lojas: v }),
    supervisorSel, optsSupervisor, onSupervisor: v => setSupervisorSel(v === supervisorSel ? '' : v),
    busca, setBusca,
    temFiltro, clearFiltros,
  }
}

