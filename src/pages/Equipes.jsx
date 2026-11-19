import { fmtBRL, fmtPct } from '../utils/formatacao.js'
import { FiltroDropdown, FiltroAnoMes, EmptyState } from '../components/DS.jsx'
import { Trophy, CheckCircle2, Users } from '../icons/iconoir'
import { useEquipes } from './equipes/useEquipes.js'
import { MetricTypeCard, ProgressBar, KpiGlobalRanking } from './equipes/EquipesUI.jsx'
import { titleCase, pctColor } from './equipes/equipes.logic.js'
import { SupervisorTrajectory } from './equipes/SupervisorTrajectory.jsx'

export default function Equipes() {
  const e = useEquipes()

  return (
    <div className="page">
      <div className="filters-bar">
        <FiltroAnoMes meses={e.mesesDisp} value={e.filtroMes} onChange={v => e.setFiltrosGlobais({ mes: v })} />
        <span className="dash-bar-sep" />
        <FiltroDropdown label="Estado" options={e.estadoOpts} value={e.filtroUF}
          onChange={v => e.setFiltrosGlobais({ estado: v === e.filtroUF ? '' : v, lojas: [] })} />
        <FiltroDropdown label="Loja" options={e.lojaOpts} value={e.filtroLoja}
          onChange={v => e.setFiltrosGlobais({ lojas: v })} multi />
        <FiltroDropdown label="Supervisor" options={e.supOpts} value={e.filtroSupervisor}
          onChange={v => e.setFiltroSupervisor(v === e.filtroSupervisor ? '' : v)} />
        {e.temFiltro && <button className="filter-clear" onClick={e.clearFiltros}>✕</button>}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 8, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => e.setOrdenacao(o => o === 'meta' ? 'alpha' : 'meta')}
          title={e.ordenacao === 'meta' ? 'Ordenado por % de meta — clique para ordenar A→Z' : 'Ordenado A→Z — clique para ordenar por % de meta'}
        >
          {e.ordenacao === 'meta' ? '↓ % Meta' : '↓ A→Z'}
        </button>
      </div>

      {e.equipes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`Nenhuma equipe encontrada para ${e.mesAtivo || 'o período'}.`}
          sub="Verifique se os colaboradores têm supervisor definido na aba Colaboradores."
        />
      ) : (
        <>
          <SupervisorTrajectory teams={e.equipes} daysElapsed={e.diasDec} daysInMonth={e.diasMes} />
          {!e.filtroSupervisor && <KpiGlobalRanking equipes={e.equipesAll} />}

          {e.equipes.map(eq => {
            const open = e.abertos[eq.supervisor] !== false
            const metricas = [
              eq.metaP   > 0 && { label: 'PEÇAS',    pct: eq.pctP,   projPct: eq.projPctP   },
              eq.metaMO  > 0 && { label: 'M.O',       pct: eq.pctMO,  projPct: eq.projPctMO  },
              eq.metaMPO > 0 && { label: 'PEÇAS O.S', pct: eq.pctMPO, projPct: eq.projPctMPO },
            ].filter(Boolean)
            const bateuTudo   = metricas.length > 0 && metricas.every(m => (m.pct ?? 0) >= 1)
            const bateuAlgum  = metricas.some(m => (m.pct ?? 0) >= 1)
            return (
              <div key={eq.supervisor} className="card" style={{ marginBottom: 10 }}>
                <div
                  className="card-header"
                  style={{ cursor: 'pointer', userSelect: 'none', marginBottom: open ? 8 : 0 }}
                  onClick={() => e.toggleAberto(eq.supervisor)}
                >
                  <span className="card-title">{titleCase(eq.supervisor)}</span>
                  {bateuTudo
                    ? <Trophy size={13} strokeWidth={1.75} style={{ color: '#f59e0b' }} title="Todas as metas atingidas" />
                    : bateuAlgum && <CheckCircle2 size={13} strokeWidth={1.75} style={{ color: 'var(--green)' }} title="Meta parcialmente atingida" />
                  }
                  <span className="badge badge-gray" style={{ fontWeight: 'var(--weight-normal)' }}>
                    {eq.membros.length} membro{eq.membros.length !== 1 ? 's' : ''}
                  </span>
                  {eq.lojas.slice(0, 5).map(l => <span key={l} className="badge badge-blue">{l}</span>)}
                  {eq.lojas.length > 5 && <span className="badge badge-gray">+{eq.lojas.length - 5}</span>}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
                    {metricas.map(m => (
                      <span key={m.label} style={{ fontSize: 'var(--text-sm2)' }}>
                        {m.label} <strong style={{ color: pctColor(m.pct) }}>{fmtPct(m.pct)}</strong>
                      </span>
                    ))}
                    {eq.comissao > 0 && (
                      <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>
                        Com. <strong>{fmtBRL(eq.comissao)}</strong>
                      </span>
                    )}
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', minWidth: 14 }}>{open ? '▲' : '▼'}</span>
                  </div>
                </div>

                {metricas.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, padding: '0 16px 10px', flexWrap: 'wrap' }}>
                    {metricas.map(m => (
                      <ProgressBar key={m.label} label={m.label} pct={m.pct} projPct={m.projPct} />
                    ))}
                  </div>
                )}

                {open && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {eq.metaP > 0 && (
                      <MetricTypeCard label="PEÇAS" metricKey="pecas" diasDec={e.diasDec}
                        real={eq.tp} meta={eq.metaP} proj={eq.projP} pct={eq.pctP} projPct={eq.projPctP}
                        porLoja={eq.porLoja} />
                    )}
                    {eq.metaMO > 0 && (
                      <MetricTypeCard label="MÃO DE OBRA" metricKey="mo" diasDec={e.diasDec}
                        real={eq.realMO} meta={eq.metaMO} proj={eq.projMO} pct={eq.pctMO} projPct={eq.projPctMO}
                        porLoja={eq.porLoja} />
                    )}
                    {eq.metaMPO > 0 && (
                      <MetricTypeCard label="PEÇAS O.S" metricKey="mpo" diasDec={e.diasDec}
                        real={eq.realMPO} meta={eq.metaMPO} proj={eq.projMPO} pct={eq.pctMPO} projPct={eq.projPctMPO}
                        porLoja={eq.porLoja} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {e.semSupervisor.length > 0 && (
        <p className="note" style={{ marginTop: 16 }}>
          {e.semSupervisor.length} colaborador{e.semSupervisor.length !== 1 ? 'es' : ''} com meta mas sem supervisor: {e.semSupervisor.map(c => c.nome).join(', ')}
        </p>
      )}
    </div>
  )
}
