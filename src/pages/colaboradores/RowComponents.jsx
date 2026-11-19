import { LOJAS } from '../../data/regras.js'
import { parseSalario } from './CellInputs.jsx'

export const CANAIS = ['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS', 'OS']

export const COLS_EDIT = [
  { key: 'apelido',      label: 'Nome nas Vendas' },
  { key: 'loja',         label: 'Loja' },
  { key: 'cargo',        label: 'Cargo' },
  { key: 'centro_custo', label: 'C. Custo' },
  { key: 'salario',      label: 'Salário' },
  { key: 'setor',        label: 'Setor' },
  { key: 'supervisor',   label: 'Supervisor' },
]
export const COLS_DEFAULT = { apelido: false, loja: true, cargo: true, centro_custo: false, salario: false, setor: true, supervisor: true }

export const FORM_VAZIO = {
  colaborador: '', apelido: '', loja: '', cargo: '',
  cargo_movimento: 'VAREJO',
  supervisor: '', salario_base: '', centro_custo: '',
}

export const SORT_FNS = {
  colaborador:     c => c.colaborador,
  apelido:         c => c.apelido || '',
  loja:            c => c.loja,
  estado:          c => LOJAS[c.loja]?.uf || '',
  cargo:           c => c.cargo || '',
  cargo_movimento: c => c.cargo_movimento,
  supervisor:      c => c.supervisor || '',
  centro_custo:    c => c.centro_custo || '',
  salario_base:    c => parseSalario(c.salario_base),
}

export function GrupoHeader({ loja, qtd, colSpan }) {
  const uf = LOJAS[loja]?.uf || ''; const un = LOJAS[loja]?.un || loja
  return (
    <tr>
      <td colSpan={colSpan} style={{
        background: 'var(--bg3)', padding: '5px 14px',
        borderTop: '2px solid var(--border2)', borderBottom: '1px solid var(--border2)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-blue" style={{ fontWeight: 'var(--weight-bold)' }}>{loja}</span>
          <span style={{ fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-semibold)', color: 'var(--text2)' }}>{un}</span>
          {uf && <span className={`badge ${uf === 'AL' ? 'badge-green' : 'badge-blue'}`} style={{ opacity: 0.65 }}>{uf}</span>}
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontWeight: 'var(--weight-normal)' }}>· {qtd} colaborador{qtd !== 1 ? 'es' : ''}</span>
        </span>
      </td>
    </tr>
  )
}

