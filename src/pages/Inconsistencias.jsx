import useStore from '../store.js'
import { EmptyState } from '../components/DS.jsx'
import { CheckCircle2, AlertCircle } from '../icons/iconoir'

export default function Inconsistencias() {
  const { inconsistencias } = useStore()

  const porTipo = inconsistencias.reduce((acc, inc) => {
    if (!acc[inc.tipo]) acc[inc.tipo] = []
    acc[inc.tipo].push(inc)
    return acc
  }, {})

  return (
    <div className="page">
      <div className="filters-bar dash-top-bar">
        <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>Inconsistências de importação</span>
        {inconsistencias.length > 0 && (
          <span className="badge badge-red" style={{ marginLeft: 4 }}>{inconsistencias.length}</span>
        )}
      </div>
      {inconsistencias.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nenhuma inconsistência detectada" sub="Todos os tipos de movimento e O.S. foram reconhecidos." />
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total</div>
              <div className="kpi-value">{inconsistencias.length}</div>
              <div className="kpi-sub">ocorrência(s)</div>
            </div>
            {Object.entries(porTipo).map(([tipo, items]) => (
              <div key={tipo} className="kpi-card amber">
                <div className="kpi-label">{tipo.replace(/_/g, ' ')}</div>
                <div className="kpi-value">{items.length}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Detalhamento</span>
              <span className="badge badge-red">{inconsistencias.length} ocorrência(s)</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Valor não reconhecido</th>
                    <th>Arquivo</th>
                    <th>Linha (aprox.)</th>
                    <th>Loja</th>
                  </tr>
                </thead>
                <tbody>
                  {inconsistencias.map((inc, i) => (
                    <tr key={`${inc.tipo}-${inc.valor}-${inc.arquivo}-${i}`}>
                      <td><span className="badge badge-amber">{inc.tipo.replace(/_/g, ' ')}</span></td>
                      <td style={{ fontWeight: 'var(--weight-semibold)' }}>{inc.valor}</td>
                      <td><span className={`badge ${inc.arquivo === 'PEÇAS' ? 'badge-blue' : 'badge-purple'}`}>{inc.arquivo}</span></td>
                      <td style={{ color: 'var(--text3)' }}>{inc.linha}</td>
                      <td><span className="badge badge-blue">{inc.empresa}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              Para resolver: adicione o tipo na aba <strong>Regras</strong> (em breve com edição inline)
              ou verifique se o nome no CSV bate exatamente com a regra cadastrada.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
