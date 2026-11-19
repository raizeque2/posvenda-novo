import {useAtacadoConfig} from '../../services/atacadoConfig.js'
import { ValorInput } from '../../components/AnalysisDS.jsx'

/**
 * Aba de Configurações → Atacado. Os cortes de inatividade (30/90/180) e o
 * limiar de queda de frequência são parâmetros globais, salvos pelo mesmo
 * mecanismo do resto das configs (salvarAtacadoConfig → salvarConfigSeguro).
 * Não é tela nova — é uma aba da página Configurações que já existe.
 */
const CAMPOS = [
  { key: 'corte1', label: 'Inativo — nível 1', sufixo: 'dias', min: 1, max: 3650, ajuda: 'Sem compra há mais de N dias' },
  { key: 'corte2', label: 'Inativo — nível 2', sufixo: 'dias', min: 1, max: 3650, ajuda: 'Sem compra há mais de N dias' },
  { key: 'corte3', label: 'Inativo — nível 3', sufixo: 'dias', min: 1, max: 3650, ajuda: 'Sem compra há mais de N dias' },
  { key: 'quedaPct', label: 'Queda de frequência', sufixo: '%', min: 1, max: 100, ajuda: 'Queda mínima do mês atual vs média dos 3 anteriores para sinalizar' },
]

export function TabelaAtacadoConfig({ canEdit }) {
  const {value:atacadoConfig,save:salvarAtacadoConfig,error}=useAtacadoConfig()

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-header">
        <span role="status">{error}</span><span className="card-title">Parâmetros de inatividade — Atacado</span>
        {!canEdit && <span className="badge badge-gray" style={{ marginLeft: 'var(--space-sm)' }}>Somente leitura</span>}
      </div>
      <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {CAMPOS.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{ width: 180 }}>
              <div style={{ fontSize: 'var(--text-sm3)', fontWeight: 'var(--weight-semibold)' }}>{c.label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>{c.ajuda}</div>
            </div>
            <ValorInput tipo="inteiro" readOnly={!canEdit} min={c.min} max={c.max} largura={72}
              value={atacadoConfig[c.key]}
              onSave={v => salvarAtacadoConfig({ ...atacadoConfig, [c.key]: Number(v) || c.min })} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>{c.sufixo}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


