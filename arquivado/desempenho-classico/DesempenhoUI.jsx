import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { fmtBRL, fmtPct } from '../../utils/formatacao.js'
import { CardHead } from '../../components/DS.jsx'
import { Award, User, Check, X, Star } from '../../icons/iconoir'
import { CHART_HONDA, CHART_GREEN, CHART_AMBER, CHART_GRAY, CANAL_COLOR } from '../../theme/chartPalette.js'

const HONDA_COLOR = CHART_HONDA
const GREEN       = CHART_GREEN
const AMBER       = CHART_AMBER
const GRAY        = CHART_GRAY
const CAT_COLOR   = CANAL_COLOR

function fmtK(v) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

function KpiMini({ label, valor, sub, cor }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontWeight: 'var(--weight-semibold)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: cor || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function BadgeChip({ icon: Icon, label, cor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20,
      background: `${cor}18`, border: `1px solid ${cor}44`,
      fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-bold)', color: cor,
    }}>
      {Icon && <Icon size={13} strokeWidth={2} />}<span>{label}</span>
    </div>
  )
}

export function HeroSection({ d, lojasTags }) {
  const pos = d.posicaoPecas || d.posicaoOficina
  const avatarColor = pos === 1 ? AMBER : pos === 2 ? 'var(--text3)' : pos === 3 ? '#cd7c2f' : 'var(--text3)'
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg3)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {pos && pos <= 3
            ? <Award size={28} strokeWidth={1.5} style={{ color: avatarColor }} />
            : <User size={28} strokeWidth={1.5} style={{ color: 'var(--text3)' }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>{d.nomeResolvido}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {d.ufPrincipal && <span className="badge badge-blue" style={{ fontSize: 'var(--text-sm)' }}>{d.ufPrincipal}</span>}
            {lojasTags.slice(0, 4).map(l => <span key={l} className="badge badge-gray" style={{ fontSize: 'var(--text-sm)' }}>{l}</span>)}
          </div>
          {pos && (
            <div style={{ marginTop: 6, fontSize: 'var(--text-base)', color: 'var(--text2)' }}>
              <strong style={{ color: pos <= 3 ? AMBER : 'var(--text)' }}>{pos}º lugar</strong>
              {d.totalNaDisputa > 0 && <span style={{ color: 'var(--text3)' }}> de {d.totalNaDisputa} · {d.ufPrincipal}</span>}
            </div>
          )}
        </div>
        {d.badges.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {d.badges.map((b, i) => <BadgeChip key={i} icon={b.icon} label={b.label} cor={b.cor} />)}
          </div>
        )}
      </div>
    </div>
  )
}

