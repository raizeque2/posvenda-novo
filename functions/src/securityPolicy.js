import { SETORES } from './tabPolicy.js'
export const roles = ['admin', 'coordenador', 'supervisor', 'operacional']
export const isActiveProfile = profile => !!profile && profile.ativo !== false && roles.includes(profile.role)
export const canImport = profile => isActiveProfile(profile) && ['admin', 'coordenador'].includes(profile.role)
export function validateImport(data) {
  if (!data || !['pecas', 'oficina'].includes(data.tipo) || typeof data.csvText !== 'string' || data.csvText.length < 10 || Buffer.byteLength(data.csvText, 'utf8') > 8000000) throw Error('CSV inválido: limite de 8 MB.')
  if (data.retroativo !== undefined && typeof data.retroativo !== 'boolean') throw Error('Modo retroativo inválido.')
  if (data.motivo !== undefined && (typeof data.motivo !== 'string' || data.motivo.length > 500)) throw Error('Motivo inválido: limite de 500 caracteres.')
  if (data.retroativo && !data.motivo?.trim()) throw Error('Upload retroativo exige um motivo da correção.')
  return { tipo: data.tipo, csvText: data.csvText, retroativo: data.retroativo === true, motivo: data.motivo?.trim() || '' }
}
export function validateAccount(data) {
  if (!data || typeof data.acao !== 'string') throw Error('Ação inválida.')
  if (data.uid !== undefined && (typeof data.uid !== 'string' || !data.uid || data.uid.length > 128 || data.uid.includes('/'))) throw Error('Identificador inválido.')
  if (data.role !== undefined && !roles.includes(data.role)) throw Error('Cargo inválido.')
  if (data.nome !== undefined && (typeof data.nome !== 'string' || !data.nome.trim() || data.nome.trim().length > 100)) throw Error('Nome inválido.')
  if (data.email !== undefined && (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) throw Error('E-mail inválido.')
  if (data.estados != null && (!Array.isArray(data.estados) || !data.estados.length || data.estados.length > 2 || data.estados.some(uf => !['AL', 'PE'].includes(uf)))) throw Error('Estados inválidos.')
  if (data.setor !== undefined && data.setor !== null && !SETORES.includes(data.setor)) throw Error('Setor inválido.')
  if (data.senha !== undefined && (typeof data.senha !== 'string' || data.senha.length < 8 || data.senha.length > 128)) throw Error('Senha deve ter entre 8 e 128 caracteres.')
  if (data.solicitacao !== undefined && (typeof data.solicitacao !== 'string' || !/^[0-9a-f]{64}$/.test(data.solicitacao))) throw Error('Solicitação inválida.')
  return data
}
