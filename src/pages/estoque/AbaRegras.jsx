import { useState } from 'react'
import { salvarRegrasEstoque } from '../../services/cloudStorage.js'
import { CardHead, SaveBar } from '../../components/DS.jsx'

export function AbaRegras({ thresholds, setThresholds, descontosPorTipo, setDescontosPorTipo, diasTransferiveis, setDiasTransferiveis, todosTipos, canEdit }) {
  const [local, setLocal]             = useState(thresholds)
  const [localTipos, setLocalTipos]   = useState(descontosPorTipo || {})
  const [localDias, setLocalDias]     = useState(diasTransferiveis || 90)
  const [salvando, setSalvando]       = useState(false)
  const [salvo, setSalvo]             = useState(false)

  async function salvar() {
    setSalvando(true); setSalvo(false)
    try {
      await salvarRegrasEstoque({ ...local, descontosPorTipo: localTipos, diasTransferiveis: localDias })
      setThresholds(local)
      setDescontosPorTipo(localTipos)
      setDiasTransferiveis(localDias)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 3000)
    } finally { setSalvando(false) }
  }

  const curvas = [
    { key: 'curvaA', label: 'Curva A', sub: 'Alto Giro',   cor: 'var(--green)', de: 0,             ate: local.curvaA },
    { key: 'curvaB', label: 'Curva B', sub: 'Giro Normal', cor: '#2563eb', de: local.curvaA+1, ate: local.curvaB },
    { key: 'curvaC', label: 'Curva C', sub: 'Alerta',      cor: 'var(--amber)', de: local.curvaB+1, ate: local.curvaC },
    { key: 'curvaD', label: 'Curva D', sub: 'Obsoleto',    cor: '#ea580c', de: local.curvaC+1, ate: local.curvaD },
  ]

  const sujo = JSON.stringify(local) !== JSON.stringify(thresholds) ||
               JSON.stringify(localTipos) !== JSON.stringify(descontosPorTipo || {}) ||
               localDias !== (diasTransferiveis || 90)

  function descartar() {
    setLocal(thresholds)
    setLocalTipos(descontosPorTipo || {})
    setLocalDias(diasTransferiveis || 90)
  }

  return (
    <div>
      {canEdit && (
        <SaveBar
          visivel={sujo}
          salvo={salvo}
          loading={salvando}
          onSalvar={salvar}
          onDescartar={descartar}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 12 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Faixas das curvas</span>
            {!canEdit && <span className="badge badge-gray" style={{ marginLeft: 8 }}>Somente leitura</span>}
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {curvas.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: f.cor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}><span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)' }}>{f.label}</span><span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginLeft: 6 }}>{f.sub}</span></div>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>{f.de}d –</span>
                {canEdit ? (
                  <input type="number" className="form-input" style={{ width: 64, fontSize: 'var(--text-base)', textAlign: 'center' }}
                    value={local[f.key]} min={1} max={3650}
                    onChange={e => setLocal(p => ({ ...p, [f.key]: Number(e.target.value) }))} />
                ) : (
                  <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', minWidth: 36, textAlign: 'center' }}>{local[f.key]}</span>
                )}
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>d</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#e4032e', flexShrink: 0 }} />
              <div style={{ flex: 1 }}><span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)' }}>Curva E</span><span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginLeft: 6 }}>Inativo</span></div>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>acima de {local.curvaD}d</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ minWidth: 200 }}>
          <CardHead title="Transferíveis" />
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>Janela de vendas para sugestão de lojas</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {canEdit ? (
                <input type="number" className="form-input" style={{ width: 70, fontSize: 'var(--text-base)', textAlign: 'center' }}
                  value={localDias} min={7} max={365}
                  onChange={e => setLocalDias(Number(e.target.value))} />
              ) : (
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>{localDias}</span>
              )}
              <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>dias</span>
            </div>
          </div>
        </div>
      </div>

      {todosTipos?.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <CardHead title="Descontos por tipo de mercadoria" badge="Curva D e E" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'center', width: 110 }}>Desconto D %</th>
                  <th style={{ textAlign: 'center', width: 110 }}>Desconto E %</th>
                </tr>
              </thead>
              <tbody>
                {todosTipos.map(tipo => {
                  const cfg = localTipos[tipo] || {}
                  return (
                    <tr key={tipo}>
                      <td style={{ fontSize: 'var(--text-sm2)' }}>{tipo}</td>
                      <td style={{ textAlign: 'center' }}>
                        {canEdit ? (
                          <input type="number" className="form-input" style={{ width: 64, fontSize: 'var(--text-sm2)', textAlign: 'center' }}
                            value={cfg.descontoD ?? ''} placeholder="—" min={0} max={100}
                            onChange={e => setLocalTipos(p => ({ ...p, [tipo]: { ...(p[tipo]||{}), descontoD: e.target.value === '' ? null : Number(e.target.value) } }))} />
                        ) : (
                          <span style={{ fontWeight: 'var(--weight-semibold)' }}>{cfg.descontoD != null ? `${cfg.descontoD}%` : '—'}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {canEdit ? (
                          <input type="number" className="form-input" style={{ width: 64, fontSize: 'var(--text-sm2)', textAlign: 'center' }}
                            value={cfg.descontoE ?? ''} placeholder="—" min={0} max={100}
                            onChange={e => setLocalTipos(p => ({ ...p, [tipo]: { ...(p[tipo]||{}), descontoE: e.target.value === '' ? null : Number(e.target.value) } }))} />
                        ) : (
                          <span style={{ fontWeight: 'var(--weight-semibold)' }}>{cfg.descontoE != null ? `${cfg.descontoE}%` : '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ padding: '12px 16px', fontSize: 'var(--text-sm2)', color: 'var(--text2)', lineHeight: 1.7 }}>
          <strong>Como funciona:</strong> O sistema usa o movimento mais recente entre entrada e saída de cada item.
          Curva A–C não são obsoletos. Curva D+E são obsoletos. O desconto por tipo é informativo e pode ser usado para promoções personalizadas.
        </div>
      </div>
    </div>
  )
}
