import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend
} from 'recharts'
import { KpiCard, Card, CardHead, Th, Td, TrHover, useSorter } from '../../components/AnalysisDS.jsx'
import './atacado.css'
import { fmtBRL, fmtPct, fmtNum, fmtCompacto } from '../../utils/formatacao.js'
import { norm } from '../../utils/normalizacao.js'

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
function mesLabel(mesAno) {
  if (!mesAno) return ''
  const [mm, aa] = mesAno.split('/')
  return `${MESES_ABREV[+mm - 1]}/${aa?.slice(2) || ''}`
}

function TooltipFat({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
      <div style={{ fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-xs)' }}>{d.mes}</div>
      <div>Bruto: {fmtBRL(d.bruto)}</div>
      <div style={{ color: 'var(--red)' }}>Devoluções: −{fmtBRL(d.devol)}</div>
      <div style={{ fontWeight: 'var(--weight-bold)' }}>Líquido: {fmtBRL(d.liquido)}</div>
      {d.meta > 0 && <div style={{ color: 'var(--text3)' }}>Meta: {fmtBRL(d.meta)}</div>}
      {d.margem != null && <div style={{ color: 'var(--text2)' }}>Margem: {fmtPct(d.margem, 1)}</div>}
    </div>
  )
}

const TABLE_MAX = 20
const TABLE_SCROLL = 100

export function AbaGeral({ a }) {
  const {
    realizado, metaAtacado, subFiltroAtivo,
    margemMes, carteiraData, novosReat, ticketMedio,
    itensPorNotaVal, concTop10, evolucao12,
    vendedoresMes, vendedores12m,
    tipoMercData, top10Pecas, nClientesMes, nCidades, busca,
  } = a

  const [periodoVend, setPeriodoVend] = useState('mes')
  const [pecasOrdem, setPecasOrdem]   = useState('desc')

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const pctProj = metaAtacado > 0 ? realizado.proj / metaAtacado : null
  const pctReal = metaAtacado > 0 ? realizado.liquido / metaAtacado : null

  // ── Chart data (faturamento 12m) ──────────────────────────────────────────
  const chartData = useMemo(() => {
    return evolucao12.map((e, i, arr) => {
      const start = Math.max(0, i - 2)
      const slice = arr.slice(start, i + 1)
      const mm3 = slice.length > 0 ? slice.reduce((s, x) => s + x.liquido, 0) / slice.length : 0
      return { ...e, mes: mesLabel(e.mes), mm3 }
    })
  }, [evolucao12])

  // ── Vendedores ────────────────────────────────────────────────────────────
  const vendedores = periodoVend === 'mes' ? vendedoresMes : vendedores12m
  const externos = useMemo(() => {
    const q = norm(busca)
    const filtered = vendedores.filter(v => v.tipo === 'EXTERNO')
    return q ? filtered.filter(v => norm(v.vendedor).includes(q)) : filtered
  }, [vendedores, busca])
  const balcao = useMemo(() => {
    const q = norm(busca)
    const filtered = vendedores.filter(v => v.tipo === 'BALCÃO')
    return q ? filtered.filter(v => norm(v.vendedor).includes(q)) : filtered
  }, [vendedores, busca])

  // ── Top 10 peças com alternância ──────────────────────────────────────────
  const pecasOrd = useMemo(() => {
    if (pecasOrdem === 'asc') return [...top10Pecas].sort((a, b) => a.faturamento - b.faturamento).slice(0, 10)
    return top10Pecas
  }, [top10Pecas, pecasOrdem])

  return (
    <>
      {/* KPIs */}
      <div className="kpi-grid kpi-grid-fluida" style={{ marginBottom: 'var(--space-lg)' }}>
        <KpiCard
          label="Faturamento × Meta"
          liq={realizado.liquido} devol={realizado.devol}
          proj={subFiltroAtivo ? 0 : realizado.proj}
          meta={subFiltroAtivo ? 0 : metaAtacado}
          pct={subFiltroAtivo ? null : pctProj}
          pctReal={subFiltroAtivo ? null : pctReal}
        >
          {subFiltroAtivo && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginTop: 'var(--space-xs)' }}>Meta não se aplica a este filtro</div>}
        </KpiCard>
        <KpiCard label="Margem" value={fmtPct(margemMes, 1)} sub="lucro bruto ÷ receita líquida" />
        <KpiCard label="Clientes ativos" value={fmtNum(carteiraData.positivados)}
          sub={`Positivação: ${fmtPct(carteiraData.positivacao, 0)} · Carteira: ${fmtNum(carteiraData.carteira)}`} />
        <KpiCard label="Novos + Reativados" value={fmtNum(novosReat.novos + novosReat.reativados)}
          sub={`${novosReat.novos} novos · ${novosReat.reativados} reativados`} />
        <KpiCard label="Ticket médio" value={fmtBRL(ticketMedio)} sub="por compra no mês" />
        <KpiCard label="Itens / Nota" value={itensPorNotaVal.toFixed(1)} sub="média de linhas distintas por NF" />
        <KpiCard label="Concentração Top 10" value={fmtPct(concTop10, 0)}
          sub={`${nClientesMes} clientes · ${nCidades} cidades`} />
      </div>

      {/* Faturamento: barras do líquido e linha da meta; margem e devoluções no tooltip. */}
      <Card style={{ marginBottom: 'var(--space-lg)' }}>
        <CardHead title={`Faturamento — ${chartData.length} meses`} />
        <div className="atacado-grafico">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
              <YAxis tickFormatter={fmtCompacto} tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<TooltipFat />} cursor={{ fill: 'var(--bg3)' }} />
              <Bar dataKey="liquido" fill="var(--honda)" radius={[6, 6, 0, 0]} maxBarSize={44} name="Faturamento líquido" />
              {!subFiltroAtivo && <Line type="stepAfter" dataKey="meta" stroke="var(--text2)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} name="Meta" />}
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      {/* Vendedores: lista ranqueada, no mesmo padrão de "Melhores vendedores" em Canais. */}
      <Card style={{ marginBottom: 'var(--space-lg)' }}>
        <CardHead
          title="Vendedores"
          action={
            <div className="atacado-seg" role="group" aria-label="Período dos vendedores">
              {['mes', '12m'].map(p => (
                <button key={p} type="button" aria-pressed={periodoVend === p} className={periodoVend === p ? 'is-ativo' : ''} onClick={() => setPeriodoVend(p)}>
                  {p === 'mes' ? 'Mês' : '12 meses'}
                </button>
              ))}
            </div>
          }
        />
        <ListaVendedores externos={externos} balcao={balcao} />
      </Card>
      {/* Tipo de mercadoria */}
      <Card style={{ marginBottom: 'var(--space-lg)' }}>
        <CardHead title="Tipo de mercadoria" badge={tipoMercData.length} />
        <AgrupamentoTable rows={tipoMercData} colLabel="Tipo" />
      </Card>

      {/* Top 10 peças */}
      <Card style={{ marginBottom: 'var(--space-lg)' }}>
        <CardHead
          title="Top 10 peças"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => setPecasOrdem(o => o === 'desc' ? 'asc' : 'desc')}>
              {pecasOrdem === 'desc' ? '↓ Mais vendidas' : '↑ Menos vendidas'}
            </button>
          }
        />
        <AgrupamentoTable rows={pecasOrd} colLabel="Peça" />
      </Card>
    </>
  )
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

