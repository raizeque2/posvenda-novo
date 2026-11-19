import { csvCell } from '../../utils/csv.js'
import { useState, useMemo } from 'react'
import { resumoEstoque } from '../../services/processamento/processarObsoleto.js'
import { fmtBRL2 as fmtBRL } from '../../utils/formatacao.js'
import { LOJAS } from '../../data/regras.js'
import { fmtPct, corCobertura } from './utils.js'
import { useSort, Th } from './TabelaUtils.jsx'
import { Download, Icon } from '../../icons/iconoir'
import { FiltroDropdown } from '../../components/DS.jsx'

function cmpMesAno(a, b) {
  const [ma, aa] = a.split('/').map(Number)
  const [mb, ab] = b.split('/').map(Number)
  return aa !== ab ? aa - ab : ma - mb
}

export function AbaHistorico({ historico, meses, onCarregar, pecas, estadoSel, lojasSel, tiposSel }) {
  const [expandido, setExpandido]         = useState(null)
  const [expandidoLoja, setExpandidoLoja] = useState(null)
  const [mesSel, setMesSel]               = useState('')

  const { sort, onSort, sorted } = useSort('mes', 'desc')

  const historicoFiltrado = useMemo(() => {
    const temFiltro = estadoSel || lojasSel?.length > 0 || tiposSel?.length > 0
    if (!temFiltro) return historico
    return historico.map(h => {
      if (!h.itens?.length) return h
      let itens = h.itens
      if (estadoSel) itens = itens.filter(i => LOJAS[i.loja]?.uf === estadoSel)
      if (lojasSel?.length > 0) itens = itens.filter(i => lojasSel.includes(i.loja))
      if (tiposSel?.length > 0) itens = itens.filter(i => tiposSel.includes(i.tipo))
      return { ...h, resumo: itens.length > 0 ? resumoEstoque(itens) : null }
    })
  }, [historico, estadoSel, lojasSel, tiposSel])

  // Só mostra números para meses já buscados (via clique em "Carregar"/expandir).
  // Não busca nada em segundo plano — igual ao comportamento anterior.
  const diasCoberturaPorMes = useMemo(() => {
    if (!pecas?.length) return {}
    const result = {}
    historicoFiltrado.forEach(h => {
      if (!h.dataISO) return
      const [y, m, d] = h.dataISO.split('-').map(Number)
      const dataSnap  = new Date(y, m - 1, d, 23, 59, 59)
      const N         = new Date(y, m, 0).getDate()
      const dInicio   = new Date(dataSnap - N * 86400000)
      let rec = pecas.filter(r =>
        r.comissao && r.dt instanceof Date && r.dt >= dInicio && r.dt <= dataSnap
      )
      if (estadoSel) rec = rec.filter(r => LOJAS[r.empresa]?.uf === estadoSel)
      if (lojasSel?.length > 0) rec = rec.filter(r => lojasSel.includes(r.empresa))
      const cmv = rec.reduce((s, r) => s + (r.custo || 0), 0)
      const mediaDiaria = cmv / N
      result[h.mesAno] = mediaDiaria > 0 ? Math.round((h.resumo?.custoTotal || 0) / mediaDiaria) : null
    })
    return result
  }, [pecas, historicoFiltrado, estadoSel, lojasSel])

  const tabelaRows = useMemo(() => {
    return meses.map(m => {
      const [mm, aa] = m.mesAno.split('/').map(Number)
      const entrada = historicoFiltrado.find(h => h.mesAno === m.mesAno)
      return {
        mesAno: m.mesAno, atual: m.atual, semDado: m.semDado, entrada,
        res: entrada?.resumo, diasCob: diasCoberturaPorMes[m.mesAno],
        ordChave: aa * 100 + mm, // ordenação cronológica correta (não é string "MM/YYYY")
      }
    })
  }, [meses, historicoFiltrado, diasCoberturaPorMes])

  const tabelaVis = useMemo(() => {
    const base = mesSel ? tabelaRows.filter(r => r.mesAno === mesSel) : tabelaRows
    return sorted(base, {
      mes:         r => r.ordChave,
      itens:       r => r.res?.totalItens ?? null,
      custo:       r => r.res?.custoTotal ?? null,
      obsoleto:    r => r.res?.obsCusto ?? null,
      pctObsoleto: r => r.res?.pctObsoleto ?? null,
      cobertura:   r => r.diasCob ?? null,
    })
  }, [tabelaRows, mesSel, sort])

  function toggleMes(mesAno) {
    setExpandido(e => e === mesAno ? null : mesAno)
    setExpandidoLoja(null)
  }

  function baixarCSV() {
    const header = ['Mês', 'Itens', 'Estoque (R$)', 'Obsoleto (R$)', '% Obsoleto', 'Dias Cobertura']
    const linhas = tabelaVis.map(r => [
      r.mesAno,
      r.res?.totalItens ?? '',
      r.res?.custoTotal  != null ? r.res.custoTotal.toFixed(2).replace('.', ',')         : '',
      r.res?.obsCusto    != null ? r.res.obsCusto.toFixed(2).replace('.', ',')           : '',
      r.res?.pctObsoleto != null ? (r.res.pctObsoleto * 100).toFixed(1).replace('.', ',') + '%' : '',
      r.diasCob != null ? r.diasCob : '',
    ])
    const csv  = [header, ...linhas].map(row => row.map(csvCell).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `historico_estoque${mesSel ? '_' + mesSel.replace('/', '-') : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const thR = { textAlign: 'right' }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Posição por Mês</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiltroDropdown
            label="Todos os meses"
            options={[...meses].sort((a, b) => cmpMesAno(b.mesAno, a.mesAno)).map(m => ({ value: m.mesAno, label: m.mesAno }))}
            value={mesSel}
            onChange={setMesSel}
          />
          <button className="btn btn-sm btn-ghost" onClick={baixarCSV} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={12} /> CSV
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="tabela-pessoas">
          <thead>
            <tr>
              <Th col="mes"        sort={sort} onSort={onSort}>Mês</Th>
              <Th col="itens"       sort={sort} onSort={onSort} style={thR}>Itens</Th>
              <Th col="custo"       sort={sort} onSort={onSort} style={thR}>Estoque (Custo)</Th>
              <Th col="obsoleto"    sort={sort} onSort={onSort} style={thR}>Obsoleto</Th>
              <Th col="pctObsoleto" sort={sort} onSort={onSort} style={thR}>% Obsoleto</Th>
              <Th col="cobertura"   sort={sort} onSort={onSort} style={thR}>Dias Cobertura</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tabelaVis.map(r => {
              const aberto = expandido === r.mesAno

              if (r.semDado) {
                return (
                  <tr key={r.mesAno}>
                    <td style={{ fontWeight: 'var(--weight-bold)' }}>{r.mesAno}</td>
                    <td colSpan={5} style={{ color: 'var(--red)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                      Sem upload de estoque neste mês
                    </td>
                    <td></td>
                  </tr>
                )
              }

              return [
                <tr key={r.mesAno} style={{ cursor: 'pointer', background: aberto ? 'var(--bg3)' : undefined }} onClick={() => {
                  if (!r.entrada) { onCarregar(r.mesAno); setExpandido(r.mesAno) }
                  else toggleMes(r.mesAno)
                }}>
                  <td>
                    <div className="tp-pessoa">
                      <span className="tp-icone"><Icon name="calendar" size={17} /></span>
                      <div><div className="tp-nome">{r.mesAno}{r.atual && <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 'var(--text-2xs)' }}>ATUAL</span>}</div><div className="tp-sub">{r.res ? `${r.res.porLoja?.length || 0} lojas` : 'não carregado'}</div></div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{r.res ? r.res.totalItens.toLocaleString('pt-BR') : '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.res ? fmtBRL(r.res.custoTotal) : '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--red)' }}>{r.res ? fmtBRL(r.res.obsCusto) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'var(--weight-bold)', color: r.res?.pctObsoleto >= 0.2 ? 'var(--red-critical)' : r.res?.pctObsoleto >= 0.1 ? 'var(--amber)' : 'var(--green)' }}>
                    {r.res ? fmtPct(r.res.pctObsoleto) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'var(--weight-semibold)' }}>
                    {r.diasCob != null ? <span style={{ color: corCobertura(r.diasCob), fontWeight: 'var(--weight-bold)' }}>{r.diasCob} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-normal)', color: 'var(--text3)' }}>dias</span></span> : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>
                    {!r.entrada ? <span style={{ color: 'var(--honda)' }}>Carregar</span> : aberto ? '▲' : '▼'}
                  </td>
                </tr>,

                aberto && r.res && (
                  <tr key={`${r.mesAno}-detail`}>
                    <td colSpan={7} style={{ padding: 0, background: 'var(--bg3)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '6px 16px 6px 32px', textAlign: 'left', fontSize: 'var(--text-sm)' }}>Loja</th>
                            <th style={{ padding: '6px 16px', textAlign: 'right', fontSize: 'var(--text-sm)' }}>Itens</th>
                            <th style={{ padding: '6px 16px', textAlign: 'right', fontSize: 'var(--text-sm)' }}>Custo</th>
                            <th style={{ padding: '6px 16px', textAlign: 'right', fontSize: 'var(--text-sm)' }}>Obsoleto</th>
                            <th style={{ padding: '6px 16px', textAlign: 'right', fontSize: 'var(--text-sm)' }}>%</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(r.res.porLoja || []).map(l => {
                            const lojaAberta = expandidoLoja === `${r.mesAno}-${l.loja}`
                            return [
                              <tr key={l.loja} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                onClick={e => { e.stopPropagation(); setExpandidoLoja(v => v === `${r.mesAno}-${l.loja}` ? null : `${r.mesAno}-${l.loja}`) }}>
                                <td style={{ padding: '6px 16px 6px 32px', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm2)' }}>{l.loja}</td>
                                <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: 'var(--text-sm2)' }}>{l.totalItens.toLocaleString('pt-BR')}</td>
                                <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: 'var(--text-sm2)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(l.custoTotal)}</td>
                                <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: 'var(--text-sm2)', color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(l.obsCusto)}</td>
                                <td style={{ padding: '6px 16px', textAlign: 'right', fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-bold)', color: l.pctObsoleto >= 0.2 ? 'var(--red-critical)' : l.pctObsoleto >= 0.1 ? 'var(--amber)' : 'var(--green)' }}>{fmtPct(l.pctObsoleto)}</td>
                                <td style={{ padding: '6px 16px', textAlign: 'right', color: 'var(--text3)', fontSize: 'var(--text-xs)' }}>{lojaAberta ? '▲' : '▼'}</td>
                              </tr>,

                              lojaAberta && (
                                <tr key={`${l.loja}-tipos`}>
                                  <td colSpan={6} style={{ padding: 0, background: 'var(--bg2)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr>
                                          <th style={{ padding: '5px 16px 5px 48px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>Tipo</th>
                                          <th style={{ padding: '5px 16px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>Itens</th>
                                          <th style={{ padding: '5px 16px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>Custo</th>
                                          <th style={{ padding: '5px 16px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>Obsoleto</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(r.res.porTipo || [])
                                          .filter(tp => tp.obsCusto > 0)
                                          .sort((a,b) => b.obsCusto - a.obsCusto)
                                          .slice(0, 10)
                                          .map(tp => (
                                            <tr key={tp.tipo} style={{ borderTop: '1px solid var(--border)' }}>
                                              <td style={{ padding: '4px 16px 4px 48px', fontSize: 'var(--text-sm)' }}>{tp.tipo}</td>
                                              <td style={{ padding: '4px 16px', textAlign: 'right', fontSize: 'var(--text-sm)' }}>{tp.totalItens}</td>
                                              <td style={{ padding: '4px 16px', textAlign: 'right', fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(tp.custoTotal)}</td>
                                              <td style={{ padding: '4px 16px', textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(tp.obsCusto)}</td>
                                            </tr>
                                          ))
                                        }
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )
                            ]
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
