import { useRef, useState } from 'react'
import {
  FiltersBar, FiltroAnoMes, FiltroDropdown, MultiSelectLojas,
  CardHead, EmptyState,
} from '../components/DS.jsx'
import { useResumoMensal } from './resumomensal/useResumoMensal.js'
import { LINHAS_OFICINA_EXIB, CANAIS_PECAS_EXIB, FUNCOES_EXIB } from './resumomensal/resumoMensal.logic.js'
import { fmtBRL2 as fmtBRL } from '../utils/formatacao.js'
import { FileText } from '../icons/iconoir'

// ─── Formato curto para eixo Y dos gráficos ──────────────────────────────────
function fmtCurto(v) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`
  return v > 0 ? `R$${v.toFixed(0)}` : '0'
}

// ─── Gráfico de linha com área preenchida ─────────────────────────────────────
function HistChart({ titulo, dados, formatY = fmtCurto, unidade = '' }) {
  const [hover, setHover] = useState(null)
  if (!dados?.length) return null

  const W = 560, H = 160
  const PAD = { top: 28, right: 16, bottom: 32, left: 52 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top  - PAD.bottom
  const maxV = Math.max(...dados.map(d => d.valor), 1)

  const pts = dados.map((d, i) => ({
    ...d,
    x: PAD.left + (dados.length < 2 ? iW / 2 : i * iW / (dados.length - 1)),
    y: PAD.top  + iH - (d.valor / maxV) * iH,
  }))

  const poly  = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area  = [`${pts[0].x},${PAD.top + iH}`, ...pts.map(p => `${p.x},${p.y}`), `${pts[pts.length-1].x},${PAD.top + iH}`].join(' ')
  const grades = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="card">
      <CardHead title={titulo} />
      <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 300, height: H }}
          onMouseLeave={() => setHover(null)}>
          {/* Grid horizontal */}
          {grades.map(p => {
            const y = PAD.top + iH * (1 - p)
            return (
              <g key={p}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="var(--border1)" strokeWidth={0.5} strokeDasharray="3 3" />
                <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="var(--text3)">
                  {formatY(maxV * p)}
                </text>
              </g>
            )
          })}
          {/* Área preenchida */}
          <polygon points={area} fill="var(--accent)" opacity={0.07} />
          {/* Linha */}
          <polyline points={poly} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
          {/* Pontos + labels do eixo X */}
          {pts.map((p, i) => (
            <g key={p.mes}
              onMouseEnter={() => setHover(i)}
              style={{ cursor: 'default' }}>
              <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3.5}
                fill={hover === i ? 'var(--accent)' : '#fff'}
                stroke="var(--accent)" strokeWidth={2} />
              <text x={p.x} y={PAD.top + iH + 14} textAnchor="middle" fontSize={8} fill="var(--text3)">
                {p.mes.slice(0, 5)}
              </text>
              {hover === i && (
                <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={9} fontWeight="700" fill="var(--text1)">
                  {unidade ? `${p.valor} ${unidade}` : formatY(p.valor)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

// ─── Campo manual ─────────────────────────────────────────────────────────────
function CampoManual({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', display: 'block', marginBottom: 3 }}>{label}</label>
      <input type={type} className="form-input" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', fontSize: 'var(--text-sm2)' }}
      />
    </div>
  )
}

// ─── Aba Oficina ──────────────────────────────────────────────────────────────
function AbaOficina({ r }) {
  const motoRef = useRef(null)

  const totalPassagens = Object.values(r.oficina).filter(v => v.contabiliza !== false).reduce((s, v) => s + v.passagens, 0)
  const totalMO        = Object.values(r.oficina).filter(v => v.contabiliza !== false).reduce((s, v) => s + v.mo, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Passagens por linha */}
      <div className="card">
        <CardHead title="Passagens por Linha IHS" />
        <div style={{ padding: '0 16px 16px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Linha IHS</th>
                <th style={{ textAlign: 'right' }}>Passagens</th>
                <th style={{ textAlign: 'right' }}>Faturamento MO</th>
              </tr>
            </thead>
            <tbody>
              {LINHAS_OFICINA_EXIB.map(([k, lbl]) => {
                const v = r.oficina[k]
                const conta = v?.contabiliza !== false
                return (
                  <tr key={k} style={{ opacity: v ? 1 : 0.3 }}>
                    <td style={{ fontSize: 'var(--text-sm2)', color: !v || conta ? undefined : 'var(--text3)' }}>
                      {lbl}
                      {v && !conta && <span style={{ marginLeft: 4, fontSize: 'var(--text-xs)', color: 'var(--text3)' }} title="Não contabiliza no total">*</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: conta ? undefined : 'var(--text3)' }}>{v?.passagens ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: conta ? undefined : 'var(--text3)' }}>{v ? fmtBRL(v.mo) : '—'}</td>
                  </tr>
                )
              })}
              <tr style={{ fontWeight: 'var(--weight-bold)', borderTop: '1px solid var(--border1)' }}>
                <td>Total</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totalPassagens}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(totalMO)}</td>
              </tr>
              <tr style={{ borderTop: '2px solid var(--border1)' }}>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Usados Honda</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.motos.usadosHonda}</td>
                <td style={{ textAlign: 'right', color: 'var(--text3)' }}>—</td>
              </tr>
              <tr>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Usados Outras Marcas</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.motos.usadosOutras}</td>
                <td style={{ textAlign: 'right', color: 'var(--text3)' }}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Upload motocicletas */}
        <div className="card">
          <CardHead title="Vendas de Motocicletas" />
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', margin: 0 }}>
              Importe o relatório <em>bi resumo mensal venda de motos</em> (Empresa; Quantidade; Marca; Estado Veículo).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input ref={motoRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={r.handleMotoUpload} />
              <button className="btn btn-ghost btn-sm" onClick={() => motoRef.current?.click()}>Importar CSV</button>
              {r.motoNome && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>{r.motoNome}</span>}
            </div>
            <table className="data-table">
              <tbody>
                <tr><td>Rev. Entrega (0km)</td>      <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.motos.novos}</td></tr>
                <tr><td>Usados Honda</td>             <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.motos.usadosHonda}</td></tr>
                <tr><td>Usados Outras Marcas</td>     <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.motos.usadosOutras}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Funcionários */}
        <div className="card">
          <CardHead title="Funcionários por Função IHS" />
          <div style={{ padding: '0 16px 16px' }}>
            {Object.keys(r.funcionarios).length === 0 ? (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>
                Nenhum cargo mapeado. Configure em Regras → Resumo Mensal → Cargos → Função IHS.
              </p>
            ) : (
              <table className="data-table">
                <tbody>
                  {FUNCOES_EXIB.map(([k, lbl]) => {
                    const n = r.funcionarios[k]
                    if (!n) return null
                    return <tr key={k}><td style={{ fontSize: 'var(--text-sm2)' }}>{lbl}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n}</td></tr>
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Campos manuais */}
        <div className="card">
          <CardHead title="Campos Manuais" />
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CampoManual label="MO/Hora (R$)"              value={r.manualOficina.mo_hora}     onChange={v => r.atualizarManualOficina('mo_hora', v)}     type="number" placeholder="ex: 95.00" />
            <CampoManual label="Instalações (m²)"          value={r.manualOficina.instalacoes} onChange={v => r.atualizarManualOficina('instalacoes', v)} placeholder="ex: 800" />
            <CampoManual label="Horário de funcionamento"  value={r.manualOficina.horarios}    onChange={v => r.atualizarManualOficina('horarios', v)}    placeholder="ex: Seg–Sex 08h–18h" />
            <CampoManual label="Observações"               value={r.manualOficina.obs}         onChange={v => r.atualizarManualOficina('obs', v)} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Aba Peças ────────────────────────────────────────────────────────────────
function AbaPecas({ r }) {
  const CANAL_COMPRA = new Set(['compra_honda', 'compra_outra'])
  const CANAIS_VENDA = CANAIS_PECAS_EXIB.filter(([k]) => !CANAL_COMPRA.has(k))
  const CANAIS_COMP  = CANAIS_PECAS_EXIB.filter(([k]) =>  CANAL_COMPRA.has(k))

  const totalVendas = CANAIS_VENDA.reduce((s, [k]) => {
    const v = r.por_canal[k]; return v && v.contabiliza !== false ? s + v.faturamento : s
  }, 0)
  const totalCusto = CANAIS_VENDA.reduce((s, [k]) => {
    const v = r.por_canal[k]; return v && v.contabiliza !== false ? s + v.custo : s
  }, 0)

  const objVendas   = parseFloat((r.manualPecas.objetivo_vendas || '').replace(',', '.')) || 0
  const itensSol    = parseInt(r.manualPecas.itens_solicitados || '0', 10) || 0
  const pctAtend    = itensSol > 0 ? ((r.qtdePecas / itensSol) * 100).toFixed(1) : '—'

  const inputStyle = { textAlign: 'right', width: '100%', padding: '1px 0', fontSize: 'inherit', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border1)', outline: 'none', color: 'var(--text1)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <CardHead title="Resumo de Peças" />
        <div style={{ padding: '0 16px 16px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {/* Canais de venda */}
              {CANAIS_VENDA.map(([k, lbl]) => {
                const v = r.por_canal[k]
                const conta = v?.contabiliza !== false
                return (
                  <tr key={k} style={{ opacity: v ? 1 : 0.35 }}>
                    <td style={{ fontSize: 'var(--text-sm2)', color: conta ? undefined : 'var(--text3)' }}>
                      {lbl}
                      {v && !conta && <span style={{ marginLeft: 4, fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>*</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v ? fmtBRL(v.faturamento) : '—'}</td>
                  </tr>
                )
              })}

              {/* Total */}
              <tr style={{ fontWeight: 'var(--weight-bold)', borderTop: '2px solid var(--border1)' }}>
                <td>Total</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(totalVendas)}</td>
              </tr>

              {/* Objetivo de Vendas — input inline */}
              <tr>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Objetivo de Vendas</td>
                <td style={{ textAlign: 'right' }}>
                  <input type="number" value={r.manualPecas.objetivo_vendas} onChange={e => r.atualizarManualPecas('objetivo_vendas', e.target.value)} style={inputStyle} placeholder="0" />
                </td>
              </tr>

              {/* CMV */}
              <tr>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Custo das Vendas</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text3)' }}>{fmtBRL(totalCusto)}</td>
              </tr>

              {/* Compras */}
              {CANAIS_COMP.map(([k, lbl]) => {
                const v = r.por_canal[k]
                return (
                  <tr key={k} style={{ opacity: v ? 1 : 0.35 }}>
                    <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>{lbl}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v ? fmtBRL(v.custo) : '—'}</td>
                  </tr>
                )
              })}

              {/* Estoque */}
              <tr style={{ borderTop: '2px solid var(--border1)' }}>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
                  Valor Estoque
                  {!r.estoqueStats.disponivel && <span style={{ marginLeft: 4, fontSize: 'var(--text-xs)', color: 'var(--text3)' }} title="Sem snapshot de Estoque para essa data">*</span>}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.estoqueStats.disponivel ? fmtBRL(r.estoqueStats.valor31) : '—'}</td>
              </tr>
              <tr>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Valor Estoque Obsoleto</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.estoqueStats.disponivel ? fmtBRL(r.estoqueStats.obsoleto) : '—'}</td>
              </tr>

              {/* Requisições */}
              <tr style={{ borderTop: '2px solid var(--border1)' }}>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Qtde. Itens Solicitados</td>
                <td style={{ textAlign: 'right' }}>
                  <input type="number" value={r.manualPecas.itens_solicitados} onChange={e => r.atualizarManualPecas('itens_solicitados', e.target.value)} style={inputStyle} placeholder="0" />
                </td>
              </tr>
              <tr>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Itens Atendidos</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.qtdePecas}</td>
              </tr>
              <tr>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>% Índice de Atendimento</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pctAtend}{pctAtend !== '—' ? '%' : ''}</td>
              </tr>
              <tr>
                <td style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Qtde. OS com Peças</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.qtdeOS}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Funcionários peças */}
      <div className="card">
        <CardHead title="Funcionários — Peças" />
        <div style={{ padding: '0 16px 16px' }}>
          {Object.keys(r.funcionarios).length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>Configure em Regras → Resumo Mensal → Cargos → Função IHS.</p>
          ) : (
            <table className="data-table">
              <tbody>
                {FUNCOES_EXIB.filter(([k]) =>
                  ['vendedor_interno','vendedor_externo','telemarketing','chefe_pecas','gerente_pecas'].includes(k)
                ).map(([k, lbl]) => {
                  const n = r.funcionarios[k]
                  if (!n) return null
                  return <tr key={k}><td style={{ fontSize: 'var(--text-sm2)' }}>{lbl}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n}</td></tr>
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Aba Histórico ────────────────────────────────────────────────────────────
function AbaHistorico({ r }) {
  const [detalhe, setDetalhe] = useState(null)

  const histPassagens = r.histOficina.filter(h => h.totalPassagens > 0).map(h => ({ mes: h.mes, valor: h.totalPassagens }))
  const histMO        = r.histOficina.filter(h => h.totalMO        > 0).map(h => ({ mes: h.mes, valor: h.totalMO        }))
  const histVendas    = r.histPecas.filter(h   => h.totalVendas    > 0).map(h => ({ mes: h.mes, valor: h.totalVendas    }))
  const histRMP       = r.histPecas.filter(h   => h.rmp_total      > 0).map(h => ({ mes: h.mes, valor: h.rmp_total      }))
  const histCompras   = r.histPecas.filter(h   => h.totalCompras   > 0).map(h => ({ mes: h.mes, valor: h.totalCompras   }))

  const metricas = [
    { key: 'passagens', label: 'Passagens Totais — Oficina',  dados: histPassagens, formato: v => `${v}`, unidade: 'pass.' },
    { key: 'mo',        label: 'Faturamento M.O. Total',       dados: histMO,        formato: fmtCurto },
    { key: 'vendas',    label: 'Vendas de Peças Total',        dados: histVendas,    formato: fmtCurto },
    { key: 'rmp',       label: 'RMP Honda',                    dados: histRMP,       formato: fmtCurto },
    { key: 'compras',   label: 'Compras de Peças',             dados: histCompras,   formato: fmtCurto },
  ].filter(m => m.dados.length > 1)

  if (metricas.length === 0) {
    return (
      <EmptyState icon={FileText} title="Histórico insuficiente"
        sub="São necessários dados de pelo menos 2 meses para exibir a evolução." />
    )
  }

  // Detalhe: tabela do mês selecionado
  function DetalheCard({ metricaKey }) {
    const m = r.histOficina.find(h => h.mes === detalhe) || null
    const p = r.histPecas.find(h => h.mes === detalhe) || null
    if (!detalhe || (!m && !p)) return null

    return (
      <div className="card" style={{ border: '2px solid var(--accent)' }}>
        <CardHead title={`Detalhe — ${detalhe}`} action={
          <button className="btn btn-ghost btn-sm" onClick={() => setDetalhe(null)}>✕ Fechar</button>
        } />
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {m && (
            <div>
              <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm2)', marginBottom: 8 }}>Oficina</div>
              <table className="data-table">
                <tbody>
                  {LINHAS_OFICINA_EXIB.map(([k, lbl]) => {
                    const v = m.por_linha[k]
                    if (!v) return null
                    return (
                      <tr key={k}>
                        <td style={{ fontSize: 'var(--text-xs)' }}>{lbl}</td>
                        <td style={{ textAlign: 'right', fontSize: 'var(--text-xs)' }}>{v.passagens} pass.</td>
                        <td style={{ textAlign: 'right', fontSize: 'var(--text-xs)' }}>{fmtBRL(v.mo)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {p && (
            <div>
              <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm2)', marginBottom: 8 }}>Peças</div>
              <table className="data-table">
                <tbody>
                  {CANAIS_PECAS_EXIB.map(([k, lbl]) => {
                    const v = p.por_canal[k]
                    if (!v) return null
                    const isC = k === 'compra_honda' || k === 'compra_outra'
                    return (
                      <tr key={k}>
                        <td style={{ fontSize: 'var(--text-xs)' }}>{lbl}</td>
                        <td style={{ textAlign: 'right', fontSize: 'var(--text-xs)' }}>{fmtBRL(isC ? v.custo : v.faturamento)}</td>
                      </tr>
                    )
                  })}
                  {p.rmp_total > 0 && (
                    <tr style={{ borderTop: '1px solid var(--border1)', fontWeight: 700 }}>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>RMP Honda</td>
                      <td style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>{fmtBRL(p.rmp_total)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', margin: 0 }}>
        Clique em um ponto do gráfico para ver o detalhe daquele mês.
      </p>

      {detalhe && <DetalheCard />}

      {metricas.map(m => (
        <HistChartClicavel
          key={m.key}
          titulo={m.label}
          dados={m.dados}
          formatY={m.formato}
          unidade={m.unidade}
          mesSelecionado={detalhe}
          onClickMes={setDetalhe}
        />
      ))}
    </div>
  )
}

// Versão clicável do HistChart
function HistChartClicavel({ titulo, dados, formatY = fmtCurto, unidade = '', mesSelecionado, onClickMes }) {
  const [hover, setHover] = useState(null)
  if (!dados?.length) return null

  const W = 560, H = 160
  const PAD = { top: 28, right: 16, bottom: 32, left: 52 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top  - PAD.bottom
  const maxV = Math.max(...dados.map(d => d.valor), 1)

  const pts = dados.map((d, i) => ({
    ...d,
    x: PAD.left + (dados.length < 2 ? iW / 2 : i * iW / (dados.length - 1)),
    y: PAD.top  + iH - (d.valor / maxV) * iH,
  }))

  const poly = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = [`${pts[0].x},${PAD.top + iH}`, ...pts.map(p => `${p.x},${p.y}`), `${pts[pts.length-1].x},${PAD.top + iH}`].join(' ')

  return (
    <div className="card">
      <CardHead title={titulo} />
      <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 300, height: H }}
          onMouseLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map(p => {
            const y = PAD.top + iH * (1 - p)
            return (
              <g key={p}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="var(--border1)" strokeWidth={0.5} strokeDasharray="3 3" />
                <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="var(--text3)">
                  {formatY(maxV * p)}
                </text>
              </g>
            )
          })}
          <polygon points={area} fill="var(--accent)" opacity={0.07} />
          <polyline points={poly} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
          {pts.map((p, i) => {
            const sel = mesSelecionado === p.mes
            const hov = hover === i
            return (
              <g key={p.mes}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)}
                onClick={() => onClickMes(mesSelecionado === p.mes ? null : p.mes)}>
                <circle cx={p.x} cy={p.y} r={sel ? 6 : hov ? 5 : 3.5}
                  fill={sel ? 'var(--accent)' : hov ? '#fff' : '#fff'}
                  stroke="var(--accent)" strokeWidth={sel ? 0 : 2} />
                <text x={p.x} y={PAD.top + iH + 14} textAnchor="middle" fontSize={8}
                  fill={sel ? 'var(--accent)' : 'var(--text3)'} fontWeight={sel ? 700 : 400}>
                  {p.mes.slice(0, 5)}
                </text>
                {(hov || sel) && (
                  <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={9} fontWeight="700" fill="var(--text1)">
                    {unidade ? `${p.valor} ${unidade}` : formatY(p.valor)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ResumoMensal() {
  const r = useResumoMensal()
  const [aba, setAba] = useState('oficina')

  const semDados = r.todosMeses.length === 0

  return (
    <div className="page">
      <div style={{ padding: '0 0 4px' }}>
        <div style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)', marginBottom: 2 }}>Honda IHS</div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text1)' }}>
          Resumo Mensal de Atividades
        </h2>
      </div>

      <FiltersBar>
        <FiltroAnoMes meses={r.todosMeses} value={r.mesAtivo} onChange={r.setMesAtivo} />
        <span className="dash-bar-sep" />
        <FiltroDropdown label="Estado" options={r.optsEstado} value={r.estadoSel} onChange={r.setEstado} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>
            Lojas — combine livremente para somar ({r.lojasSel.length === 0 ? 'todas' : r.lojasSel.join(', ')})
          </span>
          <MultiSelectLojas lojas={r.todasLojas} selecionadas={r.lojasSel} onChange={r.setLojasSel} />
        </div>
        {(r.estadoSel || r.lojasSel.length > 0) && (
          <button className="filter-clear" onClick={() => { r.setEstado(''); r.setLojasSel([]) }}>✕</button>
        )}
      </FiltersBar>

      {semDados ? (
        <EmptyState icon={FileText} title="Sem dados carregados"
          sub="Importe os arquivos de peças e oficina na página de Upload." />
      ) : (
        <>
          <div className="tab-nav">
            {[['oficina','Oficina'],['pecas','Peças'],['historico','Histórico']].map(([k, lbl]) => (
              <button key={k} className={`tab-btn${aba === k ? ' active' : ''}`} onClick={() => setAba(k)}>
                {lbl}
              </button>
            ))}
          </div>

          {aba === 'oficina'   && <AbaOficina   r={r} />}
          {aba === 'pecas'     && <AbaPecas     r={r} />}
          {aba === 'historico' && <AbaHistorico r={r} />}

        </>
      )}
    </div>
  )
}