const ORDENS = { faturamento: 'Faturamento', positivacao: 'Positivação', ticketMedio: 'Ticket médio' }
const iniciais = nome => String(nome || '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

function ListaVendedores({ externos, balcao }) {
  const grupos = [['EXTERNO', 'Externo', externos], ['BALCÃO', 'Balcão', balcao]].filter(([, , rows]) => rows.length)
  const [grupo, setGrupo] = useState(null)
  const [ordem, setOrdem] = useState('faturamento')
  const [todos, setTodos] = useState(false)
  const ativo = grupos.find(([k]) => k === grupo) || grupos[0]
  if (!ativo) return <p className="atacado-vazio">Sem vendedores neste período.</p>
  const rows = [...ativo[2]].sort((a, b) => (b[ordem] || 0) - (a[ordem] || 0))
  const lider = Math.max(1, ...rows.map(r => r[ordem] || 0))
  const visiveis = todos ? rows : rows.slice(0, 8)
  const fmt = ordem === 'positivacao' ? fmtNum : fmtBRL
  return (
    <div className="atacado-vend">
      <div className="atacado-vend-barra">
        {grupos.length > 1 && (
          <div className="atacado-seg" role="group" aria-label="Tipo de vendedor">
            {grupos.map(([k, rotulo, r]) => <button key={k} type="button" aria-pressed={ativo[0] === k} className={ativo[0] === k ? 'is-ativo' : ''} onClick={() => { setGrupo(k); setTodos(false) }}>{rotulo} <span>{r.length}</span></button>)}
          </div>
        )}
        <label className="atacado-ordem">Ordenar por
          <select value={ordem} onChange={e => setOrdem(e.target.value)}>{Object.entries(ORDENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
      </div>
      <ol className="atacado-vend-lista">
        {visiveis.map((v, i) => (
          <li key={v.chave}>
            <span className="atacado-vend-pos">{i + 1}</span>
            <span className="atacado-vend-avatar" aria-hidden="true">{iniciais(v.vendedor)}</span>
            <div className="atacado-vend-info">
              <strong title={v.vendedor}>{v.vendedor}</strong>
              <span className="atacado-vend-trilho"><i style={{ width: `${Math.max(2, (v[ordem] || 0) / lider * 100)}%` }} /></span>
              <small>{fmtNum(v.positivacao)} clientes · ticket {fmtBRL(v.ticketMedio)}</small>
            </div>
            <b>{fmt(v[ordem])}</b>
          </li>
        ))}
      </ol>
      {rows.length > 8 && <button type="button" className="btn btn-ghost atacado-ver-todos" onClick={() => setTodos(t => !t)}>{todos ? 'Mostrar menos' : `Ver todos os ${rows.length}`}</button>}
    </div>
  )
}
function AgrupamentoTable({ rows, colLabel }) {
  const { sorted, sort, toggle } = useSorter(rows, {
    label:       r => r.label,
    faturamento: r => r.faturamento,
    quantidade:  r => r.quantidade,
    nClientes:   r => r.nClientes,
  }, { col: 'faturamento', dir: 'desc' })

  const visivel = sorted.slice(0, TABLE_SCROLL)
  const total = sorted.reduce((s, r) => s + r.faturamento, 0)

  return (
    <div className="table-wrap" style={{ maxHeight: `${TABLE_MAX * 36 + 40}px`, overflowY: 'auto' }}>
      <table className="data-table">
        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>
            <Th col="label"       label={colLabel}     sort={sort} toggle={toggle} nome />
            <Th col="faturamento" label="Faturamento"  sort={sort} toggle={toggle} num />
            <Th col="quantidade"  label="Quantidade"   sort={sort} toggle={toggle} num />
            <Th col="nClientes"   label="Clientes"     sort={sort} toggle={toggle} num />
          </tr>
        </thead>
        <tbody>
          {visivel.map(r => (
            <TrHover key={r.chave}>
              <Td nome>{r.label}</Td>
              <Td num destaque>
                {fmtBRL(r.faturamento)}
                {total > 0 && <span style={{ color: 'var(--text3)', fontSize: 'var(--text-xs)', marginLeft: 'var(--space-xs)' }}>
                  {fmtPct(r.faturamento / total, 0)}
                </span>}
              </Td>
              <Td num>{fmtNum(r.quantidade)}</Td>
              <Td num>{fmtNum(r.nClientes)}</Td>
            </TrHover>
          ))}
        </tbody>
      </table>
    </div>
  )
}

