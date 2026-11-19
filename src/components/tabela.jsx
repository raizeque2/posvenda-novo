import { useState, useMemo } from 'react'

// ── Hook de ordenação multi-coluna ────────────────────────────────────────────
// Clique simples → coluna primária (substitui tudo)
// Shift+clique  → adiciona/alterna critério secundário
export function useSorter(rows, colDefs, initial = []) {
  const initArr = Array.isArray(initial)
    ? initial
    : (initial?.col ? [{ col: initial.col, dir: initial.dir || 'asc' }] : [])

  const [sorts, setSorts] = useState(initArr)

  const toggle = (col, shiftKey = false) => {
    setSorts(prev => {
      const idx = prev.findIndex(s => s.col === col)
      if (!shiftKey) {
        // Clique simples: substitui tudo; se já era primário, inverte direção
        if (prev.length > 0 && prev[0].col === col) {
          return [{ col, dir: prev[0].dir === 'asc' ? 'desc' : 'asc' }]
        }
        return [{ col, dir: 'asc' }]
      }
      // Shift+clique: adiciona ou alterna direção do critério existente
      if (idx === -1) return [...prev, { col, dir: 'asc' }]
      const updated = [...prev]
      updated[idx] = { col, dir: updated[idx].dir === 'asc' ? 'desc' : 'asc' }
      return updated
    })
  }

  const sorted = useMemo(() => {
    if (!sorts.length) return rows
    return [...rows].sort((a, b) => {
      for (const s of sorts) {
        const fn = colDefs[s.col] || (r => r[s.col])
        const va = fn(a), vb = fn(b)
        const cmp = typeof va === 'string'
          ? va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' })
          : (va > vb ? 1 : va < vb ? -1 : 0)
        if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [rows, sorts])

  return { sorted, sort: sorts, toggle }
}

// ── Cabeçalho de coluna ordenável ────────────────────────────────────────────
export function Th({ col, label, sort, toggle, style }) {
  const sortArr = Array.isArray(sort) ? sort : (sort?.col ? [sort] : [])
  const idx = sortArr.findIndex(s => s.col === col)
  const active = idx >= 0 ? sortArr[idx] : null

  return (
    <th
      onClick={e => toggle(col, e.shiftKey)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        padding: '8px 10px',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        color: active ? 'var(--honda)' : 'var(--text3)',
        borderBottom: '1px solid var(--border)',
        ...style,
      }}
      title="Clique para ordenar · Shift+clique para ordenação secundária"
    >
      {label}{' '}
      {active ? (
        <span style={{ fontSize: 'var(--text-2xs)' }}>
          {sortArr.length > 1 && <sup style={{ fontSize: 'var(--text-2xs)', opacity: 0.6, marginRight: 1 }}>{idx + 1}</sup>}
          {active.dir === 'asc' ? '↑' : '↓'}
        </span>
      ) : (
        <span style={{ fontSize: 'var(--text-2xs)', opacity: 0.4 }}>⇅</span>
      )}
    </th>
  )
}

// ── Botões de estado (AL / PE) ────────────────────────────────────────────────
const ESTADO_LABELS = { AL: 'Alagoas', PE: 'Pernambuco' }

export function EstadoBtns({ value, onChange }) {
  return (
    <>
      {['AL', 'PE'].map(uf => (
        <button key={uf} onClick={() => onChange(uf === value ? '' : uf)} style={{
          padding: '4px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer',
          fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-bold)', fontFamily: 'inherit',
          background: value === uf ? 'rgba(59,130,246,0.2)' : 'var(--bg3)',
          borderColor: value === uf ? 'var(--accent)' : 'var(--border2)',
          color: value === uf ? '#60a5fa' : 'var(--text3)',
        }}>
          {uf} — {ESTADO_LABELS[uf]}
        </button>
      ))}
    </>
  )
}
