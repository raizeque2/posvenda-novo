import { useMemo } from 'react'
import { Th, useSorter, useTablePage, Td, TrHover, TrTotal, EmptyState } from '../../components/AnalysisDS.jsx'
import { fmtBRL, fmtNum } from '../../utils/formatacao.js'
import { norm } from '../../utils/normalizacao.js'
import { MapPin } from '../../icons/iconoir'

export function AbaCobertura({ a }) {
  const filtradas = useMemo(() => {
    const q = norm(a.busca)
    return q ? a.cobertura.filter(c => norm(c.cidade).includes(q)) : a.cobertura
  }, [a.cobertura, a.busca])

  const { sorted, sort, toggle } = useSorter(filtradas, {
    cidade:      r => r.cidade,
    uf:          r => r.uf,
    nClientes:   r => r.nClientes,
    faturamento: r => r.faturamento,
  }, { col: 'faturamento', dir: 'desc' })
  const page=useTablePage(sorted)

  if (a.cobertura.length === 0) return <EmptyState icon={MapPin} title="Sem cidades atendidas neste recorte" />

  const totFat = sorted.reduce((s, r) => s + r.faturamento, 0)
  const totCli = sorted.reduce((s, r) => s + r.nClientes, 0)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Cobertura — cidades atendidas em atacado</span>
        <span className="badge badge-gray">{sorted.length} cidades</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <Th col="cidade"      label="Cidade" sort={sort} toggle={toggle} nome />
              <Th col="uf"          label="UF" sort={sort} toggle={toggle} />
              <Th col="nClientes"   label="Clientes" sort={sort} toggle={toggle} num />
              <Th col="faturamento" label="Faturamento" sort={sort} toggle={toggle} num />
            </tr>
          </thead>
          <tbody>
            {page.visible.map(c => (
              <TrHover key={c.cidade + c.uf}>
                <Td nome>{c.cidade}</Td>
                <Td>{c.uf || '—'}</Td>
                <Td num>{fmtNum(c.nClientes)}</Td>
                <Td num destaque>{fmtBRL(c.faturamento)}</Td>
              </TrHover>
            ))}
          </tbody>
          <tfoot>
            <TrTotal>
              <td colSpan={2} style={{ padding: 'var(--cell-padding)', fontWeight: 'var(--weight-bold)' }}>Total</td>
              <Td num style={{ fontWeight: 'var(--weight-bold)' }}>{fmtNum(totCli)}</Td>
              <Td num style={{ fontWeight: 'var(--weight-bold)' }}>{fmtBRL(totFat)}</Td>
            </TrTotal>
          </tfoot>
        </table>
      </div>
      {page.controls}
    </div>
  )
}



