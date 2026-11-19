import { useState, useMemo, useEffect, useRef } from 'react'
import {
  resumoEstoque, exportarEstoqueCSV, reprocessarCurvas,
  CURVA_META, THRESHOLDS_DEFAULT,
} from '../services/processamento/processarObsoleto.js'
import { listarMesesEstoque, carregarPosicaoMes, carregarRegrasEstoque } from '../services/cloudStorage.js'
import { fmtBRL2 as fmtBRL } from '../utils/formatacao.js'
import { EmptyState, FiltroDropdown, LoadingInline, FiltersBar, Divider, Chip } from '../components/DS.jsx'
import { ArrowLeftRight, Package } from '../icons/iconoir'
import { useAuth } from '../contexts/AuthContext.jsx'
import useStore from '../store.js'
import { LOJAS } from '../data/regras.js'
import { SeletorSnapshot } from './estoque/SeletorSnapshot.jsx'
import { AbaVisaoGeral }   from './estoque/AbaVisaoGeral.jsx'
import { AbaEstoque }      from './estoque/AbaEstoque.jsx'
import { AbaPromocoes }    from './estoque/AbaPromocoes.jsx'
import { AbaHistorico }    from './estoque/AbaHistorico.jsx'
import { AbaRegras }       from './estoque/AbaRegras.jsx'

