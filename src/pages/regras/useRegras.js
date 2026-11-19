import { useMemo } from 'react'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { LOJAS } from '../../data/regras.js'
import { useConfirm } from '../../hooks/useConfirm.jsx'
import { sortMesAno, mesAtualStr, proximoMesStr } from '../../utils/datas.js'

export function useRegras() {
  const {
    regras, addMesRegras, removeMesRegras,
    updateRegraPeca, addRegraPeca, removeRegraPeca, renameRegraPeca,
    updateRegraOficina, addRegraOficina, removeRegraOficina, renameRegraOficina,
    updateLoja, addLoja,
    updateComissaoOp, addComissaoOp, removeComissaoOp,
    updateComissaoGestao, addComissaoGestao, removeComissaoGestao,
    filtrosGlobais, setFiltrosGlobais, filtrosRegras, setFiltrosRegras,
    ihsMapeamento, updateIhs, addIhs, removeIhs,
  } = useStore()
  const { role } = useAuth()
  const { confirm, modal: confirmModal } = useConfirm()

  const canEdit      = role === 'admin'
  const mesHoje      = mesAtualStr()
  const mesLimite    = proximoMesStr(mesHoje)
  const mesesDisp    = Object.keys(regras).sort(sortMesAno).filter(m => sortMesAno(m, mesLimite) <= 0)

  // mes/estado vêm da fonte única (filtrosGlobais); loja (seletor de UMA loja
  // pra configurar) e aba são específicos desta tela (filtrosRegras).
  const filtroMes    = filtrosGlobais.mes
  const filtroEstado = filtrosGlobais.estado
  const filtroLoja   = filtrosRegras.loja
  const aba          = filtrosRegras.aba

  const setFiltroEstado = v => { setFiltrosGlobais({ estado: v, lojas: [] }); setFiltrosRegras({ loja: '' }) }
  const setFiltroLoja   = v => setFiltrosRegras({ loja: v })
  const setAba          = v => setFiltrosRegras({ aba: v })

  function setFiltroMes(v) {
    if (v && !regras[v]) addMesRegras(v)
    setFiltrosGlobais({ mes: v })
  }

  const mesAtivo = filtroMes || (mesesDisp.includes(mesHoje) ? mesHoje : mesesDisp[mesesDisp.length - 1]) || ''
  const mesData  = regras[mesAtivo] || {}

  const estadoOpts = useMemo(() => {
    const ufs = [...new Set(Object.values(LOJAS).map(v => v.uf))].sort()
    return ufs.map(uf => ({ value: uf, label: uf }))
  }, [])

  const lojasDisp = useMemo(() =>
    Object.entries(LOJAS)
      .filter(([, v]) => !filtroEstado || v.uf === filtroEstado)
      .sort(([a], [b]) => a.localeCompare(b))
  , [filtroEstado])

  const lojaOpts = useMemo(() =>
    lojasDisp.map(([k, v]) => ({ value: k, label: `${k} – ${v.un}` }))
  , [lojasDisp])

  const temFiltro  = filtroEstado || filtroLoja
  const clearFiltros = () => { setFiltrosGlobais({ estado: '' }); setFiltrosRegras({ loja: '' }) }

  async function removerMes() {
    if (await confirm(`Remover ${mesAtivo}?`)) {
      removeMesRegras(mesAtivo)
      setFiltrosGlobais({ mes: mesHoje })
    }
  }

  return {
    canEdit, mesHoje, mesAtivo, mesData, mesesDisp,
    filtroMes, filtroEstado, filtroLoja, aba,
    setFiltroMes, setFiltroEstado, setFiltroLoja, setAba,
    estadoOpts, lojaOpts, temFiltro, clearFiltros,
    removerMes, confirmModal,
    updateRegraPeca, addRegraPeca, removeRegraPeca, renameRegraPeca,
    updateRegraOficina, addRegraOficina, removeRegraOficina, renameRegraOficina,
    updateLoja, addLoja,
    updateComissaoOp, addComissaoOp, removeComissaoOp,
    updateComissaoGestao, addComissaoGestao, removeComissaoGestao,
    ihsMapeamento, updateIhs, addIhs, removeIhs,
  }
}