export function SecaoPecas({ d }) {
  const { kpiPecas, diasDec, diasMes } = d
  const pct = kpiPecas.pct ?? 0
  const barColor = pct >= 1 ? GREEN : pct >= 0.8 ? AMBER : HONDA_COLOR
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <CardHead title={`Peças · ${d.mesAtivo}`} badge={`${diasDec} de ${diasMes} dias úteis`} />
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
          <KpiMini label="Realizado"   valor={fmtBRL(kpiPecas.liquido)} sub={kpiPecas.pct !== null ? fmtPct(kpiPecas.pct) + ' da meta' : '–'} cor={barColor} />
          <KpiMini label="Meta"        valor={fmtBRL(kpiPecas.meta)}    sub={kpiPecas.meta > 0 ? `Faltam ${fmtBRL(Math.max(0, kpiPecas.meta - kpiPecas.liquido))}` : 'Sem meta'} />
          <KpiMini label="Projeção"    valor={fmtBRL(kpiPecas.proj)}    sub={kpiPecas.meta > 0 ? 'Proj. ' + fmtPct(kpiPecas.proj / kpiPecas.meta) : '–'} cor={kpiPecas.proj >= kpiPecas.meta ? GREEN : GRAY} />
          <KpiMini label="Ticket Médio" valor={fmtBRL(kpiPecas.ticket)} sub={`${kpiPecas.nVendas} vendas`} />
        </div>
        {kpiPecas.meta > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm2)', color: 'var(--text2)', marginBottom: 6 }}>
              <span>Progresso da meta</span>
              <span style={{ fontWeight: 'var(--weight-bold)', color: barColor }}>{fmtPct(pct)}</span>
            </div>
            <div style={{ height: 14, borderRadius: 7, background: 'var(--bg3)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${Math.min(Math.min(pct, 2) * 100, 100)}%`, height: '100%', background: barColor, borderRadius: 7, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text3)', marginTop: 4 }}>
              <span>R$0</span><span>{fmtBRL(kpiPecas.meta)}</span>
            </div>
            {kpiPecas.pct !== null && kpiPecas.pct < 1 && diasDec > 0 && (
              <div style={{ marginTop: 8, fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
                Precisaria vender <strong>{fmtBRL((kpiPecas.meta - kpiPecas.liquido) / Math.max(diasMes - diasDec, 1))}/dia</strong> nos dias restantes para bater a meta.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function SecaoOficina({ d }) {
  const { kpiOficina, diasDec, diasMes } = d
  const pct = kpiOficina.pctMO ?? 0
  const barColor = pct >= 1 ? GREEN : pct >= 0.8 ? AMBER : HONDA_COLOR
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <span className="card-title">Oficina · {d.mesAtivo}</span>
        <span className="badge badge-gray">{diasDec} de {diasMes} dias úteis</span>
        {d.ehConsultor && <span className="badge badge-blue"  style={{ fontSize: 'var(--text-sm)' }}>Consultor</span>}
        {d.ehMecanico  && <span className="badge badge-gray"  style={{ fontSize: 'var(--text-sm)' }}>Mecânico</span>}
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
          <KpiMini label="MO Real"     valor={fmtBRL(kpiOficina.moReal)}  sub={kpiOficina.pctMO !== null ? fmtPct(kpiOficina.pctMO) + ' da meta' : '–'} cor={barColor} />
          <KpiMini label="Meta MO"     valor={fmtBRL(kpiOficina.moMeta)}  sub={kpiOficina.moMeta > 0 ? `Faltam ${fmtBRL(Math.max(0, kpiOficina.moMeta - kpiOficina.moReal))}` : 'Sem meta'} />
          <KpiMini label="Peças OS"    valor={fmtBRL(kpiOficina.poReal)}  sub={kpiOficina.poMeta > 0 ? fmtPct(kpiOficina.poReal / kpiOficina.poMeta) + ' da meta' : '–'} />
          <KpiMini label="Passagens"   valor={String(kpiOficina.passagens)} sub="Atendimentos" />
          <KpiMini label="Projeção MO" valor={fmtBRL(kpiOficina.projMO)}  sub={kpiOficina.moMeta > 0 ? 'Proj. ' + fmtPct(kpiOficina.projMO / kpiOficina.moMeta) : '–'} cor={kpiOficina.projMO >= kpiOficina.moMeta ? GREEN : GRAY} />
        </div>
        {kpiOficina.moMeta > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm2)', color: 'var(--text2)', marginBottom: 6 }}>
              <span>Progresso meta MO</span>
              <span style={{ fontWeight: 'var(--weight-bold)', color: barColor }}>{fmtPct(pct)}</span>
            </div>
            <div style={{ height: 14, borderRadius: 7, background: 'var(--bg3)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(pct * 100, 100)}%`, height: '100%', background: barColor, borderRadius: 7, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MesCard({ h, isMelhor }) {
  const cor = h.bateu ? GREEN : h.meta === 0 ? GRAY : HONDA_COLOR
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8, minWidth: 80, textAlign: 'center',
      background: h.bateu ? 'rgba(34,197,94,0.08)' : 'var(--bg3)',
      border: `1px solid ${h.bateu ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
      position: 'relative',
    }}>
      {isMelhor && (
        <div style={{ position: 'absolute', top: -6, right: -4, background: 'var(--bg2)', borderRadius: 4, padding: '1px 3px', display: 'flex', alignItems: 'center' }}>
          <Star size={10} strokeWidth={2} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
        </div>
      )}
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h.mes}</div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: cor, marginTop: 2 }}>{fmtK(h.real)}</div>
      {h.meta > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginTop: 1 }}>{fmtPct(h.pct ?? 0)}</div>}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
        {h.bateu ? <Check size={12} strokeWidth={2.5} style={{ color: GREEN }} /> : h.meta > 0 ? <X size={12} strokeWidth={2.5} style={{ color: HONDA_COLOR }} /> : <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>–</span>}
      </div>
    </div>
  )
}

function TooltipPadrao(props) {
  return (
    <Tooltip {...props} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 'var(--text-sm2)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} cursor={{ fill: 'var(--bg3)', opacity: 0.5 }} />
  )
}

function HistoricoChart({ historico }) {
  const data = historico.map(h => ({
    mes: h.mes, pct: h.meta > 0 ? Math.round((h.pct ?? 0) * 100) : 0,
    bateu: h.bateu, semMeta: h.meta === 0, real: h.real, meta: h.meta,
  }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 'var(--text-xs)', fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 'var(--text-xs)', fill: 'var(--text3)' }} tickFormatter={v => `${v}%`} width={44} axisLine={false} tickLine={false} />
        <TooltipPadrao formatter={(v) => [`${v}% da meta`, 'Atingimento']}
          labelFormatter={(label, payload) => {
            const it = payload?.[0]?.payload
            return it ? `${label} · ${fmtBRL(it.real)} / ${fmtBRL(it.meta)}` : label
          }} />
        <ReferenceLine y={100} stroke={GREEN} strokeDasharray="4 3" />
        <Bar dataKey="pct" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700}>
          {data.map((e, i) => <Cell key={i} fill={e.semMeta ? GRAY : e.bateu ? GREEN : HONDA_COLOR} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SecaoHistorico({ d }) {
  const { historico } = d
  if (historico.length === 0) return null
  const ultimos12 = historico.slice(-12)
  const bateuCount = ultimos12.filter(h => h.bateu).length
  const mediaBatida = ultimos12.length > 0 ? bateuCount / ultimos12.length : 0
  const melhor = Math.max(...ultimos12.map(h => h.real))
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <span className="card-title">Histórico</span>
        <span className="badge badge-gray">{ultimos12.length} meses</span>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
          Meta batida em <strong style={{ color: mediaBatida >= 0.7 ? GREEN : mediaBatida >= 0.5 ? AMBER : HONDA_COLOR }}>{bateuCount}/{ultimos12.length} meses</strong>
        </span>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {ultimos12.map(h => <MesCard key={h.mes} h={h} isMelhor={h.real === melhor && melhor > 0} />)}
        </div>
        <HistoricoChart historico={ultimos12} />
      </div>
    </div>
  )
}

function CanalChart({ data }) {
  const altura = Math.max(160, data.length * 38)
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 'var(--text-xs)', fill: 'var(--text3)' }} tickFormatter={fmtK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="cat" tick={{ fontSize: 'var(--text-sm)', fill: 'var(--text2)' }} width={80} axisLine={false} tickLine={false} />
        <TooltipPadrao formatter={v => [fmtBRL(v), 'Vendas']} />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={700}
          label={{ position: 'right', fontSize: 'var(--text-xs)', fill: 'var(--text3)', formatter: fmtK }}>
          {data.map((e, i) => <Cell key={i} fill={CAT_COLOR[e.cat] || HONDA_COLOR} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CalendarioVendas({ d }) {
  const porDia = {}
  d.vendasPorDia.forEach(v => { porDia[v.dia] = v.diario })
  const hoje = new Date()
  const ano = hoje.getFullYear(), mes = hoje.getMonth()
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const valores = Object.values(porDia).filter(v => v > 0)
  const max = valores.length ? Math.max(...valores) : 0
  const melhorDia = Object.entries(porDia).reduce(
    (best, [dia, val]) => val > best.val ? { dia: +dia, val } : best, { dia: null, val: 0 },
  )
  const cor = val => {
    if (!val || val <= 0 || max <= 0) return 'var(--bg3)'
    return `rgba(228,3,46,${0.18 + (val / max) * 0.82})`
  }
  const cells = []
  for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null)
  for (let dia = 1; dia <= diasNoMes; dia++) cells.push(dia)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text3)', fontWeight: 'var(--weight-bold)', paddingBottom: 2 }}>{s}</div>
        ))}
        {cells.map((dia, i) => {
          if (dia === null) return <div key={i} />
          const val = porDia[dia] || 0
          const futuro = dia > hoje.getDate()
          const ehMelhor = dia === melhorDia.dia && melhorDia.val > 0
          return (
            <div key={i} title={`Dia ${dia}: ${fmtBRL(val)}`} style={{
              aspectRatio: '1', borderRadius: 6, background: futuro ? 'transparent' : cor(val),
              border: ehMelhor ? '2px solid var(--amber)' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
              color: val > max * 0.55 ? '#fff' : 'var(--text3)',
            }}>{dia}</div>
          )
        })}
      </div>
      {melhorDia.dia && (
        <div style={{ marginTop: 10, fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
          Melhor dia: <strong style={{ color: 'var(--amber)' }}>dia {melhorDia.dia}</strong> · {fmtBRL(melhorDia.val)}
        </div>
      )}
    </div>
  )
}

export function SecaoGraficos({ d }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
      {d.porCategoria.length > 0 && (
        <div className="card" style={{ marginBottom: 0 }}>
          <CardHead title="Por Canal" />
          <div style={{ padding: '0 16px 16px' }}><CanalChart data={d.porCategoria} /></div>
        </div>
      )}
      <div className="card" style={{ marginBottom: 0 }}>
        <CardHead title={`Vendas por Dia · ${d.mesAtivo}`} />
        <div style={{ padding: '0 16px 16px' }}><CalendarioVendas d={d} /></div>
      </div>
    </div>
  )
}
