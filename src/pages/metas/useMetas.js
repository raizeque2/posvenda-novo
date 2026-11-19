import { useState, useMemo, useEffect, useRef } from 'react'
import useStore from '../../store.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { LOJAS } from '../../data/regras.js'
import { useToast } from '../../hooks/useToast.jsx'
import { sortMesAno, mesAtualStr, proximoMesStr, getMes } from '../../utils/datas.js'
import { norm, resolveNome, supervisoresDisponiveis, listaSupervisores } from '../../utils/normalizacao.js'
import {
  CANAIS_PECAS, CANAIS_OFICINA, SETORES_PECAS, SETORES_OFICINA,
  SECOES_PECAS, SECOES_OFICINA, getSecaoOficina, getMetaCanal,
} from './metas.logic.js'

export function useMetas() {
  const {
    colaboradoresPorMes, metasPorMes, substituirMetasMes,
    filtrosGlobais, setFiltrosGlobais,
    pecasPorMes, oficinaPorMes, apelidoMap,
  } = useStore()
  const { role, nome } = useAuth()
  // Admin grava tudo; supervisor e coordenador gravam a equipe pelo servidor (gestaoEquipe),
  // que confere o escopo de novo. Ninguém edita a própria meta.
  const gestor = ['coordenador', 'supervisor'].includes(role)
  const soLeitura = role !== 'admin' && !gestor
  const podeEditar = c => role === 'admin' || (gestor && !!nome && norm(c.colaborador) !== norm(nome)
    && (role === 'coordenador' || listaSupervisores(c.supervisor).some(s => norm(s) === norm(nome))))
  const toast = useToast()

  const mesHoje   = mesAtualStr()
  const mesLimite = proximoMesStr(mesHoje)
  const [fator,            setFator]          = useState(0)
  const [rascunho,         setRascunho]       = useState({})
  const [salvando,         setSalvando]       = useState(false)
  const [salvo,            setSalvo]          = useState(false)
  const [abaAtiva,         setAbaAtiva]       = useState('pecas')
  const [colapsadas,       setColapsadas]     = useState(new Set())
  const [sortsMap,         setSortsMap]       = useState({})
  const inputRefs = useRef({})

  // Filtros — fonte única (ver filtrosSlice.js). Nome/cargo/supervisor eram
  // estado local só desta página; agora são compartilhados com Colaboradores,
  // Comissões, Dashboard e Equipes.
  const filtroEstado     = filtrosGlobais.estado || ''
  const filtroLojas      = filtrosGlobais.lojas  || []
  const filtroMes        = filtrosGlobais.mes    || ''
  const filtroNome       = filtrosGlobais.busca
  const filtroCargo      = filtrosGlobais.cargo
  const filtroSupervisor = filtrosGlobais.supervisor
  const setFiltroNome       = v => setFiltrosGlobais({ busca: v })
  const setFiltroCargo      = v => setFiltrosGlobais({ cargo: v })
  const setFiltroSupervisor = v => setFiltrosGlobais({ supervisor: v })
  const mesAtivo     = filtroMes
    || (Object.keys(colaboradoresPorMes).sort(sortMesAno).includes(mesHoje) ? mesHoje : Object.keys(colaboradoresPorMes).sort(sortMesAno).slice(-1)[0])
    || mesHoje

  function setFiltroMes(v) {
    setFiltrosGlobais({ mes: v })
  }

  function toggleSecao(key) {
    setColapsadas(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function handleSortSecao(secKey, col, shiftKey = false) {
    setSortsMap(prev => {
      const sorts = prev[secKey] || [{ col: 'loja', dir: 'asc' }]
      const idx   = sorts.findIndex(s => s.col === col)
      let next
      if (!shiftKey) {
        next = sorts.length > 0 && sorts[0].col === col
          ? [{ col, dir: sorts[0].dir === 'asc' ? 'desc' : 'asc' }]
          : [{ col, dir: 'asc' }]
      } else {
        if (idx === -1) next = [...sorts, { col, dir: 'asc' }]
        else { next = [...sorts]; next[idx] = { col, dir: next[idx].dir === 'asc' ? 'desc' : 'asc' } }
      }
      return { ...prev, [secKey]: next }
    })
  }

  // Mês atual e seguinte já nascem prontos em colaboradoresPorMes (ver
  // inicializarColaboradoresAutomatico) — não precisa mais forçar mesLimite
  // aqui, só um fallback pro mês corrente antes do load completar.
  const mesesDisp = useMemo(() => {
    const keys = new Set(Object.keys(colaboradoresPorMes))
    keys.add(mesHoje)
    return [...keys].sort(sortMesAno).filter(m => sortMesAno(m, mesLimite) <= 0)
  }, [colaboradoresPorMes, mesHoje, mesLimite])

  const mesesHist = useMemo(() => {
    const [ma, aa] = mesAtivo.split('/').map(Number)
    return mesesDisp.filter(m => {
      const [mm, am] = m.split('/').map(Number)
      return am * 12 + mm < aa * 12 + ma
    }).slice(-6)
  }, [mesesDisp, mesAtivo])

  const mesAnoAnterior = useMemo(() => {
    const [ma, aa] = mesAtivo.split('/').map(Number)
    return `${String(ma).padStart(2, '0')}/${aa - 1}`
  }, [mesAtivo])

  // Merge cadastral + meta por colaborador para exibição e edição de metas
  const colaboradoresMesMerged = useMemo(() => {
    const cadastro = colaboradoresPorMes[mesAtivo] || {}
    const metas    = metasPorMes[mesAtivo] || {}
    return Object.values(cadastro).map(c => ({ ...c, ...(metas[c.colaborador] || {}) }))
  }, [colaboradoresPorMes, metasPorMes, mesAtivo])

  const colaboradores = useMemo(() => {
    return colaboradoresMesMerged
      .filter(c => !filtroEstado || LOJAS[c.loja]?.uf === filtroEstado)
      .filter(c => !filtroLojas.length || filtroLojas.includes(c.loja))
      .filter(c => {
        const temMeta = c.metas
          ? Object.values(c.metas).some(m => (m.mp || 0) > 0 || (m.mo || 0) > 0 || (m.mpo || 0) > 0)
          : Number(c.mp || 0) > 0 || Number(c.mo || 0) > 0 || Number(c.mpo || 0) > 0
        const temSetor = (c.cargo_movimento || '').trim().length > 0
          && !['ADMINISTRATIVO', ''].includes((c.cargo_movimento || '').trim().toUpperCase())
        return temMeta || temSetor
      })
      .filter(c => !filtroNome || c.colaborador.toLowerCase().includes(filtroNome.toLowerCase()))
      .filter(c => filtroCargo.length === 0 || filtroCargo.includes(c.cargo?.toUpperCase()))
      .filter(c => !filtroSupervisor || listaSupervisores(c.supervisor).includes(filtroSupervisor))
  }, [colaboradoresMesMerged, filtroEstado, filtroLojas, filtroNome, filtroCargo, filtroSupervisor])

  const pecasMap = useMemo(() => {
    const map = {}
    const CATS = new Set(['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS'])
    Object.values(pecasPorMes).forEach(rows => rows.forEach(r => {
      if (!r.responsavel || !r.dt || !CATS.has(r.cat)) return
      const mes = getMes(r.dt)
      const key = `${mes}||${norm(resolveNome(r.responsavel, apelidoMap) || r.responsavel)}`
      map[key] = (map[key] || 0) + (r.eDevolucao ? -Math.abs(r.valor) : r.valor)
    }))
    return map
  }, [pecasPorMes, apelidoMap])

  const ofcMOMap = useMemo(() => {
    const map = {}
    Object.values(oficinaPorMes).forEach(rows => rows.forEach(r => {
      if (!r.dt) return
      const mes = getMes(r.dt)
      if (r.consultor) {
        const key = `${mes}||${norm(resolveNome(r.consultor, apelidoMap) || r.consultor)}`
        map[key] = (map[key] || 0) + (r.mo || 0)
      }
      if (r.tecnico && r.tecnico !== r.consultor) {
        const key = `${mes}||${norm(resolveNome(r.tecnico, apelidoMap) || r.tecnico)}`
        map[key] = (map[key] || 0) + (r.mo || 0)
      }
    }))
    return map
  }, [oficinaPorMes, apelidoMap])

  const ofcMPOMap = useMemo(() => {
    const map = {}
    Object.values(pecasPorMes).forEach(rows => rows.forEach(r => {
      if (!r.dt || !['OFICINA', 'OFICINA_INT', 'OFICINA_GAR', 'OFICINA_SEG'].includes(r.cat)) return
      const mes = getMes(r.dt)
      const val = r.eDevolucao ? -Math.abs(r.valor) : r.valor
      if (r.responsavel) {
        const key = `${mes}||${norm(resolveNome(r.responsavel, apelidoMap) || r.responsavel)}`
        map[key] = (map[key] || 0) + val
      }
      if (r.tecnico) {
        const key = `${mes}||${norm(resolveNome(r.tecnico, apelidoMap) || r.tecnico)}`
        map[key] = (map[key] || 0) + val
      }
    }))
    return map
  }, [pecasPorMes, apelidoMap])

  function getRealizado(c, campo, mes) {
    const key = `${mes}||${norm(c.colaborador)}`
    if (campo === 'mp')  return pecasMap[key]  || 0
    if (campo === 'mo')  return ofcMOMap[key]  || 0
    if (campo === 'mpo') return ofcMPOMap[key] || 0
    return 0
  }

  function calcSugestao(c, campo) {
    const vals = mesesHist.map(m => getRealizado(c, campo, m)).filter(v => v > 0)
    if (!vals.length) return 0
    const sorted = [...vals].sort((a, b) => a - b)
    const mid    = Math.floor(sorted.length / 2)
    const mediana = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    return Math.round(mediana * (1 + fator) / 500) * 500
  }

  function getSugestao(c, canal) { return calcSugestao(c, canal.key) }

  useEffect(() => {
    setRascunho({})
  }, [mesAtivo])

  function handleKeyDown(e, colabIdx, cIdx, todosVisiveis, canais, secaoKey) {
    if (e.key === 'Tab') {
      e.preventDefault()
      if (cIdx + 1 < canais.length)
        inputRefs.current[`${todosVisiveis[colabIdx].colaborador}||${secaoKey}||${canais[cIdx + 1].key}`]?.focus()
      else if (colabIdx + 1 < todosVisiveis.length)
        inputRefs.current[`${todosVisiveis[colabIdx + 1].colaborador}||${secaoKey}||${canais[0].key}`]?.focus()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (colabIdx + 1 < todosVisiveis.length)
        inputRefs.current[`${todosVisiveis[colabIdx + 1].colaborador}||${secaoKey}||${canais[cIdx].key}`]?.focus()
    }
  }

  function aplicarSugestoes() {
    setRascunho(prev => {
      const draft = JSON.parse(JSON.stringify(prev))
      colaboradores.forEach(c => {
        const canaisList = (c.cargo_movimento || '').split(';').map(s => s.trim()).filter(Boolean)
        canaisList.forEach(canal => {
          const curCanal = draft[c.colaborador]?.[canal] || {}
          const mp  = (curCanal.mp  ?? getMetaCanal(c, canal, 'mp'))  || 0
          const mo  = (curCanal.mo  ?? getMetaCanal(c, canal, 'mo'))  || 0
          const mpo = (curCanal.mpo ?? getMetaCanal(c, canal, 'mpo')) || 0
          const newMp  = mp  || calcSugestao(c, 'mp')
          const newMo  = mo  || calcSugestao(c, 'mo')
          const newMpo = mpo || calcSugestao(c, 'mpo')
          if (newMp !== mp || newMo !== mo || newMpo !== mpo) {
            if (!draft[c.colaborador]) draft[c.colaborador] = {}
            draft[c.colaborador][canal] = { mp: newMp, mo: newMo, mpo: newMpo }
          }
        })
      })
      return draft
    })
  }

  async function salvarTudo() {
    setSalvando(true)
    try {
      const cadastro = colaboradoresPorMes[mesAtivo] || {}
      const metasAtual = metasPorMes[mesAtivo] || {}
      if (role !== 'admin') {
        const alterados = Object.keys(rascunho).map(n => cadastro[n]).filter(c => c && podeEditar(c)).map(c => {
          const metasColab = metasAtual[c.colaborador] || {}
          const metas = { ...(metasColab.metas || {}) }
          for (const canal of (c.cargo_movimento || '').split(';').map(s => s.trim()).filter(Boolean)) {
            const d = rascunho[c.colaborador]?.[canal] || {}
            metas[canal] = {
              mp:  Number(d.mp  ?? getMetaCanal(metasColab, canal, 'mp'))  || 0,
              mo:  Number(d.mo  ?? getMetaCanal(metasColab, canal, 'mo'))  || 0,
              mpo: Number(d.mpo ?? getMetaCanal(metasColab, canal, 'mpo')) || 0,
            }
          }
          return { colaborador: c.colaborador, mp: 0, mo: 0, mpo: 0, metas }
        })
        if (alterados.length) {
          const { salvarMetasEquipe } = await import('../../pv/org.js')
          await salvarMetasEquipe(mesAtivo, alterados)
        }
        setRascunho({})
        setSalvo(true)
        setTimeout(() => setSalvo(false), 2000)
        return
      }
      const novos = Object.values(cadastro).map(c => {
        const metasColab = metasAtual[c.colaborador] || {}
        const draftColab = rascunho[c.colaborador]
        if (!draftColab) return {
          colaborador: c.colaborador, mp: metasColab.mp || 0, mo: metasColab.mo || 0,
          mpo: metasColab.mpo || 0, metas: metasColab.metas || {}, mes: mesAtivo,
        }
        const canaisList = (c.cargo_movimento || '').split(';').map(s => s.trim()).filter(Boolean)
        const metas = {}
        canaisList.forEach(canal => {
          const draftCanal = draftColab[canal] || {}
          metas[canal] = {
            mp:  Number(draftCanal.mp  ?? getMetaCanal(metasColab, canal, 'mp'))  || 0,
            mo:  Number(draftCanal.mo  ?? getMetaCanal(metasColab, canal, 'mo'))  || 0,
            mpo: Number(draftCanal.mpo ?? getMetaCanal(metasColab, canal, 'mpo')) || 0,
          }
        })
        return { colaborador: c.colaborador, mp: 0, mo: 0, mpo: 0, metas, mes: mesAtivo }
      })
      await substituirMetasMes(mesAtivo, novos)
      setRascunho({})
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
    } catch (erro) {
      toast(role !== 'admin' && erro?.message ? erro.message : 'Não foi possível salvar. Verifique sua conexão e tente novamente.', 'error', 6000)
    } finally {
      setSalvando(false)
    }
  }

  const secoesAba = useMemo(() => {
    const setoresFiltro = abaAtiva === 'pecas' ? SETORES_PECAS : SETORES_OFICINA
    const secoesDef     = abaAtiva === 'pecas' ? SECOES_PECAS  : SECOES_OFICINA
    const filtrados     = colaboradores.filter(c => {
      const setores = (c.cargo_movimento || '').split(';').map(s => s.trim()).filter(Boolean)
      return setores.some(s => setoresFiltro.has(s))
    })
    return secoesDef.map(sec => {
      const membros = filtrados.filter(c =>
        abaAtiva === 'pecas'
          ? (c.cargo_movimento || '').split(';').map(s => s.trim()).includes(sec.key)
          : getSecaoOficina(c) === sec.key
      )
      return { ...sec, membros }
    }).filter(s => s.membros.length > 0)
  }, [colaboradores, abaAtiva])

  const canaisAtivos = abaAtiva === 'pecas' ? CANAIS_PECAS : CANAIS_OFICINA

  const estadoOpts = useMemo(() =>
    [...new Set(Object.values(LOJAS).map(v => v.uf))].sort().map(uf => ({ value: uf, label: uf }))
  , [])

  const lojaOpts = useMemo(() =>
    Object.entries(LOJAS)
      .filter(([, v]) => !filtroEstado || v.uf === filtroEstado)
      .map(([k, v]) => ({ value: k, label: `${k} – ${v.un}` }))
  , [filtroEstado])

  const todosColabs = useMemo(() => colaboradoresMesMerged, [colaboradoresMesMerged])

  const cargoOpts = useMemo(() => {
    const s = new Set(todosColabs.map(c => c.cargo?.toUpperCase()).filter(Boolean))
    return [...s].sort().map(c => ({ value: c, label: c }))
  }, [todosColabs])

  const supervisorOpts = useMemo(() => {
    const s = supervisoresDisponiveis(todosColabs)
    return [...s].sort().map(v => ({ value: v, label: v }))
  }, [todosColabs])

  return {
    soLeitura, podeEditar, mesAtivo, mesHoje, mesesDisp, mesesHist, mesAnoAnterior,
    filtroEstado, filtroLojas, filtroMes, filtroNome, filtroCargo, filtroSupervisor,
    setFiltroMes, setFiltrosGlobais, setFiltroNome, setFiltroCargo, setFiltroSupervisor,
    estadoOpts, lojaOpts, cargoOpts, supervisorOpts,
    abaAtiva, setAbaAtiva, secoesAba, canaisAtivos,
    fator, setFator, aplicarSugestoes,
    rascunho, setRascunho,
    colapsadas, toggleSecao,
    sortsMap, handleSortSecao,
    getRealizado, getSugestao, handleKeyDown,
    inputRefs, metasPorMes, colaboradoresPorMes,
    salvando, salvo, salvarTudo,
    descartarMetas: () => setRascunho({}),
  }
}
