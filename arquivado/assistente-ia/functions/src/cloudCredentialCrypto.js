import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function encryptionKey(value) {
  const key = Buffer.from(String(value || ''), 'base64')
  if (key.length !== 32) throw Error('O cofre de conexões ainda não está configurado.')
  return key
}
export function sealCredential(master, owner, id, value) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(master), iv)
  cipher.setAAD(Buffer.from(`${owner}:${id}`))
  return { version: 1, iv: iv.toString('base64'), data: Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]).toString('base64'), tag: cipher.getAuthTag().toString('base64') }
}
export function openCredential(master, owner, id, payload) {
  if (payload?.version !== 1) throw Error('Não foi possível abrir a conexão salva. Nenhum dado foi sobrescrito.')
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(master), Buffer.from(payload.iv, 'base64'))
    decipher.setAAD(Buffer.from(`${owner}:${id}`)); decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8'))
  } catch { throw Error('Não foi possível abrir a conexão salva. Nenhum dado foi sobrescrito.') }
}
export function validCredentialName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60 || /[\x00-\x1f\x7f]/.test(value)) throw Error('Informe um nome de até 60 caracteres.')
  return value.trim()
}
