import { useState, useMemo, useRef, useEffect } from 'react'
import { CURVA_META } from '../../services/processamento/processarObsoleto.js'
import { fmtBRL2 as fmtBRL } from '../../utils/formatacao.js'
import { TrHover, TrTotal, Td, ColSelector, LojaBadge as LojaBadgeDS } from '../../components/DS.jsx'
import { Download } from '../../icons/iconoir'
import { fmtPct } from './utils.js'
import { Th, useSort, Paginacao, ItemPeca } from './TabelaUtils.jsx'
import { CurvaBadge } from './KpiCard.jsx'

function findCodPecas(row) {
  for (const k of Object.keys(row)) {
    const kn = k.replace(/﻿/g,'').trim().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
    if (kn === 'codigo mercadoria' || kn === 'codigo' || kn === 'cod. peca' || kn === 'part number') return (row[k] || '').trim()
  }
  return ''
}

const COLS_PADRAO = { custoUnit: false, custoTotal: true, pvUnit: false, pvTotal: true, margem: true, dtEntrada: false, dtSaida: false, dias: true, status: true, transferivel: true }

function TagLoja({ loja, ultimaSaida }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  return (
    <span ref={ref}
      style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', padding: '2px 6px', borderRadius: 'var(--radius)', background: 'rgba(22,163,74,0.12)', color: 'var(--green)', cursor: ultimaSaida ? 'pointer' : 'default' }}
      onMouseEnter={() => { if (ultimaSaida && ref.current) { const r = ref.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left }) } }}
      onMouseLeave={() => setPos(null)}
    >
      {loja}
      {pos && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, padding: '5px 10px', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          Última venda: {ultimaSaida instanceof Date ? ultimaSaida.toLocaleDateString('pt-BR') : '—'}
        </div>
      )}
    </span>
  )
}

