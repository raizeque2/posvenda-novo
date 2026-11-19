// Cloudflare Turnstile — verificação no servidor (Siteverify).
//
// O token do widget é de uso único e só vale com a chave secreta, que fica no
// Secret Manager do Firebase (TURNSTILE_SECRET) e nunca chega ao navegador.
// Qualquer falha — segredo ausente, rede, ação ou hostname diferente — recusa
// o pedido (fail-closed).
import { defineSecret, defineString } from 'firebase-functions/params'
import { HttpsError } from 'firebase-functions/v2/https'

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
export const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET')
// Lista separada por vírgula, ex.: "posvenda-bi.web.app,posvenda-bi.firebaseapp.com".
export const TURNSTILE_HOSTNAMES = defineString('TURNSTILE_HOSTNAMES', { default: 'posvenda-bi.web.app,posvenda-bi.firebaseapp.com' })
export const TURNSTILE_ACTIONS = ['login', 'cadastro', 'reset_senha', 'portal_login']

const MENSAGEM = 'Não foi possível confirmar a verificação de segurança. Atualize a verificação e tente novamente.'

export function parseHostnames(value) {
  return String(value || '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean)
}

/**
 * Verifica um token. Função pura (fetch injetável) para teste.
 * Retorna { ok: true } ou { ok: false, motivo }.
 */
export async function verifyTurnstileToken({ token, action, secret, hostnames, remoteip, fetchImpl = globalThis.fetch, timeoutMs = 10000 }) {
  if (!secret) return { ok: false, motivo: 'segredo-ausente' }
  if (!TURNSTILE_ACTIONS.includes(action)) return { ok: false, motivo: 'acao-invalida' }
  if (typeof token !== 'string' || !token || token.length > 2048) return { ok: false, motivo: 'token-invalido' }
  if (!hostnames?.length) return { ok: false, motivo: 'hostnames-ausentes' }
  const body = new URLSearchParams({ secret, response: token })
  if (remoteip) body.set('remoteip', remoteip)
  let result
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return { ok: false, motivo: `http-${response.status}` }
    result = await response.json()
  } catch {
    return { ok: false, motivo: 'rede' }
  }
  if (result?.success !== true) return { ok: false, motivo: (result?.['error-codes'] || []).join(',') || 'rejeitado' }
  if (result.action !== action) return { ok: false, motivo: 'acao-divergente' }
  if (!hostnames.includes(String(result.hostname || '').toLowerCase())) return { ok: false, motivo: 'hostname-divergente' }
  return { ok: true }
}

/** Uso dentro de uma callable: lança HttpsError se o token não passar. */
export async function requireTurnstile(request, action) {
  let secret = ''
  try { secret = TURNSTILE_SECRET.value() } catch { secret = '' }
  const result = await verifyTurnstileToken({
    token: request.data?.turnstileToken,
    action,
    secret,
    hostnames: parseHostnames(TURNSTILE_HOSTNAMES.value()),
    remoteip: request.rawRequest?.ip,
  })
  if (!result.ok) {
    if (result.motivo === 'segredo-ausente') console.error('TURNSTILE_SECRET não configurado; pedido recusado.')
    throw new HttpsError('failed-precondition', MENSAGEM, { turnstile: true })
  }
}
