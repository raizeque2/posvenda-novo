import {useAtacadoConfig} from '../../services/atacadoConfig.js'
import { useMemo, useState, useEffect } from 'react'
import {authorizedData} from '../../services/authorizedAccess.js'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { buildRanking } from '../../services/ranking/buildRanking.js'
import { calcLiquido, calcMetaPorCanal } from '../dashboard/dashboard.logic.js'
import {
  diasUteisMes, diasUteisDecorridos, parseMesAno, feriadosPorUF,
  sortMesAno, mesAtualStr, proximoMesStr
} from '../../utils/datas.js'
import { norm } from '../../utils/normalizacao.js'
import {
  linhasAtacado, buildClientes, buildPecas, baseInatividade, faixasInatividade,
  quedaFrequencia, buildCobertura, evolucaoMeses, janelaMeses, valLiq,
  buildAgrupamento, intervaloComprasStats, clientesCarteira, novosReativados,
  concentracaoTop10, itensPorNota, evolucao12mComMeta, buildVendedores
} from './atacado.logic.js'

export function useAtacado() {
  const {
    pecasPorMes:pecasBase, oficinaPorMes, colaboradoresPorMes, metasPorMes,
    bonificacoes, apelidoMap, regras, comissaoGestao, lojas,
    filtrosGlobais, setFiltrosGlobais
  } = useStore()
  const {value:atacadoConfig,error:configError}=useAtacadoConfig()
  const { role, estado: estadoUsuario } = useAuth()
  const isAdmin = role === 'admin'
  const [authorized,setAuthorized]=useState({}),[dataError,setDataError]=useState(''),[loading,setLoading]=useState(!isAdmin)
  // Depende só da lista de meses (não da identidade do objeto): antes, cada
  // ressincronização do store apagava a tela e baixava todos os meses de novo;
  // com o limite de concorrência do servidor, uma falha derrubava a página inteira.
  // Agora: meses já baixados ficam; só o mês atual e os novos são buscados, e a
  // falha de um mês não esconde os demais.
  const chaveMeses=Object.keys(pecasBase).sort().join(',')
  const tsPecas=useStore(s=>s.ultimasAtualizacoes?.pecas) // nova importação → rebusca o mês atual
  useEffect(()=>{
    if(isAdmin)return
    let active=true
    const meses=chaveMeses?chaveMeses.split(','):[]
    const buscar=meses.filter(month=>!(month in authorized)||month===mesAtualStr())
    if(!buscar.length){setLoading(false);return}
    if(!Object.keys(authorized).length)setLoading(true)
    setDataError('')
    Promise.allSettled(buscar.map(async month=>{
      const rows=await authorizedData({kind:'wholesale',path:`Dados/Pecas/${month.replace('/','-')}.json`})
      return [month,(rows||[]).map(row=>({...row,dt:row.dt?new Date(row.dt):null}))]
    })).then(results=>{
      if(!active)return
      const ok=results.filter(r=>r.status==='fulfilled').map(r=>r.value)
      setAuthorized(prev=>({...Object.fromEntries(Object.entries(prev).filter(([m])=>meses.includes(m))),...Object.fromEntries(ok)}))
      if(ok.length<results.length)setDataError(`Não foi possível carregar ${results.length-ok.length} mês(es) do atacado. Os demais estão atualizados.`)
    }).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isAdmin,chaveMeses,tsPecas])
  const pecasPorMes=isAdmin?pecasBase:authorized

  const mesHoje   = mesAtualStr()
  const mesLimite = proximoMesStr(mesHoje)

  const mesesDisp = useMemo(() => {
    const s = new Set(Object.keys(pecasPorMes))
    s.add(mesHoje)
    return [...s].sort(sortMesAno).filter(m => sortMesAno(m, mesLimite) <= 0)
  }, [pecasPorMes, mesHoje, mesLimite])

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtroEstado = isAdmin ? (filtrosGlobais.estado || '') : (estadoUsuario || '')
  const filtroLojas  = filtrosGlobais.lojas  || []
  const busca        = filtrosGlobais.busca  || ''
  const mesAtivo     = filtrosGlobais.mes || (mesesDisp.includes(mesHoje) ? mesHoje : mesesDisp[mesesDisp.length - 1]) || ''

  // Tipo de Mercadoria é global e compartilhado com o Faturamento (ver
  // filtrosSlice.js) — persiste e vale nas duas telas. Os demais sub-filtros da
  // aba Geral continuam locais (só fazem sentido no Atacado).
  const filtroTipoMerc    = Array.isArray(filtrosGlobais.tipoMerc) ? filtrosGlobais.tipoMerc : []
  const setFiltroTipoMerc = v => setFiltrosGlobais({ tipoMerc: v })
  const [filtroTipoMov, setFiltroTipoMov]     = useState('')
  const [filtroCidade, setFiltroCidade]         = useState('')
  const [filtroCliente, setFiltroCliente]       = useState('')

  const setMes    = v => setFiltrosGlobais({ mes: v })
  const setEstado = v => setFiltrosGlobais({ estado: v, lojas: [] })
  const setLojas  = v => setFiltrosGlobais({ lojas: v })
  const setBusca  = v => setFiltrosGlobais({ busca: v })

  const subFiltroAtivo = !!(filtroTipoMerc.length || filtroTipoMov || filtroCidade || filtroCliente)
  const temFiltro = (isAdmin && !!filtroEstado) || filtroLojas.length > 0 || !!busca || subFiltroAtivo
  const limpar = () => {
    setFiltrosGlobais({ estado: '', lojas: [], tipoMerc: [], busca: '' })
    setFiltroTipoMov(''); setFiltroCidade(''); setFiltroCliente('')
  }

  const escopo = useMemo(() => ({
    estado: filtroEstado, lojas: filtroLojas, lojasMap: lojas,
    tipoMercadoria: filtroTipoMerc, tipoMovimento: filtroTipoMov, cidade: filtroCidade,
  }), [filtroEstado, filtroLojas, lojas, filtroTipoMerc, filtroTipoMov, filtroCidade])

  // ── Linhas ATACADO ────────────────────────────────────────────────────────
  const rowsMes = useMemo(() => {
    let rows = linhasAtacado({ [mesAtivo]: pecasPorMes[mesAtivo] || [] }, escopo)
    if (filtroCliente) {
      const nc = norm(filtroCliente)
      rows = rows.filter(r => norm(r['Pessoa'] || '') === nc)
    }
    return rows
  }, [pecasPorMes, mesAtivo, escopo, filtroCliente])

  const rowsAll = useMemo(() => {
    let rows = linhasAtacado(Object.fromEntries(Object.entries(pecasPorMes).filter(([month])=>sortMesAno(month,mesAtivo)<=0)), escopo)
    if (filtroCliente) {
      const nc = norm(filtroCliente)
      rows = rows.filter(r => norm(r['Pessoa'] || '') === nc)
    }
    return rows
  }, [pecasPorMes, escopo, filtroCliente,mesAtivo])

  const meses6  = useMemo(() => janelaMeses(pecasPorMes, mesAtivo, 6), [pecasPorMes, mesAtivo])
  const meses12 = useMemo(() => janelaMeses(pecasPorMes, mesAtivo, 12), [pecasPorMes, mesAtivo])
  const rows6m  = useMemo(() => linhasAtacado(Object.fromEntries(meses6.map(m => [m, pecasPorMes[m] || []])), escopo), [pecasPorMes, meses6, escopo])
  const rows12m = useMemo(() => {
    let rows = linhasAtacado(Object.fromEntries(meses12.map(m => [m, pecasPorMes[m] || []])), escopo)
    if (filtroCliente) {
      const nc = norm(filtroCliente)
      rows = rows.filter(r => norm(r['Pessoa'] || '') === nc)
    }
    return rows
  }, [pecasPorMes, meses12, escopo, filtroCliente])

  // Data-âncora
  const dataMax = useMemo(() => {
    let max = -Infinity
    for (const r of rowsAll) if (r.dt instanceof Date) { const t = +r.dt; if (t > max) max = t }
    return max > -Infinity ? new Date(max) : new Date()
  }, [rowsAll])

  // Dias úteis
  const { diasMes, diasDec } = useMemo(() => {
    if (!mesAtivo) return { diasMes: 0, diasDec: 0 }
    const { mes, ano } = parseMesAno(mesAtivo)
    const feriados = feriadosPorUF(filtroEstado || '', ano)
    const refMes = rowsMes.reduce((mx, r) => (r.dt instanceof Date && +r.dt > mx ? +r.dt : mx), -Infinity)
    const refDate = refMes > -Infinity ? new Date(refMes) : new Date()
    return { diasMes: diasUteisMes(ano, mes, feriados), diasDec: diasUteisDecorridos(ano, mes, refDate, feriados) }
  }, [mesAtivo, filtroEstado, rowsMes])

  // ── GERAL: KPIs ───────────────────────────────────────────────────────────
  const realizado = useMemo(() => calcLiquido(rowsMes, 'ATACADO', diasDec, diasMes), [rowsMes, diasDec, diasMes])

  // Meta — suprimida quando sub-filtros ativos
  const metaAtacado = useMemo(() => {
    if (subFiltroAtivo) return 0
    const fp = (pecasPorMes[mesAtivo] || []).filter(r =>
      (!filtroLojas.length || filtroLojas.includes(r.empresa)) &&
      (!filtroEstado || lojas[r.empresa]?.uf === filtroEstado))
    const fo = (oficinaPorMes[mesAtivo] || []).filter(r =>
      (!filtroLojas.length || filtroLojas.includes(r.empresa)) &&
      (!filtroEstado || lojas[r.empresa]?.uf === filtroEstado))
    const rk = buildRanking(fp, fo, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes, diasDec, diasMes, apelidoMap,
      regras[mesAtivo]?.comissao, regras[mesAtivo]?.gestao || comissaoGestao, filtroLojas, filtroEstado, regras[mesAtivo]?.lojas || lojas)
    const rkPecas = rk.filter(c => c.tp > 0 || c.mp > 0 || c.devTotal > 0)
    return calcMetaPorCanal(rkPecas, 'ATACADO')
  }, [pecasPorMes, oficinaPorMes, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes, diasDec, diasMes, apelidoMap, regras, comissaoGestao, filtroLojas, filtroEstado, lojas, subFiltroAtivo])

  // Meta por mês para evolução 12m
  const metasPorMesCanal = useMemo(() => {
    if (subFiltroAtivo) return {}
    const out = {}
    for (const mes of meses12) {
      const fp = (pecasPorMes[mes] || []).filter(r =>
        (!filtroLojas.length || filtroLojas.includes(r.empresa)) &&
        (!filtroEstado || lojas[r.empresa]?.uf === filtroEstado))
      const fo = (oficinaPorMes[mes] || []).filter(r =>
        (!filtroLojas.length || filtroLojas.includes(r.empresa)) &&
        (!filtroEstado || lojas[r.empresa]?.uf === filtroEstado))
      const { mes: m, ano } = parseMesAno(mes)
      const feriados = feriadosPorUF(filtroEstado || '', ano)
      const dm = diasUteisMes(ano, m, feriados)
      const dd = mes === mesAtivo ? diasDec : dm
      const rk = buildRanking(fp, fo, mes, colaboradoresPorMes, metasPorMes, bonificacoes, dd, dm, apelidoMap,
        regras[mes]?.comissao, regras[mes]?.gestao || comissaoGestao, filtroLojas, filtroEstado, regras[mes]?.lojas || lojas)
      out[mes] = calcMetaPorCanal(rk.filter(c => c.tp > 0 || c.mp > 0 || c.devTotal > 0), 'ATACADO')
    }
    return out
  }, [pecasPorMes, oficinaPorMes, meses12, colaboradoresPorMes, metasPorMes, bonificacoes, diasDec, diasMes, apelidoMap, regras, comissaoGestao, filtroLojas, filtroEstado, lojas, mesAtivo, subFiltroAtivo])

  const evolucao = useMemo(() => evolucaoMeses(pecasPorMes, meses6, escopo), [pecasPorMes, meses6, escopo])

  // Evolução 12m com meta e margem
  const evolucao12 = useMemo(
    () => evolucao12mComMeta(pecasPorMes, meses12, escopo, metasPorMesCanal),
    [pecasPorMes, meses12, escopo, metasPorMesCanal]
  )

  // ── Datasets das sub-abas ─────────────────────────────────────────────────
  const clientes = useMemo(() => buildClientes(rowsMes), [rowsMes])
  const pecas    = useMemo(() => buildPecas(rowsMes), [rowsMes])
  const cobertura = useMemo(() => buildCobertura(rowsMes), [rowsMes])

  const inativos = useMemo(() => {
    const base = baseInatividade(rowsAll, dataMax)
    const { f1, f2, f3 } = faixasInatividade(base, atacadoConfig)
    const queda = quedaFrequencia(rowsAll, mesAtivo, atacadoConfig.quedaPct)
    return { f1, f2, f3, queda }
  }, [rowsAll, dataMax, atacadoConfig, mesAtivo])

  const nClientesMes = clientes.length
  const nCidades     = cobertura.length

  // ── Aba Geral: dados novos ────────────────────────────────────────────────

  // Margem do canal no mês
  const margemMes = useMemo(() => {
    const liq = rowsMes.filter(r => !r.eDevolucao).reduce((s, r) => s + (r.valor || 0), 0) -
                rowsMes.filter(r => r.eDevolucao).reduce((s, r) => s + Math.abs(r.valor || 0), 0)
    const custo = rowsMes.reduce((s, r) => s + (r.custo || 0), 0)
    return liq > 0 ? (liq - custo) / liq : 0
  }, [rowsMes])

  // Carteira e positivação
  const carteiraData = useMemo(
    () => clientesCarteira(rowsAll, mesAtivo, meses12),
    [rowsAll, mesAtivo, meses12]
  )

  // Novos e reativados
  const novosReat = useMemo(
    () => novosReativados(rowsAll, mesAtivo, atacadoConfig.corte1 || 30),
    [rowsAll, mesAtivo, atacadoConfig]
  )

  // Ticket médio
  const ticketMedio = useMemo(() => {
    const totFat = clientes.reduce((s, c) => s + c.faturamento, 0)
    const totCompras = clientes.reduce((s, c) => s + c.nCompras, 0)
    return totCompras > 0 ? totFat / totCompras : 0
  }, [clientes])

  // Itens por nota
  const itensPorNotaVal = useMemo(() => itensPorNota(rowsMes), [rowsMes])

  // Concentração top 10
  const concTop10 = useMemo(() => concentracaoTop10(clientes), [clientes])

  // Intervalos entre compras
  const intervalos = useMemo(() => intervaloComprasStats(rowsAll), [rowsAll])

  // Tipo de mercadoria agrupado
  const tipoMercData = useMemo(() => buildAgrupamento(rowsMes, 'tipoMercadoria'), [rowsMes])

  // Top 10 peças (usa buildAgrupamento)
  const top10Pecas = useMemo(() => buildAgrupamento(rowsMes, 'peca').slice(0, 10), [rowsMes])

  // Vendedores
  const colaboradoresMap = useMemo(() => {
    const map = {}
    const mesColab = colaboradoresPorMes?.[mesAtivo] || {}
    Object.values(mesColab).forEach(c => { if (c.colaborador || c.nome) map[norm(c.colaborador || c.nome)] = c })
    return map
  }, [colaboradoresPorMes, mesAtivo])

  const vendedoresMes = useMemo(() => buildVendedores(rowsMes, colaboradoresMap), [rowsMes, colaboradoresMap])
  const vendedores12m = useMemo(() => buildVendedores(rows12m, colaboradoresMap), [rows12m, colaboradoresMap])

  // Opções para os filtros extras
  const optsTipoMerc = useMemo(() => {
    const s = new Set()
    ;(pecasPorMes[mesAtivo] || []).forEach(r => { if (r.cat === 'ATACADO' && r.tipoMercadoria) s.add(r.tipoMercadoria) })
    return [...s].sort().map(v => ({ value: v, label: v }))
  }, [pecasPorMes, mesAtivo])

  const optsTipoMov = useMemo(() => {
    const s = new Set()
    ;(pecasPorMes[mesAtivo] || []).forEach(r => { const tipo=r.tipoMovimento||r.tipoMov; if (r.cat === 'ATACADO' && tipo) s.add(tipo) })
    return [...s].sort().map(v => ({ value: v, label: v }))
  }, [pecasPorMes, mesAtivo])

  const optsCidade = useMemo(() => {
    const s = new Set()
    ;(pecasPorMes[mesAtivo] || []).forEach(r => { if (r.cat === 'ATACADO' && r['Município']) s.add(r['Município'].trim()) })
    return [...s].sort().map(v => ({ value: v, label: v }))
  }, [pecasPorMes, mesAtivo])

  const optsCliente = useMemo(() => {
    const map = {}
    ;(pecasPorMes[mesAtivo] || []).forEach(r => {
      if (r.cat === 'ATACADO' && r['Pessoa']) {
        const k = norm(r['Pessoa'])
        if (!map[k]) map[k] = r['Pessoa']
      }
    })
    return Object.entries(map).sort(([, a], [, b]) => a.localeCompare(b)).map(([k, v]) => ({ value: v, label: v }))
  }, [pecasPorMes, mesAtivo])

  return {
    configError:configError||dataError, loading, role, isAdmin, mesesDisp, mesAtivo, setMes,
    filtroEstado, setEstado, filtroLojas, setLojas, busca, setBusca, temFiltro, limpar,
    lojas, diasMes, diasDec, dataMax, meses6, meses12,
    realizado, metaAtacado, evolucao, evolucao12, subFiltroAtivo,
    clientes, pecas, cobertura, inativos, nClientesMes, nCidades,
    rows6m, atacadoConfig, valLiq,
    // Aba Geral novos
    margemMes, carteiraData, novosReat, ticketMedio, itensPorNotaVal,
    concTop10, intervalos, tipoMercData, top10Pecas,
    vendedoresMes, vendedores12m,
    // Sub-filtros
    filtroTipoMerc, setFiltroTipoMerc,
    filtroTipoMov, setFiltroTipoMov,
    filtroCidade, setFiltroCidade,
    filtroCliente, setFiltroCliente,
    optsTipoMerc, optsTipoMov, optsCidade, optsCliente,
    rowsMes, temDados:rowsAll.length>0,
  }
}

