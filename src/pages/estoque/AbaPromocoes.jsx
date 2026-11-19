import { csvCell } from '../../utils/csv.js'
import { useState, useMemo } from 'react'
import { CURVA_META } from '../../services/processamento/processarObsoleto.js'
import { fmtBRL2 as fmtBRL } from '../../utils/formatacao.js'
import { LojaTags, TrHover, TrTotal, Td, ColSelector } from '../../components/DS.jsx'
import { LOJAS } from '../../data/regras.js'
import { fmtPct } from './utils.js'
import { Th, useSort, ItemPeca } from './TabelaUtils.jsx'
import { CurvaBadge } from './KpiCard.jsx'

export function AbaPromocoes({ itens, descontosPorTipo, onBaixar }) {
  const [busca, setBusca] = useState('')
  const [cols, setCols]   = useState({ custoUnit: true, pvUnit: true, pvUnitDesc: false, pvTotal: true, margem: true, descSug: true, margDesc: true })
  const { sort, onSort, sorted } = useSort('custoT', 'desc')

  const obsoletos = useMemo(() => itens.filter(i => CURVA_META[i.status]?.obsoleto), [itens])

  function getDesconto(status, tipo) {
    if (status !== 'CURVA_D' && status !== 'CURVA_E') return null
    const cfg = descontosPorTipo?.[tipo]
    if (!cfg) return null
    const pct = status === 'CURVA_D' ? cfg.descontoD : cfg.descontoE
    return pct != null && pct > 0 ? pct / 100 : null
  }

  const porEstado = useMemo(() => {
    const estados = {}
    obsoletos.forEach(r => {
      const est = LOJAS[r.loja]?.estado || 'Outros'
      if (!estados[est]) estados[est] = {}
      if (!estados[est][r.codigo]) estados[est][r.codigo] = { codigo: r.codigo, descricao: r.descricao, tipo: r.tipo, status: r.status, linhas: [] }
      if ((CURVA_META[r.status]?.ordem ?? 0) > (CURVA_META[estados[est][r.codigo].status]?.ordem ?? 0)) estados[est][r.codigo].status = r.status
      estados[est][r.codigo].linhas.push(r)
    })
    return Object.entries(estados).sort((a,b) => a[0].localeCompare(b[0])).map(([estado, codigos]) => {
      const lista = Object.values(codigos).map(c => {
        const qtde       = c.linhas.reduce((s,r) => s + r.saldo, 0)
        const custoT     = c.linhas.reduce((s,r) => s + r.custoTotal, 0)
        const pvT        = c.linhas.reduce((s,r) => s + r.pvTotal, 0)
        const custoUnit  = qtde > 0 ? custoT / qtde : 0
        const pvUnit     = qtde > 0 ? pvT / qtde : 0
        const lojas      = [...new Set(c.linhas.map(r => r.loja))]
        const margem     = pvT > 0 ? (pvT - custoT) / pvT : null
        const desc       = getDesconto(c.status, c.tipo)
        const pvDesc     = desc != null ? pvT * (1 - desc) : null
        const pvUnitDesc = desc != null && qtde > 0 ? pvT * (1 - desc) / qtde : null
        const margDesc   = pvDesc != null && pvDesc > 0 ? (pvDesc - custoT) / pvDesc : null
        const diasMax    = Math.max(...c.linhas.map(r => r.diasReferencia ?? 0))
        return { ...c, qtde, custoT, pvT, custoUnit, pvUnit, pvUnitDesc, lojas, margem, desc, margDesc, diasMax }
      }).sort((a,b) => b.custoT - a.custoT)
      return { estado, lista }
    })
  }, [obsoletos, descontosPorTipo])

  function exportCSV(lista, nome) {
    const cab = ['Código','Descrição','Tipo','Qtde Total','Custo Unit. Méd.','Custo Total','P. Venda Unit.','P. Venda Unit. c/ Desc.','P. Venda Total','Margem %','Curva','Desc. Sug.','Margem c/ Desc.','Lojas']
    const linhas = lista.map(r => [
      r.codigo, r.descricao, r.tipo, r.qtde,
      r.custoUnit.toFixed(2), r.custoT.toFixed(2),
      r.pvUnit.toFixed(2),
      r.pvUnitDesc != null ? r.pvUnitDesc.toFixed(2) : '—',
      r.pvT.toFixed(2),
      r.margem != null ? fmtPct(r.margem) : '—',
      CURVA_META[r.status]?.label,
      r.desc != null ? `${Math.round(r.desc*100)}%` : '—',
      r.margDesc != null ? fmtPct(r.margDesc) : '—',
      r.lojas.join(' | '),
    ].map(csvCell).join(';'))
    const csv  = [cab.join(';'), ...linhas].join('\n')
    const blob = new Blob(['﻿'+csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `promocoes_${nome}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportERP(lista, nome) {
    const linhas = lista.filter(r => r.desc != null).map(r => `${csvCell(r.codigo)};${Math.round(r.desc*100)}`)
    const csv  = ['MERCADORIA;DESCONTO TOTAL %', ...linhas].join('\n')
    const blob = new Blob(['﻿'+csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `micro_work_${nome}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const thStyle = { textAlign: 'center' }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input className="form-input" placeholder="Buscar código ou descrição..." value={busca}
            onChange={e => setBusca(e.target.value)} style={{ minWidth: 240, fontSize: 'var(--text-sm2)' }} />
          {busca && <button className="filter-clear" onClick={() => setBusca('')}>✕</button>}
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginLeft: 4 }}>Itens Curva D+E agrupados por código único · custo ponderado por quantidade</span>
          <div style={{ marginLeft: 'auto' }}>
            <ColSelector
              cols={cols}
              defs={[
                { k: 'custoUnit',    l: 'Custo Unit.' },
                { k: 'pvUnit',       l: 'P. Venda Unit.' },
                { k: 'pvUnitDesc',   l: 'P. Venda Unit. c/ Desc.' },
                { k: 'pvTotal',      l: 'P. Venda Total' },
                { k: 'margem',       l: 'Margem' },
                { k: 'descSug',      l: 'Desc. Sug.' },
                { k: 'margDesc',     l: 'Margem c/ Desc.' },
              ]}
              onChange={setCols}
            />
          </div>
        </div>
      </div>

      {porEstado.map(({ estado, lista }) => {
        const buscada = busca.trim()
          ? lista.filter(r => r.codigo.toLowerCase().includes(busca.toLowerCase()) || r.descricao.toLowerCase().includes(busca.toLowerCase()))
          : lista
        const filtLista = sorted(buscada, {
          lojas:       r => r.lojas[0] || '',
          codigo:      r => r.codigo,
          descricao:   r => r.descricao,
          tipo:        r => r.tipo,
          qtde:        r => r.qtde,
          custoUnit:   r => r.custoUnit,
          custoT:      r => r.custoT,
          pvUnit:      r => r.pvUnit,
          pvUnitDesc:  r => r.pvUnitDesc ?? -Infinity,
          pvT:         r => r.pvT,
          margem:      r => r.margem,
          status:      r => CURVA_META[r.status]?.ordem ?? 99,
          desc:        r => r.desc ?? -1,
          margDesc:    r => r.margDesc ?? -Infinity,
        })
        const totQtde   = filtLista.reduce((s,r) => s + r.qtde, 0)
        const totCusto  = filtLista.reduce((s,r) => s + r.custoT, 0)
        const totPv     = filtLista.reduce((s,r) => s + r.pvT, 0)
        const totMargem = totPv > 0 ? (totPv - totCusto) / totPv : null

        return (
          <div key={estado} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
              <span className="card-title">{estado}</span>
              <span className="badge badge-red">{filtLista.length} códigos · {fmtBRL(totCusto)}</span>
              <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => exportCSV(filtLista, estado)}>↓ CSV</button>
              <button className="btn btn-sm btn-ghost" onClick={() => exportERP(filtLista, estado)}>↓ Micro Work ERP</button>
            </div>
            <div className="table-wrap">
              <table className="tabela-estoque tabela-pessoas">
                <thead>
                  <tr>
                    <Th col="descricao"  sort={sort} onSort={onSort}>Peça</Th>
                    <Th col="lojas"      sort={sort} onSort={onSort}>Lojas</Th>
                    <Th col="tipo"       sort={sort} onSort={onSort}>Tipo</Th>
                    <Th col="qtde"       sort={sort} onSort={onSort} style={thStyle}>Qtde</Th>
                    {cols.custoUnit   && <Th col="custoUnit"  sort={sort} onSort={onSort} style={thStyle}>Custo Unit.</Th>}
                    <Th col="custoT"      sort={sort} onSort={onSort} style={thStyle}>Custo Total</Th>
                    {cols.pvUnit      && <Th col="pvUnit"     sort={sort} onSort={onSort} style={thStyle}>P. Venda Unit.</Th>}
                    {cols.pvUnitDesc  && <Th col="pvUnitDesc" sort={sort} onSort={onSort} style={thStyle}>P. Venda Unit. c/ Desc.</Th>}
                    {cols.pvTotal     && <Th col="pvT"        sort={sort} onSort={onSort} style={thStyle}>P. Venda Total</Th>}
                    {cols.margem      && <Th col="margem"     sort={sort} onSort={onSort} style={thStyle}>Margem</Th>}
                    <Th col="status"      sort={sort} onSort={onSort}>Curva</Th>
                    {cols.descSug     && <Th col="desc"       sort={sort} onSort={onSort} style={thStyle}>Desc. Sug.</Th>}
                    {cols.margDesc    && <Th col="margDesc"   sort={sort} onSort={onSort} style={thStyle}>Margem c/ Desc.</Th>}
                  </tr>
                </thead>
                <tbody>
                  {filtLista.map((r, i) => (
                    <TrHover key={i}>
                      <td><ItemPeca descricao={r.descricao} codigo={r.codigo} icone="percentage-circle" /></td>
                      <Td><LojaTags lojas={r.lojas} max={1} /></Td>
                      <Td style={{ color: 'var(--text3)' }}>{r.tipo}</Td>
                      <Td num>{r.qtde}</Td>
                      {cols.custoUnit   && <Td num>{fmtBRL(r.custoUnit)}</Td>}
                      <Td num style={{ fontWeight: 600, color: 'var(--red)' }}>{fmtBRL(r.custoT)}</Td>
                      {cols.pvUnit      && <Td num>{fmtBRL(r.pvUnit)}</Td>}
                      {cols.pvUnitDesc  && (
                        <Td num style={{ fontWeight: r.pvUnitDesc != null ? 600 : 400, color: r.pvUnitDesc != null ? 'var(--text)' : 'var(--text3)' }}>
                          {r.pvUnitDesc != null ? fmtBRL(r.pvUnitDesc) : '—'}
                        </Td>
                      )}
                      {cols.pvTotal     && <Td num style={{ fontWeight: 600 }}>{fmtBRL(r.pvT)}</Td>}
                      {cols.margem      && (
                        <Td num style={{ fontWeight: 700, color: r.margem != null ? (r.margem >= 0.2 ? 'var(--green)' : 'var(--amber)') : 'var(--text3)' }}>
                          {r.margem != null ? fmtPct(r.margem) : '—'}
                        </Td>
                      )}
                      <Td><CurvaBadge status={r.status} /></Td>
                      {cols.descSug  && (
                        <Td num style={{ fontWeight: r.desc != null ? 600 : 400, color: r.desc != null ? 'var(--text)' : 'var(--text3)' }}>
                          {r.desc != null ? `${Math.round(r.desc*100)}%` : '—'}
                        </Td>
                      )}
                      {cols.margDesc && (
                        <Td num style={{ fontWeight: 700, color: r.margDesc != null ? (r.margDesc >= 0.1 ? 'var(--green)' : 'var(--red-critical)') : 'var(--text3)' }}>
                          {r.margDesc != null ? fmtPct(r.margDesc) : '—'}
                        </Td>
                      )}
                    </TrHover>
                  ))}
                </tbody>
                <tfoot>
                  <TrTotal>
                    <td colSpan={3} style={{ padding: '6px 10px' }} />
                    <Td num style={{ fontWeight: 700, padding: '6px 10px' }}>{totQtde.toLocaleString('pt-BR')}</Td>
                    {cols.custoUnit  && <td style={{ padding: '6px 10px' }} />}
                    <Td num style={{ fontWeight: 700, padding: '6px 10px' }}>{fmtBRL(totCusto)}</Td>
                    {cols.pvUnit     && <td style={{ padding: '6px 10px' }} />}
                    {cols.pvUnitDesc && <td style={{ padding: '6px 10px' }} />}
                    {cols.pvTotal    && <Td num style={{ fontWeight: 700, padding: '6px 10px' }}>{fmtBRL(totPv)}</Td>}
                    {cols.margem     && <Td num style={{ fontWeight: 700, padding: '6px 10px', color: totMargem != null ? (totMargem >= 0.2 ? 'var(--green)' : 'var(--amber)') : 'var(--text3)' }}>{totMargem != null ? fmtPct(totMargem) : '—'}</Td>}
                    <td style={{ padding: '6px 10px' }} />
                    {cols.descSug  && <td style={{ padding: '6px 10px' }} />}
                    {cols.margDesc && <td style={{ padding: '6px 10px' }} />}
                  </TrTotal>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}
