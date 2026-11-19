import { useState, useMemo, useEffect } from 'react'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { LOJAS } from '../../data/regras.js'
import { norm, listaSupervisores } from '../../utils/normalizacao.js'
import { buildRanking } from '../../services/ranking/buildRanking.js'
import { diasUteisMes, diasUteisDecorridos, parseMesAno, feriadosPorUF, calcProjecao, sortMesAno, mesAtualStr, proximoMesStr } from '../../utils/datas.js'
import { getStatus } from '../../components/DS.jsx'
import { calcLiquido, calcCMV, calcImposto, calcMetaPorCanal, sortPorEficienciaPecas, buildCanalRows, sortOficinaList, addPrintFields, mapOficinaRow } from './dashboard.logic.js'

export const SECOES_LABELS = {
  varejo:      'Varejo',
  web:         'Web',
  televendas:  'Televendas',
  atacado:     'Atacado',
  consultores: 'Consultores',
  mecanicos:   'Mecânicos',
}
export const TODAS_SECOES      = Object.keys(SECOES_LABELS)
export const SCROLL_THRESHOLD  = 8
export const EXCLUIR_PASSAGEM_DASH = new Set(['INTERNO - PEÇAS', 'INTERNO - OFICINA'])

export function useDashboard() {
  const {
    pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, regras, bonificacoes, apelidoMap,
    comissaoGestao, filtrosGlobais, setFiltrosGlobais, ultimasAtualizacoes,
    carregarDadosCloud,
  } = useStore()
  const { role, estado: estadoUsuario } = useAuth()

  // ── Permissões ────────────────────────────────────────────────────────────
  const isAdmin    = role === 'admin'
  const FULL       = ['admin', 'supervisor', 'coordenador']
  const verVarejo  = FULL.includes(role) || role === 'varejo'
  const verAtacado = FULL.includes(role) || role === 'atacado'
  const verOficina = FULL.includes(role) || role === 'oficina' || role === 'varejo'
  const hasData    = Object.keys(pecasPorMes).length > 0 || Object.keys(oficinaPorMes).length > 0

  // ── Meses disponíveis ─────────────────────────────────────────────────────
  const mesHoje   = mesAtualStr()
  const mesLimite = proximoMesStr(mesHoje)

  const mesesDisp = useMemo(() => {
    const s = new Set([...Object.keys(pecasPorMes), ...Object.keys(oficinaPorMes)])
    s.add(mesHoje)
    return [...s].sort(sortMesAno).filter(m => sortMesAno(m, mesLimite) <= 0)
  }, [pecasPorMes, oficinaPorMes, mesLimite, mesHoje])

  // ── Filtros (fonte única, ver filtrosSlice.js) ───────────────────────────
  const filtroMes           = filtrosGlobais.mes
  const filtroLojas         = filtrosGlobais.lojas
  const filtroEstado        = isAdmin ? filtrosGlobais.estado : (estadoUsuario || '')
  const filtroSupervisor    = filtrosGlobais.supervisor || ''
  const setFiltroMes        = v => setFiltrosGlobais({ mes: v })
  const setFiltroEstado     = v => setFiltrosGlobais({ estado: v, lojas: [] })
  const setFiltroLojas      = v => setFiltrosGlobais({ lojas: v })
  const setFiltroSupervisor = v => setFiltrosGlobais({ supervisor: v })
  const clearFiltros        = () => setFiltrosGlobais({ mes: mesHoje, ...(isAdmin ? { estado: '' } : {}), lojas: [], supervisor: '' })

  // ── Estado de UI ──────────────────────────────────────────────────────────
  const [showDetalhesConsult, setShowDetalhesConsult] = useState(false)
  const [showDetalhesTecnico, setShowDetalhesTecnico] = useState(false)
  const [sortConsult, setSortConsult] = useState({ col: 'proj', dir: 'desc' })
  const [sortMec,     setSortMec]     = useState({ col: 'proj', dir: 'desc' })
  const [abaAtiva, setAbaAtiva]       = useState('pecas')
  const [openSecs, setOpenSecs]       = useState({ pecas: true, consultores: true, mecanicos: true })
  const [scrollAtivo, setScrollAtivo] = useState(true)
  const [exportModal, setExportModal] = useState(false)
  const [exportSels,  setExportSels]  = useState(new Set(TODAS_SECOES))
  const [gerando,     setGerando]     = useState(false)

  useEffect(() => {
    setOpenSecs({ pecas: true, consultores: true, mecanicos: true })
  }, [abaAtiva])

  const togglePecas       = () => setOpenSecs(s => ({ ...s, pecas:       !s.pecas }))
  const toggleConsultores = () => setOpenSecs(s => ({ ...s, consultores: !s.consultores }))
  const toggleMecanicos   = () => setOpenSecs(s => ({ ...s, mecanicos:   !s.mecanicos }))
  const abrirExport       = () => { setExportSels(new Set()); setExportModal(true) }
  const toggleExportSel   = key => setExportSels(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  const handleSortOficina = (setter, col) =>
    setter(p => p.col === col
      ? p.dir === 'desc' ? { col, dir: 'asc' } : { col: 'proj', dir: 'desc' }
      : { col, dir: 'desc' })

  // ── Dados brutos do mês ───────────────────────────────────────────────────
  const mesAtivo = filtroMes || mesHoje
  const fpAll    = pecasPorMes[mesAtivo]   || []
  const foAll    = oficinaPorMes[mesAtivo] || []

  const lojasDisp = useMemo(() => {
    const s = new Set()
    for (const r of fpAll) if (r.empresa) s.add(r.empresa)
    for (const r of foAll) if (r.empresa) s.add(r.empresa)
    return [...s].sort().filter(l => !filtroEstado || LOJAS[l]?.uf === filtroEstado)
  }, [fpAll, foAll, filtroEstado])

  const cadastroMes = useMemo(() => colaboradoresPorMes[mesAtivo] || {}, [colaboradoresPorMes, mesAtivo])

  const nomesSupervisor = useMemo(() => {
    if (!filtroSupervisor) return null
    const s = new Set()
    // Trata múltiplos supervisores por colaborador (campo "A;B") — antes
    // comparava a string inteira e nunca encontrava ninguém com 2+ supervisores.
    Object.values(cadastroMes).forEach(c => {
      if (listaSupervisores(c.supervisor).includes(filtroSupervisor)) s.add(norm(c.colaborador))
    })
    return s
  }, [cadastroMes, filtroSupervisor])

  const fp = useMemo(() => fpAll.filter(r =>
    (!filtroLojas.length || filtroLojas.includes(r.empresa)) &&
    (!filtroEstado || LOJAS[r.empresa]?.uf === filtroEstado) &&
    (!nomesSupervisor || nomesSupervisor.has(norm(r.responsavel || '')))
  ), [fpAll, filtroLojas, filtroEstado, nomesSupervisor])

  const fo = useMemo(() => foAll.filter(r =>
    (!filtroLojas.length || filtroLojas.includes(r.empresa)) &&
    (!filtroEstado || LOJAS[r.empresa]?.uf === filtroEstado) &&
    (!nomesSupervisor || nomesSupervisor.has(norm(r.consultor || '')) || nomesSupervisor.has(norm(r.tecnico || '')))
  ), [foAll, filtroLojas, filtroEstado, nomesSupervisor])

  const comparisonHistory = useMemo(() => {
    if (!mesAtivo) return { pieces: [], services: [] }
    const [selectedMonth, selectedYear] = mesAtivo.split('/').map(Number)
    const selectedIndex = selectedYear * 12 + selectedMonth
    const allowed = row =>
      (!filtroLojas.length || filtroLojas.includes(row.empresa)) &&
      (!filtroEstado || LOJAS[row.empresa]?.uf === filtroEstado)
    const months = [...new Set([...Object.keys(pecasPorMes), ...Object.keys(oficinaPorMes)])]
      .filter(value => {
        const [month, year] = value.split('/').map(Number)
        const index = year * 12 + month
        return index < selectedIndex && index >= selectedIndex - 6
      })
    return {
      pieces: months.flatMap(month => (pecasPorMes[month] || []).filter(row => allowed(row) && (!nomesSupervisor || nomesSupervisor.has(norm(row.responsavel || ''))))),
      services: months.flatMap(month => (oficinaPorMes[month] || []).filter(row => allowed(row) && (!nomesSupervisor || nomesSupervisor.has(norm(row.consultor || '')) || nomesSupervisor.has(norm(row.tecnico || ''))))),
    }
  }, [mesAtivo, pecasPorMes, oficinaPorMes, filtroLojas, filtroEstado, nomesSupervisor])

  // ── Datas máximas e dias úteis ────────────────────────────────────────────
  const dataMaximaPecas = useMemo(() => {
    let max = -Infinity
    for (const r of fp) if (r.dt instanceof Date) { const t = r.dt.getTime(); if (t > max) max = t }
    return max > -Infinity ? new Date(max) : null
  }, [fp])

  const dataMaximaOficina = useMemo(() => {
    let max = -Infinity
    for (const r of fo) if (r.dt instanceof Date) { const t = r.dt.getTime(); if (t > max) max = t }
    return max > -Infinity ? new Date(max) : null
  }, [fo])

  const dataMaxima = useMemo(() => {
    const candidates = [dataMaximaPecas, dataMaximaOficina].filter(Boolean).map(d => d.getTime())
    return candidates.length ? new Date(Math.max(...candidates)) : null
  }, [dataMaximaPecas, dataMaximaOficina])

  const { diasMes, diasDec, diasDecHoje } = useMemo(() => {
    if (!mesAtivo) return { diasMes: 0, diasDec: 0, diasDecHoje: 0 }
    const { mes, ano } = parseMesAno(mesAtivo)
    const feriados = feriadosPorUF(filtroEstado || '', ano)
    const refDate  = dataMaxima || new Date()
    return {
      diasMes:     diasUteisMes(ano, mes, feriados),
      diasDec:     diasUteisDecorridos(ano, mes, refDate,    feriados), // para projeção (base nos dados)
      diasDecHoje: diasUteisDecorridos(ano, mes, new Date(), feriados), // para exibição (base no relógio)
    }
  }, [mesAtivo, dataMaxima, filtroEstado])

  const diasFaltantes    = Math.max(0, Math.round((diasMes - diasDecHoje) * 10) / 10)
  const ultimaAtualizacao = useMemo(() => {
    if (!dataMaxima) return null
    return dataMaxima.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }, [dataMaxima])

  // ── Mapa de MO de hoje ────────────────────────────────────────────────────
  const moHojeMap = useMemo(() => {
    if (!dataMaximaOficina) return {}
    const dMax = dataMaximaOficina.toDateString()
    const map = {}
    fo.filter(r => r.dt instanceof Date && r.dt.toDateString() === dMax).forEach(r => {
      if (r.consultor) { const k = norm(r.consultor); map[k] = (map[k] || 0) + r.mo }
      if (r.tecnico)   { const k = norm(r.tecnico);   map[k] = (map[k] || 0) + r.mo }
    })
    return map
  }, [fo, dataMaximaOficina])

  // ── Ranking ───────────────────────────────────────────────────────────────
  // Construído a partir de `fp`/`fo` (já filtrados por loja/estado/supervisor
  // NA VENDA) — não mais de fpAll/foAll com filtro por pessoa cadastrada
  // depois. Antes, filtrar por Loja trazia "tudo que essa pessoa vendeu, em
  // qualquer loja" pra quem tinha cadastro ali, e escondia quem vendeu ali
  // mas é cadastrado noutra loja — batendo diferente do KPI (que já contava
  // por venda). Agora os dois usam a mesma régua: por venda. filtroLojas e
  // filtroEstado vão pro buildRanking pra também trazer, com valor zerado,
  // quem tem meta cadastrada ali mas não vendeu nada ainda no mês (sem isso,
  // esse colaborador some da lista até a primeira venda) — supervisor não
  // tem esse suporte nativo no buildRanking, então filtra depois só pra
  // cobrir esse mesmo caso de meta-sem-venda (quem já vendeu é filtrado
  // corretamente lá em fp/fo, antes de chegar aqui).
  const ranking = useMemo(() => {
    const rk = buildRanking(fp, fo, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes, diasDec, diasMes, apelidoMap,
      regras[mesAtivo]?.comissao, regras[mesAtivo]?.gestao || comissaoGestao, filtroLojas, filtroEstado)
    if (!filtroSupervisor) return rk
    return rk.filter(c => {
      const mt = cadastroMes[c.nome] || cadastroMes[norm(c.nome)]
      return listaSupervisores(mt?.supervisor).includes(filtroSupervisor)
    })
  }, [fp, fo, mesAtivo, colaboradoresPorMes, metasPorMes, cadastroMes, bonificacoes, diasDec, diasMes, apelidoMap, filtroLojas, filtroEstado, filtroSupervisor, regras, comissaoGestao])

  const rkPecas   = useMemo(() => ranking.filter(c => c.tp > 0 || c.mp > 0 || c.devTotal > 0), [ranking])
  const rkOficina = useMemo(() => ranking.filter(c => c.to > 0 || c.mo > 0 || c.mpo > 0),      [ranking])

  // ── Totais por canal ──────────────────────────────────────────────────────
  const vare   = useMemo(() => calcLiquido(fp, 'VAREJO',     diasDec, diasMes), [fp, diasDec, diasMes])
  const atac   = useMemo(() => calcLiquido(fp, 'ATACADO',    diasDec, diasMes), [fp, diasDec, diasMes])
  const webL   = useMemo(() => calcLiquido(fp, 'WEB',        diasDec, diasMes), [fp, diasDec, diasMes])
  const telev  = useMemo(() => calcLiquido(fp, 'TELEVENDAS', diasDec, diasMes), [fp, diasDec, diasMes])
  const pof    = useMemo(() => calcLiquido(fp, 'OFICINA',     diasDec, diasMes), [fp, diasDec, diasMes])
  const pofInt = useMemo(() => calcLiquido(fp, 'OFICINA_INT', diasDec, diasMes), [fp, diasDec, diasMes])
  const pofGar = useMemo(() => calcLiquido(fp, 'OFICINA_GAR', diasDec, diasMes), [fp, diasDec, diasMes])
  const pofSeg = useMemo(() => calcLiquido(fp, 'OFICINA_SEG', diasDec, diasMes), [fp, diasDec, diasMes])
  const mor    = useMemo(() => fo.reduce((s, r) => s + r.mo, 0), [fo])

  const cmvVarejo     = useMemo(() => calcCMV(fp, 'VAREJO'),     [fp])
  const cmvAtacado    = useMemo(() => calcCMV(fp, 'ATACADO'),    [fp])
  const cmvWeb        = useMemo(() => calcCMV(fp, 'WEB'),        [fp])
  const cmvTelevendas = useMemo(() => calcCMV(fp, 'TELEVENDAS'), [fp])
  const cmvPecOS      = useMemo(() => calcCMV(fp, 'OFICINA') + calcCMV(fp, 'OFICINA_GAR') + calcCMV(fp, 'OFICINA_SEG'), [fp])

  const impVarejo     = useMemo(() => calcImposto(fp, 'VAREJO',     regras, mesAtivo), [fp, regras, mesAtivo])
  const impAtacado    = useMemo(() => calcImposto(fp, 'ATACADO',    regras, mesAtivo), [fp, regras, mesAtivo])
  const impWeb        = useMemo(() => calcImposto(fp, 'WEB',        regras, mesAtivo), [fp, regras, mesAtivo])
  const impTelevendas = useMemo(() => calcImposto(fp, 'TELEVENDAS', regras, mesAtivo), [fp, regras, mesAtivo])
  const impPecOS      = useMemo(() => calcImposto(fp, 'OFICINA', regras, mesAtivo) + calcImposto(fp, 'OFICINA_GAR', regras, mesAtivo) + calcImposto(fp, 'OFICINA_SEG', regras, mesAtivo), [fp, regras, mesAtivo])

  const tPBalcao = vare.liquido + atac.liquido + webL.liquido + telev.liquido
  const tPComOS  = tPBalcao + pof.liquido + pofGar.liquido + pofSeg.liquido

  const metaVarejo     = useMemo(() => calcMetaPorCanal(rkPecas, 'VAREJO'),     [rkPecas])
  const metaAtacado    = useMemo(() => calcMetaPorCanal(rkPecas, 'ATACADO'),    [rkPecas])
  const metaWeb        = useMemo(() => calcMetaPorCanal(rkPecas, 'WEB'),        [rkPecas])
  const metaTelevendas = useMemo(() => calcMetaPorCanal(rkPecas, 'TELEVENDAS'), [rkPecas])
  const metaTotalPecas = metaVarejo + metaAtacado + metaWeb + metaTelevendas
  const metaMO         = useMemo(() => rkOficina.filter(c => c.ehConsultor && c.mo  > 0).reduce((s, c) => s + c.mo,  0), [rkOficina])
  const metaPecOSof    = useMemo(() => rkOficina.filter(c => c.ehConsultor && c.mpo > 0).reduce((s, c) => s + c.mpo, 0), [rkOficina])

  // ── Opções de filtro ──────────────────────────────────────────────────────
  const optsEstado = [{ value: 'AL', label: 'Alagoas' }, { value: 'PE', label: 'Pernambuco' }]
  const optsLojas  = useMemo(() => lojasDisp.map(l => ({ value: l, label: l })), [lojasDisp])
  // Um colaborador pode ter mais de um supervisor ("Fulano;Beltrano") — cada
  // nome precisa virar uma opção separada, senão a lista mostra o campo
  // bruto colado como se fosse uma pessoa só, e escolher essa opção nunca
  // bate com ninguém (zera a tela toda).
  const optsSupervisores = useMemo(() => {
    const s = new Set()
    Object.values(cadastroMes)
      .filter(c => !filtroEstado || LOJAS[c.loja]?.uf === filtroEstado)
      .filter(c => !filtroLojas.length || filtroLojas.includes(c.loja))
      .forEach(c => listaSupervisores(c.supervisor).forEach(x => s.add(x)))
    return [...s].sort().map(v => ({ value: v, label: v }))
  }, [cadastroMes, filtroEstado, filtroLojas])

  // ── Linhas por canal ──────────────────────────────────────────────────────
  const varejoRows  = useMemo(() => buildCanalRows(rkPecas, 'VAREJO',     c => c.varejo     - c.devVarejo,     c => c.devVarejo,     c => c.custoVarejo     || 0, regras, mesAtivo, diasDec, diasMes), [rkPecas, regras, mesAtivo, diasDec, diasMes])
  const atacadoRows = useMemo(() => buildCanalRows(rkPecas, 'ATACADO',    c => c.atacado    - c.devAtacado,    c => c.devAtacado,    c => c.custoAtacado    || 0, regras, mesAtivo, diasDec, diasMes), [rkPecas, regras, mesAtivo, diasDec, diasMes])
  const webRows     = useMemo(() => buildCanalRows(rkPecas, 'WEB',        c => c.web        - c.devWeb,        c => c.devWeb,        c => c.custoWeb        || 0, regras, mesAtivo, diasDec, diasMes), [rkPecas, regras, mesAtivo, diasDec, diasMes])
  const televRows   = useMemo(() => buildCanalRows(rkPecas, 'TELEVENDAS', c => c.televendas - c.devTelevendas, c => c.devTelevendas, c => c.custoTelevendas || 0, regras, mesAtivo, diasDec, diasMes), [rkPecas, regras, mesAtivo, diasDec, diasMes])

  // ── Listas de oficina (consultores / mecânicos) ───────────────────────────
  const consultoresBase = useMemo(() => rkOficina.filter(c => c.ehConsultor), [rkOficina])
  const tecnicosBase    = useMemo(() => rkOficina.filter(c => c.ehTecnico),   [rkOficina])

  const consultoresLista = useMemo(() => {
    if (sortConsult.col === 'proj') {
      return [...consultoresBase].sort((a, b) => {
        const efA = a.eficienciaMOCons ?? a.eficienciaMO
        const efB = b.eficienciaMOCons ?? b.eficienciaMO
        if (efA === null && efB === null) return (b.morealCons ?? b.moreal) - (a.morealCons ?? a.moreal)
        if (efA === null) return 1; if (efB === null) return -1
        return efB - efA
      })
    }
    return sortOficinaList(consultoresBase, sortConsult, moHojeMap)
  }, [consultoresBase, sortConsult, moHojeMap])

  const tecnicosLista = useMemo(() => {
    if (sortMec.col === 'proj') {
      return [...tecnicosBase].sort((a, b) => {
        const efA = a.eficienciaMOTec ?? a.eficienciaMO
        const efB = b.eficienciaMOTec ?? b.eficienciaMO
        if (efA === null && efB === null) return (b.morealTec ?? b.moreal) - (a.morealTec ?? a.moreal)
        if (efA === null) return 1; if (efB === null) return -1
        return efB - efA
      })
    }
    return sortOficinaList(tecnicosBase, sortMec, moHojeMap)
  }, [tecnicosBase, sortMec, moHojeMap])

  // ── Totais oficina ────────────────────────────────────────────────────────
  const totConsultMO     = useMemo(() => consultoresLista.reduce((s, c) => s + (c.morealCons ?? c.moreal), 0), [consultoresLista])
  const totConsultPO     = useMemo(() => consultoresLista.reduce((s, c) => s + ((c.pocoficinaVend ?? c.pocoficina) - (c.devPocoficinaVend ?? c.devPocoficina ?? 0)), 0), [consultoresLista])
  const totProjConsultMO = useMemo(() => consultoresLista.reduce((s, c) => s + (c.projMOCons  ?? c.projMO  ?? 0), 0), [consultoresLista])
  const totProjConsultPO = useMemo(() => consultoresLista.reduce((s, c) => s + (c.projPecasOSVend ?? c.projPecasOS ?? 0), 0), [consultoresLista])
  const totHojeConsult   = useMemo(() => consultoresLista.reduce((s, c) => s + (moHojeMap[norm(c.nome)] || 0), 0), [consultoresLista, moHojeMap])
  const totConsultPass   = useMemo(() => consultoresLista.reduce((s, c) => s + (c.passagens ?? 0), 0), [consultoresLista])
  const totTecMO         = useMemo(() => tecnicosLista.reduce((s, c) => s + (c.morealTec ?? c.moreal), 0), [tecnicosLista])
  const totTecPO         = useMemo(() => tecnicosLista.reduce((s, c) => s + ((c.pocoficInaTec ?? c.pocoficina) - (c.devPocoficInaTec ?? c.devPocoficina ?? 0)), 0), [tecnicosLista])
  const totTecPass       = useMemo(() => tecnicosLista.reduce((s, c) => s + (c.passagensTec ?? c.passagens ?? 0), 0), [tecnicosLista])
  const totHojeTec       = useMemo(() => tecnicosLista.reduce((s, c) => s + (moHojeMap[norm(c.nome)] || 0), 0), [tecnicosLista, moHojeMap])
  const totPassagensOS   = useMemo(() =>
    new Set(fo.filter(r => r.osId && r.contaPassagem && !EXCLUIR_PASSAGEM_DASH.has(r.tipoOS)).map(r => r.osId)).size
  , [fo])

  // ── Vendas de hoje ────────────────────────────────────────────────────────
  const vendaHojePorCanal = useMemo(() => {
    if (!dataMaximaPecas) return {}
    const dMax = dataMaximaPecas.toDateString()
    const m = { VAREJO: 0, ATACADO: 0, WEB: 0, TELEVENDAS: 0, OFICINA: 0 }
    fp.filter(r => r.dt instanceof Date && r.dt.toDateString() === dMax).forEach(r => {
      if (r.cat === 'OFICINA_GAR' || r.cat === 'OFICINA_SEG') m.OFICINA += r.valor
      else if (r.cat in m) m[r.cat] += r.valor
    })
    return m
  }, [fp, dataMaximaPecas])

  const vendaHojeColabMap = useMemo(() => {
    if (!dataMaximaPecas || mesAtivo !== mesHoje) return {}
    const dMax = dataMaximaPecas.toDateString()
    const map = {}
    fp.filter(r => r.dt instanceof Date && r.dt.toDateString() === dMax && r.responsavel).forEach(r => {
      const k = norm(r.responsavel)
      if (!map[k]) map[k] = {}
      map[k][r.cat] = (map[k][r.cat] || 0) + r.valor
    })
    return map
  }, [fp, dataMaximaPecas, mesAtivo, mesHoje])

  // ── Linhas de impressão ───────────────────────────────────────────────────
  const printVarejoRows  = useMemo(() => addPrintFields(varejoRows,  vendaHojeColabMap), [varejoRows,  vendaHojeColabMap])
  const printWebRows     = useMemo(() => addPrintFields(webRows,     vendaHojeColabMap), [webRows,     vendaHojeColabMap])
  const printTelvRows    = useMemo(() => addPrintFields(televRows,   vendaHojeColabMap), [televRows,   vendaHojeColabMap])
  const printAtacadoRows = useMemo(() => addPrintFields(atacadoRows, vendaHojeColabMap), [atacadoRows, vendaHojeColabMap])
  const printConsultRows = useMemo(() => consultoresLista.map(r => mapOficinaRow(r, true,  moHojeMap, diasDec, diasMes)), [consultoresLista, moHojeMap, diasDec, diasMes])
  const printTecRows     = useMemo(() => tecnicosLista.map(r    => mapOficinaRow(r, false, moHojeMap, diasDec, diasMes)), [tecnicosLista,    moHojeMap, diasDec, diasMes])

  // ── PDF ───────────────────────────────────────────────────────────────────
  const pecasInPrint     = ['varejo','web','televendas','atacado'].some(k => exportSels.has(k))
  const consultInPrint   = exportSels.has('consultores')
  const mecanicosInPrint = exportSels.has('mecanicos')

  async function imprimir() {
    setExportModal(false)
    setGerando(true)
    await new Promise(r => setTimeout(r, 50))
    try {
      const { gerarPDF } = await import('./gerarPDF.js')
      await gerarPDF({
        filtroEstado, mesAtivo, diasDec, diasMes, ultimaAtualizacao,
        verVarejo, verAtacado, verOficina,
        vare, atac, webL, telev, pof, mor,
        metaVarejo, metaAtacado, metaWeb, metaTelevendas, metaMO, metaPecOSof,
        exportSels, pecasInPrint, consultInPrint, mecanicosInPrint,
        printVarejoRows, printWebRows, printTelvRows, printAtacadoRows,
        printConsultRows, printTecRows,
      })
    } finally {
      setGerando(false)
      setExportSels(new Set(TODAS_SECOES))
    }
  }

  const withScrollC = scrollAtivo && consultoresLista.length > SCROLL_THRESHOLD
  const withScrollT = scrollAtivo && tecnicosLista.length   > SCROLL_THRESHOLD

  return {
    // dados
    fp, fo, fpAll, foAll, comparisonHistory,
    diasMes, diasDec, diasFaltantes, mesAtivo, mesHoje, mesesDisp, ultimaAtualizacao,
    // permissões
    isAdmin, verVarejo, verAtacado, verOficina, hasData,
    // totais por canal
    vare, atac, webL, telev, pof, pofInt, pofGar, pofSeg, mor, tPBalcao, tPComOS,
    cmvVarejo, cmvAtacado, cmvWeb, cmvTelevendas, cmvPecOS,
    impVarejo, impAtacado, impWeb, impTelevendas, impPecOS,
    metaVarejo, metaAtacado, metaWeb, metaTelevendas, metaTotalPecas, metaMO, metaPecOSof,
    // linhas
    varejoRows, atacadoRows, webRows, televRows,
    consultoresLista, tecnicosLista,
    // totais oficina
    totConsultMO, totConsultPO, totProjConsultMO, totProjConsultPO, totHojeConsult, totConsultPass,
    totTecMO, totTecPO, totTecPass, totHojeTec, totPassagensOS,
    // hoje
    vendaHojePorCanal, vendaHojeColabMap, moHojeMap,
    // impressão
    printVarejoRows, printWebRows, printTelvRows, printAtacadoRows, printConsultRows, printTecRows,
    pecasInPrint, consultInPrint, mecanicosInPrint,
    // filtros
    filtroMes, filtroLojas, filtroEstado, filtroSupervisor,
    setFiltroMes, setFiltroEstado, setFiltroLojas, setFiltroSupervisor, clearFiltros,
    optsEstado, optsLojas, optsSupervisores,
    // estado UI
    showDetalhesConsult, setShowDetalhesConsult,
    showDetalhesTecnico, setShowDetalhesTecnico,
    sortConsult, setSortConsult,
    sortMec, setSortMec,
    abaAtiva, setAbaAtiva,
    openSecs, togglePecas, toggleConsultores, toggleMecanicos,
    scrollAtivo, setScrollAtivo, withScrollC, withScrollT,
    exportModal, setExportModal, exportSels, setExportSels, toggleExportSel, abrirExport,
    gerando, imprimir,
    // store
    ultimasAtualizacoes, carregarDadosCloud,
    handleSortOficina,
  }
}
