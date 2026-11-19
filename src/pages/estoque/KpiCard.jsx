import { useState, useRef } from 'react'
import { Tag } from '../../components/DS.jsx'
import { CURVA_META } from '../../services/processamento/processarObsoleto.js'

export function KpiCard({ label, valor, sub, cor, mini, loading }) {
  const [tipPos, setTipPos] = useState(null)
  const iRef = useRef(null)
  return (
    <div style={{
      background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', padding: '10px 14px',
      border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
        {sub && (
          <span ref={iRef} style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', cursor: 'pointer', opacity: 0.5, lineHeight: 1, userSelect: 'none' }}
            onClick={() => setTipPos(v => v ? null : (() => { const r = iRef.current?.getBoundingClientRect(); if (!r) return null; const TIP_W = 220; return { top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - TIP_W - 8) } })())}
            onMouseEnter={() => {
              const r = iRef.current?.getBoundingClientRect()
              if (!r) return
              const TIP_W = 220
              const left = r.left + TIP_W > window.innerWidth - 8 ? window.innerWidth - TIP_W - 8 : r.left
              const top  = r.bottom + 4 + 80 > window.innerHeight ? r.top - 84 : r.bottom + 4
              setTipPos({ top, left })
            }}
            onMouseLeave={() => setTipPos(null)}>ⓘ</span>
        )}
      </div>
      {loading ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            border: '2px solid var(--accent)', borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>calculando…</span>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: cor || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      )}
      {tipPos && (
        <div style={{ position: 'fixed', top: tipPos.top, left: tipPos.left, zIndex: 9999, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '7px 11px', fontSize: 'var(--text-sm)', color: 'var(--text2)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 220, lineHeight: 1.6, pointerEvents: 'none' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export function CurvaBadge({ status }) {
  const meta = CURVA_META[status] || CURVA_META.SEM_DATA
  const corMap = { 'var(--green)': 'green', '#2563eb': 'blue', 'var(--amber)': 'amber', '#ea580c': 'amber', 'var(--red-critical)': 'red' }
  const cor = corMap[meta.cor] || 'gray'
  return <Tag cor={cor}>{meta.label}</Tag>
}
