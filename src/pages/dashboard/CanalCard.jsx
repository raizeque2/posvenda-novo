import { useState, useMemo } from 'react'
import { norm } from '../../utils/normalizacao.js'
import { fmtBRL, fmtPct, nomeAbrev } from '../../utils/formatacao.js'
import { LojaTags, StatusBadge } from '../../components/DS.jsx'
import { DevBadge, RankLabel, rowClass, ThSort } from './DashAux.jsx'

const SCROLL_THRESHOLD = 8

export function CanalCard({ titulo, count, rows, secKey, cat, scrollAtivo, exportSels, vendaHojeColabMap, diasDec, diasMes }) {
  const [sortCol, setSortCol] = useState('proj')
  const [sortDir, setSortDir] = useState('desc')
  const [showDetalhes, setShowDetalhes] = useState(false)

  // Colunas base (10) + CMV e Imposto quando expandido
  const totalCols = 10 + (showDetalhes ? 2 : 0)

  function handleSort(col) {
    if (sortCol === col) {
      if (sortDir === 'desc') setSortDir('asc')
      else { setSortCol('proj'); setSortDir('desc') }
    } else {
      setSortCol(col); setSortDir('desc')
    }
  }

  const sortedRows = useMemo(() => {
    const fns = {
      proj:   r => r.metaCanal > 0 ? r.projCanal / r.metaCanal : (r.liq > 0 ? -0.001 : -Infinity),
      loja:   r => r.lojas?.[0] || '',
      nome:   r => (r.nome || '').trim(),
      meta:   r => r.metaCanal || 0,
      real:   r => r.liq || 0,
      hoje:   r => vendaHojeColabMap[norm(r.nome)]?.[cat] || 0,
      tm:     r => r.nrReq > 0 ? r.liq / r.nrReq : 0,
      margem: r => r.margem ?? -Infinity,
    }
    const fn = fns[sortCol] || fns.proj
    return [...rows].sort((a, b) => {
      const va = fn(a), vb = fn(b)
      if (typeof va === 'string') return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb)
      return sortDir === 'desc' ? (vb || 0) - (va || 0) : (va || 0) - (vb || 0)
    })
  }, [rows, sortCol, sortDir, vendaHojeColabMap, cat])

  const withScroll  = scrollAtivo && rows.length > SCROLL_THRESHOLD
  const printHidden = !exportSels.has(secKey) ? 'no-print-section' : ''

  const totals = useMemo(() => ({
    liq:   rows.reduce((s, r) => s + r.liq, 0),
    proj:  rows.reduce((s, r) => s + r.projCanal, 0),
    meta:  rows.reduce((s, r) => s + r.metaCanal, 0),
    imp:   rows.reduce((s, r) => s + (r.imposto || 0), 0),
    custo: rows.reduce((s, r) => s + (r.custo   || 0), 0),
    hoje:  rows.reduce((s, r) => s + (vendaHojeColabMap[norm(r.nome)]?.[cat] || 0), 0),
  }), [rows, vendaHojeColabMap, cat])

  const tStyle = { padding: '9px 12px', color: 'var(--text3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', textAlign: 'center', verticalAlign: 'middle', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 3 }

  return (
    <div className={`card ${printHidden}`} style={{ marginBottom: 0, overflow: 'hidden', isolation: 'isolate' }}>
      <div className={`table-mobile-sticky ${withScroll ? 'table-wrap table-scroll' : 'table-wrap'}`}
        style={withScroll ? { maxHeight: 354, overflowY: 'auto' } : {}}>
        <table style={{ tableLayout: 'fixed' }} className="canal-table">
          <colgroup>
            <col style={{ width: 32 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 100 }} />
            {showDetalhes && <col style={{ width: 86 }} />}
            {showDetalhes && <col style={{ width: 86 }} />}
            <col style={{ width: 72 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 68 }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td colSpan={totalCols} style={{ ...tStyle, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="card-title">{titulo}</span>
                  {sortCol !== 'proj' && (
                    <button className="btn btn-ghost btn-xs"
                      onClick={() => { setSortCol('proj'); setSortDir('desc') }}>↺ padrão</button>
                  )}
                  <span className="no-print" style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    R$ <strong>{fmtBRL(totals.liq)}</strong>{totals.hoje > 0 && <> · Hoje <strong>{fmtBRL(totals.hoje)}</strong></>}
                  </span>
                  <button className="btn btn-ghost btn-xs no-print" onClick={() => setShowDetalhes(v => !v)}>
                    {showDetalhes ? 'Ocultar' : 'Expandir'}
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => { setSortCol('proj'); setSortDir('desc') }} title="Padrão: projeção">#</th>
              <ThSort col="loja"   label="Loja"        sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <ThSort col="nome"   label="Colaborador" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <ThSort col="real"   label="Realizado"   center sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              {showDetalhes && <th style={{ textAlign: 'center' }}>Imposto</th>}
              {showDetalhes && <th style={{ textAlign: 'center' }}>CMV</th>}
              <ThSort col="margem" label="% Margem"    center sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <ThSort col="meta"   label="Meta"        center sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th style={{ textAlign: 'center' }}>% Meta</th>
              <ThSort col="proj"   label="Projeção"    center sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <ThSort col="hoje"   label="Hoje"        center sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <ThSort col="tm"     label="TM"          center sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((c, i) => {
              const hojeColab = vendaHojeColabMap[norm(c.nome)]?.[cat] || 0
              return (
                <tr key={c.nome} className={rowClass(i + 1)}>
                  <RankLabel pos={i + 1} />
                  <td><LojaTags lojas={c.lojas} max={1} /></td>
                  <td className="name-cell" style={{ whiteSpace: 'nowrap' }}>
                    <span className="collab-name" title={c.nome}>{nomeAbrev(c.nome)}</span>
                    {c.inativo
                      ? <span className="badge badge-gray" style={{ marginLeft: 5, fontSize: 'var(--text-2xs)' }}>inativo</span>
                      : !c.temMeta && <span style={{ color: 'var(--text3)', fontWeight: 'var(--weight-normal)' }}> *</span>}
                    <div className="name-loja-mobile"><LojaTags lojas={c.lojas} /></div>
                  </td>
                  <td className="text-bold" style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                    {fmtBRL(c.liq)}
                    {c.dev > 0 && <DevBadge bruto={c.liq + c.dev} dev={c.dev} />}
                  </td>
                  {showDetalhes && <td className="text-muted" style={{ textAlign: 'center' }}>{c.imposto > 0 ? fmtBRL(c.imposto) : '–'}</td>}
                  {showDetalhes && <td className="text-muted" style={{ textAlign: 'center' }}>{c.custo > 0 ? fmtBRL(c.custo) : '–'}</td>}
                  <td className="text-muted" style={{ textAlign: 'center' }}>{c.margem !== null ? fmtPct(c.margem) : '–'}</td>
                  <td className="text-muted" style={{ textAlign: 'center' }}>{c.metaCanal > 0 ? fmtBRL(c.metaCanal) : '–'}</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {c.metaCanal > 0 && c.projCanal > 0
                      ? <StatusBadge pct={c.projCanal / c.metaCanal} />
                      : <span style={{ color: 'var(--text3)' }}>–</span>}
                  </td>
                  <td className="text-muted" style={{ textAlign: 'center' }}>{c.projCanal > 0 ? fmtBRL(c.projCanal) : '–'}</td>
                  <td className="text-muted" style={{ textAlign: 'center' }}>{hojeColab > 0 ? fmtBRL(hojeColab) : '–'}</td>
                  <td className="text-muted" style={{ textAlign: 'center' }}>{c.nrReq > 0 ? fmtBRL(c.liq / c.nrReq) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
