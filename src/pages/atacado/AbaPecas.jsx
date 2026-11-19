import { useMemo } from 'react'
import { Th, useSorter, useTablePage, Td, TrHover, TrTotal, EmptyState } from '../../components/AnalysisDS.jsx'
import { fmtBRL, fmtNum } from '../../utils/formatacao.js'
import { norm } from '../../utils/normalizacao.js'
import { Package } from '../../icons/iconoir'

export function AbaPecas({ a }) {
  const filtradas = useMemo(() => {
    const q = norm(a.busca)
    if (!q) return a.pecas
    return a.pecas.filter(p => norm(p.codigo).includes(q) || norm(p.descricao).includes(q))
  }, [a.pecas, a.busca])

  const { sorted, sort, toggle } = useSorter(filtradas, {
    codigo:     r => r.codigo,
    descricao:  r => r.descricao,
    quantidade: r => r.quantidade,
    valor:      r => r.valor,
  }, { col: 'valor', dir: 'desc' })
  const page=useTablePage(sorted)

  if (a.pecas.length === 0) return <EmptyState icon={Package} title="Sem vendas de atacado neste recorte" />

  const totQtd = sorted.reduce((s, r) => s + r.quantidade, 0)
  const totVal = sorted.reduce((s, r) => s + r.valor, 0)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Peças mais vendidas — atacado</span>
        <span className="badge badge-gray">{sorted.length} códigos</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <Th col="codigo"     label="Código" sort={sort} toggle={toggle} />
              <Th col="descricao"  label="Descrição" sort={sort} toggle={toggle} nome />
              <Th col="quantidade" label="Qtde" sort={sort} toggle={toggle} num />
              <Th col="valor"      label="Valor" sort={sort} toggle={toggle} num />
            </tr>
          </thead>
          <tbody>
            {page.visible.map(r => (
              <TrHover key={r.codigo}>
                <Td style={{ color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.codigo}</Td>
                <Td nome>{r.descricao || '—'}</Td>
                <Td num>{fmtNum(r.quantidade)}</Td>
                <Td num destaque>{fmtBRL(r.valor)}</Td>
              </TrHover>
            ))}
          </tbody>
          <tfoot>
            <TrTotal>
              <td colSpan={2} style={{ padding: 'var(--cell-padding)', fontWeight: 'var(--weight-bold)' }}>Total</td>
              <Td num style={{ fontWeight: 'var(--weight-bold)' }}>{fmtNum(totQtd)}</Td>
              <Td num style={{ fontWeight: 'var(--weight-bold)' }}>{fmtBRL(totVal)}</Td>
            </TrTotal>
          </tfoot>
        </table>
      </div>
      {page.controls}
    </div>
  )
}



