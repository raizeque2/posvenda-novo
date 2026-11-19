import { useState, useMemo, useRef, useEffect } from 'react'
import { fmtBRL } from '../../utils/formatacao.js'

export function parseSalario(v) {
  if (!v) return 0
  const s = String(v).trim()
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0
  return Number(s) || 0
}
export function fmtSalario(v) {
  const n = parseSalario(v)
  if (!n) return '–'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export const iFlat = { borderRadius: 'var(--radius)', padding: '3px 8px', fontSize: 'var(--text-sm2)', height: 28, width: '100%' }
export const tdE   = { padding: '2px 4px', verticalAlign: 'middle' }
export const stickyName = {
  position: 'sticky', left: 0, zIndex: 2,
  background: 'var(--bg2)',
  boxShadow: '2px 0 5px rgba(0,0,0,0.07)',
}
export const stickyNameTh = {
  position: 'sticky', left: 0, zIndex: 4,
  background: 'var(--bg3)',
  boxShadow: '2px 0 5px rgba(0,0,0,0.07)',
}

export function calcPanelPos(rect, panelH = 260, panelW = 160) {
  const dropUp = rect.bottom + panelH > window.innerHeight
  const left   = Math.min(rect.left, window.innerWidth - panelW - 4)
  return dropUp
    ? { top: 'auto', bottom: window.innerHeight - rect.top + 2, left }
    : { top: rect.bottom + 2, bottom: 'auto', left }
}

export function CellDropdown({ value, onChange, options, placeholder = 'Selecionar...', startOpen = false }) {
  const [open, setOpen]         = useState(startOpen)
  const [busca, setBusca]       = useState('')
  const [panelPos, setPanelPos] = useState({})
  const ref      = useRef(null)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    if (!busca) return options
    return options.filter(o => o.toLowerCase().includes(busca.toLowerCase()))
  }, [options, busca])

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setBusca('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // startOpen (célula clicada já nasce com o painel aberto) — calcula a
  // posição e foca a busca assim que monta, sem precisar de um 2º clique.
  useEffect(() => {
    if (!startOpen) return
    if (ref.current) setPanelPos(calcPanelPos(ref.current.getBoundingClientRect(), 260, 180))
    setTimeout(() => inputRef.current?.focus(), 30)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleOpen() {
    if (open) { setOpen(false); setBusca(''); return }
    if (ref.current) setPanelPos(calcPanelPos(ref.current.getBoundingClientRect(), 260, 180))
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function select(opt) { onChange(opt ? opt.split(' –')[0].trim() : ''); setOpen(false); setBusca('') }

  const isEmpty = !value

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button type="button" onClick={handleOpen} className="form-input"
        style={{ ...iFlat, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', textAlign: 'left', gap: 4,
          background: isEmpty ? 'rgba(245,158,11,0.08)' : undefined }}>
        <span style={{ fontSize: 'var(--text-sm2)', color: isEmpty ? 'var(--text3)' : 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {value || placeholder}
        </span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text3)', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'fixed', zIndex: 9999, minWidth: 180, ...panelPos,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', maxHeight: 260 }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <input ref={inputRef} className="form-input"
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar..." autoComplete="off"
              style={{ ...iFlat, height: 26, fontSize: 'var(--text-sm2)', width: '100%' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {value && (
              <div onMouseDown={() => select('')}
                style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 'var(--text-sm2)',
                  color: 'var(--text3)', fontStyle: 'italic' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                — limpar
              </div>
            )}
            {filtered.length === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 'var(--text-sm2)', fontStyle: 'italic' }}>
                Nenhum resultado
              </div>
            )}
            {filtered.map(opt => {
              const active = value && opt.startsWith(value + ' –')
              return (
                <div key={opt} onMouseDown={() => select(opt)}
                  style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--text-sm2)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                    color: active ? 'var(--honda)' : 'var(--text)',
                    background: active ? 'rgba(204,0,0,0.04)' : undefined }}
                  onMouseEnter={e => e.currentTarget.style.background = active ? 'rgba(204,0,0,0.08)' : 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = active ? 'rgba(204,0,0,0.04)' : ''}>
                  {active && <span style={{ color: 'var(--honda)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)' }}>✓</span>}
                  {opt}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function CellSelect({ value, onChange, options, placeholder = '', upperCase = false, startOpen = false }) {
  const [open, setOpen]           = useState(false)
  const [panelPos, setPanelPos]   = useState({})
  const [highlight, setHighlight] = useState(null)
  const ref = useRef(null)

  const filtered = useMemo(() => {
    if (!value) return options.slice(0, 20)
    return options.filter(o => o.toLowerCase().includes(value.toLowerCase())).slice(0, 20)
  }, [options, value])

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => { if (!open) setHighlight(null) }, [open])

  function handleFocus() {
    if (ref.current) setPanelPos(calcPanelPos(ref.current.getBoundingClientRect(), 220, 200))
    setOpen(true)
  }

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <input
        className="form-input"
        value={value}
        placeholder={placeholder}
        autoFocus={startOpen}
        onChange={e => { onChange(upperCase ? e.target.value.toUpperCase() : e.target.value); setHighlight(null) }}
        onFocus={handleFocus}
        onKeyDown={e => {
          if (!open) return
          if (e.key === 'Escape') { setOpen(false); return }
          if (e.key === 'Tab')    { setOpen(false); return }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight(h => Math.min((h ?? -1) + 1, filtered.length - 1))
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight(h => Math.max((h ?? 0) - 1, 0))
          }
          if (e.key === 'Enter' && highlight != null && filtered[highlight]) {
            e.preventDefault(); onChange(filtered[highlight]); setOpen(false)
          }
        }}
        style={iFlat}
      />
      {open && (filtered.length > 0 || value) && (
        <div style={{
          position: 'fixed', zIndex: 9999, minWidth: 160, ...panelPos,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map((o, index) => (
            <div key={o}
              onMouseDown={() => { onChange(o); setOpen(false) }}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--text-base)', color: 'var(--text)', whiteSpace: 'nowrap',
                background: index === highlight ? 'var(--bg4)' : '' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => { e.currentTarget.style.background = index === highlight ? 'var(--bg4)' : '' }}>
              {o}
            </div>
          ))}
          {filtered.length === 0 && value && (
            <div style={{ padding: '7px 12px', fontSize: 'var(--text-sm)', color: 'var(--text3)', fontStyle: 'italic' }}>
              Novo: "{value}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CellMultiSelect({ value, onChange, options, startOpen = false }) {
  const [open, setOpen]         = useState(startOpen)
  const [panelPos, setPanelPos] = useState({})
  const ref = useRef(null)
  const sel = useMemo(
    () => new Set(value ? value.split(';').map(s => s.trim()).filter(Boolean) : []),
    [value]
  )

  function toggle(opt) {
    const s = new Set(sel); if (s.has(opt)) s.delete(opt); else s.add(opt)
    onChange([...s].join(';'))
  }

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (startOpen && ref.current) setPanelPos(calcPanelPos(ref.current.getBoundingClientRect(), 260, 160))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleToggle() {
    if (!open && ref.current) setPanelPos(calcPanelPos(ref.current.getBoundingClientRect(), 260, 160))
    setOpen(o => !o)
  }

  const items   = sel.size > 0 ? [...sel] : []
  const display = items.length === 0 ? '–' : items.length === 1 ? items[0] : `${items[0]} +${items.length - 1}`
  const isEmpty = sel.size === 0

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button
        type="button"
        onClick={handleToggle}
        className="form-input"
        style={{
          ...iFlat, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', textAlign: 'left', gap: 4,
          background: isEmpty ? 'rgba(245,158,11,0.08)' : undefined,
        }}>
        <span style={{ fontSize: 'var(--text-sm2)', color: isEmpty ? 'var(--text3)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {display}
        </span>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text3)', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'fixed', zIndex: 9999, minWidth: 160, ...panelPos,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          padding: '4px 0', maxHeight: 260, overflowY: 'auto',
        }}>
          {options.map(opt => {
            const active = sel.has(opt)
            return (
              <div key={opt}
                onMouseDown={e => { e.preventDefault(); toggle(opt) }}
                style={{
                  padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--text-sm2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  color: active ? 'var(--honda)' : 'var(--text)',
                  background: active ? 'rgba(204,0,0,0.04)' : undefined,
                }}
                onMouseEnter={e => e.currentTarget.style.background = active ? 'rgba(204,0,0,0.08)' : 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = active ? 'rgba(204,0,0,0.04)' : ''}>
                <span style={{ width: 14, textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--honda)', fontWeight: 'var(--weight-bold)', flexShrink: 0 }}>
                  {active ? '✓' : ''}
                </span>
                {opt}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MetaInput({ value, onChange, col, startOpen = false }) {
  const ref = useRef(null)

  function parseRaw(s) {
    const str = String(s ?? '').trim()
    if (!str) return 0
    if (str.includes(',')) return Number(str.replace(/\./g, '').replace(',', '.')) || 0
    if (/^\d+\.\d{1,2}$/.test(str)) return Number(str) || 0
    return Number(str.replace(/\./g, '')) || 0
  }

  function toDisplay(v) {
    const n = parseRaw(v)
    return n ? n.toLocaleString('pt-BR') : ''
  }

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.value = toDisplay(value)
    }
  }, [value])

  return (
    <input
      ref={ref}
      className="form-input"
      type="text"
      inputMode="numeric"
      data-metacol={col}
      defaultValue={toDisplay(value)}
      autoFocus={startOpen}
      onFocus={e => {
        const n = parseRaw(e.target.value)
        e.target.value = n ? String(n) : ''
        e.target.select()
      }}
      onBlur={e => {
        const n = parseRaw(e.target.value)
        onChange(n || '')
        e.target.value = toDisplay(n)
      }}
      onKeyDown={e => {
        if (e.key === 'Tab' && col) {
          const inputs = document.querySelectorAll(`input[data-metacol="${col}"]`)
          const idx = Array.from(inputs).indexOf(ref.current)
          const next = e.shiftKey ? inputs[idx - 1] : inputs[idx + 1]
          if (next) { e.preventDefault(); next.focus() }
        }
      }}
      style={iFlat}
    />
  )
}

export function ChipMultiSelect({ value, onChange, options, abbreviated = false }) {
  const sel = new Set(value ? value.split(';').map(s => s.trim()).filter(Boolean) : [])
  function toggle(opt) {
    const s = new Set(sel); if (s.has(opt)) s.delete(opt); else s.add(opt); onChange([...s].join(';'))
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {options.map(opt => {
        const active = sel.has(opt)
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)} style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius)',
            border: `1px solid ${active ? 'var(--honda)' : 'var(--border2)'}`,
            background: active ? 'var(--honda-bg)' : 'var(--bg3)',
            color: active ? 'var(--honda)' : 'var(--text2)',
            fontSize: 'var(--text-sm2)', cursor: 'pointer', fontWeight: active ? 600 : 400,
            whiteSpace: 'nowrap', transition: 'all 0.12s', lineHeight: 1.4,
          }}>{abbreviated ? opt.split(' ')[0] : opt}</button>
        )
      })}
    </div>
  )
}