export function AbaEstoque({ itens, pecas, diasJanela = 90, curvasSel = [], soTransf = false, onBaixar }) {
  const [busca, setBusca]     = useState('')
  const [pagina, setPagina]   = useState(0)
  const [cols, setCols]       = useState(COLS_PADRAO)
  const [openCols, setOpenCols] = useState(false)
  const colsRef = useRef(null)

  useEffect(() => {
    const h = e => { if (colsRef.current && !colsRef.current.contains(e.target)) setOpenCols(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggleCol = k => setCols(p => ({ ...p, [k]: !p[k] }))
  const POR_PAG = 100
  const { sort, onSort, sorted } = useSort('custoTotal', 'desc')

  const lojasPorCodigo = useMemo(() => {
    if (!pecas?.length) return {}
    const hoje   = new Date()
    const dCorte = new Date(hoje - diasJanela * 86400000)
    const map    = {}
    pecas.filter(r => r.comissao && r.dt instanceof Date && r.dt >= dCorte).forEach(r => {
      const cod  = findCodPecas(r)
      const loja = r.empresa || ''
      if (!cod || !loja) return
      if (!map[cod]) map[cod] = {}
      if (!map[cod][loja] || r.dt > map[cod][loja]) map[cod][loja] = r.dt
    })
    return map
  }, [pecas, diasJanela])

  const itensComTransf = useMemo(() => itens.map(item => {
    const codMap = lojasPorCodigo[item.codigo] || {}
    const sugestoes = Object.entries(codMap)
      .filter(([l]) => l !== item.loja)
      .sort((a, b) => b[1] - a[1])
      .map(([loja, ultimaSaida]) => ({ loja, ultimaSaida }))
    return { ...item, sugestoes }
  }), [itens, lojasPorCodigo])

  const filtrados = useMemo(() => {
    let r = itensComTransf
    if (curvasSel.length > 0) r = r.filter(i => curvasSel.includes(i.status))
    if (soTransf) r = r.filter(i => i.sugestoes.length > 0)
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      r = r.filter(i => i.codigo.toLowerCase().includes(q) || i.descricao.toLowerCase().includes(q))
    }
    return sorted(r, {
      loja:          i => i.loja,
      codigo:        i => i.codigo,
      descricao:     i => i.descricao,
      tipo:          i => i.tipo,
      saldo:         i => i.saldo,
      custoUnitario: i => i.custoUnitario,
      custoTotal:    i => i.custoTotal,
      pvUnitario:    i => i.pvUnitario,
      pvTotal:       i => i.pvTotal,
      margem:        i => i.pvTotal > 0 ? (i.pvTotal - i.custoTotal) / i.pvTotal : null,
      dtEntrada:     i => i.dtEntrada instanceof Date ? i.dtEntrada.getTime() : 0,
      dtSaida:       i => i.dtSaida   instanceof Date ? i.dtSaida.getTime()   : 0,
      diasReferencia:i => i.diasReferencia ?? 99999,
      status:        i => CURVA_META[i.status]?.ordem ?? 99,
      sugestoes:     i => i.sugestoes.length,
    })
  }, [itensComTransf, curvasSel, soTransf, busca, sort])

  const paginaItens = filtrados.slice(pagina * POR_PAG, (pagina + 1) * POR_PAG)
  const totQtde   = filtrados.reduce((s,r) => s + r.saldo, 0)
  const totCustoT = filtrados.reduce((s,r) => s + r.custoTotal, 0)
  const totPvT    = filtrados.reduce((s,r) => s + r.pvTotal, 0)
  const totMargem = totPvT > 0 ? (totPvT - totCustoT) / totPvT : null
  const thStyle   = { textAlign: 'center' }
  const temTransf = itensComTransf.some(i => i.sugestoes.length > 0)

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="card-title">Estoque</span>
        <span className="badge badge-gray">{filtrados.length.toLocaleString('pt-BR')} / {itens.length.toLocaleString('pt-BR')}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <ColSelector
            cols={cols}
            defs={[
              { k: 'custoUnit',    l: 'Custo Unit.' },
              { k: 'custoTotal',   l: 'Custo Total' },
              { k: 'pvUnit',       l: 'P. Venda Unit.' },
              { k: 'pvTotal',      l: 'P. Venda Total' },
              { k: 'margem',       l: 'Margem' },
              { k: 'dtEntrada',    l: 'Últ. Entrada' },
              { k: 'dtSaida',      l: 'Últ. Saída' },
              { k: 'dias',         l: 'Dias' },
              { k: 'status',       l: 'Curva' },
              { k: 'transferivel', l: 'Transferível Para' },
            ]}
            onChange={setCols}
          />
          <button className="btn btn-sm btn-ghost" onClick={() => onBaixar(filtrados, cols)} style={{ display:'flex',alignItems:'center',gap:4 }}>
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        <input className="form-input" placeholder="Buscar código ou descrição..." value={busca}
          onChange={e => { setBusca(e.target.value); setPagina(0) }} style={{ minWidth: 260, fontSize: 'var(--text-sm2)' }} />
      </div>

      <div className="table-wrap">
        <table className="tabela-estoque tabela-pessoas">
          <thead>
            <tr>
              <Th col="descricao"     sort={sort} onSort={onSort}>Peça</Th>
              <Th col="loja"          sort={sort} onSort={onSort}>Loja</Th>
              <Th col="tipo"          sort={sort} onSort={onSort}>Tipo</Th>
              <Th col="saldo"         sort={sort} onSort={onSort} style={thStyle}>Qtde</Th>
              {cols.custoUnit    && <Th col="custoUnitario"  sort={sort} onSort={onSort} style={thStyle}>Custo Unit.</Th>}
              {cols.custoTotal   && <Th col="custoTotal"     sort={sort} onSort={onSort} style={thStyle}>Custo Total</Th>}
              {cols.pvUnit       && <Th col="pvUnitario"     sort={sort} onSort={onSort} style={thStyle}>P. Venda Unit.</Th>}
              {cols.pvTotal      && <Th col="pvTotal"        sort={sort} onSort={onSort} style={thStyle}>P. Venda Total</Th>}
              {cols.margem       && <Th col="margem"         sort={sort} onSort={onSort} style={thStyle}>Margem</Th>}
              {cols.dtEntrada    && <Th col="dtEntrada"      sort={sort} onSort={onSort} style={thStyle}>Últ. Entrada</Th>}
              {cols.dtSaida      && <Th col="dtSaida"        sort={sort} onSort={onSort} style={thStyle}>Últ. Saída</Th>}
              {cols.dias         && <Th col="diasReferencia" sort={sort} onSort={onSort} style={thStyle}>Dias</Th>}
              {cols.status       && <Th col="status"         sort={sort} onSort={onSort}>Curva</Th>}
              {temTransf && cols.transferivel && <Th col="sugestoes" sort={sort} onSort={onSort}>Transferível Para</Th>}
            </tr>
          </thead>
          <tbody>
            {paginaItens.map((r, i) => {
              const margem = r.pvTotal > 0 ? (r.pvTotal - r.custoTotal) / r.pvTotal : null
              return (
                <TrHover key={i}>
                  <td><ItemPeca descricao={r.descricao} codigo={r.codigo} /></td>
                  <Td><LojaBadgeDS>{r.loja}</LojaBadgeDS></Td>
                  <Td style={{ color: 'var(--text3)' }}>{r.tipo}</Td>
                  <Td num>{r.saldo}</Td>
                  {cols.custoUnit   && <Td num>{r.custoUnitario > 0 ? fmtBRL(r.custoUnitario) : '—'}</Td>}
                  {cols.custoTotal  && <Td num style={{ fontWeight: 600 }}>{fmtBRL(r.custoTotal)}</Td>}
                  {cols.pvUnit      && <Td num>{r.pvUnitario > 0 ? fmtBRL(r.pvUnitario) : '—'}</Td>}
                  {cols.pvTotal  && <Td num style={{ fontWeight: 600 }}>{fmtBRL(r.pvTotal)}</Td>}
                  {cols.margem   && <Td num style={{ fontWeight: 700, color: margem != null ? (margem >= 0.3 ? 'var(--green)' : margem >= 0.1 ? 'var(--amber)' : 'var(--red-critical)') : 'var(--text3)' }}>{margem != null ? fmtPct(margem) : '—'}</Td>}
                  {cols.dtEntrada && <Td num style={{ color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.dtEntrada instanceof Date ? r.dtEntrada.toLocaleDateString('pt-BR') : '—'}</Td>}
                  {cols.dtSaida   && <Td num style={{ color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.dtSaida instanceof Date ? r.dtSaida.toLocaleDateString('pt-BR') : '—'}</Td>}
                  {cols.dias      && <Td num style={{ fontWeight: 700, color: CURVA_META[r.status]?.cor }}>{r.diasReferencia ?? '—'}</Td>}
                  {cols.status    && <Td><CurvaBadge status={r.status} /></Td>}
                  {temTransf && cols.transferivel && (
                    <Td>
                      {r.sugestoes.length > 0 ? (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {r.sugestoes.map(s => <TagLoja key={s.loja} loja={s.loja} ultimaSaida={s.ultimaSaida} />)}
                        </div>
                      ) : <span style={{ color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>—</span>}
                    </Td>
                  )}
                </TrHover>
              )
            })}
          </tbody>
          <tfoot>
            <TrTotal>
              <td colSpan={3} style={{ padding: '6px 10px' }} />
              <Td num style={{ fontWeight: 700, padding: '6px 10px' }}>{totQtde.toLocaleString('pt-BR')}</Td>
              {cols.custoUnit  && <td style={{ padding: '6px 10px' }} />}
              {cols.custoTotal && <Td num style={{ fontWeight: 700, padding: '6px 10px' }}>{fmtBRL(totCustoT)}</Td>}
              {cols.pvUnit     && <td style={{ padding: '6px 10px' }} />}
              {cols.pvTotal  && <Td num style={{ fontWeight: 700, padding: '6px 10px' }}>{fmtBRL(totPvT)}</Td>}
              {cols.margem   && <Td num style={{ fontWeight: 700, padding: '6px 10px', color: totMargem != null ? (totMargem >= 0.3 ? 'var(--green)' : totMargem >= 0.1 ? 'var(--amber)' : 'var(--red-critical)') : 'var(--text3)' }}>{totMargem != null ? fmtPct(totMargem) : '—'}</Td>}
              {cols.dtEntrada && <td style={{ padding: '6px 10px' }} />}
              {cols.dtSaida   && <td style={{ padding: '6px 10px' }} />}
              {cols.dias      && <td style={{ padding: '6px 10px' }} />}
              {cols.status    && <td style={{ padding: '6px 10px' }} />}
              {temTransf && cols.transferivel && <td style={{ padding: '6px 10px' }} />}
            </TrTotal>
          </tfoot>
        </table>
      </div>
      <Paginacao pagina={pagina} total={filtrados.length} porPag={POR_PAG} onChange={setPagina} />
    </div>
  )
}
