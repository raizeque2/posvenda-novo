import { useState, useRef } from 'react'
import { fmtBRL, fmtPct } from '../../utils/formatacao.js'

// Tooltip inline mostrando breakdown bruto/devolução/líquido
export function DevBadge({ bruto, dev }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  return (
    <span
      ref={ref}
      style={{ display: 'inline-block', marginLeft: 5 }}
      onMouseEnter={() => {
        const r = ref.current?.getBoundingClientRect()
        if (r) setPos({ top: r.bottom + 4, left: r.left })
      }}
      onMouseLeave={() => setPos(null)}
    >
      <span style={{ color: 'var(--red)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', cursor: 'pointer' }}>▼</span>
      {pos && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 6, padding: '6px 10px', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)', lineHeight: 1.8,
        }}>
          <div style={{ color: 'var(--text2)' }}>Bruto: <strong>{fmtBRL(bruto)}</strong></div>
          <div style={{ color: 'var(--red)' }}>Dev.: − <strong>{fmtBRL(dev)}</strong></div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2 }}>
            Líquido: <strong>{fmtBRL(bruto - dev)}</strong>
          </div>
        </div>
      )}
    </span>
  )
}

// Tooltip inline para Peças OS mostrando breakdown Serviço/Revisão/Cortesia
export function PecasOSHover({ val, servico = 0, revisao = 0, cortesia = 0 }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const temDetalhes = servico > 0 || revisao > 0 || cortesia > 0
  if (!temDetalhes) return <span>{fmtBRL(val)}</span>
  const lbl = { color: 'var(--text3)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
      <span style={lbl}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
  return (
    <span
      ref={ref}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => {
        const r = ref.current?.getBoundingClientRect()
        if (r) setPos({ top: r.bottom + 4, left: r.left })
      }}
      onMouseLeave={() => setPos(null)}
    >
      {fmtBRL(val)}
      {pos && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 6, padding: '6px 10px', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)', lineHeight: 1.8, fontWeight: 'var(--weight-normal)',
        }}>
          {servico  > 0 && row('Serviço',  fmtBRL(servico))}
          {revisao  > 0 && row('Revisão',  fmtBRL(revisao))}
          {cortesia > 0 && row('Cortesia', fmtBRL(cortesia))}
        </div>
      )}
    </span>
  )
}

export function RankLabel({ pos }) {
  const style = pos <= 3
    ? { color: 'var(--honda)', fontWeight: 'var(--weight-bold)', width: 28, textAlign: 'center' }
    : { color: 'var(--text3)', fontWeight: 'var(--weight-semibold)', width: 28, textAlign: 'center' }
  return <td style={style}>{pos}°</td>
}

export function rowClass(pos) {
  if (pos === 1) return 'row-top1'
  if (pos === 2) return 'row-top2'
  return ''
}

export function ThSort({ col, label, center, sortCol, sortDir, onSort, className }) {
  const active = sortCol === col
  return (
    <th
      className={className}
      onClick={() => onSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: center ? 'center' : 'left' }}
    >
      {label}
      {active && <span style={{ color: 'var(--honda)', fontSize: 'var(--text-2xs)', marginLeft: 3 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  )
}
