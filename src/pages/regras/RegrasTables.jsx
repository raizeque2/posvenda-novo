import { useState, useMemo } from 'react'
import useStore from '../../store.js'
import { LOJAS } from '../../data/regras.js'
import { norm } from '../../utils/normalizacao.js'
import { useSorter, ThMulti as Th, Td, TrHover, Tag, FormDropdown, EditToggleButton as BtnEditar } from '../../components/DS.jsx'
import { useConfirm } from '../../hooks/useConfirm.jsx'
import { BadgeToggle, EditableText, EditableSelect, EditableMultiplier, EditablePct } from './RegrasInputs.jsx'

const CATS_PECAS = ['VAREJO','WEB','TELEVENDAS','ATACADO','OFICINA','OFICINA_INT','OFICINA_GAR','OFICINA_SEG','COMPRA','DEV.COMPRA']

function TipoEditavel({ tipo, onRename, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(tipo)
  if (readOnly) return <span style={{ fontWeight: 'var(--weight-medium)' }}>{tipo}</span>
  if (!editing) return (
    <span
      style={{ fontWeight: 'var(--weight-medium)', cursor: 'pointer', borderBottom: '1px dashed var(--border2)' }}
      title="Clique para renomear"
      onClick={() => { setVal(tipo); setEditing(true) }}
    >{tipo}</span>
  )
  return (
    <input
      autoFocus
      className="form-input"
      value={val}
      style={{ minWidth: 180, padding: '2px 6px', fontSize: 'var(--text-sm2)' }}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { onRename(val); setEditing(false) }
        if (e.key === 'Escape') { setEditing(false) }
      }}
      onBlur={() => { onRename(val); setEditing(false) }}
    />
  )
}

