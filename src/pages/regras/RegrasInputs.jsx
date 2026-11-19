import { useState, useEffect, useRef } from 'react'
import { FormDropdown } from '../../components/DS.jsx'

export function BadgeToggle({ value, onChange, readOnly }) {
  return (
    <span onClick={() => !readOnly && onChange(!value)} style={{
      cursor: readOnly ? 'default' : 'pointer', display: 'inline-block', borderRadius: 4,
      padding: '2px 8px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', userSelect: 'none',
      background: value ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
      color: value ? '#34d399' : '#f87171',
    }} title={readOnly ? undefined : 'Clique para alternar'}>
      {value ? 'SIM' : 'NÃO'}
    </span>
  )
}

export function EditableSelect({ value, options, onSave, readOnly }) {
  const [editing, setEditing] = useState(false)
  if (!readOnly && editing) return (
    <div style={{ minWidth: 140 }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setEditing(false) }}>
      <FormDropdown
        value={value}
        options={options.map(o => ({ value: o, label: o }))}
        onChange={v => { onSave(v); setEditing(false) }}
      />
    </div>
  )
  return (
    <span onClick={() => !readOnly && setEditing(true)}
      style={{ cursor: readOnly ? 'default' : 'pointer', borderBottom: readOnly ? 'none' : '1px dashed var(--border2)', paddingBottom: 1 }}
      title={readOnly ? undefined : 'Clique para editar'}>
      {value || '–'}
    </span>
  )
}

export function EditableText({ value, onSave, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  if (!readOnly && editing) return (
    <input autoFocus className="form-input" value={val}
      style={{ padding: '2px 6px', fontSize: 'var(--text-sm2)', width: '100%', minWidth: 80 }}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onSave(val); setEditing(false) }}
      onKeyDown={e => {
        if (e.key === 'Enter') { onSave(val); setEditing(false) }
        if (e.key === 'Escape') setEditing(false)
      }} />
  )
  return (
    <span onClick={() => !readOnly && setEditing(true)}
      style={{ cursor: readOnly ? 'default' : 'pointer', borderBottom: readOnly ? 'none' : '1px dashed var(--border2)', paddingBottom: 1 }}
      title={readOnly ? undefined : 'Clique para editar'}>
      {value || '–'}
    </span>
  )
}

export function EditableMultiplier({ value, onSave, suffix = 'x', readOnly }) {
  const ref = useRef(null)
  const display = v => { const n = v || 0; return n ? String(Math.round(n * 1000) / 1000) : '' }
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = display(value)
  }, [value])
  if (readOnly) return (
    <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
      {display(value) || '0'}{suffix}
    </span>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <input ref={ref} type="text" inputMode="decimal" className="form-input" defaultValue={display(value)} placeholder="0"
        onFocus={e => e.target.select()}
        onBlur={e => { const n = parseFloat(e.target.value.replace(',', '.')) || 0; onSave(n); e.target.value = n ? String(n) : '' }}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { ref.current.value = display(value); e.target.blur() } }}
        style={{ padding: '5px 8px', fontSize: 'var(--text-sm2)', width: 60, minWidth: 60 }}
      />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', userSelect: 'none' }}>{suffix}</span>
    </div>
  )
}

export function EditablePct({ value, onSave, readOnly }) {
  const ref = useRef(null)
  const pctDisplay = v => { const n = Math.round((v || 0) * 100 * 1000) / 1000; return n ? String(n) : '' }
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = pctDisplay(value)
  }, [value])
  if (readOnly) return (
    <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
      {pctDisplay(value) || '0'}%
    </span>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <input ref={ref} type="text" inputMode="decimal" className="form-input" defaultValue={pctDisplay(value)} placeholder="0"
        onFocus={e => e.target.select()}
        onBlur={e => { const pct = parseFloat(e.target.value.replace(',', '.')) || 0; onSave(pct / 100); e.target.value = pct ? String(pct) : '' }}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { ref.current.value = pctDisplay(value); e.target.blur() } }}
        style={{ padding: '5px 8px', fontSize: 'var(--text-sm2)', width: 60, minWidth: 60 }}
      />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', userSelect: 'none' }}>%</span>
    </div>
  )
}
