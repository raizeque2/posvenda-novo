import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CURVA_META } from '../../services/processamento/processarObsoleto.js'
import { fmtBRL2 as fmtBRL } from '../../utils/formatacao.js'
import { fmtK, fmtPct, corCobertura, fmtDataCurta } from './utils.js'
import { Estado } from '../../components/Estados.jsx'
import './estoque-geral.css'

const CURVAS = ['CURVA_A', 'CURVA_B', 'CURVA_C', 'CURVA_D', 'CURVA_E']
const Icone = ({ nome }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><use href={`/icons/iconoir.svg#${nome}`} /></svg>

function faixaDias(st, t) {
  return st === 'CURVA_A' ? `0–${t.curvaA} dias`
    : st === 'CURVA_B' ? `${t.curvaA + 1}–${t.curvaB} dias`
    : st === 'CURVA_C' ? `${t.curvaB + 1}–${t.curvaC} dias`
    : st === 'CURVA_D' ? `${t.curvaC + 1}–${t.curvaD} dias`
    : `mais de ${t.curvaD} dias`
}
const corObsoleto = pct => pct >= 0.2 ? 'var(--red-critical)' : pct >= 0.1 ? 'var(--amber)' : 'var(--green)'

function Indicador({ icone, rotulo, valor, detalhe, tom }) {
  return (
    <article className="eg-ind">
      <span className={`eg-ind-icone${tom ? ` is-${tom}` : ''}`}><Icone nome={icone} /></span>
      <strong>{valor}</strong>
      <span>{rotulo}</span>
      {detalhe && <small>{detalhe}</small>}
    </article>
  )
}

/** Lista com barras horizontais (substitui as roscas, que repetiam a mesma informação). */
function ListaBarras({ titulo, subtitulo, icone, dados, total, cor, vazio }) {
  const topo = Math.max(1, ...dados.map(d => d.valor))
  return (
    <section className="eg-card">
      <header><span className="eg-card-icone"><Icone nome={icone} /></span><div><h3>{titulo}</h3>{subtitulo && <p>{subtitulo}</p>}</div></header>
      {dados.length ? (
        <ol className="eg-lista">
          {dados.map(d => (
            <li key={d.nome}>
              <div><span title={d.nome}>{d.nome}</span><b>{fmtBRL(d.valor)}</b>{total > 0 && <em>{fmtPct(d.valor / total)}</em>}</div>
              <span className="eg-barra"><i style={{ width: `${Math.max(2, d.valor / topo * 100)}%`, background: cor }} /></span>
            </li>
          ))}
        </ol>
      ) : <p className="eg-vazio">{vazio}</p>}
    </section>
  )
}

export function AbaVisaoGeral({ resumo, itens, historico, thresholds, pecas, loadingHistorico }) {
  const t = thresholds
  const N = useMemo(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate() }, [])

  const { diasCoberturaTotal, cmvJanela, diasCoberturaPorLoja } = useMemo(() => {
    if (!pecas?.length || !resumo?.custoTotal) return { diasCoberturaTotal: null, cmvJanela: 0, diasCoberturaPorLoja: {} }
    const dN = new Date(Date.now() - N * 86400000)
    const lojasFiltradas = new Set((resumo.porLoja || []).map(l => l.loja))
    const rec = pecas.filter(r => r.comissao && r.dt instanceof Date && r.dt >= dN && lojasFiltradas.has(r.empresa))
    const cmv = rec.reduce((s, r) => s + (r.custo || 0), 0)
    const mediaDiaria = cmv / N
    const porLoja = {}
    resumo.porLoja?.forEach(l => {
      const md = rec.filter(r => r.empresa === l.loja).reduce((s, r) => s + (r.custo || 0), 0) / N
      porLoja[l.loja] = md > 0 ? Math.round(l.custoTotal / md) : null
    })
    return { diasCoberturaTotal: mediaDiaria > 0 ? Math.round(resumo.custoTotal / mediaDiaria) : null, cmvJanela: cmv, diasCoberturaPorLoja: porLoja }
  }, [pecas, resumo, N])

  const evolucao = useMemo(() => [...historico].sort((a, b) => a.dataISO.localeCompare(b.dataISO)).map(h => ({
    mes: fmtDataCurta(h.dataISO),
    total: Math.round(h.resumo?.custoTotal || 0),
    obsoleto: Math.round(h.resumo?.obsCusto || 0),
    pct: h.resumo?.pctObsoleto ? Math.round(h.resumo.pctObsoleto * 100) : 0,
  })), [historico])

  const curvas = CURVAS.map(st => ({ st, ...CURVA_META[st], ...(resumo.porStatus?.[st] || { itens: 0, custo: 0 }) }))
  const lojas = useMemo(() => [...resumo.porLoja].sort((a, b) => b.custoTotal - a.custoTotal), [resumo])
  const obsLoja = lojas.map(l => ({ nome: l.loja, valor: l.obsCusto })).filter(d => d.valor > 0).sort((a, b) => b.valor - a.valor)
  const preObs = useMemo(() => {
    const m = {}
    ;(itens || []).filter(i => i.status === 'CURVA_C').forEach(i => { m[i.tipo] = (m[i.tipo] || 0) + i.custoTotal })
    return Object.entries(m).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6)
  }, [itens])
  const tipos = (resumo.porTipo || []).map(x => ({ nome: x.tipo, valor: x.custoTotal })).sort((a, b) => b.valor - a.valor).slice(0, 6)

  if (!resumo.totalItens) return <Estado tipo="semDados" titulo="Sem posição de estoque para este recorte" texto="Escolha outro mês ou ajuste os filtros de estado, loja e tipo." />

  return (
    <div className="eg">
      <div className="eg-inds">
        <Indicador icone="box" rotulo="Estoque a custo" valor={fmtBRL(resumo.custoTotal)} detalhe={`${resumo.totalItens.toLocaleString('pt-BR')} itens · venda ${fmtBRL(resumo.pvTotal)}`} />
        <Indicador icone="warning-triangle" tom="red" rotulo="Obsoleto (curvas D e E)" valor={fmtBRL(resumo.obsCusto)} detalhe={`${fmtPct(resumo.pctObsoleto)} do estoque · ${resumo.obsItens} itens`} />
        <Indicador icone="refresh-double" rotulo={`CMV dos últimos ${N} dias`} valor={loadingHistorico ? '…' : fmtBRL(cmvJanela)} detalhe={`Média de ${fmtBRL(cmvJanela / N)} por dia`} />
        <Indicador icone="clock" tom={diasCoberturaTotal == null ? null : diasCoberturaTotal > 120 ? 'red' : diasCoberturaTotal > 60 ? 'amber' : 'green'} rotulo="Cobertura de estoque" valor={loadingHistorico ? '…' : diasCoberturaTotal != null ? `${diasCoberturaTotal.toLocaleString('pt-BR')} dias` : '—'} detalhe="Estoque a custo ÷ CMV médio diário" />
      </div>

      <section className="eg-saude" aria-labelledby="eg-saude-t">
        <header><div><h2 id="eg-saude-t">Saúde do estoque por curva</h2><p>Curva pela última saída de cada item. D e E são obsoletos; C pede atenção.</p></div></header>
        <div className="eg-pilha" role="img" aria-label={curvas.map(c => `${c.label}: ${fmtPct(resumo.custoTotal ? c.custo / resumo.custoTotal : 0)}`).join(', ')}>
          {curvas.filter(c => c.custo > 0).map(c => <i key={c.st} style={{ flexGrow: c.custo, background: c.cor }} title={`${c.label}: ${fmtBRL(c.custo)}`} />)}
        </div>
        <ul className="eg-curvas">
          {curvas.map(c => (
            <li key={c.st}>
              <span className="eg-ponto" style={{ background: c.cor }} />
              <div><strong>{c.label}</strong><small>{c.sublabel} · {faixaDias(c.st, t)}</small></div>
              <div className="eg-curva-num"><b>{fmtBRL(c.custo)}</b><small>{c.itens.toLocaleString('pt-BR')} itens · {fmtPct(resumo.custoTotal ? c.custo / resumo.custoTotal : 0)}</small></div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="eg-lojas-t">
        <h2 id="eg-lojas-t" className="eg-secao">Lojas</h2>
        <div className="eg-lojas">
          {lojas.map(l => (
            <article key={l.loja} className="eg-loja">
              <header><strong>{l.loja}</strong><span style={{ color: corObsoleto(l.pctObsoleto) }}>{fmtPct(l.pctObsoleto)} obsoleto</span></header>
              <b>{fmtBRL(l.custoTotal)}</b>
              <div className="eg-pilha eg-pilha-mini" aria-hidden="true">{CURVAS.map(st => l.curvas?.[st]?.custo > 0 && <i key={st} style={{ flexGrow: l.curvas[st].custo, background: CURVA_META[st].cor }} />)}</div>
              <dl>
                <div><dt>Obsoleto</dt><dd>{fmtBRL(l.obsCusto)}</dd></div>
                <div><dt>Cobertura</dt><dd style={{ color: corCobertura(diasCoberturaPorLoja[l.loja]) }}>{diasCoberturaPorLoja[l.loja] != null ? `${diasCoberturaPorLoja[l.loja]} dias` : '—'}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <div className="eg-cards">
        <ListaBarras titulo="Obsoleto por loja" subtitulo="Curvas D e E a custo" icone="warning-triangle" dados={obsLoja} total={resumo.obsCusto} cor="var(--red-critical)" vazio="Nenhuma loja com estoque obsoleto." />
        <ListaBarras titulo="Pré-obsoleto (curva C)" subtitulo="Tipos que podem virar obsoletos" icone="clock" dados={preObs} cor="var(--amber)" vazio="Nenhum item na curva C." />
        {tipos.length > 1 && <ListaBarras titulo="Estoque por tipo" subtitulo="Maiores grupos a custo" icone="packages" dados={tipos} total={resumo.custoTotal} cor="var(--honda)" vazio="" />}
      </div>

      {evolucao.length >= 2 && (
        <section className="eg-card eg-evolucao">
          <header><span className="eg-card-icone"><Icone nome="graph-up" /></span><div><h3>Evolução mensal</h3><p>Estoque total, obsoleto e % obsoleto por posição</p></div></header>
          <div className="eg-grafico">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
                <YAxis yAxisId="val" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={fmtK} width={48} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={v => `${v}%`} width={36} />
                <Tooltip formatter={(v, name) => name === 'pct' ? [`${v}%`, '% obsoleto'] : [fmtBRL(v), name === 'total' ? 'Estoque total' : 'Obsoleto']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend formatter={v => v === 'total' ? 'Estoque total' : v === 'obsoleto' ? 'Obsoleto' : '% obsoleto'} wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="val" dataKey="total" stroke="var(--text3)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line yAxisId="val" dataKey="obsoleto" stroke="var(--honda)" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="pct" dataKey="pct" stroke="var(--amber)" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  )
}
