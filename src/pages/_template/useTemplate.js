/**
 * useTemplate — estado e dados da página.
 * Renomear para use[NomePagina].js ao copiar o template.
 *
 * Regras:
 *  ✅ Estado local (filtros, UI state) fica aqui
 *  ✅ Leitura do store Zustand fica aqui
 *  ✅ useMemo e useEffect ficam aqui
 *  ✅ Cálculos pesados chamam funções de template.logic.js
 *  ❌ Nunca retornar JSX daqui
 */

import { useState, useMemo } from 'react'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { mesAtualStr, sortMesAno, proximoMesStr } from '../../utils/datas.js'
import { calcularDados } from './template.logic.js'

export function useTemplate() {
  // ── Dados globais do store ────────────────────────────────────────────────
  const { pecasPorMes, oficinaPorMes, metasPorMes, loading } = useStore()
  const { role } = useAuth()

  // ── Filtros locais ────────────────────────────────────────────────────────
  const mesHoje   = mesAtualStr()
  const mesLimite = proximoMesStr(mesHoje)

  const [filtros, setFiltrosRaw] = useState({
    mes:  mesHoje,
    loja: '',
  })

  function setFiltros(patch) {
    setFiltrosRaw(prev => ({ ...prev, ...patch }))
  }

  // ── Meses disponíveis (union de peças + oficina) ──────────────────────────
  const mesesDisponiveis = useMemo(() => {
    const s = new Set([...Object.keys(pecasPorMes), ...Object.keys(oficinaPorMes)])
    s.add(mesHoje)
    return [...s].sort(sortMesAno).filter(m => sortMesAno(m, mesLimite) <= 0)
  }, [pecasPorMes, oficinaPorMes, mesHoje, mesLimite])

  // ── Dados brutos do mês selecionado ──────────────────────────────────────
  // Substitua `pecasPorMes` pela fonte certa para a página
  const dadosBrutos = useMemo(
    () => pecasPorMes[filtros.mes] || [],
    [pecasPorMes, filtros.mes]
  )

  // ── Lojas disponíveis no mês ──────────────────────────────────────────────
  const lojasDisponiveis = useMemo(
    () => [...new Set(dadosBrutos.map(r => r.loja).filter(Boolean))].sort(),
    [dadosBrutos]
  )

  // ── Cálculo principal (puro — sem efeitos) ────────────────────────────────
  const { dados, kpis } = useMemo(
    () => calcularDados(dadosBrutos, filtros),
    [dadosBrutos, filtros]
  )

  return {
    dados,
    kpis,
    filtros,
    setFiltros,
    mesesDisponiveis,
    lojasDisponiveis,
    loading,
    role,
  }
}
