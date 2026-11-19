import { useState, useMemo } from 'react'
import useStore from '../../store.js'
import { LOJAS } from '../../data/regras.js'
import { buildRanking } from '../../services/ranking/buildRanking.js'
import { feriadosPorUF, diasUteisMes, diasUteisDecorridos, sortMesAno, mesAtualStr, proximoMesStr } from '../../utils/datas.js'
import { buildEquipes, sortEquipes, titleCase } from './equipes.logic.js'

export function useEquipes() {
  const {
    pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, apelidoMap, bonificacoes,
    regras, comissaoOperacional, comissaoGestao,
    filtrosGlobais, setFiltrosGlobais,
  } = useStore()

  const [abertos,   setAbertos]   = useState({})
  const [ordenacao, setOrdenacao] = useState('meta')

  const filtroMes        = filtrosGlobais.mes
  const filtroUF         = filtrosGlobais.estado
  const filtroLoja       = filtrosGlobais.lojas
  const filtroSupervisor = filtrosGlobais.supervisor
  const setFiltroSupervisor = v => setFiltrosGlobais({ supervisor: v })

  const mesHoje   = mesAtualStr()
  const mesLimite = proximoMesStr(mesHoje)

  const mesesDisp = useMemo(() => {
    const s = new Set([...Object.keys(pecasPorMes), ...Object.keys(oficinaPorMes)])
    return [...s].sort(sortMesAno).filter(m => sortMesAno(m, mesLimite) <= 0)
  }, [pecasPorMes, oficinaPorMes, mesLimite])

  const mesAtivo = filtroMes || (mesesDisp.includes(mesHoje) ? mesHoje : mesesDisp[mesesDisp.length - 1]) || ''

  const estadoOpts = useMemo(() => {
    const ufs = [...new Set(Object.values(LOJAS).map(v => v.uf))].sort()
    return ufs.map(uf => ({ value: uf, label: uf }))
  }, [])

  const lojaOpts = useMemo(() =>
    Object.entries(LOJAS)
      .filter(([, v]) => !filtroUF || v.uf === filtroUF)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ value: k, label: `${k} – ${v.un}` }))
  , [filtroUF])

  const pecasFiltradas  = pecasPorMes[mesAtivo]   || []
  const oficinaFiltrada = oficinaPorMes[mesAtivo] || []

  const dataMaxima = useMemo(() => {
    let max = -Infinity
    for (const r of pecasFiltradas)  if (r.dt?.getTime) { const t = r.dt.getTime(); if (t > max) max = t }
    for (const r of oficinaFiltrada) if (r.dt?.getTime) { const t = r.dt.getTime(); if (t > max) max = t }
    return max > -Infinity ? new Date(max) : null
  }, [pecasFiltradas, oficinaFiltrada])

  const { diasMes, diasDec } = useMemo(() => {
    if (!mesAtivo || !dataMaxima) return { diasMes: 0, diasDec: 0 }
    const [mm, aa] = mesAtivo.split('/').map(Number)
    const feriados = feriadosPorUF(filtroUF || '', aa)
    return {
      diasMes: diasUteisMes(aa, mm, feriados),
      diasDec: diasUteisDecorridos(aa, mm, dataMaxima, feriados),
    }
  }, [mesAtivo, dataMaxima, filtroUF])

  const ranking = useMemo(() =>
    buildRanking(
      pecasFiltradas, oficinaFiltrada, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes,
      diasDec, diasMes, apelidoMap,
      regras[mesAtivo]?.comissao || comissaoOperacional,
      regras[mesAtivo]?.gestao   || comissaoGestao,
      filtroLoja, filtroUF,
    )
  , [pecasFiltradas, oficinaFiltrada, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes,
     diasDec, diasMes, apelidoMap, regras, comissaoOperacional, comissaoGestao,
     filtroLoja, filtroUF])

  const equipesAll = useMemo(() =>
    sortEquipes(buildEquipes(ranking, comissaoGestao, diasDec), ordenacao)
  , [ranking, comissaoGestao, diasDec, ordenacao])

  const supOpts = useMemo(() =>
    equipesAll.map(e => ({ value: e.supervisor, label: titleCase(e.supervisor) }))
  , [equipesAll])

  const equipes = useMemo(() =>
    filtroSupervisor ? equipesAll.filter(e => e.supervisor === filtroSupervisor) : equipesAll
  , [equipesAll, filtroSupervisor])

  const semSupervisor = useMemo(() =>
    ranking.filter(c => !c.inativo && !c.supervisor && c.temMeta)
  , [ranking])

  const temFiltro = (filtroMes && filtroMes !== mesHoje) || filtroUF || filtroLoja.length > 0 || filtroSupervisor

  const toggleAberto = supervisor =>
    setAbertos(a => ({ ...a, [supervisor]: !a[supervisor] }))

  const clearFiltros = () => {
    setFiltrosGlobais({ mes: mesHoje, estado: '', lojas: [], supervisor: '' })
  }

  return {
    mesAtivo, mesHoje, mesesDisp,
    filtroMes, filtroUF, filtroLoja,
    setFiltrosGlobais,
    filtroSupervisor, setFiltroSupervisor,
    ordenacao, setOrdenacao,
    estadoOpts, lojaOpts, supOpts,
    equipes, equipesAll, semSupervisor,
    diasDec, diasMes,
    temFiltro, clearFiltros,
    abertos, toggleAberto,
  }
}
