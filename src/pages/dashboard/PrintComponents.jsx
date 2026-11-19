import { fmtBRL, fmtPct, nomeAbrev } from '../../utils/formatacao.js'
import { LojaTags, StatusBadge } from '../../components/DS.jsx'

const ESTADO_PRINT = { PE: 'Pernambuco', AL: 'Alagoas' }

export function printKpiSub(proj, meta, hoje) {
  if (!proj && !meta && !hoje) return null
  return (
    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {proj > 0 && <span style={{ fontSize: 8, color: 'var(--text3)' }}>↗ {fmtBRL(proj)}</span>}
      {meta > 0 && <span style={{ fontSize: 8, color: 'var(--text3)' }}>Meta {fmtBRL(meta)}</span>}
      {hoje > 0 && <span style={{ fontSize: 8, color: 'var(--text3)' }}>Hoje {fmtBRL(hoje)}</span>}
    </div>
  )
}

export function PrintHeader({ estado, tipo, mes, diasDec, diasMes, ultimaAtualizacao }) {
  const diasFalt = Math.max(0, Math.round((diasMes - diasDec) * 10) / 10)
  return (
    <div className="snap-print-header">
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb', letterSpacing: '-0.4px' }}>Pós-Venda</div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
          {ESTADO_PRINT[estado] || estado || 'Todos'} · {tipo} · {mes}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ padding: '2px 10px', borderLeft: '1px solid rgba(255,255,255,0.12)', textAlign: 'right' }}>
          <div style={{ fontSize: 7, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Dias úteis</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f9fafb', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(diasDec * 10) / 10}<span style={{ fontSize: 9, color: '#6b7280' }}> / {diasMes}</span>
          </div>
        </div>
        <div style={{ padding: '2px 10px', borderLeft: '1px solid rgba(255,255,255,0.12)', textAlign: 'right' }}>
          <div style={{ fontSize: 7, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Restantes</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: diasFalt <= 3 ? '#fca5a5' : '#f9fafb', fontVariantNumeric: 'tabular-nums' }}>
            {diasFalt}
          </div>
        </div>
        {ultimaAtualizacao && (
          <div style={{ padding: '2px 10px', borderLeft: '1px solid rgba(255,255,255,0.12)', textAlign: 'right' }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Importação</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#f9fafb' }}>{ultimaAtualizacao}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function PrintRankCell({ pos }) {
  return (
    <td style={{ color: pos <= 3 ? 'var(--honda)' : '#9ca3af', fontWeight: pos <= 3 ? 700 : 600, width: 22, textAlign: 'center' }}>
      {pos}°
    </td>
  )
}

export const PRINT_CARD = { border: '1px solid #9ca3af', borderRadius: 'var(--radius)', padding: '5px 8px', marginBottom: 6, background: 'var(--bg2)', breakInside: 'avoid' }
export const PRINT_TH = { padding: '2px 4px', fontSize: 7, background: 'var(--bg3)', border: '1px solid #9ca3af', fontWeight: 600, color: '#374151' }
export const PRINT_TD = { padding: '2px 4px', fontSize: 8, borderBottom: '1px solid #e5e7eb' }

const STATUS_BORDER = { green: 'var(--green)', amber: 'var(--amber)', red: 'var(--honda)', honda: 'var(--honda)' }

export function PrintKpiCard({ label, value, status, badge, sub }) {
  const borderColor = STATUS_BORDER[status] || '#9ca3af'
  return (
    <div style={{
      border: '1px solid #9ca3af',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 4,
      padding: '6px 8px',
      background: '#f9fafb',
      breakInside: 'avoid',
    }}>
      <div style={{ fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {badge && <span>{badge}</span>}
      </div>
      {sub}
    </div>
  )
}

export function PrintCanalCard({ titulo, rows }) {
  if (!rows || rows.length === 0) return null
  return (
    <div style={PRINT_CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#111827' }}>{titulo}</span>
        <span style={{ fontSize: 7, padding: '1px 5px', border: '1px solid #d1d5db', borderRadius: 10, color: '#6b7280', background: '#f9fafb' }}>{rows.length} vendedor{rows.length !== 1 ? 'es' : ''}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
        <thead>
          <tr>
            <th style={{ ...PRINT_TH, textAlign: 'center', width: 22 }}>#</th>
            <th style={PRINT_TH}>Loja</th>
            <th style={PRINT_TH}>Colaborador</th>
            <th style={{ ...PRINT_TH, textAlign: 'center' }}>Realizado</th>
            <th style={{ ...PRINT_TH, textAlign: 'center' }}>% Margem</th>
            <th style={{ ...PRINT_TH, textAlign: 'center' }}>Meta</th>
            <th style={{ ...PRINT_TH, textAlign: 'center' }}>% Meta</th>
            <th style={{ ...PRINT_TH, textAlign: 'center' }}>Projeção</th>
            <th style={{ ...PRINT_TH, textAlign: 'center' }}>Hoje</th>
            <th style={{ ...PRINT_TH, textAlign: 'center' }}>TM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pctMeta = r.metaCanal > 0 ? r.projCanal / r.metaCanal : null
            const rowBg = i === 0 ? 'rgba(204,0,0,0.05)' : i === 1 ? 'rgba(204,0,0,0.02)' : 'var(--bg2)'
            return (
              <tr key={i} style={{ background: rowBg }}>
                <td style={{ ...PRINT_TD, textAlign: 'center', color: i < 3 ? 'var(--honda)' : '#9ca3af', fontWeight: i < 3 ? 700 : 400 }}>{i + 1}°</td>
                <td style={PRINT_TD}><LojaTags lojas={r.lojas || []} /></td>
                <td style={PRINT_TD}>{nomeAbrev(r.nome)}</td>
                <td style={{ ...PRINT_TD, textAlign: 'center', fontWeight: 600 }}>{fmtBRL(r.liq)}</td>
                <td style={{ ...PRINT_TD, textAlign: 'center', color: '#6b7280' }}>{r.margem != null ? fmtPct(r.margem) : '–'}</td>
                <td style={{ ...PRINT_TD, textAlign: 'center', color: '#6b7280' }}>{r.metaCanal > 0 ? fmtBRL(r.metaCanal) : '–'}</td>
                <td style={{ ...PRINT_TD, textAlign: 'center' }}>{pctMeta != null ? <StatusBadge pct={pctMeta} /> : '–'}</td>
                <td style={{ ...PRINT_TD, textAlign: 'center' }}>{r.projCanal > 0 ? fmtBRL(r.projCanal) : '–'}</td>
                <td style={{ ...PRINT_TD, textAlign: 'center', color: '#6b7280' }}>{r.hoje > 0 ? fmtBRL(r.hoje) : '–'}</td>
                <td style={{ ...PRINT_TD, textAlign: 'center', color: '#6b7280' }}>{r.tm > 0 ? fmtBRL(r.tm) : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PrintOficinaTabela({ rows, titulo, label }) {
  if (!rows || rows.length === 0) return null
  return (
    <>
      <div style={{ margin: '6px 0 4px', fontSize: 9, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titulo}</div>
      <div style={PRINT_CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#111827' }}>{label === 'Consultor' ? 'Consultores' : 'Mecânicos'}</span>
          <span style={{ fontSize: 7, padding: '1px 5px', border: '1px solid #d1d5db', borderRadius: 10, color: '#6b7280', background: '#f9fafb' }}>{rows.length} {label === 'Consultor' ? 'consultores' : 'mecânicos'}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', fontSize: 7, color: '#6b7280' }}>
              <td colSpan={3} style={{ padding: '2px 4px', border: '1px solid #9ca3af' }} />
              <td colSpan={3} style={{ padding: '2px 4px', textAlign: 'center', fontWeight: 700, border: '1px solid #9ca3af' }}>Mão de Obra</td>
              <td colSpan={3} style={{ padding: '2px 4px', textAlign: 'center', fontWeight: 700, border: '1px solid #9ca3af' }}>Peças OS</td>
              <td colSpan={2} style={{ padding: '2px 4px', textAlign: 'center', border: '1px solid #9ca3af' }}>–</td>
            </tr>
            <tr>
              <th style={{ ...PRINT_TH, textAlign: 'center', width: 22 }}>#</th>
              <th style={PRINT_TH}>Lojas</th>
              <th style={PRINT_TH}>{label}</th>
              <th style={{ ...PRINT_TH, textAlign: 'center' }}>Realizado</th>
              <th style={{ ...PRINT_TH, textAlign: 'center' }}>Meta</th>
              <th style={{ ...PRINT_TH, textAlign: 'center' }}>% Meta</th>
              <th style={{ ...PRINT_TH, textAlign: 'center' }}>Realizado</th>
              <th style={{ ...PRINT_TH, textAlign: 'center' }}>Meta</th>
              <th style={{ ...PRINT_TH, textAlign: 'center' }}>% Meta</th>
              <th style={{ ...PRINT_TH, textAlign: 'center' }}>Passagens</th>
              <th style={{ ...PRINT_TH, textAlign: 'center' }}>Hoje MO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pctMO = r.mo > 0 ? r.projMO / r.mo : null
              const pctPO = r.mpo > 0 ? r.projPO / r.mpo : null
              const rowBg = i === 0 ? 'rgba(204,0,0,0.05)' : i === 1 ? 'rgba(204,0,0,0.02)' : 'var(--bg2)'
              return (
                <tr key={i} style={{ background: rowBg }}>
                  <td style={{ ...PRINT_TD, textAlign: 'center', color: i < 3 ? 'var(--honda)' : '#9ca3af', fontWeight: i < 3 ? 700 : 400 }}>{i + 1}°</td>
                  <td style={PRINT_TD}><LojaTags lojas={r.lojas || []} /></td>
                  <td style={PRINT_TD}>{nomeAbrev(r.nome)}</td>
                  <td style={{ ...PRINT_TD, textAlign: 'center', fontWeight: 600 }}>{fmtBRL(r.moreal)}</td>
                  <td style={{ ...PRINT_TD, textAlign: 'center', color: '#6b7280' }}>{r.mo > 0 ? fmtBRL(r.mo) : '–'}</td>
                  <td style={{ ...PRINT_TD, textAlign: 'center' }}>{pctMO != null ? <StatusBadge pct={pctMO} /> : '–'}</td>
                  <td style={{ ...PRINT_TD, textAlign: 'center', fontWeight: 600 }}>{fmtBRL(r.pocoficina)}</td>
                  <td style={{ ...PRINT_TD, textAlign: 'center', color: '#6b7280' }}>{r.mpo > 0 ? fmtBRL(r.mpo) : '–'}</td>
                  <td style={{ ...PRINT_TD, textAlign: 'center' }}>{pctPO != null ? <StatusBadge pct={pctPO} /> : '–'}</td>
                  <td style={{ ...PRINT_TD, textAlign: 'center' }}>{r.passagens ?? 0}</td>
                  <td style={{ ...PRINT_TD, textAlign: 'center', color: '#6b7280' }}>{r.hoje > 0 ? fmtBRL(r.hoje) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