export function TabelaPecas({ mes, uf, mesData, updateRegraPeca, addRegraPeca, removeRegraPeca, renameRegraPeca, canEdit }) {
  const regrasBrute = mesData?.pecas?.[uf] || {}
  const [busca, setBusca]     = useState('')
  const [novo, setNovo]       = useState({ tipo: '', cat: '', meta: false, com: false })
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(false)

  const allRows  = Object.entries(regrasBrute).map(([tipo, v]) => ({ tipo, ...v }))
  const baseRows = useMemo(() =>
    allRows.filter(r => !busca || r.tipo.toLowerCase().includes(busca.toLowerCase()) || r.cat.toLowerCase().includes(busca.toLowerCase()))
  , [allRows, busca])

  const { sorted, sort, toggle } = useSorter(baseRows, {
    tipo: r => r.tipo, cat: r => r.cat, meta: r => r.meta ? 1 : 0, com: r => r.com ? 1 : 0,
  })

  const { confirm, modal: confirmModal } = useConfirm()

  function salvarNovo() {
    if (!novo.tipo.trim()) return
    addRegraPeca(mes, uf, novo.tipo.trim().toUpperCase(), { cat: novo.cat, meta: novo.meta, com: novo.com })
    setNovo({ tipo: '', cat: '', meta: false, com: false })
    setShowForm(false)
  }

  function sairEdicao() { setEditando(false); setShowForm(false) }

  return (
    <>
    <div className="card">
      <div className="card-header">
        <span className="card-title">Peças — {uf}</span>
        <span className="badge badge-gray">{sorted.length} de {allRows.length} tipos</span>
        <input className="filter-select" placeholder="Buscar tipo ou categoria..." value={busca}
          onChange={e => setBusca(e.target.value)} style={{ marginLeft: 8, minWidth: 200 }} />
        {editando && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Novo tipo'}
          </button>
        )}
        {canEdit && <BtnEditar editando={editando} onToggle={editando ? sairEdicao : () => setEditando(true)} />}
      </div>
      {editando && showForm && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <input className="form-input" placeholder="Tipo Movimento" value={novo.tipo} style={{ flex: 2, minWidth: 200 }}
            onChange={e => setNovo(v => ({ ...v, tipo: e.target.value }))} />
          <div style={{ flex: 1, minWidth: 140 }}>
            <FormDropdown
              value={novo.cat} placeholder="Categoria"
              options={CATS_PECAS.map(c => ({ value: c, label: c }))}
              onChange={v => setNovo(s => ({ ...s, cat: v }))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
            <BadgeToggle value={novo.meta} onChange={v => setNovo(s => ({ ...s, meta: v }))} /> Meta
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
            <BadgeToggle value={novo.com} onChange={v => setNovo(s => ({ ...s, com: v }))} /> Comissão
          </div>
          <button className="btn btn-primary btn-sm" onClick={salvarNovo}>Salvar</button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <Th col="tipo" label="Tipo Movimento" sort={sort} toggle={toggle} />
            <Th col="cat"  label="Categoria"      sort={sort} toggle={toggle} />
            <Th col="meta" label="Meta"            sort={sort} toggle={toggle} />
            <Th col="com"  label="Comissão"        sort={sort} toggle={toggle} />
            {editando && <th style={{ width: 80 }}>Ações</th>}
          </tr></thead>
          <tbody>
            {sorted.map(r => (
              <TrHover key={r.tipo}>
                <Td>
                  <TipoEditavel tipo={r.tipo} readOnly={!editando} onRename={v => renameRegraPeca(mes, uf, r.tipo, v)} />
                </Td>
                <Td><EditableSelect value={r.cat} options={CATS_PECAS} onSave={v => updateRegraPeca(mes, uf, r.tipo, 'cat', v)} readOnly={!editando} /></Td>
                <Td><BadgeToggle  value={r.meta} onChange={v => updateRegraPeca(mes, uf, r.tipo, 'meta', v)} readOnly={!editando} /></Td>
                <Td><BadgeToggle  value={r.com}  onChange={v => updateRegraPeca(mes, uf, r.tipo, 'com',  v)} readOnly={!editando} /></Td>
                {editando && (
                  <Td center>
                    <button className="btn btn-danger btn-sm"
                      onClick={async () => { if (await confirm(`Remover "${r.tipo}"?`)) removeRegraPeca(mes, uf, r.tipo) }}>
                      Remover
                    </button>
                  </Td>
                )}
              </TrHover>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {confirmModal}
    </>
  )
}

export function TabelaOficina({ mes, uf, mesData, updateRegraOficina, addRegraOficina, removeRegraOficina, renameRegraOficina, canEdit }) {
  const regrasBrute = mesData?.oficina?.[uf] || {}
  const [busca, setBusca]       = useState('')
  const [novo, setNovo]         = useState({ tipo: '', cat: '', meta: false, com: false })
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(false)

  const allRows  = Object.entries(regrasBrute).map(([tipo, v]) => ({ tipo, ...v }))
  const baseRows = useMemo(() =>
    allRows.filter(r => !busca || r.tipo.toLowerCase().includes(busca.toLowerCase()) || r.cat.toLowerCase().includes(busca.toLowerCase()))
  , [allRows, busca])

  const { sorted, sort, toggle } = useSorter(baseRows, {
    tipo: r => r.tipo, cat: r => r.cat, meta: r => r.meta ? 1 : 0, com: r => r.com ? 1 : 0,
  })

  const { confirm, modal: confirmModal } = useConfirm()

  function salvarNovo() {
    if (!novo.tipo.trim()) return
    addRegraOficina(mes, uf, novo.tipo.trim().toUpperCase(), { cat: novo.cat, meta: novo.meta, com: novo.com })
    setNovo({ tipo: '', cat: '', meta: false, com: false })
    setShowForm(false)
  }

  function sairEdicao() { setEditando(false); setShowForm(false) }

  return (
    <>
    <div className="card">
      <div className="card-header">
        <span className="card-title">Oficina — {uf}</span>
        <span className="badge badge-gray">{sorted.length} de {allRows.length} tipos</span>
        <input className="filter-select" placeholder="Buscar tipo ou categoria..." value={busca}
          onChange={e => setBusca(e.target.value)} style={{ marginLeft: 8, minWidth: 200 }} />
        {editando && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Novo tipo'}
          </button>
        )}
        {canEdit && <BtnEditar editando={editando} onToggle={editando ? sairEdicao : () => setEditando(true)} />}
      </div>
      {editando && showForm && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <input className="form-input" placeholder="Tipo O.S." value={novo.tipo} style={{ flex: 2, minWidth: 200 }}
            onChange={e => setNovo(v => ({ ...v, tipo: e.target.value }))} />
          <input className="form-input" placeholder="Categoria" value={novo.cat} style={{ flex: 1, minWidth: 120 }}
            onChange={e => setNovo(v => ({ ...v, cat: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
            <BadgeToggle value={novo.meta} onChange={v => setNovo(s => ({ ...s, meta: v }))} /> Meta
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
            <BadgeToggle value={novo.com} onChange={v => setNovo(s => ({ ...s, com: v }))} /> Comissão
          </div>
          <button className="btn btn-primary btn-sm" onClick={salvarNovo}>Salvar</button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <Th col="tipo" label="Tipo O.S."  sort={sort} toggle={toggle} />
            <Th col="cat"  label="Categoria"  sort={sort} toggle={toggle} />
            <Th col="meta" label="Meta"        sort={sort} toggle={toggle} />
            <Th col="com"  label="Comissão"    sort={sort} toggle={toggle} />
            {editando && <th style={{ width: 80 }}>Ações</th>}
          </tr></thead>
          <tbody>
            {sorted.map(r => (
              <TrHover key={r.tipo}>
                <Td>
                  <TipoEditavel tipo={r.tipo} readOnly={!editando} onRename={v => renameRegraOficina(mes, uf, r.tipo, v)} />
                </Td>
                <Td><EditableText value={r.cat}  onSave={v => updateRegraOficina(mes, uf, r.tipo, 'cat',  v)} readOnly={!editando} /></Td>
                <Td><BadgeToggle  value={r.meta} onChange={v => updateRegraOficina(mes, uf, r.tipo, 'meta', v)} readOnly={!editando} /></Td>
                <Td><BadgeToggle  value={r.com}  onChange={v => updateRegraOficina(mes, uf, r.tipo, 'com',  v)} readOnly={!editando} /></Td>
                {editando && (
                  <Td center>
                    <button className="btn btn-danger btn-sm"
                      onClick={async () => { if (await confirm(`Remover "${r.tipo}"?`)) removeRegraOficina(mes, uf, r.tipo) }}>
                      Remover
                    </button>
                  </Td>
                )}
              </TrHover>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {confirmModal}
    </>
  )
}

export function TabelaLojas({ mes, filtroEstado, filtroLoja, mesData, updateLoja, addLoja, canEdit }) {
  const lojasObj = mesData?.lojas || {}
  const allRows  = Object.entries(lojasObj).map(([sigla, v]) => ({ sigla, ...v }))
  const baseRows = allRows
    .filter(r => !filtroEstado || r.uf === filtroEstado)
    .filter(r => !filtroLoja  || r.sigla === filtroLoja)
  const { sorted, sort, toggle } = useSorter(baseRows, {
    sigla: r => r.sigla, un: r => r.un, estado: r => r.estado, uf: r => r.uf,
    aliqImposto: r => r.aliqImposto || 0, pecasMoTarget: r => r.pecasMoTarget || 0,
  })
  const [novo, setNovo]         = useState({ sigla: '', un: '', estado: '', uf: 'PE' })
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(false)

  function salvarNovo() {
    if (!novo.sigla.trim() || !novo.un.trim()) return
    addLoja(mes, novo.sigla.trim().toUpperCase(), { un: novo.un, estado: novo.estado, uf: novo.uf })
    setNovo({ sigla: '', un: '', estado: '', uf: 'PE' })
    setShowForm(false)
  }

  function sairEdicao() { setEditando(false); setShowForm(false) }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Lojas — {mes}</span>
        <span className="badge badge-gray">{sorted.length} de {allRows.length}</span>
        {editando && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Nova loja'}
          </button>
        )}
        {canEdit && <BtnEditar editando={editando} onToggle={editando ? sairEdicao : () => setEditando(true)} />}
      </div>
      {editando && showForm && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <input className="form-input" placeholder="Sigla (ex: ARA)" value={novo.sigla} style={{ width: 90 }}
            onChange={e => setNovo(v => ({ ...v, sigla: e.target.value }))} />
          <input className="form-input" placeholder="Unidade" value={novo.un}
            onChange={e => setNovo(v => ({ ...v, un: e.target.value }))} />
          <input className="form-input" placeholder="Estado" value={novo.estado}
            onChange={e => setNovo(v => ({ ...v, estado: e.target.value }))} />
          <div style={{ width: 90 }}>
            <FormDropdown value={novo.uf} options={[{ value: 'AL', label: 'AL' }, { value: 'PE', label: 'PE' }]}
              onChange={v => setNovo(s => ({ ...s, uf: v }))} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={salvarNovo}>Salvar</button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <Th col="sigla"         label="Sigla"           sort={sort} toggle={toggle} />
            <Th col="un"            label="Unidade"         sort={sort} toggle={toggle} />
            <Th col="estado"        label="Estado"          sort={sort} toggle={toggle} />
            <Th col="uf"            label="UF"              sort={sort} toggle={toggle} />
            <Th col="aliqImposto"   label="Alíq. Imposto"   sort={sort} toggle={toggle} />
            <Th col="pecasMoTarget" label="Peças/MO Target"  sort={sort} toggle={toggle} />
          </tr></thead>
          <tbody>
            {sorted.map(r => (
              <TrHover key={r.sigla}>
                <Td><span className="badge badge-blue">{r.sigla}</span></Td>
                <Td><EditableText    value={r.un}             onSave={v => updateLoja(mes, r.sigla, 'un',            v)} readOnly={!editando} /></Td>
                <Td><EditableText    value={r.estado}         onSave={v => updateLoja(mes, r.sigla, 'estado',        v)} readOnly={!editando} /></Td>
                <Td>
                  {editando ? (
                    <div style={{ width: 90 }}>
                      <FormDropdown value={r.uf} options={[{ value: 'AL', label: 'AL' }, { value: 'PE', label: 'PE' }]}
                        onChange={v => updateLoja(mes, r.sigla, 'uf', v)} />
                    </div>
                  ) : (
                    <span className={`badge ${r.uf === 'AL' ? 'badge-green' : 'badge-blue'}`}>{r.uf}</span>
                  )}
                </Td>
                <Td><EditablePct        value={r.aliqImposto   || 0} onSave={v => updateLoja(mes, r.sigla, 'aliqImposto',   v)} readOnly={!editando} /></Td>
                <Td><EditableMultiplier value={r.pecasMoTarget || 0} onSave={v => updateLoja(mes, r.sigla, 'pecasMoTarget', v)} readOnly={!editando} /></Td>
              </TrHover>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const CAMPOS_COM = [
  { key: 'cp',   label: 'Com. Peças' },
  { key: 'cpo',  label: 'Com. Peças OS' },
  { key: 'cmo',  label: 'Com. MO' },
  { key: 'cbp',  label: 'Bônus Peças' },
  { key: 'cbpo', label: 'Bônus Peças OS' },
  { key: 'cbmo', label: 'Bônus MO' },
]

export function TabelaComissaoOp({ mes, filtroEstado, mesData, updateComissaoOp, addComissaoOp, removeComissaoOp, canEdit }) {
  const { colaboradoresPorMes } = useStore()
  const { confirm, modal: confirmModal } = useConfirm()
  const allRows  = (mesData?.comissao || []).map((r, i) => ({ ...r, _idx: i }))
  const baseRows = allRows.filter(r => !filtroEstado || (r.uf || 'PE') === filtroEstado)
  const { sorted, sort, toggle } = useSorter(baseRows, {
    uf: r => r.uf, cargo: r => r.cargo,
    cp: r => r.cp, cpo: r => r.cpo, cmo: r => r.cmo,
    cbp: r => r.cbp || 0, cbpo: r => r.cbpo || 0, cbmo: r => r.cbmo || 0,
  })
  const [novo, setNovo]         = useState({ uf: 'PE', cargo: '', cp: '', cpo: '', cmo: '', cbp: '', cbpo: '', cbmo: '' })
  const [showForm, setShowForm] = useState(false)

  const cargosSemRegra = useMemo(() => {
    const colabs = Object.values(colaboradoresPorMes[mes] || {})
    const cargoMap = {}
    colabs.forEach(c => { if (!c.cargo) return; const n = norm(c.cargo); if (!cargoMap[n]) cargoMap[n] = c.cargo.toUpperCase() })
    const regrasCargosNorm = new Set((mesData?.comissao || []).map(r => norm(r.cargo)))
    const mesesAnteriores  = Object.keys(colaboradoresPorMes).filter(m => m < mes)
    const cargosAntNorm    = new Set()
    mesesAnteriores.forEach(m => Object.values(colaboradoresPorMes[m] || {}).forEach(c => c.cargo && cargosAntNorm.add(norm(c.cargo))))
    return Object.entries(cargoMap)
      .filter(([n]) => !regrasCargosNorm.has(n))
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([n, cargo]) => {
        const membros = colabs.filter(c => norm(c.cargo) === n)
        const ufs = membros.map(c => LOJAS[c.loja]?.uf).filter(Boolean)
        const ufSugerida = ufs.length
          ? Object.entries(ufs.reduce((acc, u) => ({ ...acc, [u]: (acc[u] || 0) + 1 }), {})).sort(([,a],[,b]) => b-a)[0][0]
          : 'PE'
        return { cargo, novo: !cargosAntNorm.has(n), ufSugerida }
      })
  }, [colaboradoresPorMes, mes, mesData])

  const cargosInativos = useMemo(() => {
    const todosCargosNorm = new Set()
    Object.values(colaboradoresPorMes).forEach(m => Object.values(m).forEach(c => c.cargo && todosCargosNorm.add(norm(c.cargo))))
    if (todosCargosNorm.size === 0) return new Set()
    return new Set((mesData?.comissao || []).map(r => r.cargo?.toUpperCase()).filter(c => c && !todosCargosNorm.has(norm(c))))
  }, [colaboradoresPorMes, mesData])

  function salvarNovo() {
    if (!novo.cargo.trim()) return
    addComissaoOp(mes, {
      uf: novo.uf, cargo: novo.cargo.toUpperCase(),
      cp:  (+novo.cp  || 0) / 100, cpo: (+novo.cpo || 0) / 100, cmo: (+novo.cmo || 0) / 100,
      cbp: (+novo.cbp || 0) / 100, cbpo: (+novo.cbpo || 0) / 100, cbmo: (+novo.cbmo || 0) / 100,
    })
    setNovo({ uf: 'PE', cargo: '', cp: '', cpo: '', cmo: '', cbp: '', cbpo: '', cbmo: '' })
    setShowForm(false)
  }

  return (
    <>
    <div className="card">
      <div className="card-header">
        <span className="card-title">Comissão Operacional — {mes}</span>
        <span className="badge badge-gray">{sorted.length} de {allRows.length} regras</span>
        {canEdit && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Nova regra'}
          </button>
        )}
      </div>
      {canEdit && showForm && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 90 }}>
            <FormDropdown value={novo.uf} options={[{ value: 'AL', label: 'AL' }, { value: 'PE', label: 'PE' }]}
              onChange={v => setNovo(s => ({ ...s, uf: v }))} />
          </div>
          <input className="form-input" placeholder="Cargo" value={novo.cargo} style={{ flex: 2, minWidth: 160 }}
            onChange={e => setNovo(v => ({ ...v, cargo: e.target.value }))} />
          {CAMPOS_COM.map(({ key, label }) => (
            <input key={key} className="form-input" placeholder={`% ${label}`} type="number" step="0.01" value={novo[key]} style={{ width: 120 }}
              onChange={e => setNovo(v => ({ ...v, [key]: e.target.value }))} />
          ))}
          <button className="btn btn-primary btn-sm" onClick={salvarNovo}>Salvar</button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <Th col="uf"    label="UF"             sort={sort} toggle={toggle} />
            <Th col="cargo" label="Cargo"           sort={sort} toggle={toggle} />
            {CAMPOS_COM.map(({ key, label }) => (
              <Th key={key} col={key} label={`% ${label}`} sort={sort} toggle={toggle} />
            ))}
            {canEdit && <th>Ações</th>}
          </tr></thead>
          <tbody>
            {sorted.map(r => (
              <TrHover key={r._idx}>
                <Td><span className={`badge ${r.uf === 'AL' ? 'badge-green' : 'badge-blue'}`}>{r.uf || 'PE'}</span></Td>
                <Td style={{ fontWeight: 'var(--weight-medium)' }}>
                  {r.cargo}
                  {cargosInativos.has(r.cargo?.toUpperCase()) && <Tag cor="gray" style={{ marginLeft: 8 }}>sem uso na folha</Tag>}
                </Td>
                {CAMPOS_COM.map(({ key }) => (
                  <Td key={key}><EditablePct value={r[key] || 0} onSave={v => updateComissaoOp(mes, r._idx, key, v)} readOnly={!canEdit} /></Td>
                ))}
                {canEdit && (
                  <Td center>
                    <button className="btn btn-danger btn-sm"
                      onClick={async () => { if (await confirm('Remover esta regra?')) removeComissaoOp(mes, r._idx) }}>
                      Remover
                    </button>
                  </Td>
                )}
              </TrHover>
            ))}
            {cargosSemRegra
              .filter(c => !filtroEstado || c.ufSugerida === filtroEstado)
              .map(({ cargo, novo, ufSugerida }) => (
                <TrHover key={`pending-${cargo}`} style={{ background: 'rgba(245,158,11,0.06)' }}>
                  <Td>
                    <span className={`badge ${ufSugerida === 'AL' ? 'badge-green' : 'badge-blue'}`} style={{ opacity: 0.6 }}>
                      {ufSugerida}
                    </span>
                  </Td>
                  <Td style={{ fontWeight: 'var(--weight-medium)', color: 'var(--amber)' }}>
                    * {cargo}
                    {novo && <Tag cor="amber" style={{ marginLeft: 8 }}>novo</Tag>}
                  </Td>
                  {CAMPOS_COM.map(({ key }) => (
                    <Td key={key} style={{ color: 'var(--text3)' }}>—</Td>
                  ))}
                  {canEdit && (
                    <Td center>
                      <button className="btn btn-ghost btn-sm"
                        style={{ borderColor: 'rgba(245,158,11,0.4)', color: 'var(--amber)' }}
                        onClick={() => { setNovo(v => ({ ...v, cargo, uf: ufSugerida })); setShowForm(true) }}>
                        Criar regra
                      </button>
                    </Td>
                  )}
                </TrHover>
              ))}
          </tbody>
        </table>
      </div>
    </div>
    {confirmModal}
    </>
  )
}

const CARGOS_GESTAO = ['SUPERVISOR', 'COORDENADOR', 'CHEFE DE OFICINA', 'CHEFE', 'GERENTE', 'GESTOR']

export function TabelaComissaoGestao({ mes, mesData, updateComissaoGestao, addComissaoGestao, removeComissaoGestao, canEdit }) {
  const { colaboradoresPorMes } = useStore()
  const rows = (mesData?.gestao || []).map((r, i) => ({ ...r, _idx: i }))
  const { sorted, sort, toggle } = useSorter(rows, {
    colaborador: r => r.colaborador, cargo: r => r.cargo || '',
    comissao: r => r.comissao || 0, bonificacao: r => r.bonificacao || 0,
  })
  const [novo, setNovo]         = useState({ colaborador: '', cargo: '' })
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(false)
  const { confirm, modal: confirmModal } = useConfirm()

  const gestoresSugeridos = useMemo(() => {
    const jaAdicionados = new Set((mesData?.gestao || []).map(r => r.colaborador?.toUpperCase()))
    const todosMeses = Object.keys(colaboradoresPorMes).sort()
    const ultimoMes  = todosMeses[todosMeses.length - 1]
    const candidatos = {}
    todosMeses.forEach(m => {
      Object.values(colaboradoresPorMes[m] || {}).forEach(c => {
        const cargo = c.cargo?.toUpperCase() || ''
        const nome  = c.colaborador?.toUpperCase()
        if (!nome || !CARGOS_GESTAO.some(g => cargo.includes(g))) return
        if (!candidatos[nome]) candidatos[nome] = { nome, cargo: c.cargo, meses: [] }
        candidatos[nome].meses.push(m)
      })
    })
    return Object.values(candidatos)
      .filter(c => !jaAdicionados.has(c.nome))
      .map(c => ({ ...c, isNovo: c.meses.every(m => m >= ultimoMes) }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [colaboradoresPorMes, mesData])

  function salvarNovo() {
    if (!novo.colaborador.trim()) return
    addComissaoGestao(mes, {
      colaborador: novo.colaborador.trim().toUpperCase(),
      cargo: novo.cargo.trim().toUpperCase(),
      cp: 0, cpo: 0, cmo: 0, comissao: 0, bonificacao: 0,
      baseCalculo: 'equipe_mais_propria', canaisBase: ['tp'], indicadores: [],
    })
    setNovo({ colaborador: '', cargo: '' })
    setShowForm(false)
  }

  function sairEdicao() { setEditando(false); setShowForm(false) }

  return (
    <>
    <div className="card">
      <div className="card-header">
        <span className="card-title">Comissão de Gestão — {mes}</span>
        <span className="badge badge-gray">{sorted.length} gestores</span>
        {editando && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Novo gestor'}
          </button>
        )}
        {canEdit && <BtnEditar editando={editando} onToggle={editando ? sairEdicao : () => setEditando(true)} />}
      </div>
      {editando && showForm && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <input className="form-input" placeholder="Nome completo (maiúsculas)" value={novo.colaborador} style={{ flex: 2, minWidth: 200 }}
            onChange={e => setNovo(v => ({ ...v, colaborador: e.target.value }))} />
          <input className="form-input" placeholder="Cargo" value={novo.cargo} style={{ flex: 1, minWidth: 140 }}
            onChange={e => setNovo(v => ({ ...v, cargo: e.target.value }))} />
          <button className="btn btn-primary btn-sm" onClick={salvarNovo}>Salvar</button>
        </div>
      )}
      {editando && gestoresSugeridos.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: 8 }}>
          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm2)', color: 'var(--indigo, #6366f1)', marginBottom: 4 }}>
            {gestoresSugeridos.length} gestor{gestoresSugeridos.length > 1 ? 'es' : ''} identificado{gestoresSugeridos.length > 1 ? 's' : ''} na folha
            <span style={{ fontWeight: 'var(--weight-normal)', marginLeft: 8, color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>— clique para adicionar · * apareceu apenas neste mês</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {gestoresSugeridos.map(g => (
              <button key={g.nome}
                onClick={() => { setNovo({ colaborador: g.nome, cargo: g.cargo || '' }); setShowForm(true) }}
                className="btn btn-ghost btn-sm"
                style={{ borderColor: 'rgba(99,102,241,0.35)', color: 'var(--indigo, #6366f1)', fontSize: 'var(--text-sm)' }}>
                {g.isNovo ? '* ' : ''}+ {g.nome}{g.cargo ? ` (${g.cargo})` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <Th col="colaborador" label="Colaborador"   sort={sort} toggle={toggle} />
            <Th col="cargo"       label="Cargo"         sort={sort} toggle={toggle} />
            <Th col="comissao"    label="% Comissão"    sort={sort} toggle={toggle} />
            <Th col="bonificacao" label="% Bonificação" sort={sort} toggle={toggle} />
            {editando && <th>Ações</th>}
          </tr></thead>
          <tbody>
            {sorted.length === 0 && (
              <TrHover>
                <Td colSpan={editando ? 5 : 4} center style={{ padding: 24, color: 'var(--text3)' }}>
                  {editando ? 'Nenhum gestor — clique em "+ Novo gestor"' : 'Nenhum gestor cadastrado.'}
                </Td>
              </TrHover>
            )}
            {sorted.map(r => (
              <TrHover key={r._idx}>
                <Td style={{ fontWeight: 'var(--weight-semibold)' }}>
                  <EditableText value={r.colaborador} onSave={v => updateComissaoGestao(mes, r._idx, 'colaborador', v.toUpperCase())} readOnly={!editando} />
                </Td>
                <Td>
                  <EditableText value={r.cargo || ''} onSave={v => updateComissaoGestao(mes, r._idx, 'cargo', v.toUpperCase())} readOnly={!editando} />
                </Td>
                <Td><EditablePct value={r.comissao    || 0} onSave={v => updateComissaoGestao(mes, r._idx, 'comissao',    v)} readOnly={!editando} /></Td>
                <Td><EditablePct value={r.bonificacao || 0} onSave={v => updateComissaoGestao(mes, r._idx, 'bonificacao', v)} readOnly={!editando} /></Td>
                {editando && (
                  <Td center>
                    <button className="btn btn-danger btn-sm"
                      onClick={async () => { if (await confirm(`Remover "${r.colaborador}"?`)) removeComissaoGestao(mes, r._idx) }}>
                      Remover
                    </button>
                  </Td>
                )}
              </TrHover>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {confirmModal}
    </>
  )
}
