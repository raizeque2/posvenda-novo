import { useState, useMemo } from 'react'
import useStore from '../../store.js'
import { useConfirm } from '../../hooks/useConfirm.jsx'
import { IHS_LINHAS_OFICINA, IHS_CANAIS_PECAS, IHS_CARGOS } from '../../store/configSlice.js'
import { Th, Td, TrHover, Tag, FormDropdown, EditToggleButton } from '../../components/DS.jsx'
import { BadgeToggle } from './RegrasInputs.jsx'

function Select({ value, onChange, opcoes, disabled }) {
  if (disabled) return <span style={{ color: value ? 'var(--text)' : 'var(--text3)' }}>{value ? opcoes[value] : '—'}</span>
  return (
    <FormDropdown
      value={value || ''}
      placeholder="— selecione —"
      options={Object.entries(opcoes).map(([k, label]) => ({ value: k, label }))}
      onChange={onChange}
    />
  )
}

function SecaoMapeamento({ secaoKey, colunaEsquerda = 'Tipo no sistema', opcoesMap, placeholder, mapeamento, editando, onUpdate, onAdd, onRemove, itensEsquerda }) {
  const [novoTipo, setNovoTipo]   = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [busca, setBusca]         = useState('')

  const linhas = useMemo(() => {
    const mapa = mapeamento || {}
    const todas = new Set([...Object.keys(mapa), ...itensEsquerda])
    return [...todas]
      .filter(k => !busca || k.toLowerCase().includes(busca.toLowerCase()))
      .sort()
  }, [mapeamento, itensEsquerda, busca])

  function salvarNovo() {
    const chave = novoTipo.trim().toUpperCase()
    if (!chave || !novoValor) return
    onAdd(secaoKey, chave, novoValor)
    setNovoTipo('')
    setNovoValor('')
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>{linhas.length} itens</span>
      </div>

      {linhas.length > 6 && (
        <input
          className="form-input"
          placeholder="Buscar..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ marginBottom: 8, maxWidth: 260 }}
        />
      )}

      <div className="table-wrap" style={{ marginBottom: editando ? 8 : 0 }}>
        <table>
          <thead>
            <tr>
              <Th style={{ width: '50%' }}>{colunaEsquerda}</Th>
              <Th style={{ width: editando ? '45%' : '50%' }}>Campo IHS</Th>
              {editando && <Th style={{ width: 40 }} />}
            </tr>
          </thead>
          <tbody>
            {linhas.map(tipo => {
              const val = mapeamento?.[tipo] || ''
              const naoMapeado = !val
              return (
                <TrHover key={tipo} style={{ background: naoMapeado ? 'var(--warning-bg, #fff8e1)' : undefined }}>
                  <Td mono>
                    {tipo}
                    {naoMapeado && <Tag cor="amber" style={{ marginLeft: 8 }}>sem mapeamento</Tag>}
                  </Td>
                  <Td>
                    <Select
                      value={val}
                      onChange={v => onUpdate(secaoKey, tipo, v)}
                      opcoes={opcoesMap}
                      disabled={!editando}
                    />
                  </Td>
                  {editando && (
                    <Td center>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '2px 8px' }}
                        onClick={() => onRemove(secaoKey, tipo)}
                        title="Remover linha"
                      >✕</button>
                    </Td>
                  )}
                </TrHover>
              )
            })}
            {linhas.length === 0 && (
              <tr>
                <Td colSpan={editando ? 3 : 2} center style={{ padding: 20, color: 'var(--text3)' }}>
                  Nenhum item configurado
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder={placeholder}
            value={novoTipo}
            onChange={e => setNovoTipo(e.target.value)}
            style={{ minWidth: 260 }}
            onKeyDown={e => e.key === 'Enter' && salvarNovo()}
          />
          <Select value={novoValor} onChange={setNovoValor} opcoes={opcoesMap} />
          <button className="btn btn-primary btn-sm" onClick={salvarNovo} disabled={!novoTipo.trim() || !novoValor}>
            + Adicionar
          </button>
        </div>
      )}
    </div>
  )
}

