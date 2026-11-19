import { useMemo, useState } from 'react'
import { Th, useSorter, useTablePage, Td, TrHover, TrTotal, EmptyState } from '../../components/AnalysisDS.jsx'
import { fmtBRL, fmtNum } from '../../utils/formatacao.js'
import { norm } from '../../utils/normalizacao.js'
import { Users, ChevronRight, ChevronDown } from '../../icons/iconoir'
import { histItensCliente } from './atacado.logic.js'

function HistItens({ a, chave }) {
  const itens = useMemo(() => histItensCliente(a.rows6m, chave, a.meses6), [a.rows6m, chave, a.meses6])
  if (itens.length === 0) return <div style={{ padding: 'var(--space-md)', color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>Sem itens nos últimos {a.meses6.length} meses.</div>
  return (
    <div style={{ padding: 'var(--space-sm) var(--space-lg)', background: 'var(--bg3)' }}>
      <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 'var(--space-xs)' }}>
        Recompra — últimos {a.meses6.length} meses (qtd · valor por mês)
      </div>
      <div className="table-wrap">
        <table className="data-table data-table--densa">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Peça</th>
              {a.meses6.map(m => <th key={m} style={{ textAlign: 'right' }}>{m}</th>)}
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map(it => (
              <tr key={it.codigo}>
                <td style={{ padding: 'var(--cell-padding)' }}>
                  <span style={{ color: 'var(--text3)', marginRight: 'var(--space-xs)' }}>{it.codigo}</span>{it.descricao}
                </td>
                {a.meses6.map(m => {
                  const cell = it.porMes[m]
                  return <td key={m} className="num" style={{ textAlign: 'right', color: cell ? 'var(--text)' : 'var(--text3)' }}>
                    {cell ? `${fmtNum(cell.qtd)} · ${fmtBRL(cell.valor)}` : '—'}
                  </td>
                })}
                <td className="num" style={{ textAlign: 'right', fontWeight: 'var(--weight-semibold)' }}>{fmtBRL(it.totalValor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AbaClientes({ a }) {
  const [aberto, setAberto] = useState(() => new Set())
  const toggleRow = ch => setAberto(s => { const n = new Set(s); n.has(ch) ? n.delete(ch) : n.add(ch); return n })

  const filtrados = useMemo(() => {
    const q = norm(a.busca)
    if (!q) return a.clientes
    return a.clientes.filter(c => norm(c.cliente).includes(q) || norm(c.cidade).includes(q))
  }, [a.clientes, a.busca])

  const { sorted, sort, toggle } = useSorter(filtrados, {
    cliente:     r => r.cliente,
    cidade:      r => r.cidade,
    nCompras:    r => r.nCompras,
    ticket:      r => r.ticket,
    faturamento: r => r.faturamento,
  }, { col: 'faturamento', dir: 'desc' })
  const page=useTablePage(sorted)

  if (a.clientes.length === 0) return <EmptyState icon={Users} title="Sem clientes de atacado neste recorte" />

  const totFat = sorted.reduce((s, r) => s + r.faturamento, 0)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Clientes de atacado</span>
        <span className="badge badge-gray">{sorted.length} clientes</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginLeft: 'var(--space-xs)' }}>· clique para ver a recompra</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <Th col="cliente"     label="Cliente" sort={sort} toggle={toggle} nome />
              <Th col="cidade"      label="Cidade" sort={sort} toggle={toggle} />
              <Th col="nCompras"    label="Compras" sort={sort} toggle={toggle} num />
              <Th col="ticket"      label="Ticket médio" sort={sort} toggle={toggle} num />
              <Th col="faturamento" label="Faturamento" sort={sort} toggle={toggle} num />
            </tr>
          </thead>
          <tbody>
            {page.visible.map(c => {
              const on = aberto.has(c.chave)
              return [
                <TrHover key={c.chave} onClick={() => toggleRow(c.chave)}>
                  <Td center>{on ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</Td>
                  <Td nome>{c.cliente}</Td>
                  <Td>{c.cidade || '—'}</Td>
                  <Td num>{fmtNum(c.nCompras)}</Td>
                  <Td num>{fmtBRL(c.ticket)}</Td>
                  <Td num destaque>{fmtBRL(c.faturamento)}</Td>
                </TrHover>,
                on && <tr key={c.chave + '-exp'}><td colSpan={6} style={{ padding: 0 }}><HistItens a={a} chave={c.chave} /></td></tr>
              ]
            })}
          </tbody>
          <tfoot>
            <TrTotal>
              <td colSpan={5} style={{ padding: 'var(--cell-padding)', fontWeight: 'var(--weight-bold)' }}>Total</td>
              <Td num style={{ fontWeight: 'var(--weight-bold)' }}>{fmtBRL(totFat)}</Td>
            </TrTotal>
          </tfoot>
        </table>
      </div>
      {page.controls}
    </div>
  )
}