export default function Estoque() {
  const { role } = useAuth()
  const { ultimasAtualizacoes, pecasPorMes, estoqueCache, setEstoqueCache, loadingHistorico, filtrosGlobais, setFiltrosGlobais } = useStore()
  const pecasStore = useMemo(() => Object.values(pecasPorMes).flat(), [pecasPorMes])
  const canEdit = role === 'admin'

  const cached = estoqueCache
  const [aba, setAba]                         = useState('visao')
  const [itens, setItens]                     = useState(cached?.itens || [])
  // mesAtivo continua local — representa o que está DE FATO carregado (itens/
  // histórico), diferente do filtro global que representa o que foi PEDIDO.
  // carregarMes() sempre grava os dois juntos; o efeito abaixo cobre o caso do
  // mês global mudar por causa de OUTRA página (Dashboard etc).
  const [mesAtivo, setMesAtivo]               = useState(cached?.mesAtivo || null)
  const [meses, setMeses]                     = useState(cached?.meses || [])
  const [historico, setHistorico]             = useState(cached?.historico || [])
  const historicoRef = useRef(cached?.historico || [])
  const [carregando, setCarregando]           = useState(false)
  const [inicializando, setInicializando]     = useState(!cached)
  const [thresholds, setThresholds]               = useState(cached?.thresholds || THRESHOLDS_DEFAULT)
  const [descontosPorTipo, setDescontosPorTipo]   = useState(cached?.descontosPorTipo || {})
  const [diasTransferiveis, setDiasTransferiveis] = useState(cached?.diasTransferiveis || 90)

  const estadoSel = filtrosGlobais.estado
  const lojasSel  = filtrosGlobais.lojas
  const setLojasSel = v => setFiltrosGlobais({ lojas: v })
  const [tiposSel, setTiposSel]     = useState([])
  const [curvasSel, setCurvasSel]   = useState([])
  const [soTransf, setSoTransf]     = useState(false)

  const todasLojas = useMemo(() => [...new Set(itens.map(r => r.loja))].filter(Boolean).sort(), [itens])
  const todosTipos = useMemo(() => [...new Set(itens.map(r => r.tipo))].filter(Boolean).sort(), [itens])

  const optsEstado = useMemo(() => {
    const ufs = new Set(todasLojas.map(l => LOJAS[l]?.uf).filter(Boolean))
    return [...ufs].sort().map(uf => ({
      value: uf,
      label: Object.values(LOJAS).find(l => l.uf === uf)?.estado || uf,
    }))
  }, [todasLojas])

  const lojasFiltradaEstado = useMemo(() =>
    estadoSel
      ? todasLojas.filter(l => LOJAS[l]?.uf === estadoSel)
      : todasLojas,
  [todasLojas, estadoSel])

  const optsLojas = lojasFiltradaEstado.map(l => ({ value: l, label: l }))
  const optsTipos = todosTipos.map(t => ({ value: t, label: t }))

  const itensFiltrados = useMemo(() => {
    let r = itens
    if (estadoSel) r = r.filter(i => LOJAS[i.loja]?.uf === estadoSel)
    if (lojasSel.length > 0) r = r.filter(i => lojasSel.includes(i.loja))
    if (tiposSel.length > 0) r = r.filter(i => tiposSel.includes(i.tipo))
    if (curvasSel.length > 0) r = r.filter(i => curvasSel.includes(i.status))
    return r
  }, [itens, estadoSel, lojasSel, tiposSel, curvasSel])

  const resumo = useMemo(() => itensFiltrados.length > 0 ? resumoEstoque(itensFiltrados) : null, [itensFiltrados])

  const tsAtual = ultimasAtualizacoes?.estoque || null
  useEffect(() => {
    if (!cached) { init(); return }
    if (tsAtual && cached.tsAtualizado !== tsAtual) { init(); return }
  }, [tsAtual])

  // Mês global mudou por causa de OUTRA página (ex: Dashboard) — sincroniza.
  // carregarMes() já grava de volta em filtrosGlobais.mes, então esse efeito
  // não reexecuta à toa depois (mesAtivo e filtrosGlobais.mes ficam iguais).
  useEffect(() => {
    if (inicializando || carregando) return
    if (filtrosGlobais.mes && filtrosGlobais.mes !== mesAtivo) carregarMes(filtrosGlobais.mes)
  }, [filtrosGlobais.mes, inicializando])

  async function init() {
    const [regras, lista] = await Promise.all([carregarRegrasEstoque(), listarMesesEstoque()])
    if (regras) {
      if (regras.curvaA !== undefined) setThresholds(regras)
      if (regras.descontosPorTipo) setDescontosPorTipo(regras.descontosPorTipo)
      if (regras.diasTransferiveis) setDiasTransferiveis(regras.diasTransferiveis)
    }
    setMeses(lista)
    // Preferir o mês globalmente selecionado, se já existir um snapshot pra
    // ele — mantém a página consistente com o resto do app ao navegar.
    const doFiltroGlobal = lista.find(m => m.mesAno === filtrosGlobais.mes && !m.semDado)
    const atual = doFiltroGlobal || lista.find(m => m.atual) || [...lista].reverse().find(m => !m.semDado)
    if (atual) await carregarMes(atual.mesAno, regras, lista)
    setInicializando(false)
  }

  function fimDoMes(mesAno) {
    const [m, a] = mesAno.split('/').map(Number)
    return new Date(a, m, 0, 23, 59, 59)
  }

  async function carregarMes(mesAno, regrasOverride, mesesOverride) {
    setCarregando(true)
    try {
      const pos = await carregarPosicaoMes(mesAno)
      if (!pos) return
      const t = regrasOverride?.curvaA !== undefined ? regrasOverride : thresholds
      if (pos.semDado) {
        setItens([])
        setMesAtivo(mesAno)
        setFiltrosGlobais({ mes: mesAno })
        historicoRef.current = [...historicoRef.current.filter(h => h.mesAno !== mesAno), { mesAno, dataISO: fimDoMes(mesAno).toISOString().slice(0, 10), resumo: null, itens: [], semDado: true }]
        setHistorico(historicoRef.current)
        return
      }
      const dataRefSnap = pos.congelado ? fimDoMes(mesAno) : new Date()
      const reprocessados = reprocessarCurvas(pos.itens || [], t, dataRefSnap)
      const res = resumoEstoque(reprocessados)
      const listaMeses = mesesOverride || meses
      setItens(reprocessados)
      setMesAtivo(mesAno)
      setFiltrosGlobais({ mes: mesAno })
      // O cache usa as regras recém-carregadas (init passa regrasOverride); antes
      // ele gravava descontos/janela do render anterior (closure obsoleta) e a
      // aba Promoções voltava sem descontos depois de um cache hit.
      const novoHist = [...historicoRef.current.filter(h => h.mesAno !== mesAno), {
        mesAno, dataISO: dataRefSnap.toISOString().slice(0, 10), resumo: res, itens: reprocessados, congelado: pos.congelado,
      }]
      historicoRef.current = novoHist
      setHistorico(novoHist)
      setEstoqueCache({
        meses: listaMeses,
        itens: reprocessados,
        mesAtivo: mesAno,
        historico: novoHist,
        thresholds: t,
        descontosPorTipo: regrasOverride?.descontosPorTipo ?? descontosPorTipo,
        diasTransferiveis: regrasOverride?.diasTransferiveis ?? diasTransferiveis,
        tsAtualizado: tsAtual,
      })
    } finally {
      setCarregando(false)
    }
  }

  function baixarCSV(lista, cols) {
    const itensExport = lista || itensFiltrados
    const csv   = exportarEstoqueCSV(itensExport, cols)
    const blob  = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href = url; a.download = `estoque_${(mesAtivo || 'export').replace('/', '-')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function clearFiltros() {
    setFiltrosGlobais({ estado: '', lojas: [] })
    setTiposSel([])
    setCurvasSel([])
    setSoTransf(false)
  }

  const optsCurvas = Object.entries(CURVA_META).map(([k, v]) => ({ value: k, label: v.label }))
  const temFiltro = estadoSel || lojasSel.length > 0 || tiposSel.length > 0 || curvasSel.length > 0 || soTransf

  const abas = [
    { key: 'visao',     label: 'Visão Geral' },
    { key: 'estoque',   label: 'Estoque'     },
    { key: 'promocoes', label: 'Promoções'   },
    { key: 'historico', label: 'Histórico'   },
    { key: 'regras',    label: 'Regras'      },
  ]

  const emptyProps = { icon: Package, title: 'Nenhum dado de estoque', sub: 'Importe um arquivo na página Upload para começar.' }

  return (
    <div className="page">
      <FiltersBar>
        {!inicializando && (
          meses.length > 0
            ? <SeletorSnapshot meses={meses} value={mesAtivo} onChange={mesAno => carregarMes(mesAno)} />
            : itens.length === 0 && <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>Nenhum dado — importe na página Upload</span>
        )}
        {(meses.length > 0 || optsEstado.length > 0) && <Divider />}
        {optsEstado.length > 1 && (
          <FiltroDropdown label="Estado" options={optsEstado} value={estadoSel} onChange={v => setFiltrosGlobais({ estado: v, lojas: [] })} />
        )}
        {optsLojas.length > 0 && (
          <FiltroDropdown label="Lojas" options={optsLojas} value={lojasSel} onChange={setLojasSel} multi />
        )}
        {optsTipos.length > 0 && (
          <FiltroDropdown label="Tipos" options={optsTipos} value={tiposSel} onChange={setTiposSel} multi />
        )}
        {aba === 'estoque' && (
          <FiltroDropdown label="Curva" options={optsCurvas} value={curvasSel} onChange={setCurvasSel} multi />
        )}
        {aba === 'estoque' && (
          <Chip
            icon={ArrowLeftRight}
            ativo={soTransf}
            onClick={() => setSoTransf(v => !v)}
          >
            Transferíveis
          </Chip>
        )}
        {temFiltro && (
          <button className="filter-clear" onClick={clearFiltros}>✕</button>
        )}
      </FiltersBar>

      <div className="tab-nav" style={{ marginBottom: 16 }}>
        {abas.map(a => (
          <button key={a.key} className={`tab-btn${aba === a.key ? ' active' : ''}`} onClick={() => setAba(a.key)}>
            {a.label}
          </button>
        ))}
      </div>

      {(inicializando || carregando) ? (
        <LoadingInline msg="Carregando estoque..." />
      ) : (
        <>
          {aba === 'visao'     && (itensFiltrados.length === 0 ? <EmptyState {...emptyProps} /> : <AbaVisaoGeral resumo={resumo} itens={itensFiltrados} historico={historico} thresholds={thresholds} pecas={pecasStore} onBaixar={baixarCSV} loadingHistorico={loadingHistorico} />)}
          {aba === 'estoque'   && (itensFiltrados.length === 0 ? <EmptyState {...emptyProps} /> : <AbaEstoque itens={itensFiltrados} pecas={pecasStore} diasJanela={diasTransferiveis} curvasSel={curvasSel} soTransf={soTransf} onBaixar={baixarCSV} />)}
          {aba === 'promocoes' && (itensFiltrados.length === 0 ? <EmptyState {...emptyProps} /> : <AbaPromocoes itens={itensFiltrados} descontosPorTipo={descontosPorTipo} onBaixar={baixarCSV} />)}
          {aba === 'historico' && <AbaHistorico historico={historico} meses={meses} onCarregar={carregarMes} pecas={pecasStore} estadoSel={estadoSel} lojasSel={lojasSel} tiposSel={tiposSel} />}
          {aba === 'regras'    && <AbaRegras thresholds={thresholds} setThresholds={setThresholds} descontosPorTipo={descontosPorTipo} setDescontosPorTipo={setDescontosPorTipo} diasTransferiveis={diasTransferiveis} setDiasTransferiveis={setDiasTransferiveis} todosTipos={todosTipos} canEdit={canEdit} />}
        </>
      )}
    </div>
  )
}
