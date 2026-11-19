import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import useStore from '../store.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { LOJAS } from '../data/regras.js'
import { useSorter, ThMulti as Th } from '../components/DS.jsx'
import { CardHead, FiltroDropdown, FiltroAnoMes, Modal } from '../components/DS.jsx'
import { useConfirm } from '../hooks/useConfirm.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { norm, resolveNome, supervisoresDisponiveis } from '../utils/normalizacao.js'
import { sortMesAno, mesAtualStr, proximoMesStr } from '../utils/datas.js'
import { stickyNameTh, CellDropdown, CellSelect, ChipMultiSelect } from './colaboradores/CellInputs.jsx'
import { CANAIS, COLS_EDIT, COLS_DEFAULT, FORM_VAZIO, SORT_FNS, GrupoHeader } from './colaboradores/RowComponents.jsx'
import { InlineRow } from './colaboradores/InlineRow.jsx'

export default function Colaboradores() {
  const {
    colaboradoresPorMes, pecasPorMes, oficinaPorMes, apelidoMap,
    upsertColaborador, substituirColaboradoresCadastrais,
    filtrosGlobais, setFiltrosGlobais,
  } = useStore()
  const { role } = useAuth()
  const soLeitura = role === 'supervisor'
  const { confirm, modal: confirmModal } = useConfirm()
  const toast = useToast()

  const mesHoje   = mesAtualStr()
  const mesLimite = proximoMesStr(mesHoje)

  // O mês atual e o seguinte já nascem prontos (colaboradores copiados do mês
  // anterior) na carga do app — ver inicializarColaboradoresAutomatico em
  // configSlice.js. Não precisa mais oferecer/espelhar o mês seguinte aqui.
  const mesesDisp = useMemo(
    () => Object.keys(colaboradoresPorMes).sort(sortMesAno).filter(m => sortMesAno(m, mesLimite) <= 0),
    [colaboradoresPorMes, mesLimite]
  )

  const filtroMes    = filtrosGlobais.mes
  const filtroEstado = filtrosGlobais.estado
  const filtroLoja   = filtrosGlobais.lojas
  const filtroSetor  = filtrosGlobais.setor
  const filtroCargo  = filtrosGlobais.cargo
  const buscaNome    = filtrosGlobais.busca

  function setFiltroMes(v) {
    setFiltrosGlobais({ mes: v })
  }

  const mesAtivo = filtroMes || (mesesDisp.includes(mesHoje) ? mesHoje : mesesDisp[mesesDisp.length - 1]) || ''

  const [colsVisiveis, setColsVisiveis] = useState(COLS_DEFAULT)
  const [showColPicker, setShowColPicker] = useState(false)
  const colPickerRef = useRef(null)
  useEffect(() => {
    if (!showColPicker) return
    const h = e => { if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setShowColPicker(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showColPicker])
  // checkbox + Colaborador + UF sempre visíveis; "apelido" não é coluna própria
  // (mostrado dentro da célula de Colaborador), não soma no colSpan.
  const colSpan = 3 + COLS_EDIT.filter(c => c.key !== 'apelido' && colsVisiveis[c.key]).length

  const [selectedKeys, setSelectedKeys] = useState(new Set())

  // ── Autosave (reforma da tela, 02/09/2026) — PREVIEW, sem gravação real ──
  // Edição por clique direto, sem "Modo Edição"/"Salvar tudo": cada célula
  // salva sozinha ao confirmar. Por decisão do Bruno, enquanto a estrutura
  // nova do banco (1 documento por pessoa) não está pronta, o autosave só
  // loga no console e guarda a mudança num estado local (overrides) — nunca
  // toca o Firestore. Serve pra validar a usabilidade/fluidez da interação
  // antes de ligar a gravação de verdade.
  const [overrides, setOverrides] = useState({})
  function autosavePreview(nome, campo, valor) {
    console.log('[Colaboradores] autosave (preview, não gravado):', { colaborador: nome, campo, valor })
    setOverrides(o => ({ ...o, [nome]: { ...o[nome], [campo]: valor } }))
  }

  const [form, setForm]               = useState(FORM_VAZIO)
  const [showForm, setShowForm]       = useState(false)
  const [showNomeSugs, setShowNomeSugs] = useState(false)
  const nomeRef = useRef(null)

  const cargosExistentes = useMemo(() => {
    const s = new Set()
    Object.values(colaboradoresPorMes).forEach(m => Object.values(m).forEach(c => { if (c.cargo) s.add(c.cargo.toUpperCase()) }))
    return [...s].sort()
  }, [colaboradoresPorMes])

  const centrosCustoExistentes = useMemo(() => {
    const s = new Set()
    Object.values(colaboradoresPorMes).forEach(m => Object.values(m).forEach(c => { if (c.centro_custo) s.add(c.centro_custo) }))
    return [...s].sort()
  }, [colaboradoresPorMes])

  // Opções do seletor de Supervisor: todo colaborador cujo CARGO contém
  // "supervisor" entra automaticamente (não precisa ser escolhido por
  // ninguém antes) — ver supervisoresDisponiveis (fonte única, normalizacao.js).
  // Aplica os overrides (edição por clique ainda não gravada) — sem isso,
  // editar o cargo de alguém pra "Supervisor" só libera ele como opção pras
  // OUTRAS linhas depois de recarregar a página.
  const supervisoresExistentes = useMemo(() => {
    const todos = Object.values(colaboradoresPorMes).flatMap(m => Object.values(m))
      .map(c => overrides[c.colaborador] ? { ...c, ...overrides[c.colaborador] } : c)
    return [...supervisoresDisponiveis(todos)].sort()
  }, [colaboradoresPorMes, overrides])

  function buscarHistorico(nome) {
    const meses = Object.keys(colaboradoresPorMes).filter(m => m !== mesAtivo).sort((a, b) => b.localeCompare(a))
    for (const m of meses) { const c = colaboradoresPorMes[m][nome]; if (c) return c }
    return null
  }

  const sugestoesHistorico = useMemo(() => {
    const reg = new Set(Object.keys(colaboradoresPorMes[mesAtivo] || {}))
    const map = {}
    Object.entries(colaboradoresPorMes).filter(([m]) => m !== mesAtivo).sort(([a],[b]) => b.localeCompare(a))
      .forEach(([, dados]) => Object.values(dados).forEach(c => {
        if (!reg.has(c.colaborador) && !map[c.colaborador]) map[c.colaborador] = c
      }))
    return map
  }, [colaboradoresPorMes, mesAtivo])

  const sugestoesVendas = useMemo(() => {
    const reg = new Set(Object.values(colaboradoresPorMes).flatMap(m => Object.keys(m).map(n => norm(n))))
    const nomes = new Set()
    Object.values(pecasPorMes).forEach(rows => rows.forEach(p => {
      if (p.responsavel && !reg.has(norm(p.responsavel))) nomes.add(p.responsavel)
    }))
    Object.values(oficinaPorMes).forEach(rows => rows.forEach(o => {
      if (o.consultor && !reg.has(norm(o.consultor))) nomes.add(o.consultor)
      if (o.tecnico   && !reg.has(norm(o.tecnico)))   nomes.add(o.tecnico)
    }))
    return [...nomes].sort()
  }, [pecasPorMes, oficinaPorMes, colaboradoresPorMes])

  const semCadastro = useMemo(() => {
    const reg = new Set(Object.keys(colaboradoresPorMes[mesAtivo] || {}).map(n => norm(n)))
    const nomes = new Set()
    ;(pecasPorMes[mesAtivo] || []).forEach(p => {
      const n = resolveNome(p.responsavel, apelidoMap) || p.responsavel
      if (n && !reg.has(norm(n))) nomes.add(n)
    })
    ;(oficinaPorMes[mesAtivo] || []).forEach(o => {
      const nc = resolveNome(o.consultor, apelidoMap) || o.consultor
      const nt = resolveNome(o.tecnico,   apelidoMap) || o.tecnico
      if (nc && !reg.has(norm(nc))) nomes.add(nc)
      if (nt && !reg.has(norm(nt))) nomes.add(nt)
    })
    return [...nomes].sort()
  }, [pecasPorMes, oficinaPorMes, colaboradoresPorMes, mesAtivo, apelidoMap])

  const estadoOpts = useMemo(() =>
    [...new Set(Object.values(LOJAS).map(v => v.uf))].sort().map(uf => ({ value: uf, label: uf }))
  , [])

  const lojasDisp = useMemo(() =>
    Object.entries(LOJAS).filter(([, v]) => !filtroEstado || v.uf === filtroEstado).sort(([a],[b]) => a.localeCompare(b))
  , [filtroEstado])

  const lojaOpts  = useMemo(() => lojasDisp.map(([k, v]) => ({ value: k, label: `${k} – ${v.un}` })), [lojasDisp])
  const cargoOpts = useMemo(() => {
    const base = Object.values(colaboradoresPorMes[mesAtivo] || {})
      .filter(c => !filtroEstado || LOJAS[c.loja]?.uf === filtroEstado)
      .filter(c => filtroLoja.length === 0 || filtroLoja.includes(c.loja))
    const s = new Set(base.map(c => c.cargo?.toUpperCase()).filter(Boolean))
    return [...s].sort().map(c => ({ value: c, label: c }))
  }, [colaboradoresPorMes, mesAtivo, filtroEstado, filtroLoja])

  const setorOpts = useMemo(() => {
    const base = Object.values(colaboradoresPorMes[mesAtivo] || {})
      .filter(c => !filtroEstado || LOJAS[c.loja]?.uf === filtroEstado)
      .filter(c => filtroLoja.length === 0 || filtroLoja.includes(c.loja))
      .filter(c => filtroCargo.length === 0 || filtroCargo.includes(c.cargo?.toUpperCase()))
    const s = new Set()
    base.forEach(c => (c.cargo_movimento || 'VAREJO').split(';').map(x => x.trim()).filter(Boolean).forEach(x => s.add(x)))
    return CANAIS.filter(canal => s.has(canal)).map(c => ({ value: c, label: c }))
  }, [colaboradoresPorMes, mesAtivo, filtroEstado, filtroLoja, filtroCargo])

  const lojasSorted = useMemo(() => Object.entries(LOJAS).sort(), [])

  const baseRows = useMemo(() => {
    const dados = colaboradoresPorMes[mesAtivo] || {}
    return Object.values(dados)
      .map(c => overrides[c.colaborador] ? { ...c, ...overrides[c.colaborador] } : c)
      .filter(c => !filtroEstado       || LOJAS[c.loja]?.uf === filtroEstado)
      .filter(c => filtroLoja.length === 0  || filtroLoja.includes(c.loja))
      .filter(c => filtroSetor.length === 0 || filtroSetor.some(s => (c.cargo_movimento || 'VAREJO').split(';').some(cm => cm.trim() === s)))
      .filter(c => filtroCargo.length === 0 || filtroCargo.includes(c.cargo?.toUpperCase()))
      .filter(c => !buscaNome          || c.colaborador.toLowerCase().includes(buscaNome.toLowerCase()))
  }, [colaboradoresPorMes, mesAtivo, filtroEstado, filtroLoja, filtroSetor, filtroCargo, buscaNome, overrides])

  const { sorted: colaboradores, sort, toggle } = useSorter(baseRows, SORT_FNS, { col: 'loja', dir: 'asc' })

  const temFiltro = (filtroMes && filtroMes !== mesHoje) || filtroEstado || filtroLoja.length > 0 || filtroSetor.length > 0 || filtroCargo.length > 0 || buscaNome
  const clearFiltros = () => setFiltrosGlobais({ mes: mesHoje, estado: '', lojas: [], setor: [], cargo: [], busca: '' })

  const grupos = useMemo(() => {
    const g = {}
    colaboradores.forEach(c => { const k = c.loja || '–'; if (!g[k]) g[k] = []; g[k].push(c) })
    return Object.entries(g)
  }, [colaboradores])

  const visiveisKeys      = useMemo(() => colaboradores.map(c => c.colaborador), [colaboradores])
  const todosSelecionados = visiveisKeys.length > 0 && visiveisKeys.every(k => selectedKeys.has(k))

  function toggleSelectAll() {
    if (todosSelecionados) setSelectedKeys(s => { const n = new Set(s); visiveisKeys.forEach(k => n.delete(k)); return n })
    else setSelectedKeys(s => { const n = new Set(s); visiveisKeys.forEach(k => n.add(k)); return n })
  }

  const toggleSelect = useCallback(nome => {
    setSelectedKeys(s => { const n = new Set(s); n.has(nome) ? n.delete(nome) : n.add(nome); return n })
  }, [])

  async function excluirSelecionados() {
    const ok = await confirm(`Excluir ${selectedKeys.size} colaborador(es) de ${mesAtivo}?`)
    if (!ok) return
    const dados = colaboradoresPorMes[mesAtivo] || {}
    await substituirColaboradoresCadastrais(mesAtivo, Object.values(dados).filter(c => !selectedKeys.has(c.colaborador)))
    setSelectedKeys(new Set())
    toast?.('Colaborador(es) excluído(s).', 'success')
  }

  function abrirNovo() { setForm(FORM_VAZIO); setShowForm(true); setShowNomeSugs(false) }

  function salvar() {
    if (!form.colaborador.trim() || !form.loja) return
    const nome = form.colaborador.trim().toUpperCase()
    upsertColaborador(mesAtivo, {
      colaborador: nome, apelido: form.apelido.trim(),
      loja: form.loja, cargo: form.cargo.trim().toUpperCase(),
      centro_custo: form.centro_custo.trim(), salario_base: form.salario_base,
      cargo_movimento: form.cargo_movimento, supervisor: form.supervisor.trim(),
      ativo: true,
    })
    setShowForm(false); setForm(FORM_VAZIO)
  }

  const q = norm(form.colaborador)
  const historicoFilt = q.length >= 2 ? Object.values(sugestoesHistorico).filter(c => norm(c.colaborador).includes(q)) : []
  const vendasFilt    = q.length >= 2 ? sugestoesVendas.filter(n => norm(n).includes(q)) : []
  const temSugestoes  = showNomeSugs && (historicoFilt.length > 0 || vendasFilt.length > 0)
  const totalColabs   = Object.values(colaboradoresPorMes[mesAtivo] || {}).length

  return (
    <>
    <div className="page">
      <div className="filters-bar">
        <FiltroAnoMes meses={mesesDisp} value={filtroMes} onChange={setFiltroMes} />
        <span className="dash-bar-sep" />
        <FiltroDropdown label="Estado" options={estadoOpts} value={filtroEstado} onChange={v => setFiltrosGlobais({ estado: v === filtroEstado ? '' : v, lojas: [] })} />
        <FiltroDropdown label="Loja"   options={lojaOpts}   value={filtroLoja}   onChange={v => setFiltrosGlobais({ lojas: v })} multi />
        <FiltroDropdown label="Cargo"  options={cargoOpts}  value={filtroCargo}  onChange={v => setFiltrosGlobais({ cargo: v })} multi />
        <FiltroDropdown label="Setor"  options={setorOpts}  value={filtroSetor}  onChange={v => setFiltrosGlobais({ setor: v })} multi />
        <input className="filter-select" placeholder="Buscar nome..." value={buscaNome}
          onChange={e => setFiltrosGlobais({ busca: e.target.value })} style={{ minWidth: 160 }} />
        {temFiltro && <button className="filter-clear" onClick={clearFiltros}>✕</button>}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!soLeitura && selectedKeys.size > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--honda)', color: 'var(--honda)' }}
              onClick={excluirSelecionados}>
              Excluir selecionados ({selectedKeys.size})
            </button>
          )}
          {!soLeitura && (
            <button className="btn btn-primary btn-sm" onClick={abrirNovo}>+ Novo colaborador</button>
          )}
        </div>
      </div>

      {showForm && !soLeitura && (
        <Modal
          title={`Novo Colaborador — ${mesAtivo}`}
          onClose={() => { setShowForm(false); setForm(FORM_VAZIO) }}
          maxWidth={640}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setForm(FORM_VAZIO) }}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar}>Salvar colaborador</button>
          </>}
        >
            <div className="form-grid">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Nome *</label>
                <input ref={nomeRef} className="form-input" placeholder="Digite para buscar..."
                  value={form.colaborador} autoComplete="off"
                  onChange={e => { setForm(f => ({ ...f, colaborador: e.target.value })); setShowNomeSugs(true) }}
                  onFocus={() => setShowNomeSugs(true)} onBlur={() => setTimeout(() => setShowNomeSugs(false), 150)} />
                {temSugestoes && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxHeight: 280, overflowY: 'auto' }}>
                    {historicoFilt.length > 0 && (<>
                      <div style={{ padding: '6px 12px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Meses anteriores</div>
                      {historicoFilt.map(c => (
                        <div key={c.colaborador}
                          onMouseDown={() => { setForm({ colaborador: c.colaborador, apelido: c.apelido || '', loja: c.loja, cargo: c.cargo || '', centro_custo: c.centro_custo || '', salario_base: c.salario_base || '', cargo_movimento: c.cargo_movimento || 'VAREJO', supervisor: c.supervisor || '' }); setShowNomeSugs(false) }}
                          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <span style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)' }}>{c.colaborador}</span>
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>{c.loja} · {c.cargo_movimento}</span>
                        </div>
                      ))}
                    </>)}
                    {vendasFilt.length > 0 && (<>
                      <div style={{ padding: '6px 12px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--honda)', textTransform: 'uppercase', letterSpacing: 1, borderTop: historicoFilt.length ? '1px solid var(--border2)' : 'none' }}>Nas vendas · sem cadastro</div>
                      {vendasFilt.map(nome => (
                        <div key={nome} onMouseDown={() => { setForm(f => ({ ...f, colaborador: nome })); setShowNomeSugs(false) }}
                          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <span style={{ fontSize: 'var(--text-base)' }}>{nome}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--honda)', fontWeight: 'var(--weight-semibold)' }}>sem meta</span>
                        </div>
                      ))}
                    </>)}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Apelido</label>
                <input className="form-input" placeholder="Ex: ARA - DANIEL MECANICO" value={form.apelido}
                  onChange={e => setForm(f => ({ ...f, apelido: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Loja *</label>
                <CellDropdown
                  value={form.loja}
                  onChange={v => setForm(f => ({ ...f, loja: v }))}
                  options={lojasSorted.map(([k, v]) => `${k} – ${v.un} (${v.uf})`)}
                  placeholder="Selecionar loja..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cargo</label>
                <CellSelect
                  value={form.cargo}
                  onChange={v => setForm(f => ({ ...f, cargo: v.toUpperCase() }))}
                  options={cargosExistentes}
                  placeholder="Ex: VENDEDOR DE PECAS"
                  upperCase
                />
              </div>
              <div className="form-group">
                <label className="form-label">Centro de Custo</label>
                <CellSelect
                  value={form.centro_custo}
                  onChange={v => setForm(f => ({ ...f, centro_custo: v }))}
                  options={centrosCustoExistentes}
                  placeholder="Ex: PEÇAS E ACESSÓRIOS"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Salário Base (R$)</label>
                <input className="form-input" type="text" inputMode="numeric" placeholder="0"
                  value={form.salario_base}
                  onChange={e => setForm(f => ({ ...f, salario_base: e.target.value.replace(/\D/g, '') }))}
                  onFocus={e => e.target.select()} />
              </div>
              <div className="form-group">
                <label className="form-label">Setor / Movimento</label>
                <ChipMultiSelect value={form.cargo_movimento} onChange={v => setForm(f => ({ ...f, cargo_movimento: v }))} options={CANAIS} />
              </div>
              <div className="form-group">
                <label className="form-label">Supervisor</label>
                <ChipMultiSelect value={form.supervisor} onChange={v => setForm(f => ({ ...f, supervisor: v }))} options={supervisoresExistentes} />
              </div>
            </div>
        </Modal>
      )}

      {semCadastro.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.07)', border: '1px solid var(--red)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 12,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--red)', whiteSpace: 'nowrap' }}>
            {semCadastro.length} sem cadastro em {mesAtivo}:
          </span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {semCadastro.map(nome => (
              <button key={nome} className="btn btn-danger btn-sm"
                onClick={() => {
                  const hist = buscarHistorico(nome)
                  setForm({
                    colaborador: nome.toUpperCase(),
                    apelido: hist?.apelido || '',
                    loja: hist?.loja || '',
                    cargo: hist?.cargo || '',
                    cargo_movimento: hist?.cargo_movimento || 'VAREJO',
                    centro_custo: hist?.centro_custo || '',
                    salario_base: String(hist?.salario_base || ''),
                    supervisor: hist?.supervisor || '',
                  })
                  setShowForm(true)
                  setShowNomeSugs(false)
                }}>
                + {nome}
              </button>
            ))}
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {mesAtivo || '–'} — {colaboradores.length} colaborador{colaboradores.length !== 1 ? 'es' : ''}
            {totalColabs !== colaboradores.length && (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontWeight: 'var(--weight-normal)', marginLeft: 8 }}>
                ({totalColabs} no total)
              </span>
            )}
          </span>
          {temFiltro && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontStyle: 'italic' }}>· filtro ativo</span>
          )}
          {!soLeitura && (
            <span style={{ marginLeft: 8, fontSize: 'var(--text-xs)', color: 'rgba(245,158,11,0.9)' }}>· laranja = campo vazio</span>
          )}
          <div ref={colPickerRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-sm"
              style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => setShowColPicker(v => !v)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/>
              </svg>
              Colunas
            </button>
            {showColPicker && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 9999,
                background: 'var(--bg2)', border: '1px solid var(--border2)',
                borderRadius: 6, padding: '10px 14px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150,
              }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Colunas visíveis</div>
                {COLS_EDIT.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm2)' }}>
                    <input type="checkbox" checked={!!colsVisiveis[key]}
                      onChange={() => setColsVisiveis(v => ({ ...v, [key]: !v[key] }))}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }} />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 270px)', overflowY: 'auto' }}>
          <table className="table-scroll tabela-pessoas">
            <thead>
              <tr>
                <th style={{ width: 36, paddingLeft: 10, ...stickyNameTh }}>
                  <input type="checkbox" checked={todosSelecionados} onChange={toggleSelectAll}
                    style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                </th>
                <Th col="colaborador"     label="Colaborador"     sort={sort} toggle={toggle} style={{ ...stickyNameTh, left: 36 }} />
                {colsVisiveis.loja         && <Th col="loja"            label="Loja"            sort={sort} toggle={toggle} />}
                <Th col="estado"          label="UF"              sort={sort} toggle={toggle} />
                {colsVisiveis.cargo        && <Th col="cargo"           label="Cargo"           sort={sort} toggle={toggle} />}
                {colsVisiveis.centro_custo && <Th col="centro_custo"    label="Centro de Custo" sort={sort} toggle={toggle} />}
                {colsVisiveis.salario      && <Th col="salario_base"    label="Salário Base"    sort={sort} toggle={toggle} />}
                {colsVisiveis.setor        && <Th col="cargo_movimento" label="Setor"           sort={sort} toggle={toggle} />}
                {colsVisiveis.supervisor   && <Th col="supervisor"      label="Supervisor"      sort={sort} toggle={toggle} />}
              </tr>
            </thead>
            <tbody>
              {colaboradores.length === 0 ? (
                <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>
                  Nenhum colaborador encontrado
                </td></tr>
              ) : grupos.map(([loja, rows]) => (
                <React.Fragment key={loja}>
                  <GrupoHeader loja={loja} qtd={rows.length} colSpan={colSpan} />
                  {rows.map(c => (
                    <InlineRow key={c.colaborador} c={c} checked={selectedKeys.has(c.colaborador)} onToggle={toggleSelect}
                      onSave={autosavePreview} editable={!soLeitura}
                      cargos={cargosExistentes} centros={centrosCustoExistentes}
                      supervisores={supervisoresExistentes} lojas={lojasSorted}
                      cols={colsVisiveis} />
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    {confirmModal}
    </>
  )
}
