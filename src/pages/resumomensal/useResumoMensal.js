import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { LOJAS } from '../../data/regras.js'
import { mesAtualStr, sortMesAno } from '../../utils/datas.js'
import { parseCSV } from '../../services/processamento/parseCSV.js'
import { salvarConfig, carregarConfig } from '../../services/firestoreService.js'
import { carregarPosicaoMes, carregarRegrasEstoque } from '../../services/cloudStorage.js'
import { reprocessarCurvas } from '../../services/processamento/processarObsoleto.js'
import {
  calcularOficina, calcularPecas, calcularFuncionarios,
  processarMotocicletas, historicoOficina, historicoPecas,
} from './resumoMensal.logic.js'

const OPTS_ESTADO = [
  { value: 'AL', label: 'Alagoas' },
  { value: 'PE', label: 'Pernambuco' },
]

export function useResumoMensal() {
  const { oficinaPorMes, pecasPorMes, colaboradoresPorMes, ihsMapeamento, filtrosGlobais, setFiltrosGlobais } = useStore()
  const { user, role } = useAuth()
  const canEdit = role === 'admin' || role === 'coordenador'

  // ── Filtros (fonte única, ver filtrosSlice.js) ───────────────────────────
  const todosMeses = useMemo(() => {
    const set = new Set([
      ...Object.keys(oficinaPorMes),
      ...Object.keys(pecasPorMes),
    ])
    return [...set].sort(sortMesAno)
  }, [oficinaPorMes, pecasPorMes])

  const mesHoje   = mesAtualStr()
  const mesAtivo  = filtrosGlobais.mes
  const setMesAtivo = v => setFiltrosGlobais({ mes: v })

  const estadoSel = filtrosGlobais.estado
  const lojasSel  = filtrosGlobais.lojas
  const setLojasSel = v => setFiltrosGlobais({ lojas: v })

  // Estado limita as lojas disponíveis; ao trocar de estado, zera a seleção de lojas.
  const setEstado = (uf) => setFiltrosGlobais({ estado: uf, lojas: [] })

  const todasLojas = useMemo(() => {
    const set = new Set()
    Object.values(oficinaPorMes).forEach(rows => rows.forEach(r => r.empresa && set.add(r.empresa)))
    Object.values(pecasPorMes).forEach(rows  => rows.forEach(r => r.empresa && set.add(r.empresa)))
    return [...set].filter(l => !estadoSel || LOJAS[l]?.uf === estadoSel).sort()
  }, [oficinaPorMes, pecasPorMes, estadoSel])

  // ── Auto-calculados ────────────────────────────────────────────────────────
  const oficinaBase = useMemo(
    () => calcularOficina(oficinaPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento),
    [oficinaPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento]
  )

  const { por_canal, rmp_total, itensAtendidos, qtdePecas, qtdeOS } = useMemo(
    () => calcularPecas(pecasPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento),
    [pecasPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento]
  )

  const funcionarios = useMemo(
    () => calcularFuncionarios(colaboradoresPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento),
    [colaboradoresPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento]
  )

  // ── Histórico BI ──────────────────────────────────────────────────────────
  const histOficina = useMemo(
    () => historicoOficina(oficinaPorMes, lojasSel, estadoSel, ihsMapeamento),
    [oficinaPorMes, lojasSel, estadoSel, ihsMapeamento]
  )

  const histPecas = useMemo(
    () => historicoPecas(pecasPorMes, lojasSel, estadoSel, ihsMapeamento),
    [pecasPorMes, lojasSel, estadoSel, ihsMapeamento]
  )

  // ── Motocicletas (fotografia por mês, persistida no Firestore) ──────────────
  // O upload é a "foto" do mês selecionado. Guardamos as linhas cruas por mês
  // (com Empresa) para permitir filtrar por loja/estado e reabrir meses passados.
  const [motosPorMes, setMotosPorMes] = useState({})
  const [motoNome, setMotoNome]       = useState('')

  useEffect(() => {
    carregarConfig('resumoMotos').then(cfg => { if (cfg && typeof cfg === 'object') setMotosPorMes(cfg) }).catch(() => {})
  }, [])

  const motos = useMemo(
    () => processarMotocicletas(motosPorMes[mesAtivo] || [], lojasSel, estadoSel),
    [motosPorMes, mesAtivo, lojasSel, estadoSel]
  )

  const handleMotoUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMotoNome(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { rows } = parseCSV(ev.target.result)
        // Guarda só as colunas necessárias — mantém o doc enxuto.
        const enxutas = rows.map(r => ({
          Empresa:           r['Empresa']          || '',
          Quantidade:        r['Quantidade']       || '',
          Marca:             r['Marca']            || '',
          'Estado Veículo':  r['Estado Veículo']   || '',
        }))
        setMotosPorMes(prev => {
          const next = { ...prev, [mesAtivo]: enxutas }
          if (canEdit) salvarConfig('resumoMotos', next).catch(() => {})
          return next
        })
      } catch { /* arquivo inválido — ignora */ }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }, [mesAtivo, canEdit])

  // Rev. Entrega (0km) vem da venda de novos: injeta na linha rev_entrega da oficina.
  const oficina = useMemo(() => {
    const base = { ...oficinaBase }
    if (motos.novos > 0 || base.rev_entrega) {
      base.rev_entrega = {
        passagens:   motos.novos,
        mo:          oficinaBase.rev_entrega?.mo || 0,
        contabiliza: ihsMapeamento?.contabiliza_linhas_ihs?.rev_entrega !== false,
      }
    }
    return base
  }, [oficinaBase, motos, ihsMapeamento])

  // ── Estoque mês anterior ───────────────────────────────────────────────────
  // disponivel=false quando não há snapshot de estoque para o fim do mês anterior
  // ao mês ativo — evita mostrar "R$ 0,00" como se o estoque fosse zero de verdade.
  const [estoqueStats, setEstoqueStats] = useState({ valor31: 0, obsoleto: 0, disponivel: true })

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      try {
        const pos = await carregarPosicaoMes(mesAtivo)
        if (!pos || pos.semDado || !pos.itens?.length || cancelado) {
          if (!cancelado) setEstoqueStats({ valor31: 0, obsoleto: 0, disponivel: false })
          return
        }
        const regras = await carregarRegrasEstoque()
        const [mm, yyyy] = mesAtivo.split('/').map(Number)
        const dataRef = pos.congelado ? new Date(yyyy, mm, 0, 23, 59, 59) : new Date()
        let itens = reprocessarCurvas(pos.itens, regras || {}, dataRef)
        if (lojasSel.length > 0 || estadoSel) {
          itens = itens.filter(i => {
            if (lojasSel.length > 0 && !lojasSel.includes(i.loja)) return false
            if (estadoSel && LOJAS[i.loja]?.uf !== estadoSel) return false
            return true
          })
        }
        const f = ihsMapeamento?.pecas_filtro || {}
        const permitidos = new Set(Object.entries(f).filter(([, v]) => v === true).map(([k]) => k.toUpperCase().trim()))
        if (permitidos.size > 0) itens = itens.filter(i => permitidos.has((i.tipo || '').toUpperCase().trim()))
        const valor31  = itens.reduce((s, i) => s + (i.custoTotal || 0), 0)
        const obsoleto = itens.filter(i => i.status === 'CURVA_D' || i.status === 'CURVA_E').reduce((s, i) => s + (i.custoTotal || 0), 0)
        if (!cancelado) setEstoqueStats({ valor31, obsoleto, disponivel: true })
      } catch { if (!cancelado) setEstoqueStats({ valor31: 0, obsoleto: 0, disponivel: false }) }
    }
    carregar()
    return () => { cancelado = true }
  }, [mesAtivo, ihsMapeamento, lojasSel, estadoSel])

  // ── Campos manuais com autosave ────────────────────────────────────────────
  const MANUAL_OFICINA_VAZIO = { mo_hora: '', instalacoes: '', horarios: '', obs: '' }
  const MANUAL_PECAS_VAZIO   = { objetivo_vendas: '', itens_solicitados: '', obs: '' }

  const [manualOficina, setManualOficina] = useState(MANUAL_OFICINA_VAZIO)
  const [manualPecas,   setManualPecas]   = useState(MANUAL_PECAS_VAZIO)
  const manualCarregado = useRef(false)
  const saveTimer       = useRef(null)

  const chaveManual = useMemo(() => {
    const lojasPart = lojasSel.length > 0 ? lojasSel.join('_') : 'TODAS'
    return `resumoManual_${lojasPart}_${mesAtivo.replace('/', '-')}`
  }, [mesAtivo, lojasSel])

  // Carrega campos manuais ao trocar mês/loja
  useEffect(() => {
    manualCarregado.current = false
    carregarConfig(chaveManual)
      .then(cfg => {
        setManualOficina({ ...MANUAL_OFICINA_VAZIO, ...(cfg?.oficina || {}) })
        setManualPecas({ ...MANUAL_PECAS_VAZIO, ...(cfg?.pecas || {}) })
      })
      .catch(() => {
        setManualOficina(MANUAL_OFICINA_VAZIO)
        setManualPecas(MANUAL_PECAS_VAZIO)
      })
      .finally(() => { manualCarregado.current = true })
  }, [chaveManual])

  // Autosave com debounce de 800ms após edição
  useEffect(() => {
    if (!canEdit || !manualCarregado.current) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      salvarConfig(chaveManual, { oficina: manualOficina, pecas: manualPecas }).catch(() => {})
    }, 800)
    return () => clearTimeout(saveTimer.current)
  }, [manualOficina, manualPecas, chaveManual, canEdit])

  const atualizarManualOficina = (campo, val) => setManualOficina(s => ({ ...s, [campo]: val }))
  const atualizarManualPecas   = (campo, val) => setManualPecas(s => ({ ...s, [campo]: val }))

  return {
    // filtros
    todosMeses, mesAtivo, setMesAtivo,
    todasLojas, lojasSel, setLojasSel,
    estadoSel, setEstado, optsEstado: OPTS_ESTADO,
    // calculados
    oficina, por_canal, rmp_total, itensAtendidos, qtdePecas, qtdeOS, funcionarios,
    // estoque
    estoqueStats,
    // histórico BI
    histOficina, histPecas,
    // motos
    motos, motoNome, handleMotoUpload,
    // manuais
    manualOficina, atualizarManualOficina,
    manualPecas,   atualizarManualPecas,
    canEdit,
  }
}
