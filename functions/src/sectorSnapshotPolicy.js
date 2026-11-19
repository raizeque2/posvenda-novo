import { createHash, timingSafeEqual } from 'node:crypto'

export function sectorSnapshotData(snapshot, config, request, now = new Date()) {
  const state = String(request?.estado || '').toUpperCase(), type = String(request?.tipo || '').toLowerCase(), token = request?.token
  const invalid = () => { throw Error('Este link está inválido, revogado ou expirado. Solicite um endereço atualizado ao responsável.') }
  if (!['AL', 'PE'].includes(state) || !['pecas', 'oficina'].includes(type) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return invalid()
  const slot = config?.configs?.[`${state}-${type}`]
  if (!snapshot || slot?.ativo === false) return invalid()
  const secret = slot?.chaveOverride || config?.chaveSecreta
  if (typeof secret !== 'string' || !secret) return invalid()
  const month = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: '2-digit', year: 'numeric' }).format(now)
  const expected = createHash('sha256').update(`${secret}::${state}::${type}::${month}`).digest('hex')
  const actual = Buffer.from(token), comparison = Buffer.from(expected)
  if (!timingSafeEqual(actual, comparison) || snapshot.mes !== month || snapshot.tipo !== type || snapshot.estado && snapshot.estado !== state) return invalid()
  return Object.fromEntries(['mes', 'estado', 'tipo', 'dataAtualizacao', 'dataRef', 'ts', 'diasMes', 'diasDec', 'kpis', 'canais', 'consultores', 'mecanicos'].filter(key => snapshot[key] !== undefined).map(key => [key, snapshot[key]]))
}
