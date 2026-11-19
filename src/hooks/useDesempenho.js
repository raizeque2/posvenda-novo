import { latestDate, monthProgress, personMonth } from '../analytics/personal.js'
import { useMemo } from 'react'
import useStore from '../store.js'
import { buildRanking } from '../services/ranking/buildRanking.js'
import { norm, resolveNome } from '../utils/normalizacao.js'
import { mesAtualStr, sortMesAno } from '../utils/datas.js'
import { LOJAS } from '../data/regras.js'
import { Medal, Target, TrendingUp, TriangleAlert, Flame, ArrowUp, ArrowDown, Star } from 'lucide-react'

export function useDesempenho(nomeInput, includeHistory = true) {
  // Seletores campo a campo: sem assinar o store inteiro, este hook não
  // recalcula ranking/histórico quando só um filtro ou um upload mudou.
  const pecasPorMes = useStore(s => s.pecasPorMes)
  const oficinaPorMes = useStore(s => s.oficinaPorMes)
  const colaboradoresPorMes = useStore(s => s.colaboradoresPorMes)
  const metasPorMes = useStore(s => s.metasPorMes)
  const regras = useStore(s => s.regras)
  const comissaoGestao = useStore(s => s.comissaoGestao)
  const bonificacoes = useStore(s => s.bonificacoes)
  const apelidoMap = useStore(s => s.apelidoMap)
  const lojas = useStore(s => s.lojas)
  const state = useMemo(() => ({ pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, regras, comissaoGestao, bonificacoes, apelidoMap, lojas }), [pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, regras, comissaoGestao, bonificacoes, apelidoMap, lojas])

  const mesAtivo = mesAtualStr()

  const nomeResolvido = useMemo(
    () => resolveNome(nomeInput, apelidoMap) || nomeInput || '',
    [nomeInput, apelidoMap],
  )
  const nomeNorm = useMemo(() => norm(nomeResolvido), [nomeResolvido])

  // ── Registros brutos desta pessoa ──────────────────────────────────────────
  const minhasPecas = useMemo(
    () => Object.values(pecasPorMes).flat().filter(r => norm(resolveNome(r.responsavel, apelidoMap)) === nomeNorm),
    [pecasPorMes, nomeNorm, apelidoMap],
  )
  const minhaOficina = useMemo(
    () => Object.values(oficinaPorMes).flat().filter(r =>
      norm(resolveNome(r.consultor, apelidoMap)) === nomeNorm ||
      norm(resolveNome(r.tecnico,   apelidoMap)) === nomeNorm),
    [oficinaPorMes, nomeNorm, apelidoMap],
  )

  const ehConsultor = useMemo(
    () => minhaOficina.some(r => norm(resolveNome(r.consultor, apelidoMap)) === nomeNorm),
    [minhaOficina, nomeNorm, apelidoMap],
  )
  const ehMecanico = useMemo(
    () => minhaOficina.some(r =>
      norm(resolveNome(r.tecnico,   apelidoMap)) === nomeNorm &&
      norm(resolveNome(r.consultor, apelidoMap)) !== nomeNorm),
    [minhaOficina, nomeNorm, apelidoMap],
  )
  const temPecas   = minhasPecas.some(r => ['VAREJO','ATACADO','WEB','TELEVENDAS'].includes(r.cat))
  const temOficina = minhaOficina.length > 0

  // ── Mês corrente ──────────────────────────────────────────────────────────
  const pecasMes   = useMemo(() => minhasPecas.filter(r => r.mes === mesAtivo && ['VAREJO','ATACADO','WEB','TELEVENDAS'].includes(r.cat)),   [minhasPecas,   mesAtivo])
  const oficinaMes = useMemo(() => minhaOficina.filter(r => r.mes === mesAtivo),  [minhaOficina,  mesAtivo])

  // ── UF principal ─────────────────────────────────────────────────────────
  const ufPrincipal = useMemo(() => {
    for (const r of [...minhasPecas, ...minhaOficina]) {
      const uf = (lojas[r.empresa] || LOJAS[r.empresa])?.uf
      if (uf) return uf
    }
    return ''
  }, [minhasPecas, minhaOficina, lojas])

  // ── Dias úteis do mês ────────────────────────────────────────────────────
  const { diasMes, diasDec } = useMemo(() => {
    const cutoff=latestDate([...(pecasPorMes[mesAtivo]||[]),...(oficinaPorMes[mesAtivo]||[])])
    const progress=monthProgress(mesAtivo,cutoff,ufPrincipal)
    return {diasMes:progress.total,diasDec:progress.elapsed}
  }, [mesAtivo, pecasPorMes, oficinaPorMes, ufPrincipal])

  // ── Ranking do mês atual (mesmo estado) ──────────────────────────────────
  const ranking = useMemo(() => {
    const fp = (pecasPorMes[mesAtivo] || []).filter(r => !ufPrincipal || (lojas[r.empresa] || LOJAS[r.empresa])?.uf === ufPrincipal)
    const fo = (oficinaPorMes[mesAtivo] || []).filter(r => !ufPrincipal || (lojas[r.empresa] || LOJAS[r.empresa])?.uf === ufPrincipal)
    return buildRanking(fp, fo, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes, diasDec, diasMes, apelidoMap,
      regras[mesAtivo]?.comissao, regras[mesAtivo]?.gestao || comissaoGestao)
  }, [pecasPorMes, oficinaPorMes, mesAtivo, ufPrincipal, colaboradoresPorMes, metasPorMes, bonificacoes, diasDec, diasMes, apelidoMap, regras, comissaoGestao, lojas])

  const meuEntry = useMemo(() => ranking.find(c => norm(c.nome) === nomeNorm), [ranking, nomeNorm])

  // ── Posição no ranking ────────────────────────────────────────────────────
  const posicaoPecas = useMemo(() => {
    if (!temPecas) return null
    const sorted = [...ranking].filter(c => c.tpBruto > 0 || c.tp > 0).sort((a, b) => b.tp - a.tp)
    const idx = sorted.findIndex(c => norm(c.nome) === nomeNorm)
    return idx >= 0 ? idx + 1 : null
  }, [ranking, nomeNorm, temPecas])

  const posicaoOficina = useMemo(() => {
    if (!ehConsultor && !ehMecanico) return null
    const filterFn = ehConsultor ? (c => c.ehConsultor) : (c => c.ehTecnico)
    const sorted = [...ranking].filter(filterFn).sort((a, b) => (b[ehConsultor?'morealCons':'morealTec']||0) - (a[ehConsultor?'morealCons':'morealTec']||0))
    const idx = sorted.findIndex(c => norm(c.nome) === nomeNorm)
    return idx >= 0 ? idx + 1 : null
  }, [ranking, nomeNorm, ehConsultor, ehMecanico])

  const totalNaDisputa = useMemo(() => {
    if (temPecas) return ranking.filter(c => c.tpBruto > 0 || c.tp > 0).length
    if (ehConsultor) return ranking.filter(c => c.ehConsultor).length
    if (ehMecanico)  return ranking.filter(c => c.ehTecnico).length
    return 0
  }, [ranking, temPecas, ehConsultor, ehMecanico])

  // ── KPIs peças ───────────────────────────────────────────────────────────
  const kpiPecas = useMemo(() => {
    const vendas    = pecasMes.filter(r => !r.eDevolucao)
    const devol     = pecasMes.filter(r =>  r.eDevolucao)
    const bruto     = vendas.reduce((s, r) => s + (r.valor || 0), 0)
    const devolTotal = devol.reduce((s, r) => s + Math.abs(r.valor || 0), 0)
    const liquido   = bruto - devolTotal
    const meta      = meuEntry?.mp || 0
    const pct       = meta > 0 ? liquido / meta : null
    const proj      = diasDec > 0 ? (liquido / diasDec) * diasMes : 0
    const nVendas   = vendas.length
    const ticket    = nVendas > 0 ? bruto / nVendas : 0
    return { bruto, devolTotal, liquido, meta, pct, proj, nVendas, ticket }
  }, [pecasMes, meuEntry, diasDec, diasMes])

  // ── KPIs oficina ─────────────────────────────────────────────────────────
  const kpiOficina = useMemo(() => {
    const moReal  = ehConsultor ? (meuEntry?.morealCons ?? meuEntry?.moreal ?? 0) : (meuEntry?.morealTec ?? meuEntry?.moreal ?? 0)
    const moMeta  = meuEntry?.mo  || 0
    const poReal  = (meuEntry?.pocoficina || 0) - (meuEntry?.devPocoficina || 0)
    const poMeta  = meuEntry?.mpo || 0
    const passagens = meuEntry?.passagens || 0
    const pctMO   = moMeta > 0 ? moReal / moMeta : null
    const projMO  = diasDec > 0 ? (moReal / diasDec) * diasMes : 0
    return { moReal, moMeta, poReal, poMeta, passagens, pctMO, projMO }
  }, [meuEntry, ehConsultor, diasDec, diasMes])

  // ── Histórico mensal ─────────────────────────────────────────────────────
  const mesesDisp = useMemo(() => {
    const s = new Set([...minhasPecas, ...minhaOficina].map(r => r.mes).filter(Boolean))
    return [...s].sort(sortMesAno)
  }, [minhasPecas, minhaOficina])

  const historico = useMemo(() => !includeHistory ? [] : mesesDisp.map(m => {
    const fp  = pecasPorMes[m]   || []
    const fo  = oficinaPorMes[m] || []
    const rk  = buildRanking(fp, fo, m, colaboradoresPorMes, metasPorMes, bonificacoes, undefined, undefined, apelidoMap, regras[m]?.comissao, regras[m]?.gestao || comissaoGestao)
    const ent = rk.find(c => norm(c.nome) === nomeNorm)
    if (!ent) return null
    const meta  = (temPecas ? ent.mp : ent.mo) || 0
    const real  =  temPecas ? ent.tp : (ehConsultor ? ent.morealCons : ent.morealTec) || 0
    const bateu = meta > 0 && real >= meta
    return { mes: m, real, meta, bateu, comissao: ent.comTotal || 0, pct: meta > 0 ? real / meta : null }
  }).filter(Boolean), [mesesDisp, pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, bonificacoes, regras, comissaoGestao, nomeNorm, temPecas, apelidoMap, ehConsultor, includeHistory])

  // ── Evolução diária acumulada (mês corrente) ──────────────────────────────
  const personal = useMemo(()=>personMonth(state,nomeResolvido,mesAtivo,'mp'),[state,nomeResolvido,mesAtivo])
  const vendasPorDia = personal.calendar.filter(p=>p.observed).map(p=>({dia:p.day,diario:p.amount,acumulado:p.real}))
  const metaDiaria = personal.calendar.filter(p=>p.observed).map(p=>({dia:p.day,metaAcum:p.target}))

  // ── Vendas por categoria ──────────────────────────────────────────────────
  const porCategoria = useMemo(() => {
    const map = {}
    pecasMes.filter(r => !r.eDevolucao).forEach(r => {
      if (r.cat && r.cat !== 'OFICINA' && r.cat !== 'OFICINA_INT') {
        map[r.cat] = (map[r.cat] || 0) + (r.valor || 0)
      }
    })
    return Object.entries(map)
      .map(([cat, valor]) => ({ cat, valor }))
      .sort((a, b) => b.valor - a.valor)
  }, [pecasMes])

  // ── Vendas por dia da semana ──────────────────────────────────────────────
  const porDiaSemana = useMemo(() => {
    const map = [0, 0, 0, 0, 0, 0, 0]
    pecasMes.filter(r => r.dt instanceof Date && !r.eDevolucao).forEach(r => {
      map[r.dt.getDay()] += r.valor || 0
    })
    return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((nome, i) => ({ nome, valor: map[i] }))
  }, [pecasMes])

  // ── Tipos de movimento (proxy para mix de vendas) ────────────────────────
  const porTipoMov = useMemo(() => {
    const map = {}
    pecasMes.filter(r => !r.eDevolucao).forEach(r => {
      if (r.tipoMov) map[r.tipoMov] = (map[r.tipoMov] || 0) + (r.valor || 0)
    })
    return Object.entries(map)
      .map(([tipo, valor]) => ({ tipo, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10)
  }, [pecasMes])

  // ── Lista de vendas individuais ───────────────────────────────────────────
  const listaVendas = useMemo(() =>
    [...pecasMes]
      .filter(r => r.dt instanceof Date)
      .sort((a, b) => b.dt - a.dt),
    [pecasMes],
  )

  // ── Badges gamificados ────────────────────────────────────────────────────
  const badges = useMemo(() => {
    const b = []
    const pos = posicaoPecas || posicaoOficina

    if      (pos === 1) b.push({ icon: Medal, label: '1º Lugar',  cor: '#f59e0b' })
    else if (pos === 2) b.push({ icon: Medal, label: '2º Lugar',  cor: 'var(--text3)' })
    else if (pos === 3) b.push({ icon: Medal, label: '3º Lugar',  cor: '#cd7f32' })

    const pct = kpiPecas.pct ?? kpiOficina.pctMO
    if      (pct !== null && pct >= 1.0) b.push({ icon: Target,       label: 'Meta Batida',   cor: 'var(--green)' })
    else if (pct !== null && pct >= 0.85) b.push({ icon: TrendingUp,  label: 'Na Rota',      cor: 'var(--honda)' })
    else if (pct !== null && pct < 0.7)  b.push({ icon: TriangleAlert, label: 'Atenção',      cor: 'var(--red)'   })

    const ultimos3 = historico.slice(-3)
    if (ultimos3.length === 3 && ultimos3.every(h => h.bateu))
      b.push({ icon: Flame, label: 'Sequência 3x', cor: '#f97316' })

    if (historico.length >= 2 && diasDec >= diasMes) {
      const anterior = historico.filter(h=>sortMesAno(h.mes,mesAtivo)<0).at(-1)
      if(!anterior)return b
      const realAtual = temPecas ? kpiPecas.liquido : kpiOficina.moReal
      const pctDiff = anterior.real > 0 ? (realAtual - anterior.real) / anterior.real : 0
      if      (pctDiff > 0.15) b.push({ icon: ArrowUp,   label: `+${(pctDiff * 100).toFixed(0)}% vs mês ant.`, cor: 'var(--green)' })
      else if (pctDiff < -0.15) b.push({ icon: ArrowDown, label: `${(pctDiff * 100).toFixed(0)}% vs mês ant.`, cor: 'var(--red)'   })
    }

    const realAtual = temPecas ? kpiPecas.liquido : kpiOficina.moReal
    const melhor = historico.length ? Math.max(...historico.slice(0, -1).map(h => h.real)) : 0
    if (realAtual > 0 && melhor > 0 && realAtual > melhor)
      b.push({ icon: Star, label: 'Recorde Pessoal', cor: '#f59e0b' })

    return b
  }, [posicaoPecas, posicaoOficina, kpiPecas, kpiOficina, historico, temPecas, diasDec, diasMes, mesAtivo])

  return {
    nomeResolvido, nomeNorm,
    temPecas, temOficina, ehConsultor, ehMecanico,
    ufPrincipal,
    mesAtivo,
    diasMes, diasDec,
    posicaoPecas, posicaoOficina, totalNaDisputa,
    meuEntry,
    kpiPecas, kpiOficina,
    historico,
    vendasPorDia, metaDiaria,
    porCategoria, porDiaSemana, porTipoMov,
    listaVendas,
    badges,
  }
}
