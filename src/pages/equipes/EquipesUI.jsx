import { useState } from 'react'
import { fmtBRL, fmtPct } from '../../utils/formatacao.js'
import { StatusBadge } from '../../components/DS.jsx'
import { Trophy } from '../../icons/iconoir'
import { pctColor, fazPecasFn, fazOSFn } from './equipes.logic.js'

function LojaMetricRow({ loja, metricKey, diasDec, showMecs }) {
  const [open,     setOpen]     = useState(false)
  const [detalhes, setDetalhes] = useState(false)

  let real, meta, members, mecMembers
  if (metricKey === 'pecas') {
    real = loja.tp; meta = loja.metaP
    members    = loja.membros.filter(m => fazPecasFn(m) && (m.tp > 0 || m.mp > 0))
    mecMembers = []
  } else if (metricKey === 'mo') {
    real = loja.realMO; meta = loja.metaMO
    members    = loja.membros.filter(m => fazOSFn(m) && (m.moreal > 0 || m.mo > 0))
    mecMembers = loja.mecanicos.filter(m => m.moreal > 0 || m.mo > 0)
  } else {
    real = loja.realMPO; meta = loja.metaMPO
    members    = loja.membros.filter(m => fazOSFn(m) && ((m.pocoficina - (m.devPocoficina || 0)) > 0 || m.mpo > 0))
    mecMembers = loja.mecanicos.filter(m => (m.pocoficina - (m.devPocoficina || 0)) > 0 || m.mpo > 0)
  }

  if (members.length === 0 && mecMembers.length === 0) return null
  const pct = meta > 0 ? real / meta : null

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', cursor: 'pointer', fontSize: 'var(--text-base)' }}>
        <span className="badge badge-blue" style={{ minWidth: 66, textAlign: 'center' }}>{loja.loja}</span>
        <span style={{ color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>
          {members.length} membro{members.length !== 1 ? 's' : ''}
          {showMecs && mecMembers.length > 0 && <span style={{ opacity: .6 }}> · {mecMembers.length} mecânico{mecMembers.length !== 1 ? 's' : ''}</span>}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-sm2)' }}>
            {fmtBRL(real)}{meta > 0 ? <span style={{ color: 'var(--text3)' }}> / {fmtBRL(meta)}</span> : ''}
          </span>
          <span style={{ fontWeight: 'var(--weight-bold)', color: pctColor(pct), minWidth: 40, textAlign: 'right' }}>{fmtPct(pct)}</span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', minWidth: 14 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="table-wrap" style={{ paddingBottom: 6 }}>
          {metricKey !== 'pecas' && (
            <div style={{ textAlign: 'right', padding: '0 16px 4px' }}>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 'var(--text-xs)' }} onClick={e => { e.stopPropagation(); setDetalhes(v => !v) }}>
                {detalhes ? 'Ocultar' : 'Expandir'}
              </button>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>Colaborador</th><th>Cargo</th>
                {metricKey === 'pecas' && <><th>Meta</th><th>Realizado</th><th>%</th><th>Proj.</th><th>TM</th></>}
                {metricKey === 'mo'    && <><th>Meta MO</th><th>Real MO</th><th>%</th><th>Proj MO</th><th>Pass.</th>{detalhes && <><th>TM MO</th><th>TM Pç OS</th><th>Pç÷MO</th><th>PMD</th></>}</>}
                {metricKey === 'mpo'   && <><th>Meta Pç OS</th><th>Real Pç OS</th><th>%</th><th>Proj</th>{detalhes && <><th>TM Pç OS</th><th>Pass.</th></>}</>}
              </tr>
            </thead>
            <tbody>
              {members.slice().sort((a, b) => {
                if (metricKey === 'pecas') return b.tp - a.tp
                if (metricKey === 'mo')   return b.moreal - a.moreal
                return (b.pocoficina - (b.devPocoficina || 0)) - (a.pocoficina - (a.devPocoficina || 0))
              }).map(m => {
                const pocLiq = m.pocoficina - (m.devPocoficina || 0)
                if (metricKey === 'pecas') {
                  const p = m.mp > 0 ? m.tp / m.mp : null
                  return (
                    <tr key={m.nome}>
                      <td style={{ fontWeight: 'var(--weight-semibold)' }}>{m.nome}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>{m.cargoMovimento || '–'}</span></td>
                      <td className="text-muted">{m.mp ? fmtBRL(m.mp) : '–'}</td>
                      <td style={{ fontWeight: 'var(--weight-semibold)' }}>{fmtBRL(m.tp)}</td>
                      <td style={{ fontWeight: 'var(--weight-semibold)', color: pctColor(p) }}>{fmtPct(p)}</td>
                      <td className="text-muted">{m.projP > 0 ? fmtBRL(m.projP) : '–'}</td>
                      <td className="text-muted">{m.nrReq > 0 ? fmtBRL(m.tp / m.nrReq) : '–'}</td>
                    </tr>
                  )
                }
                if (metricKey === 'mo') {
                  const p = m.mo > 0 ? m.moreal / m.mo : null
                  const pass = m.passagens ?? 0
                  return (
                    <tr key={m.nome}>
                      <td style={{ fontWeight: 'var(--weight-semibold)' }}>{m.nome}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>{m.cargoMovimento || '–'}</span></td>
                      <td className="text-muted">{m.mo ? fmtBRL(m.mo) : '–'}</td>
                      <td style={{ fontWeight: 'var(--weight-semibold)' }}>{fmtBRL(m.moreal)}</td>
                      <td style={{ fontWeight: 'var(--weight-semibold)', color: pctColor(p) }}>{fmtPct(p)}</td>
                      <td className="text-muted">{m.projMO > 0 ? fmtBRL(m.projMO) : '–'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{pass}</td>
                      {detalhes && <>
                        <td className="text-muted">{pass > 0 ? fmtBRL(m.moreal / pass) : '–'}</td>
                        <td className="text-muted">{pass > 0 ? fmtBRL(pocLiq / pass) : '–'}</td>
                        <td className="text-muted">{m.moreal > 0 ? (pocLiq / m.moreal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}</td>
                        <td className="text-muted">{diasDec > 0 && pass ? (pass / diasDec).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–'}</td>
                      </>}
                    </tr>
                  )
                }
                const p = m.mpo > 0 ? pocLiq / m.mpo : null
                const pass = m.passagens ?? 0
                return (
                  <tr key={m.nome}>
                    <td style={{ fontWeight: 'var(--weight-semibold)' }}>{m.nome}</td>
                    <td><span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>{m.cargoMovimento || '–'}</span></td>
                    <td className="text-muted">{m.mpo ? fmtBRL(m.mpo) : '–'}</td>
                    <td style={{ fontWeight: 'var(--weight-semibold)' }}>{fmtBRL(pocLiq)}</td>
                    <td style={{ fontWeight: 'var(--weight-semibold)', color: pctColor(p) }}>{fmtPct(p)}</td>
                    <td className="text-muted">{m.projPecasOS > 0 ? fmtBRL(m.projPecasOS) : '–'}</td>
                    {detalhes && <>
                      <td className="text-muted">{pass > 0 ? fmtBRL(pocLiq / pass) : '–'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{pass}</td>
                    </>}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {showMecs && mecMembers.length > 0 && (
            <>
              <div style={{ padding: '6px 16px 2px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border)' }}>
                Mecânicos
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th><th>Cargo</th>
                    {metricKey === 'mo'  && <><th>Meta MO</th><th>Real MO</th><th>%</th><th>Proj MO</th><th>Pass.</th></>}
                    {metricKey === 'mpo' && <><th>Meta Pç OS</th><th>Real Pç OS</th><th>%</th><th>Proj</th></>}
                  </tr>
                </thead>
                <tbody>
                  {mecMembers.slice().sort((a, b) =>
                    metricKey === 'mo'
                      ? b.moreal - a.moreal
                      : (b.pocoficina - (b.devPocoficina || 0)) - (a.pocoficina - (a.devPocoficina || 0))
                  ).map(m => {
                    const pocLiq = m.pocoficina - (m.devPocoficina || 0)
                    if (metricKey === 'mo') {
                      const p = m.mo > 0 ? m.moreal / m.mo : null
                      return (
                        <tr key={m.nome}>
                          <td style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text2)' }}>{m.nome}</td>
                          <td><span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>{m.cargoMovimento || '–'}</span></td>
                          <td className="text-muted">{m.mo ? fmtBRL(m.mo) : '–'}</td>
                          <td style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text2)' }}>{fmtBRL(m.moreal)}</td>
                          <td style={{ fontWeight: 'var(--weight-semibold)', color: pctColor(p) }}>{fmtPct(p)}</td>
                          <td className="text-muted">{m.projMO > 0 ? fmtBRL(m.projMO) : '–'}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text2)' }}>{m.passagens ?? 0}</td>
                        </tr>
                      )
                    }
                    const p = m.mpo > 0 ? pocLiq / m.mpo : null
                    return (
                      <tr key={m.nome}>
                        <td style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text2)' }}>{m.nome}</td>
                        <td><span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>{m.cargoMovimento || '–'}</span></td>
                        <td className="text-muted">{m.mpo ? fmtBRL(m.mpo) : '–'}</td>
                        <td style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text2)' }}>{fmtBRL(pocLiq)}</td>
                        <td style={{ fontWeight: 'var(--weight-semibold)', color: pctColor(p) }}>{fmtPct(p)}</td>
                        <td className="text-muted">{m.projPecasOS > 0 ? fmtBRL(m.projPecasOS) : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function MetricTypeCard({ label, real, meta, proj, pct, projPct, porLoja, metricKey, diasDec }) {
  const [open, setOpen] = useState(false)
  const activeLoja = porLoja.filter(l => {
    if (metricKey === 'pecas') return l.tp > 0 || l.metaP > 0
    if (metricKey === 'mo')    return l.realMO > 0 || l.metaMO > 0
    return l.realMPO > 0 || l.metaMPO > 0
  })
  if (activeLoja.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header" onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <span className="card-title">{label}</span>
        <span className="badge badge-gray">{activeLoja.length} unidade{activeLoja.length !== 1 ? 's' : ''}</span>
        <span className="card-total">
          <strong style={{ color: pctColor(pct) }}>{fmtBRL(real)}</strong>
          {meta > 0 && <span style={{ color: 'var(--text3)' }}> / {fmtBRL(meta)}</span>}
          {pct !== null && <span style={{ marginLeft: 10, fontWeight: 'var(--weight-bold)', color: pctColor(pct) }}>{fmtPct(pct)}</span>}
        </span>
        {proj > 0 && projPct !== null && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>↗ {fmtBRL(proj)} <StatusBadge pct={projPct} /></span>
        )}
        <button className="btn btn-ghost btn-sm no-print" style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)' }}
          onClick={e => { e.stopPropagation(); setOpen(v => !v) }}>
          {open ? '▲' : '▼'}
        </button>
      </div>
      {open && activeLoja.map(loja => (
        <LojaMetricRow key={loja.loja} loja={loja} metricKey={metricKey} diasDec={diasDec} />
      ))}
    </div>
  )
}

export function ProgressBar({ label, pct, projPct }) {
  const pctSafe = Math.min(pct ?? 0, 1.5)
  const cor = pct >= 1 ? 'var(--green)' : pct >= 0.8 ? 'var(--amber)' : 'var(--honda)'
  const corProj = projPct >= 1 ? 'var(--green)' : projPct >= 0.8 ? 'var(--amber)' : 'var(--honda)'
  const showProj = projPct !== null && projPct > 0 && Math.abs((projPct ?? 0) - (pct ?? 0)) > 0.01
  return (
    <div style={{ minWidth: 120, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text3)', marginBottom: 3 }}>
        <span style={{ fontWeight: 'var(--weight-bold)', letterSpacing: 0.3 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 'var(--weight-bold)', color: cor }}>{fmtPct(pct)}</span>
          {showProj && <span style={{ color: corProj, opacity: 0.75 }}>↗ {fmtPct(projPct)}</span>}
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg3)', position: 'relative' }}>
        <div style={{ height: '100%', borderRadius: 3, background: cor, width: `${Math.min(pctSafe * 100, 100)}%`, transition: 'width 0.5s ease' }} />
        {showProj && (
          <div style={{ position: 'absolute', top: -2, left: `${Math.min((projPct ?? 0) * 100, 100)}%`, height: 10, width: 2, background: corProj, borderRadius: 1, transform: 'translateX(-1px)' }} />
        )}
      </div>
    </div>
  )
}

function KpiMiniSup({ label, real, meta, proj, projPct }) {
  const pct = meta > 0 ? real / meta : null
  const cor = pct >= 1 ? 'var(--green)' : pct >= 0.8 ? 'var(--amber)' : 'var(--honda)'
  const corProj = projPct >= 1 ? 'var(--green)' : projPct >= 0.8 ? 'var(--amber)' : 'var(--honda)'
  const showProj = proj > 0 && projPct !== null && Math.abs((projPct ?? 0) - (pct ?? 0)) > 0.01
  return (
    <div style={{ flex: 1, minWidth: 140, background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(real)}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginTop: 2 }}>
        Meta {fmtBRL(meta)} · <strong style={{ color: cor }}>{fmtPct(pct)}</strong>
      </div>
      {showProj && (
        <div style={{ fontSize: 'var(--text-xs)', marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text3)' }}>↗ Proj.</span>
          <span style={{ fontWeight: 'var(--weight-semibold)', color: corProj, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(proj)}</span>
          <span style={{ color: corProj, fontWeight: 'var(--weight-bold)' }}>{fmtPct(projPct)}</span>
          {projPct >= 1 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--green)', fontWeight: 700 }}>↗</span>}
        </div>
      )}
    </div>
  )
}

export function KpiGlobalRanking({ equipes }) {
  const totP  = equipes.reduce((s, e) => s + e.tp,      0)
  const metaP = equipes.reduce((s, e) => s + e.metaP,   0)
  const projP = equipes.reduce((s, e) => s + e.projP,   0)
  const totMO = equipes.reduce((s, e) => s + e.realMO,  0)
  const metaMO  = equipes.reduce((s, e) => s + e.metaMO,  0)
  const projMO  = equipes.reduce((s, e) => s + e.projMO,  0)
  const totPO   = equipes.reduce((s, e) => s + e.realMPO, 0)
  const metaPO  = equipes.reduce((s, e) => s + e.metaMPO, 0)
  const projPO  = equipes.reduce((s, e) => s + e.projMPO, 0)

  const ranking = equipes
    .map(e => {
      const pctsDisp = [e.metaP > 0 && e.pctP, e.metaMO > 0 && e.pctMO, e.metaMPO > 0 && e.pctMPO].filter(v => v !== false && v !== null && v !== undefined)
      const projDisp = [e.metaP > 0 && e.projPctP, e.metaMO > 0 && e.projPctMO, e.metaMPO > 0 && e.projPctMPO].filter(v => v !== false && v !== null && v !== undefined)
      return { ...e, melhor: pctsDisp.length ? Math.max(...pctsDisp) : 0, melhorProj: projDisp.length ? Math.max(...projDisp) : 0 }
    })
    .sort((a, b) => b.melhor - a.melhor)

  const medalhaColor = pos => pos === 0 ? '#f59e0b' : pos === 1 ? 'var(--text3)' : pos === 2 ? '#cd7c2f' : 'var(--text3)'

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header" style={{ marginBottom: 8 }}>
        <span className="card-title">Visão Geral</span>
        <span className="badge badge-gray">{equipes.length} supervisores</span>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        {metaP  > 0 && <KpiMiniSup label="PEÇAS"    real={totP}  meta={metaP}  proj={projP}  projPct={metaP  > 0 ? projP  / metaP  : null} />}
        {metaMO > 0 && <KpiMiniSup label="M.O"       real={totMO} meta={metaMO} proj={projMO} projPct={metaMO > 0 ? projMO / metaMO : null} />}
        {metaPO > 0 && <KpiMiniSup label="PEÇAS O.S" real={totPO} meta={metaPO} proj={projPO} projPct={metaPO > 0 ? projPO / metaPO : null} />}
      </div>
      <div style={{ padding: '12px 16px 8px' }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          Ranking Supervisores
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranking.map((e, i) => {
            const cor     = e.melhor     >= 1 ? 'var(--green)' : e.melhor     >= 0.8 ? 'var(--amber)' : 'var(--honda)'
            const corProj = e.melhorProj >= 1 ? 'var(--green)' : e.melhorProj >= 0.8 ? 'var(--amber)' : 'var(--honda)'
            const showProj = e.melhorProj > 0 && Math.abs(e.melhorProj - e.melhor) > 0.01
            return (
              <div key={e.supervisor}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                  <span style={{ fontSize: 'var(--text-md)', minWidth: 24, textAlign: 'center', fontWeight: 700, color: medalhaColor(i) }}>{i + 1}°</span>
                  <span style={{ fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-semibold)', flex: 1, color: 'var(--text)' }}>{e.supervisor}</span>
                  <span style={{ fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-bold)', color: cor, minWidth: 38, textAlign: 'right' }}>{fmtPct(e.melhor)}</span>
                  {showProj && <span style={{ fontSize: 'var(--text-xs)', color: corProj, minWidth: 54, textAlign: 'right' }}>↗ {fmtPct(e.melhorProj)}</span>}
                  {e.melhor >= 1 && <Trophy size={13} strokeWidth={1.75} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                </div>
                <div style={{ display: 'flex', gap: 0, marginLeft: 34, height: 6, borderRadius: 3, background: 'var(--bg3)', position: 'relative' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: cor, width: `${Math.min(e.melhor * 100, 100)}%`, transition: 'width 0.5s ease' }} />
                  {showProj && (
                    <div style={{ position: 'absolute', top: -1, left: `${Math.min(e.melhorProj * 100, 100)}%`, height: 8, width: 2, background: corProj, borderRadius: 1, transform: 'translateX(-1px)' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
