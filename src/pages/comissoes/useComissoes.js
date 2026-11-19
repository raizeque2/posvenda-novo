import { useState, useMemo } from 'react'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { LOJAS } from '../../data/regras.js'
import { buildRanking } from '../../services/ranking/buildRanking.js'
import { buildGestaoComissao } from '../../services/ranking/buildGestaoComissao.js'
import { norm, supervisoresDisponiveis, listaSupervisores } from '../../utils/normalizacao.js'
import { diasUteisMes, diasUteisDecorridos, parseMesAno, feriadosPorUF, sortMesAno, mesAtualStr, proximoMesStr } from '../../utils/datas.js'
import { useSorter } from '../../components/DS.jsx'
import { RANK_SORT_FNS } from './comissoes.logic.js'

const CANAIS_SETOR = ['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS', 'OS']

export function useComissoes() {
  const {
    pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, bonificacoes, bonAudit,
    salvarBonificacoesLote, mesclarBonificacoesMes, apelidoMap, regras, comissaoGestao, gestaoManual,
    setIndicadorGestao, setBonusExtraGestao, filtrosGlobais, setFiltrosGlobais,
  } = useStore()
  const { user, role, estado: estadoUsuario, nome: nomeUsuario } = useAuth()

  const isAdmin       = role === 'admin'
  const souSupervisor = role === 'supervisor'
  const hasData = Object.keys(pecasPorMes).length > 0 || Object.keys(oficinaPorMes).length > 0
  const mesHoje   = mesAtualStr()
  const mesLimite = proximoMesStr(mesHoje)

  // ── Estado de UI ──────────────────────────────────────────────────────────
  const [aba, setAba]                       = useState('operacional')
  const [openOperacionais, setOpenOperacionais] = useState(true)
  const [openHistorico,    setOpenHistorico]    = useState(true)

  const todosFechados = !openOperacionais && !openHistorico
  const recolherTodos = () => { setOpenOperacionais(false); setOpenHistorico(false) }
  const expandirTodos = () => { setOpenOperacionais(true);  setOpenHistorico(true)  }

  // ── Filtros do store (fonte única, ver filtrosSlice.js) ─────────────────────
  const filtroMes        = filtrosGlobais.mes
  const filtroLojas      = filtrosGlobais.lojas
  const filtroEstado     = isAdmin ? filtrosGlobais.estado : (estadoUsuario || '')
  const filtroCargo      = filtrosGlobais.cargo
  const filtroSetor      = filtrosGlobais.setor
  const buscaNome        = filtrosGlobais.busca
  const filtroSupervisor = filtrosGlobais.supervisor
  const setFiltroMes        = v => setFiltrosGlobais({ mes: v })
  const setFiltroEstado     = v => setFiltrosGlobais({ estado: v, lojas: [] })
  const setFiltroLojas      = v => setFiltrosGlobais({ lojas: v })
  const setFiltroCargo      = v => setFiltrosGlobais({ cargo: v })
  const setFiltroSetor      = v => setFiltrosGlobais({ setor: v })
  const setBuscaNome        = v => setFiltrosGlobais({ busca: v })
  const setFiltroSupervisor = v => setFiltrosGlobais({ supervisor: v })

  const mesesDisp = useMemo(() => {
    const s = new Set([...Object.keys(pecasPorMes), ...Object.keys(oficinaPorMes)])
    return [...s].sort(sortMesAno).filter(m => sortMesAno(m, mesLimite) <= 0)
  }, [pecasPorMes, oficinaPorMes, mesLimite])

  const mesAtivo = filtroMes || (mesesDisp.includes(mesHoje) ? mesHoje : mesesDisp[mesesDisp.length - 1]) || ''

  const mesFechado = useMemo(() => {
    if (!mesAtivo) return false
    const [ma, aa] = mesAtivo.split('/').map(Number)
    const [mh, ah] = mesHoje.split('/').map(Number)
    return aa < ah || (aa === ah && ma < mh)
  }, [mesAtivo, mesHoje])

  const estadoOpts = useMemo(() => {
    const ufs = [...new Set(Object.values(LOJAS).map(v => v.uf))].sort()
    return ufs.map(uf => ({ value: uf, label: uf }))
  }, [])

  const lojasDisp = useMemo(() => {
    const s = new Set()
    for (const r of (pecasPorMes[mesAtivo] || [])) if (r.empresa) s.add(r.empresa)
    for (const r of (oficinaPorMes[mesAtivo] || [])) if (r.empresa) s.add(r.empresa)
    return [...s].sort().filter(l => !filtroEstado || LOJAS[l]?.uf === filtroEstado)
  }, [pecasPorMes, oficinaPorMes, mesAtivo, filtroEstado])

  const lojaOpts = useMemo(() => lojasDisp.map(l => ({ value: l, label: l })), [lojasDisp])

  // ── Dados ─────────────────────────────────────────────────────────────────
  const fpAll = pecasPorMes[mesAtivo]   || []
  const foAll = oficinaPorMes[mesAtivo] || []

  const fp = useMemo(() => fpAll.filter(r =>
    (!filtroLojas.length || filtroLojas.includes(r.empresa)) &&
    (!filtroEstado || LOJAS[r.empresa]?.uf === filtroEstado)
  ), [fpAll, filtroLojas, filtroEstado])

  const fo = useMemo(() => foAll.filter(r =>
    (!filtroLojas.length || filtroLojas.includes(r.empresa)) &&
    (!filtroEstado || LOJAS[r.empresa]?.uf === filtroEstado)
  ), [foAll, filtroLojas, filtroEstado])

  const dataMaxima = useMemo(() => {
    const datas = [...fpAll, ...foAll].filter(r => r.dt instanceof Date).map(r => r.dt.getTime())
    return datas.length ? new Date(Math.max(...datas)) : new Date()
  }, [fpAll, foAll])

  const { diasMes, diasDec } = useMemo(() => {
    if (!mesAtivo) return { diasMes: 0, diasDec: 0 }
    const { mes, ano } = parseMesAno(mesAtivo)
    const feriados = feriadosPorUF(filtroEstado || '', ano)
    return {
      diasMes: diasUteisMes(ano, mes, feriados),
      diasDec: diasUteisDecorridos(ano, mes, dataMaxima, feriados),
    }
  }, [mesAtivo, dataMaxima, filtroEstado])

  const cadastroMes = useMemo(() => colaboradoresPorMes[mesAtivo] || {}, [colaboradoresPorMes, mesAtivo])

  // ── Ranking ───────────────────────────────────────────────────────────────
  // Sem filtro de atividade aqui de propósito: Comissões precisa listar todo
  // colaborador ativo (mesmo sem venda/meta) para permitir bônus manual a
  // qualquer cargo — não só quem gerou comissão calculada este mês.
  const rankingFull = useMemo(() => (
    buildRanking(fpAll, foAll, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes, diasDec, diasMes, apelidoMap,
      regras[mesAtivo]?.comissao, regras[mesAtivo]?.gestao || comissaoGestao)
  ), [fpAll, foAll, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes, diasDec, diasMes, apelidoMap, regras, comissaoGestao])

  // Supervisor só vê o próprio time (nunca o time de outro supervisor) —
  // coordenador/admin continuam com o escopo por estado, sem restrição extra.
  const nomeUsuarioNorm = norm(nomeUsuario || '')
  const baseRanking = useMemo(() => rankingFull.filter(c => {
    const mt = cadastroMes[c.nome] || cadastroMes[norm(c.nome)]
    const lojaBase = mt?.loja || c.lojas[0] || ''
    const ufBase   = LOJAS[lojaBase]?.uf || ''
    if (filtroLojas.length && !filtroLojas.includes(lojaBase)) return false
    if (filtroEstado && ufBase !== filtroEstado) return false
    if (souSupervisor) {
      const sups = listaSupervisores(mt?.supervisor).map(s => norm(s))
      if (!sups.includes(nomeUsuarioNorm)) return false
    }
    return true
  }), [rankingFull, cadastroMes, filtroLojas, filtroEstado, souSupervisor, nomeUsuarioNorm])

  const gestaoConfig  = regras[mesAtivo]?.gestao || comissaoGestao
  const rankingGestao = useMemo(() => (
    buildGestaoComissao(rankingFull, gestaoConfig, gestaoManual[mesAtivo] || {})
  ), [rankingFull, gestaoConfig, gestaoManual, mesAtivo])

  const gestaoNomesNorm = useMemo(() => new Set(comissaoGestao.map(g => norm(g.colaborador))), [comissaoGestao])
  const rankingOperacionais = useMemo(() => baseRanking.filter(c => !gestaoNomesNorm.has(norm(c.nome))), [baseRanking, gestaoNomesNorm])

  // ── Opções de filtro locais ───────────────────────────────────────────────
  const cargoOpts = useMemo(() => {
    const s = new Set(rankingOperacionais.map(c => c.cargo?.toUpperCase()).filter(Boolean))
    return [...s].sort().map(c => ({ value: c, label: c }))
  }, [rankingOperacionais])

  const setorOpts = useMemo(() => {
    const base = filtroCargo.length
      ? rankingOperacionais.filter(c => filtroCargo.includes(c.cargo?.toUpperCase()))
      : rankingOperacionais
    const s = new Set()
    base.forEach(c => (c.cargoMovimento || '').split(';').map(x => x.trim()).filter(Boolean).forEach(x => s.add(x)))
    return CANAIS_SETOR.filter(canal => s.has(canal)).map(c => ({ value: c, label: c }))
  }, [rankingOperacionais, filtroCargo])

  const supOptsComissoes = useMemo(() => {
    const s = supervisoresDisponiveis(Object.values(cadastroMes))
    return [...s].sort().map(v => ({ value: v, label: v }))
  }, [cadastroMes])

  const rankingOpFiltrado = useMemo(() => rankingOperacionais
    .filter(c => !filtroSupervisor || (() => {
      const mt = cadastroMes[c.nome] || cadastroMes[norm(c.nome)]
      return listaSupervisores(mt?.supervisor).includes(filtroSupervisor)
    })())
    .filter(c => filtroCargo.length === 0 || filtroCargo.includes(c.cargo?.toUpperCase()))
    .filter(c => filtroSetor.length  === 0 || filtroSetor.some(s => (c.cargoMovimento || '').split(';').map(x => x.trim()).includes(s)))
    .filter(c => !buscaNome || c.nome.toLowerCase().includes(buscaNome.toLowerCase()))
  , [rankingOperacionais, filtroSupervisor, filtroCargo, filtroSetor, buscaNome, cadastroMes])

  const { sorted: operacionais, sort: opSort, toggle: opToggle } = useSorter(rankingOpFiltrado, RANK_SORT_FNS, [{ col: 'totalComBon', dir: 'desc' }])

  // ── Histórico ─────────────────────────────────────────────────────────────
  const historico = useMemo(() => mesesDisp.map(m => {
    const base = !filtroEstado
      ? { mfp: pecasPorMes[m] || [], mfo: oficinaPorMes[m] || [] }
      : {
          mfp: (pecasPorMes[m] || []).filter(r => LOJAS[r.empresa]?.uf === filtroEstado),
          mfo: (oficinaPorMes[m] || []).filter(r => LOJAS[r.empresa]?.uf === filtroEstado),
        }
    const mc = buildRanking(base.mfp, base.mfo, m, colaboradoresPorMes, metasPorMes, bonificacoes, undefined, undefined, undefined,
      regras[m]?.comissao, regras[m]?.gestao || comissaoGestao)
    return {
      mes: m,
      metaP:    mc.reduce((s, c) => s + c.mp, 0),
      realP:    mc.reduce((s, c) => s + c.tp, 0),
      metaO:    mc.reduce((s, c) => s + c.mo + c.mpo, 0),
      realO:    mc.reduce((s, c) => s + c.to, 0),
      comTotal: mc.reduce((s, c) => s + c.comTotal, 0),
      // Bonificação = calculada (meta batida) + manual — igual à coluna
      // "Total Bonif." da tabela operacional, senão o bônus manual lançado
      // no mês some do resumo histórico.
      bonTotal: mc.reduce((s, c) => s + c.bonCalc + c.bon, 0),
      cmMeta:   mc.filter(c => c.temMeta).length,
    }
  }), [mesesDisp, pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, bonificacoes, filtroEstado, regras, comissaoGestao])

  // ── Totais ────────────────────────────────────────────────────────────────
  const totCom          = baseRanking.reduce((s, c) => s + c.comTotal,    0)
  const totBonCalc      = baseRanking.reduce((s, c) => s + c.bonCalc,     0)
  const totBon          = baseRanking.reduce((s, c) => s + c.bon,         0)
  const totGeral        = baseRanking.reduce((s, c) => s + c.totalComBon, 0)
  const totGestaoTotal  = rankingGestao.reduce((s, g) => s + g.total,     0)
  const totOpCom        = operacionais.reduce((s, c) => s + c.comTotal,   0)
  const totOpBonCalc    = operacionais.reduce((s, c) => s + c.bonCalc,    0)
  const totOpBon        = operacionais.reduce((s, c) => s + c.bon,        0)
  const totOpGeral      = operacionais.reduce((s, c) => s + c.totalComBon, 0)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clearFiltros = () => {
    setFiltrosGlobais({
      mes: mesAtualStr(), ...(isAdmin ? { estado: '' } : {}), lojas: [],
      cargo: [], setor: [], busca: '', supervisor: '',
    })
  }
  const temFiltro = (filtroMes && filtroMes !== mesHoje) || (isAdmin && filtroEstado) || filtroLojas.length > 0
    || filtroCargo.length > 0 || filtroSetor.length > 0 || buscaNome || filtroSupervisor
  const todasZeradas = hasData && mesAtivo && operacionais.length > 0
    && operacionais.every(c => c.comTotal === 0 && c.bon === 0)

  return {
    // dados
    hasData, mesAtivo, mesesDisp, mesHoje,
    isAdmin, user, role,
    operacionais, opSort, opToggle,
    rankingGestao, historico,
    // filtros (todos vêm de filtrosGlobais — fonte única entre páginas)
    filtroMes, filtroLojas, filtroEstado,
    setFiltroMes, setFiltroEstado, setFiltroLojas, clearFiltros, temFiltro,
    estadoOpts, lojaOpts, supOptsComissoes, cargoOpts, setorOpts,
    filtroSupervisor, setFiltroSupervisor,
    filtroCargo, setFiltroCargo,
    filtroSetor, setFiltroSetor,
    buscaNome, setBuscaNome,
    // totais
    totCom, totBonCalc, totBon, totGeral,
    totGestaoTotal,
    totOpCom, totOpBonCalc, totOpBon, totOpGeral,
    // UI
    aba, setAba,
    openOperacionais, setOpenOperacionais,
    openHistorico, setOpenHistorico,
    todosFechados, recolherTodos, expandirTodos,
    todasZeradas,
    // actions
    salvarBonificacoesLote, mesclarBonificacoesMes, bonAudit,
    setIndicadorGestao, setBonusExtraGestao,
    mesFechado,
  }
}
