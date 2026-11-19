import { norm } from '../../utils/normalizacao.js'

export const CANAIS_PECAS   = [{ key: 'mp',  label: 'Peças' }]
export const CANAIS_OFICINA = [{ key: 'mo',  label: 'MO' }, { key: 'mpo', label: 'Peças OS' }]
export const SETORES_PECAS   = new Set(['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS'])
export const SETORES_OFICINA = new Set(['OS'])

export const SECOES_PECAS = [
  { key: 'VAREJO',     label: 'Varejo',     canalMeta: 'VAREJO' },
  { key: 'ATACADO',    label: 'Atacado',    canalMeta: 'ATACADO' },
  { key: 'WEB',        label: 'Web',        canalMeta: 'WEB' },
  { key: 'TELEVENDAS', label: 'Televendas', canalMeta: 'TELEVENDAS' },
]
export const SECOES_OFICINA = [
  { key: 'OS_CONSULTOR', label: 'Consultores', canalMeta: 'OS' },
  { key: 'OS_MECANICO',  label: 'Mecânicos',   canalMeta: 'OS' },
]

export const CARGOS_MECANICO = new Set([
  'MECANICO', 'AUXILIAR MECANICO', 'LAVADOR', 'CHEFE DE OFICINA',
  'TERCEIRO', 'TERCEIROS', 'TERCEIRIZADO', 'TERCEIRIZADA',
])

export function getSecaoOficina(c) {
  const cargo = norm(c.cargo || '')
  const isMecanico = [...CARGOS_MECANICO].some(k => cargo.startsWith(norm(k)))
  return isMecanico ? 'OS_MECANICO' : 'OS_CONSULTOR'
}

// ── Helpers para metas por canal ──────────────────────────────────────────────

/**
 * Lê o valor de uma meta (mp/mo/mpo) para um canal específico.
 * Se o registro já tiver `metas[canal]`, usa o novo formato.
 * Caso contrário, cai nos campos legados (mp/mo/mpo) — a meta única do
 * colaborador se aplica a qualquer canal, preservando dados históricos.
 */
export function getMetaCanal(c, canal, campo) {
  if (c.metas && c.metas[canal] !== undefined) {
    return Number(c.metas[canal][campo]) || 0
  }
  return Number(c[campo]) || 0
}

/**
 * Retorna o objeto `metas` canônico para salvar no Firestore.
 * Se o registro já tiver `metas`, devolve sem alteração.
 * Se for legado (só mp/mo/mpo planos), expande os campos para cada canal
 * presente em `cargo_movimento` — o mesmo valor vai para todos os canais,
 * permitindo ao usuário diferenciar depois via UI.
 */
export function normalizarMetasColaborador(c) {
  if (c.metas) return c.metas
  const canais = (c.cargo_movimento || '').split(';').map(s => s.trim()).filter(Boolean)
  const metas = {}
  canais.forEach(canal => {
    metas[canal] = {
      mp:  Number(c.mp)  || 0,
      mo:  Number(c.mo)  || 0,
      mpo: Number(c.mpo) || 0,
    }
  })
  return metas
}
