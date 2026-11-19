import { useMemo } from 'react'
import { Th, useSorter, useTablePage, Td, TrHover, EmptyState, Tag } from '../../components/AnalysisDS.jsx'
import { fmtBRL, fmtPct } from '../../utils/formatacao.js'
import { norm } from '../../utils/normalizacao.js'
import { Clock } from '../../icons/iconoir'

const fmtData = d => (d instanceof Date ? d.toLocaleDateString('pt-BR') : '—')

function TabelaInativos({ titulo, tom, itens, busca }) {
  const filtrados = useMemo(() => {
    const q = norm(busca)
    return q ? itens.filter(c => norm(c.cliente).includes(q) || norm(c.cidade).includes(q)) : itens
  }, [itens, busca])

  const { sorted, sort, toggle } = useSorter(filtrados, {
    cliente:        r => r.cliente,
    cidade:         r => r.cidade,
    diasSemComprar: r => r.diasSemComprar,
    ultimaValor:    r => r.ultimaValor,
    valorMedio:     r => r.valorMedio,
  }, { col: 'diasSemComprar', dir: 'desc' })
  const page=useTablePage(sorted)

  return (
    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="card-header">
        <span className="card-title">{titulo}</span>
        <Tag cor={tom}>{filtrados.length}</Tag>
      </div>
      {filtrados.length === 0 ? (
        <div style={{ padding: 'var(--space-lg)', color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>Ninguém nesta faixa.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <Th col="cliente"        label="Cliente" sort={sort} toggle={toggle} nome />
                <Th col="cidade"         label="Cidade" sort={sort} toggle={toggle} />
                <Th col="diasSemComprar" label="Dias s/ comprar" sort={sort} toggle={toggle} num />
                <Th col="ultimaValor"    label="Última compra" sort={sort} toggle={toggle} num />
                <Th col="valorMedio"     label="Valor médio/mês" sort={sort} toggle={toggle} num />
              </tr>
            </thead>
            <tbody>
              {page.visible.map(c => (
                <TrHover key={c.chave}>
                  <Td nome>{c.cliente}</Td>
                  <Td>{c.cidade || '—'}</Td>
                  <Td num>{c.diasSemComprar}</Td>
                  <Td num>{fmtData(c.ultima)} · {fmtBRL(c.ultimaValor)}</Td>
                  <Td num>{fmtBRL(c.valorMedio)}</Td>
                </TrHover>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.controls}
    </div>
  )
}

function TabelaQueda({ itens, busca }) {
  const filtrados = useMemo(() => {
    const q = norm(busca)
    return q ? itens.filter(c => norm(c.cliente).includes(q) || norm(c.cidade).includes(q)) : itens
  }, [itens, busca])

  const { sorted, sort, toggle } = useSorter(filtrados, {
    cliente: r => r.cliente,
    cidade:  r => r.cidade,
    media:   r => r.media,
    atual:   r => r.atual,
    queda:   r => r.queda,
  }, { col: 'queda', dir: 'desc' })
  const page=useTablePage(sorted)

  return (
    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="card-header">
        <span className="card-title">Queda de frequência — mês atual vs média dos 3 anteriores</span>
        <Tag cor="amber">{filtrados.length}</Tag>
      </div>
      {filtrados.length === 0 ? (
        <div style={{ padding: 'var(--space-lg)', color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>Ninguém caiu acima do limiar configurado.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <Th col="cliente" label="Cliente" sort={sort} toggle={toggle} nome />
                <Th col="cidade"  label="Cidade" sort={sort} toggle={toggle} />
                <Th col="media"   label="Média 3 meses" sort={sort} toggle={toggle} num />
                <Th col="atual"   label="Mês atual" sort={sort} toggle={toggle} num />
                <Th col="queda"   label="Queda" sort={sort} toggle={toggle} num />
              </tr>
            </thead>
            <tbody>
              {page.visible.map(c => (
                <TrHover key={c.chave}>
                  <Td nome>{c.cliente}</Td>
                  <Td>{c.cidade || '—'}</Td>
                  <Td num>{fmtBRL(c.media)}</Td>
                  <Td num>{fmtBRL(c.atual)}</Td>
                  <Td num><Tag cor={c.queda >= 0.99 ? 'red' : 'amber'} style={{ fontSize: 'var(--text-sm)' }}>−{fmtPct(c.queda, 0)}</Tag></Td>
                </TrHover>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.controls}
    </div>
  )
}

export function AbaInativos({ a }) {
  const { f1, f2, f3, queda } = a.inativos
  const cfg = a.atacadoConfig
  const total = f1.length + f2.length + f3.length + queda.length
  if (total === 0) return <EmptyState icon={Clock} title="Nenhum cliente inativo neste recorte" sub="Ou não há histórico suficiente para medir recência." />

  return (
    <>
      <TabelaInativos titulo={`Sem compra há mais de ${cfg.corte1} dias`} tom="amber" itens={f1} busca={a.busca} />
      <TabelaInativos titulo={`Sem compra há mais de ${cfg.corte2} dias`} tom="amber" itens={f2} busca={a.busca} />
      <TabelaInativos titulo={`Sem compra há mais de ${cfg.corte3} dias`} tom="red" itens={f3} busca={a.busca} />
      <TabelaQueda itens={queda} busca={a.busca} />
    </>
  )
}