function SecaoFiltroMercadoria({ mapeamento, editando, onUpdate, itensDinamicos }) {
  const [busca, setBusca] = useState('')

  const todos = useMemo(() => {
    const mapa = mapeamento || {}
    const todas = new Set([...Object.keys(mapa), ...itensDinamicos])
    return [...todas].filter(k => k && (!busca || k.toLowerCase().includes(busca.toLowerCase()))).sort()
  }, [mapeamento, itensDinamicos, busca])

  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginBottom: 10 }}>
        Marque os tipos que entram no cálculo do RMP Honda no Resumo Mensal.
      </p>

      {todos.length > 6 && (
        <input
          className="form-input"
          placeholder="Buscar..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ marginBottom: 8, maxWidth: 260 }}
        />
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <Th>Tipo de Mercadoria</Th>
              <Th center style={{ width: 70 }}>RMP Honda</Th>
            </tr>
          </thead>
          <tbody>
            {todos.map(tipo => {
              const incluido = mapeamento?.[tipo] === true
              return (
                <TrHover key={tipo}>
                  <Td>{tipo}</Td>
                  <Td center>
                    <BadgeToggle value={incluido} readOnly={!editando} onChange={v => onUpdate('pecas_filtro', tipo, v)} />
                  </Td>
                </TrHover>
              )
            })}
            {todos.length === 0 && (
              <tr>
                <Td colSpan={2} center style={{ padding: 20, color: 'var(--text3)' }}>
                  Nenhum tipo de mercadoria encontrado nos dados carregados
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SecaoContabiliza({ opcoesMap, contabilizaKey, ihsMapeamento, editando, onUpdate }) {
  const linhas = Object.entries(opcoesMap).filter(([k]) => k !== 'ignorar')
  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginBottom: 10 }}>
        Desmarque os campos internos — o valor aparece no Resumo Mensal mas não soma no total do KPI (exibido com *).
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <Th>Campo IHS</Th>
              <Th center style={{ width: 70 }}>Conta</Th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(([k, lbl]) => {
              const conta = ihsMapeamento?.[contabilizaKey]?.[k] !== false
              return (
                <TrHover key={k}>
                  <Td>{lbl}</Td>
                  <Td center>
                    <BadgeToggle value={conta} readOnly={!editando} onChange={v => onUpdate(contabilizaKey, k, v)} />
                  </Td>
                </TrHover>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TabelaIHS({ canEdit }) {
  const { ihsMapeamento, updateIhs, addIhs, removeIhs, pecasPorMes, oficinaPorMes, colaboradoresPorMes } = useStore()
  const { confirm, modal: confirmModal } = useConfirm()

  const [editando, setEditando] = useState(false)

  const tiposOS = useMemo(() => {
    const set = new Set()
    Object.values(oficinaPorMes).forEach(rows => rows.forEach(r => r.tipoOS && set.add(r.tipoOS)))
    return [...set].sort()
  }, [oficinaPorMes])

  const tiposMov = useMemo(() => {
    const set = new Set()
    Object.values(pecasPorMes).forEach(rows => rows.forEach(r => r.tipoMov && set.add(r.tipoMov)))
    return [...set].sort()
  }, [pecasPorMes])

  const tiposMercadoria = useMemo(() => {
    const set = new Set()
    Object.values(pecasPorMes).forEach(rows => rows.forEach(r => {
      const tm = r.tipoMercadoria || r['Tipo Mercadoria'] || r['Tipo de Mercadoria'] || ''
      if (tm) set.add(tm)
    }))
    return [...set].sort()
  }, [pecasPorMes])

  const cargos = useMemo(() => {
    const set = new Set()
    Object.values(colaboradoresPorMes).forEach(mes => Object.values(mes).forEach(c => c.cargo && set.add(c.cargo.toUpperCase())))
    return [...set].sort()
  }, [colaboradoresPorMes])

  async function handleRemove(secao, chave) {
    const ok = await confirm(`Remover "${chave}" do mapeamento?`)
    if (ok) removeIhs(secao, chave)
  }

  const [abaIHS, setAbaIHS] = useState('oficina')

  return (
    <>
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <span className="card-title">Resumo Mensal — Mapeamento IHS</span>
        {canEdit && (
          <EditToggleButton editando={editando} onToggle={() => setEditando(v => !v)} />
        )}
      </div>
      <div className="tab-nav" style={{ padding: '0 16px' }}>
        {[
          ['oficina',      'Tipo de O.S.'],
          ['pecas_canal',  'Tipo de Movimento'],
          ['pecas_filtro', 'Tipo de Mercadoria'],
          ['cargos',       'Cargo'],
        ].map(([k, lbl]) => (
          <button key={k} className={`tab-btn${abaIHS === k ? ' active' : ''}`} onClick={() => setAbaIHS(k)}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{ padding: '16px' }}>
        {abaIHS === 'oficina' && (
          <>
            <SecaoMapeamento
              secaoKey="oficina"
              colunaEsquerda="Tipo de O.S."
              opcoesMap={IHS_LINHAS_OFICINA}
              placeholder="ex: SEGURADORA - PAD"
              mapeamento={ihsMapeamento?.oficina}
              editando={editando}
              onUpdate={updateIhs}
              onAdd={addIhs}
              onRemove={handleRemove}
              itensEsquerda={tiposOS}
            />
            <SecaoContabiliza
              opcoesMap={IHS_LINHAS_OFICINA}
              contabilizaKey="contabiliza_linhas_ihs"
              ihsMapeamento={ihsMapeamento}
              editando={editando}
              onUpdate={updateIhs}
            />
          </>
        )}
        {abaIHS === 'pecas_canal' && (
          <>
            <SecaoMapeamento
              secaoKey="pecas_canal"
              colunaEsquerda="Tipo de Movimento"
              opcoesMap={IHS_CANAIS_PECAS}
              placeholder="ex: VENDA POR O.S."
              mapeamento={ihsMapeamento?.pecas_canal}
              editando={editando}
              onUpdate={updateIhs}
              onAdd={addIhs}
              onRemove={handleRemove}
              itensEsquerda={tiposMov}
            />
            <SecaoContabiliza
              opcoesMap={IHS_CANAIS_PECAS}
              contabilizaKey="contabiliza_canais_pecas"
              ihsMapeamento={ihsMapeamento}
              editando={editando}
              onUpdate={updateIhs}
            />
          </>
        )}
        {abaIHS === 'pecas_filtro' && (
          <SecaoFiltroMercadoria
            mapeamento={ihsMapeamento?.pecas_filtro}
            editando={editando}
            onUpdate={updateIhs}
            itensDinamicos={tiposMercadoria}
          />
        )}
        {abaIHS === 'cargos' && (
          <SecaoMapeamento
            secaoKey="cargos"
            colunaEsquerda="Cargo"
            opcoesMap={IHS_CARGOS}
            placeholder="ex: MECÂNICO"
            mapeamento={ihsMapeamento?.cargos}
            editando={editando}
            onUpdate={updateIhs}
            onAdd={addIhs}
            onRemove={handleRemove}
            itensEsquerda={cargos}
          />
        )}
      </div>
    </div>
    {confirmModal}
    </>
  )
}
