import { useState } from 'react'
import { Icon } from '../../icons/iconoir'

// Célula "Peça" no estilo da lista de usuários: ícone + descrição + código embaixo.
export function ItemPeca({ descricao, codigo, icone = 'box' }) {
  return (
    <div className="tp-pessoa" title={descricao}>
      <span className="tp-icone"><Icon name={icone} size={17} /></span>
      <div style={{ minWidth: 0 }}><div className="tp-nome tp-trunca">{descricao}</div><div className="tp-sub">{codigo}</div></div>
    </div>
  )
}

export function Th({ children, col, sort, onSort, style }) {
  const ativo = sort?.col === col
  const isNum = style?.textAlign === 'center' || style?.textAlign === 'right'
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        padding: '8px 10px',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: ativo ? 'var(--honda)' : 'var(--text3)',
        textAlign: isNum ? 'right' : 'left',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid rgba(15,23,42,0.08)',
        transition: 'color 0.15s',
      }}
    >
      {children}
      <span style={{ marginLeft: 3, opacity: ativo ? 1 : 0.35, fontSize: 'var(--text-2xs)' }}>
        {ativo ? (sort?.dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  )
}

export function useSort(defaultCol, defaultDir = 'desc') {
  const [sort, setSort] = useState({ col: defaultCol, dir: defaultDir })
  function onSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })
  }
  function sorted(arr, acessors) {
    const fn = acessors[sort.col]
    if (!fn) return arr
    return [...arr].sort((a, b) => {
      const va = fn(a) ?? (sort.dir === 'asc' ? Infinity : -Infinity)
      const vb = fn(b) ?? (sort.dir === 'asc' ? Infinity : -Infinity)
      if (typeof va === 'string') return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sort.dir === 'asc' ? va - vb : vb - va
    })
  }
  return { sort, onSort, sorted }
}

export function Paginacao({ pagina, total, porPag, onChange }) {
  const totalPags = Math.ceil(total / porPag)
  if (totalPags <= 1) return null
  return (
    <div style={{ padding: '10px 16px', display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
      <button className="btn btn-sm btn-ghost" disabled={pagina === 0} onClick={() => onChange(p => p - 1)}>← Anterior</button>
      <span>Página {pagina+1} de {totalPags}</span>
      <button className="btn btn-sm btn-ghost" disabled={pagina >= totalPags-1} onClick={() => onChange(p => p + 1)}>Próxima →</button>
    </div>
  )
}
