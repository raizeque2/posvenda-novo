import { useMemo } from 'react'
import { FiltroAnoMes, EmptyState } from '../../components/DS.jsx'
import { Users } from '../../icons/iconoir'
import { fmtBRL, fmtPct } from '../../utils/formatacao.js'
import { useEquipes } from '../equipes/useEquipes.js'
import { MetricTypeCard, ProgressBar } from '../equipes/EquipesUI.jsx'
import { fazOSFn, fazPecasFn, pctColor, titleCase } from '../equipes/equipes.logic.js'
import '../../theme/operations.css'
import './portal.css'

/**
 * Painel do supervisor: a equipe é definida pelo campo "Supervisor" do
 * cadastro de colaboradores (mesma regra de Equipes.jsx e do escopo do
 * servidor). Reaproveita o hook e os cartões da página de equipes.
 */
export default function MinhaEquipe() {
  const e = useEquipes()

  const membros = useMemo(() => {
    const mapa = new Map()
    e.equipes.forEach(equipe => equipe.membros.forEach(membro => mapa.set(membro.nome, membro)))
    return [...mapa.values()].sort((a, b) => (b.tp || 0) - (a.tp || 0))
  }, [e.equipes])

  return (
    <div className="page">
      <div className="filters-bar">
        <FiltroAnoMes meses={e.mesesDisp} value={e.filtroMes} onChange={value => e.setFiltrosGlobais({ mes: value })} />
        <span className="dash-bar-sep" />
        <span className="portal-pill">{membros.length} colaborador{membros.length === 1 ? '' : 'es'} na equipe</span>
      </div>

      {e.equipes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`Nenhuma equipe encontrada para ${e.mesAtivo || 'o período'}.`}
          sub="O time é montado a partir do campo Supervisor no cadastro de colaboradores. Confira com o administrador se seu nome está preenchido lá."
        />
      ) : (
        <>
          {e.equipes.map(equipe => {
            const metricas = [
              equipe.metaP > 0 && { label: 'PEÇAS', pct: equipe.pctP, projPct: equipe.projPctP },
              equipe.metaMO > 0 && { label: 'M.O', pct: equipe.pctMO, projPct: equipe.projPctMO },
              equipe.metaMPO > 0 && { label: 'PEÇAS O.S', pct: equipe.pctMPO, projPct: equipe.projPctMPO },
            ].filter(Boolean)
            return (
              <div key={equipe.supervisor} className="card">
                <div className="card-header">
                  <span className="card-title">{titleCase(equipe.supervisor)}</span>
                  <span className="badge badge-gray" style={{ fontWeight: 'var(--weight-normal)' }}>
                    {equipe.membros.length} membro{equipe.membros.length !== 1 ? 's' : ''}
                  </span>
                  {equipe.lojas.slice(0, 5).map(loja => <span key={loja} className="badge badge-blue">{loja}</span>)}
                </div>
                {metricas.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    {metricas.map(metrica => (
                      <ProgressBar key={metrica.label} label={metrica.label} pct={metrica.pct} projPct={metrica.projPct} />
                    ))}
                  </div>
                )}
                {equipe.metaP > 0 && (
                  <MetricTypeCard label="PEÇAS" metricKey="pecas" diasDec={e.diasDec}
                    real={equipe.tp} meta={equipe.metaP} proj={equipe.projP} pct={equipe.pctP} projPct={equipe.projPctP}
                    porLoja={equipe.porLoja} />
                )}
                {equipe.metaMO > 0 && (
                  <MetricTypeCard label="MÃO DE OBRA" metricKey="mo" diasDec={e.diasDec}
                    real={equipe.realMO} meta={equipe.metaMO} proj={equipe.projMO} pct={equipe.pctMO} projPct={equipe.projPctMO}
                    porLoja={equipe.porLoja} />
                )}
                {equipe.metaMPO > 0 && (
                  <MetricTypeCard label="PEÇAS O.S" metricKey="mpo" diasDec={e.diasDec}
                    real={equipe.realMPO} meta={equipe.metaMPO} proj={equipe.projMPO} pct={equipe.pctMPO} projPct={equipe.projPctMPO}
                    porLoja={equipe.porLoja} />
                )}
              </div>
            )
          })}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Metas por colaborador</span>
              <span className="badge badge-gray">{e.mesAtivo}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Cargo</th>
                    <th>Meta peças</th>
                    <th>Realizado</th>
                    <th>%</th>
                    <th>Meta M.O</th>
                    <th>Realizado</th>
                    <th>%</th>
                    <th>Meta peças O.S</th>
                    <th>Realizado</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {membros.map(membro => {
                    const colunas = [
                      fazPecasFn(membro) ? { meta: membro.mp || 0, real: membro.tp || 0 } : null,
                      fazOSFn(membro) ? { meta: membro.mo || 0, real: membro.moreal || 0 } : null,
                      fazOSFn(membro) ? { meta: membro.mpo || 0, real: (membro.pocoficina || 0) - (membro.devPocoficina || 0) } : null,
                    ]
                    return (
                      <tr key={membro.nome}>
                        <td style={{ fontWeight: 'var(--weight-semibold)' }}>{membro.nome}</td>
                        <td><span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>{membro.cargoMovimento || '–'}</span></td>
                        {colunas.map((coluna, indice) => (
                          <CelulaMeta key={indice} coluna={coluna} />
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="note">Somente leitura. Ajustes de meta continuam com o administrador.</p>
          </div>
        </>
      )}
    </div>
  )
}

/** Três células de uma métrica: meta, realizado e %. */
function CelulaMeta({ coluna }) {
  const pct = coluna && coluna.meta > 0 ? coluna.real / coluna.meta : null
  return (
    <>
      <td className="text-muted">{coluna && coluna.meta > 0 ? fmtBRL(coluna.meta) : '–'}</td>
      <td style={{ fontWeight: 'var(--weight-semibold)' }}>{coluna ? fmtBRL(coluna.real) : '–'}</td>
      <td style={{ color: pctColor(pct), fontWeight: 'var(--weight-semibold)' }}>{fmtPct(pct)}</td>
    </>
  )
}
