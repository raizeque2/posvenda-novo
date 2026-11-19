import { useState, useMemo, useEffect, useRef } from 'react'
import { MESES_ABREV } from './utils.js'

export function SeletorSnapshot({ meses, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [anoSel, setAnoSel] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const porMes = useMemo(() => {
    const m = {}
    meses.forEach(x => { m[x.mesAno] = x })
    return m
  }, [meses])

  const anos = useMemo(() => [...new Set(meses.map(x => x.mesAno.split('/')[1]))].sort((a,b) => b.localeCompare(a)), [meses])
  const anoEfetivo = anoSel || (value ? value.split('/')[1] : anos[0])
  const btnLabel = value || 'Posição'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`filter-select filter-dropdown-btn${value ? ' filter-active' : ''}`} onClick={() => setOpen(v => !v)}>
        {btnLabel}<span style={{ fontSize: 'var(--text-2xs)', marginLeft: 6, opacity: 0.45 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="filter-dropdown-panel" style={{ minWidth: 230, padding: '8px 0 4px' }}>
          {anos.length > 1 && (
            <div style={{ padding: '0 12px 8px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Ano</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {anos.map(ano => (
                  <button key={ano} onClick={() => setAnoSel(ano)} style={{
                    padding: '3px 12px', borderRadius: 5, fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-bold)',
                    fontFamily: 'var(--font)', cursor: 'pointer', border: '1px solid',
                    background: anoEfetivo === ano ? 'var(--honda-bg)' : 'var(--bg3)',
                    borderColor: anoEfetivo === ano ? 'var(--honda)' : 'var(--border2)',
                    color: anoEfetivo === ano ? 'var(--honda)' : 'var(--text2)',
                  }}>{ano}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{anoEfetivo}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {Array.from({ length: 12 }, (_, i) => {
                const mm = String(i+1).padStart(2,'0')
                const mesAno = `${mm}/${anoEfetivo}`
                const info = porMes[mesAno]
                const temDado = !!info && !info.semDado
                const semDado = info?.semDado
                const ativo = value === mesAno
                return (
                  <button key={mm} onClick={() => { if (temDado) { onChange(mesAno); setOpen(false) } }}
                    title={semDado ? 'Sem upload de estoque neste mês' : undefined}
                    style={{
                    padding: '6px 4px', borderRadius: 5, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                    fontFamily: 'var(--font)', cursor: temDado ? 'pointer' : 'default',
                    border: '1px solid', opacity: temDado ? 1 : 0.28,
                    background: ativo ? 'var(--honda-bg)' : 'var(--bg3)',
                    borderColor: ativo ? 'var(--honda)' : (semDado ? 'var(--red)' : 'var(--border2)'),
                    color: ativo ? 'var(--honda)' : temDado ? 'var(--text)' : (semDado ? 'var(--red)' : 'var(--text3)'),
                  }}>{MESES_ABREV[i]}{info?.atual && <span style={{fontSize:'var(--text-2xs)', opacity:0.7}}> ●</span>}</button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
